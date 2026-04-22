/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const getServerSession = jest.fn();
const sql = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => getServerSession(...args),
}));

jest.mock('@/lib/db', () => ({
  sql: (...args: any[]) => sql(...args),
}));

const FILA_5  = { id: 10, cliente_deseado_id: 5,  cliente_winfac_id: null, descripcion: 'Producto A', estado: 'pendiente', es_china: false };
const FILA_99 = { id: 20, cliente_deseado_id: 99, cliente_winfac_id: null, descripcion: 'Producto B', estado: 'pendiente', es_china: false };

function hasClienteDeseadoWhereFilter(): boolean {
  return sql.mock.calls.some((call: any[]) => {
    const firstArg = call[0];
    // El TemplateStringsArray puede ser array o array-like — unirlo todo
    const allStrings = Object.values(firstArg).join(' ');
    void allStrings;
    // Verificar que contiene el WHERE filter (no solo el JOIN)
    // El JOIN es: 'ON pd.cliente_deseado_id = cd.id' (estático, sin interpolación)
    // El WHERE filter es: 'WHERE pd.cliente_deseado_id = ${value}' (valor interpolado)
    // La diferencia: en el WHERE el segmento TERMINA en 'cliente_deseado_id = '
    const segments: string[] = Object.values(firstArg);
    return segments.some(seg =>
      seg.trimEnd().endsWith('cliente_deseado_id =') ||
      seg.trimEnd().endsWith('cliente_deseado_id =\n') ||
      /WHERE\s+pd\.cliente_deseado_id\s*=\s*$/.test(seg.trimEnd())
    );
  });
}

describe('GET /api/deseados — filtro por cliente_deseado_id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 1, rol: 'admin', empresas: [1, 2] } });
  });

  test('sin filtro — sql no inyecta WHERE de cliente_deseado_id', async () => {
    const { GET } = require('@/app/api/deseados/route');

    sql.mockResolvedValueOnce([FILA_5, FILA_99]);

    const req = new NextRequest('http://localhost/api/deseados?estado=pendiente');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    // Sin el parámetro en la URL no debe haber filtro WHERE en la query
    expect(hasClienteDeseadoWhereFilter()).toBe(false);
  });

  test('con filtro cliente_deseado_id=5 — sql incluye WHERE de cliente_deseado_id', async () => {
    const { GET } = require('@/app/api/deseados/route');

    sql.mockResolvedValueOnce([FILA_5]);

    const req = new NextRequest('http://localhost/api/deseados?estado=pendiente&cliente_deseado_id=5');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].cliente_deseado_id).toBe(5);
    // La implementación debe leer el parámetro y añadirlo al WHERE de la query
    expect(hasClienteDeseadoWhereFilter()).toBe(true);
  });

  test('con filtro cliente_deseado_id=99 sin resultados — sql incluye WHERE y data vacío', async () => {
    const { GET } = require('@/app/api/deseados/route');

    sql.mockResolvedValueOnce([]);

    const req = new NextRequest('http://localhost/api/deseados?estado=pendiente&cliente_deseado_id=99');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
    // Aunque no haya resultados, el filtro debió haberse leído y aplicado
    expect(hasClienteDeseadoWhereFilter()).toBe(true);
  });
});
