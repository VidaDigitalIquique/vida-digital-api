/**
 * @jest-environment node
 */
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  ejecutarReconciliacion,
  restaurar,
  volcarRespaldo,
  type DepsScript,
  type FilaFoto,
} from '../scripts/reconciliar-fotos';
import type { EjecutorSql } from '../lib/fotos-sync';

const CLOUD = 'demo';
const U = (p: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/${p}`;

type Evento = { tipo: 'select' | 'update' | 'respaldo' | 'listar'; texto?: string; valores?: unknown[] };

function sqlFalso(filas: FilaFoto[], eventos: Evento[] = []): EjecutorSql {
  const sql = jest.fn(async (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?');
    if (/SELECT/i.test(texto)) {
      eventos.push({ tipo: 'select', texto });
      return filas;
    }
    eventos.push({ tipo: 'update', texto, valores });
    return [];
  });
  return sql as unknown as EjecutorSql;
}

const deps = (sql: EjecutorSql, eventos: Evento[], volcar = jest.fn(() => 'ruta.json')): DepsScript => ({
  listar: async () => ({
    recursos: [{ public_id: 'productos/A', secure_url: U('productos/A.jpg'), created_at: null }],
    incompleto: false,
  }),
  sql,
  log: () => {},
  volcar,
});

const fila: FilaFoto = { id: 1, codigo: 'A', imagen_url: null, public_id: null };
const actualizaciones = (eventos: Evento[]) => eventos.filter((e) => e.tipo === 'update');

describe('scripts/reconciliar-fotos', () => {
  it('dry-run no escribe ni pide respaldo', async () => {
    const eventos: Evento[] = [];
    const volcar = jest.fn(() => 'ruta.json');
    const res = await ejecutarReconciliacion(deps(sqlFalso([fila], eventos), eventos, volcar), { aplicar: false });
    expect(res.codigo).toBe(0);
    expect(res.acciones).toBe(1);
    expect(actualizaciones(eventos)).toHaveLength(0);
    expect(volcar).not.toHaveBeenCalled();
  });

  it('--apply sin --backup falla antes de leer nada y no escribe', async () => {
    const eventos: Evento[] = [];
    const d = deps(sqlFalso([fila], eventos), eventos);
    const listar = jest.spyOn(d, 'listar');
    const res = await ejecutarReconciliacion(d, { aplicar: true });
    expect(res.codigo).toBe(1);
    expect(res.escribio).toBe(false);
    expect(listar).not.toHaveBeenCalled();
    expect(actualizaciones(eventos)).toHaveLength(0);
  });

  it('el respaldo se escribe antes del primer UPDATE', async () => {
    const eventos: Evento[] = [];
    const volcar = jest.fn(() => {
      eventos.push({ tipo: 'respaldo' });
      return 'respaldo.json';
    });
    const res = await ejecutarReconciliacion(deps(sqlFalso([fila], eventos), eventos, volcar), {
      aplicar: true,
      backup: '/tmp/backup',
    });
    expect(res.escribio).toBe(true);
    const orden = eventos.map((e) => e.tipo);
    expect(orden.indexOf('respaldo')).toBeGreaterThanOrEqual(0);
    expect(orden.indexOf('respaldo')).toBeLessThan(orden.indexOf('update'));
    expect(volcar).toHaveBeenCalledWith([fila]);
  });

  it('si el respaldo falla no se escribe nada', async () => {
    const eventos: Evento[] = [];
    const volcar = jest.fn(() => {
      throw new Error('disco lleno');
    });
    const res = await ejecutarReconciliacion(deps(sqlFalso([fila], eventos), eventos, volcar), {
      aplicar: true,
      backup: '/tmp/backup',
    });
    expect(res.codigo).toBe(1);
    expect(res.escribio).toBe(false);
    expect(actualizaciones(eventos)).toHaveLength(0);
  });

  it('bloqueado no escribe', async () => {
    const eventos: Evento[] = [];
    const volcar = jest.fn(() => 'ruta.json');
    const d = deps(sqlFalso([fila], eventos), eventos, volcar);
    d.listar = async () => ({ recursos: [], incompleto: false });
    const res = await ejecutarReconciliacion(d, { aplicar: true, backup: '/tmp/backup' });
    expect(res.bloqueado).toBe('cloudinary_vacio');
    expect(res.escribio).toBe(false);
    expect(actualizaciones(eventos)).toHaveLength(0);
    expect(volcar).not.toHaveBeenCalled();
  });

  it('lee los productos antes de listar Cloudinary', async () => {
    const eventos: Evento[] = [];
    const d = deps(sqlFalso([fila], eventos), eventos);
    d.listar = async () => {
      eventos.push({ tipo: 'listar' });
      return {
        recursos: [{ public_id: 'productos/A', secure_url: U('productos/A.jpg'), created_at: null }],
        incompleto: false,
      };
    };
    await ejecutarReconciliacion(d, { aplicar: false });
    const select = eventos.findIndex((e) => e.tipo === 'select');
    const listar = eventos.findIndex((e) => e.tipo === 'listar');
    expect(select).toBeGreaterThanOrEqual(0);
    expect(select).toBeLessThan(listar);
  });

  it('la foto creada antes del listado no se limpia; el recurso ausente si', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    const conRecurso: FilaFoto = {
      id: 1, codigo: 'A', imagen_url: U('productos/A.jpg'), public_id: 'productos/A',
    };
    const eventos: Evento[] = [];
    const con = await ejecutarReconciliacion(deps(sqlFalso([conRecurso], eventos), eventos), { aplicar: false });
    expect(con.acciones).toBe(0);

    const sinRecurso: FilaFoto = {
      id: 2, codigo: 'B', imagen_url: U('productos/B.jpg'), public_id: 'productos/B',
    };
    const eventos2: Evento[] = [];
    const sin = await ejecutarReconciliacion(deps(sqlFalso([sinRecurso], eventos2), eventos2), { aplicar: false });
    expect(sin.acciones).toBe(1);
  });

  it('restaurar devuelve imagen_url, public_id e id de cada fila', async () => {
    const eventos: Evento[] = [];
    const sql = sqlFalso([], eventos);
    const filas: FilaFoto[] = [
      { id: 7, codigo: 'X', imagen_url: 'https://x/1.jpg', public_id: 'productos/X' },
      { id: 8, codigo: 'Y', imagen_url: null, public_id: null },
    ];
    const n = await restaurar(sql, filas);
    expect(n).toBe(2);
    const ups = actualizaciones(eventos);
    expect(ups).toHaveLength(2);
    expect(ups[0].valores).toEqual(['https://x/1.jpg', 'productos/X', 7]);
    expect(ups[1].valores).toEqual([null, null, 8]);
  });

  it('no imprime secretos en la salida', async () => {
    process.env.DATABASE_URL = 'postgresql://usuario:SUPERSECRETO@host/db';
    process.env.CLOUDINARY_API_SECRET = 'SECRETO_CLOUD';
    const eventos: Evento[] = [];
    const lineas: string[] = [];
    const d = deps(sqlFalso([fila], eventos), eventos);
    d.log = (l) => lineas.push(l);
    await ejecutarReconciliacion(d, { aplicar: false });
    const salida = lineas.join('\n');
    expect(salida).not.toContain('SUPERSECRETO');
    expect(salida).not.toContain('SECRETO_CLOUD');
  });

  it('volcarRespaldo nombra el archivo y guarda las filas afectadas', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fotos-'));
    const filas: FilaFoto[] = [
      { id: 3, codigo: 'A', imagen_url: U('productos/A.jpg'), public_id: 'productos/A' },
      { id: 4, codigo: 'B', imagen_url: null, public_id: null },
    ];
    const ruta = volcarRespaldo(filas, dir, new Date('2026-01-02T03:04:05Z'));
    expect(ruta).toContain('fotos-backup-20260102-030405.json');
    expect(JSON.parse(readFileSync(ruta, 'utf8'))).toEqual(filas);
  });
});
