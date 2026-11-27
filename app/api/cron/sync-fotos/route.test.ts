/**
 * @jest-environment node
 */
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/cloudinary', () => ({ listarImagenesProductos: jest.fn() }));
jest.mock('@/config/feature-flags.json', () => ({ 'sync-fotos-reconciliacion': false }));

import { sql } from '@/lib/db';
import { listarImagenesProductos } from '@/lib/cloudinary';
import flags from '@/config/feature-flags.json';
import { POST } from './route';

const CLOUD = 'dxkidwxjl';
const U = (p: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/${p}`;
const FLAG = flags as unknown as Record<string, boolean>;
const sqlMock = sql as unknown as jest.Mock;
const listarMock = listarImagenesProductos as unknown as jest.Mock;

const productos = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    codigo: `COD-${i + 1}`,
    imagen_url: null,
    public_id: null,
  }));

const pagina = (recursos: { public_id: string; secure_url: string; created_at: null }[], siguiente: string | null = null) =>
  ({ recursos, siguiente });

const req = (url = 'http://localhost/api/cron/sync-fotos', auth = `Bearer ${process.env.CRON_SECRET}`) =>
  new Request(url, { method: 'POST', headers: auth ? { authorization: auth } : {} });

const updates = () =>
  sqlMock.mock.calls.filter(([s]) => Array.isArray(s) && s.join('').includes('UPDATE'));

const setup = (filas: unknown[], recursos: unknown[] = []) => {
  sqlMock.mockResolvedValue(filas);
  listarMock.mockResolvedValue(pagina(recursos as never[]));
};

beforeEach(() => {
  process.env.CRON_SECRET = 'secreto-test';
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
  FLAG['sync-fotos-reconciliacion'] = false;
  sqlMock.mockReset();
  listarMock.mockReset();
});

describe('POST /api/cron/sync-fotos', () => {
  it('21. sin Bearer o Bearer incorrecto devuelve 401 y 0 sql', async () => {
    const sinAuth = await POST(req('http://localhost/api/cron/sync-fotos', ''));
    expect(sinAuth.status).toBe(401);
    const mala = await POST(req('http://localhost/api/cron/sync-fotos', 'Bearer otro'));
    expect(mala.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('22. flag apagado: 0 UPDATE aunque no haya ?dry', async () => {
    setup(productos(1), [{ public_id: 'productos/COD-1', secure_url: U('productos/COD-1.jpg'), created_at: null }]);
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(updates()).toHaveLength(0);
  });

  it('23. flag apagado + ?dry=1: 0 UPDATE', async () => {
    setup(productos(1), [{ public_id: 'productos/COD-1', secure_url: U('productos/COD-1.jpg'), created_at: null }]);
    const res = await POST(req('http://localhost/api/cron/sync-fotos?dry=1'));
    expect(res.status).toBe(200);
    expect(updates()).toHaveLength(0);
  });

  it('24. flag encendido + ?dry=1: 0 UPDATE y plan en la respuesta', async () => {
    FLAG['sync-fotos-reconciliacion'] = true;
    setup(productos(2), [
      { public_id: 'productos/COD-1', secure_url: U('productos/COD-1.jpg'), created_at: null },
      { public_id: 'productos/COD-2', secure_url: U('productos/COD-2.jpg'), created_at: null },
    ]);
    const res = await POST(req('http://localhost/api/cron/sync-fotos?dry=1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.dry).toBe(true);
    expect(body.acciones).toBe(2);
    expect(body.muestra).toHaveLength(2);
    expect(updates()).toHaveLength(0);
  });

  it('25. flag encendido: un UPDATE por accion', async () => {
    FLAG['sync-fotos-reconciliacion'] = true;
    setup(productos(2), [
      { public_id: 'productos/COD-1', secure_url: U('productos/COD-1.jpg'), created_at: null },
      { public_id: 'productos/COD-2', secure_url: U('productos/COD-2.jpg'), created_at: null },
    ]);
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.aplicadas).toBe(2);
    expect(updates()).toHaveLength(2);
  });

  it('26. 6 paginas con cursor restante bloquea listado_incompleto y no escribe', async () => {
    FLAG['sync-fotos-reconciliacion'] = true;
    sqlMock.mockResolvedValue(productos(1));
    listarMock.mockResolvedValue(
      pagina([{ public_id: 'productos/COD-1', secure_url: U('productos/COD-1.jpg'), created_at: null }], 'siguiente')
    );
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.bloqueado).toBe('listado_incompleto');
    expect(listarMock).toHaveBeenCalledTimes(6);
    expect(updates()).toHaveLength(0);
  });

  it('27. si el listado lanza devuelve 502 sin escribir', async () => {
    sqlMock.mockResolvedValue(productos(1));
    listarMock.mockRejectedValue(new Error('cloud caido'));
    const res = await POST(req());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('cloudinary_no_disponible');
    expect(updates()).toHaveLength(0);
  });

  it('29. lee los productos antes de listar Cloudinary', async () => {
    FLAG['sync-fotos-reconciliacion'] = true;
    const orden: string[] = [];
    sqlMock.mockImplementation(async (s: TemplateStringsArray) => {
      orden.push(s.join('').includes('UPDATE') ? 'update' : 'select');
      return productos(1);
    });
    listarMock.mockImplementation(async () => {
      orden.push('listar');
      return pagina([{ public_id: 'productos/COD-1', secure_url: U('productos/COD-1.jpg'), created_at: null }]);
    });
    await POST(req('http://localhost/api/cron/sync-fotos?dry=1'));
    expect(orden[0]).toBe('select');
    expect(orden.indexOf('select')).toBeLessThan(orden.indexOf('listar'));
  });

  it('30. la foto creada antes del listado no se limpia; el recurso ausente si', async () => {
    FLAG['sync-fotos-reconciliacion'] = true;
    const conRecurso = [{
      id: 1, codigo: 'COD-1', imagen_url: U('productos/COD-1.jpg'), public_id: 'productos/COD-1',
    }];
    setup(conRecurso, [{ public_id: 'productos/COD-1', secure_url: U('productos/COD-1.jpg'), created_at: null }]);
    const ok = await (await POST(req('http://localhost/api/cron/sync-fotos?dry=1'))).json();
    expect(ok.acciones).toBe(0);

    const sinRecurso = [{
      id: 2, codigo: 'COD-2', imagen_url: U('productos/COD-2.jpg'), public_id: 'productos/COD-2',
    }];
    setup(sinRecurso, [{ public_id: 'productos/COD-1', secure_url: U('productos/COD-1.jpg'), created_at: null }]);
    const malo = await (await POST(req('http://localhost/api/cron/sync-fotos?dry=1'))).json();
    expect(malo.acciones).toBe(1);
    expect(malo.muestra[0].tipo).toBe('limpiar');
  });

  it('28. 250 acciones: 200 aplicadas y 50 pendientes', async () => {
    FLAG['sync-fotos-reconciliacion'] = true;
    const filas = productos(250);
    const recursos = filas.map((p) => ({
      public_id: `productos/${p.codigo}`,
      secure_url: U(`productos/${p.codigo}.jpg`),
      created_at: null,
    }));
    setup(filas, recursos);
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.aplicadas).toBe(200);
    expect(body.pendientes).toBe(50);
    expect(body.desincronizadas_restantes).toBe(50);
    expect(updates()).toHaveLength(200);
  });
});
