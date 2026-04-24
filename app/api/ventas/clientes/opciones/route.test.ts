import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getOpciones } from './route';
import { GET as getClientes } from '../route';
import { sql } from '@/lib/db';
import { getServerSession } from 'next-auth';

vi.mock('@/lib/db', () => ({ sql: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockSql = vi.mocked(sql);
const mockGetServerSession = vi.mocked(getServerSession);

const mockSession = { user: { rol: 'vendedor', empresas: [2] } };

function makeRequest(pathWithQuery: string) {
  return new Request(`http://localhost${pathWithQuery}`);
}

function getSqlTextFromFirstCall() {
  const firstArg = mockSql.mock.calls[0]?.[0] as TemplateStringsArray | string | undefined;
  if (!firstArg) return '';
  return Array.isArray(firstArg) ? firstArg.join('') : String(firstArg);
}

describe('GET /api/ventas/clientes/opciones - ciudad_alias (tests rojos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession as any);
  });

  it('Test 1 — opciones NO incluye aliases, solo canonicals', async () => {
    mockSql
      .mockResolvedValueOnce([
        { ciudad: 'CIUDAD DEL EST', pais: 'PARAGUAY' },
        { ciudad: 'IQUIQUE', pais: 'CHILE' },
      ] as any)
      .mockResolvedValueOnce([
        { alias: 'CIUDAD DEL EST', ciudad_canonical: 'CIUDAD DEL ESTE' },
      ] as any);

    const res = await getOpciones();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ciudades).toContain('CIUDAD DEL ESTE');
    expect(body.ciudades).not.toContain('CIUDAD DEL EST');
    expect(body.ciudades).toContain('IQUIQUE');
  });

  it('Test 2 — opciones no duplica canonical si ya existe en clientes', async () => {
    mockSql
      .mockResolvedValueOnce([
        { ciudad: 'CIUDAD DEL ESTE', pais: 'PARAGUAY' },
        { ciudad: 'CIUDAD DEL EST', pais: 'PARAGUAY' },
      ] as any)
      .mockResolvedValueOnce([
        { alias: 'CIUDAD DEL EST', ciudad_canonical: 'CIUDAD DEL ESTE' },
      ] as any);

    const res = await getOpciones();
    const body = await res.json();

    expect(res.status).toBe(200);
    const apariciones = (body.ciudades as string[]).filter(c => c === 'CIUDAD DEL ESTE').length;
    expect(apariciones).toBe(1);
  });

  it('Test 3 — búsqueda por ciudad canonical encuentra clientes con alias', async () => {
    mockSql.mockResolvedValueOnce([] as any);

    const res = await getClientes(
      makeRequest('/api/ventas/clientes?q=&empresaSlug=vida&ciudad=CIUDAD%20DEL%20ESTE')
    );
    const sqlText = getSqlTextFromFirstCall();

    expect(res.status).toBe(200);
    expect(mockSql).toHaveBeenCalled();
    expect(sqlText).toContain('ciudad_alias');
  });
});
