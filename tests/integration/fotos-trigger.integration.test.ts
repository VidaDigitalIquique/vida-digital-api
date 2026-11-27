// Integración real contra Neon: requiere TEST_DATABASE_URL (rama de pruebas) y que la
// migración 012 esté aplicada en esa rama. Sin alguna de las dos, se salta.
import { describe, expect, it } from 'vitest';
import { sql } from '@/lib/db';

const hasTestDb = !!process.env.TEST_DATABASE_URL;

async function faltaFuncion(): Promise<boolean> {
  if (!hasTestDb) return true;
  const filas = await sql`SELECT to_regprocedure('public.productos_heredar_imagen()') AS r`;
  return filas[0]?.r == null;
}

const FOTO = 'https://res.cloudinary.com/dxkidwxjl/image/upload/productos/ZZ-S18-TRIG.jpg';
const PID = 'productos/ZZ-S18-TRIG';

describe.skipIf(!hasTestDb)('trigger productos_heredar_imagen', () => {
  it('31. una fila nueva sin foto hereda la foto de su hermana normalizada', async (ctx) => {
    if (await faltaFuncion()) ctx.skip();
    const codigo = `ZZ-S18-TRIG-${Date.now()}`;
    const ids: number[] = [];
    try {
      const [origen] = await sql`
        INSERT INTO public.productos (empresa_id, codigo, imagen_url, public_id)
        VALUES (1, ${codigo}, ${FOTO}, ${PID})
        RETURNING id
      `;
      ids.push(origen.id);

      const [nueva] = await sql`
        INSERT INTO public.productos (empresa_id, codigo)
        VALUES (1, ${` ${codigo.toLowerCase()} `})
        RETURNING id
      `;
      ids.push(nueva.id);

      const [fila] = await sql`
        SELECT imagen_url, public_id FROM public.productos WHERE id = ${nueva.id}
      `;
      expect(fila.imagen_url).toBe(FOTO);
      expect(fila.public_id).toBe(PID);
    } finally {
      for (const id of ids) {
        await sql`DELETE FROM public.productos WHERE id = ${id}`;
      }
    }
  });

  it('32. una fila que ya trae su propia foto no se mezcla', async (ctx) => {
    if (await faltaFuncion()) ctx.skip();
    const codigo = `ZZ-S18-PROPIA-${Date.now()}`;
    const ids: number[] = [];
    try {
      const [origen] = await sql`
        INSERT INTO public.productos (empresa_id, codigo, imagen_url, public_id)
        VALUES (1, ${codigo}, ${FOTO}, ${PID})
        RETURNING id
      `;
      ids.push(origen.id);

      const [nueva] = await sql`
        INSERT INTO public.productos (empresa_id, codigo, imagen_url)
        VALUES (1, ${` ${codigo.toLowerCase()} `}, ${'https://i.imgur.com/propia.jpg'})
        RETURNING id
      `;
      ids.push(nueva.id);

      const [fila] = await sql`
        SELECT imagen_url, public_id FROM public.productos WHERE id = ${nueva.id}
      `;
      expect(fila.imagen_url).toBe('https://i.imgur.com/propia.jpg');
      expect(fila.public_id).toBeNull();
    } finally {
      for (const id of ids) {
        await sql`DELETE FROM public.productos WHERE id = ${id}`;
      }
    }
  });
});
