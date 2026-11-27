/**
 * @jest-environment node
 */
// Fase B s25: el lado muerto de despachos se retiro (/despachos y /api/despachos/process);
// el lado vivo (/bodega y /api/despachos/procesar) sigue en pie.
// RUTAS_POR_ROL se lee del fuente, igual que __tests__/middleware-matcher.test.ts:
// no conviene importar middleware.ts en jest (next-auth/edge).
import fs from 'fs';
import path from 'path';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/db', () => ({ sql: jest.fn() }));
jest.mock('@/lib/gemini', () => ({ callGeminiText: jest.fn() }));
jest.mock('@/lib/cloudinary', () => ({ uploadImage: jest.fn() }));
jest.mock('next/server', () => ({
  NextResponse: { json: (body: any) => ({ json: async () => body }) },
}));

const src = fs.readFileSync(path.join(__dirname, '..', 'middleware.ts'), 'utf8');

function rutasDe(rol: string): string[] {
  const m = src.match(new RegExp(`${rol}:\\s*\\[([^\\]]*)\\]`));
  if (!m) throw new Error(`No se encontro la lista de ${rol} en RUTAS_POR_ROL`);
  return (m[1].match(/'[^']+'/g) ?? []).map((x) => x.slice(1, -1));
}

describe('s25 — despachos: lado muerto retirado, lado vivo intacto', () => {
  it('RUTAS_POR_ROL.admin ya no incluye /despachos', () => {
    expect(rutasDe('admin')).not.toContain('/despachos');
  });

  it('RUTAS_POR_ROL.admin y bodeguero conservan /bodega', () => {
    expect(rutasDe('admin')).toContain('/bodega');
    expect(rutasDe('bodeguero')).toContain('/bodega');
  });

  it('middleware no menciona el header X-Preferred-Model', () => {
    expect(src).not.toContain('X-Preferred-Model');
  });

  it('/api/despachos/procesar sigue exportando POST', async () => {
    const mod = await import('@/app/api/despachos/procesar/route');
    expect(typeof mod.POST).toBe('function');
  });
});
