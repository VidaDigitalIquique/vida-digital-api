import { describe, expect, it, beforeAll } from 'vitest';
import { sql } from '@/lib/db';

// syncPostProcess aún no existe — este import DEBE fallar en Fase B
import { syncPostProcess } from '@/lib/services/sync-post-process';

describe('syncPostProcess — integración real contra Neon', () => {
  it('retorna objeto con las 7 claves esperadas', async () => {
    const result = await syncPostProcess(sql);

    // Shape principal
    expect(result).toHaveProperty('ubicaciones_sanjh');
    expect(result).toHaveProperty('ubicaciones_vida');
    expect(result).toHaveProperty('alertas_generadas');
    expect(result).toHaveProperty('alertas_stock_bajo');
    expect(result).toHaveProperty('client_ratings');
    expect(result).toHaveProperty('clientes_nuevos');

    // Tipos básicos
    expect(typeof result.ubicaciones_sanjh).toBe('number');
    expect(typeof result.ubicaciones_vida).toBe('number');
    expect(typeof result.alertas_generadas).toBe('number');
    expect(typeof result.alertas_stock_bajo).toBe('number');

    // Sub-objetos
    expect(result.client_ratings).toHaveProperty('updated');
    expect(typeof result.client_ratings.updated).toBe('number');

    expect(result.clientes_nuevos).toHaveProperty('nuevos');
    expect(typeof result.clientes_nuevos.nuevos).toBe('number');
    expect(result.clientes_nuevos).toHaveProperty('sugerencias');
    expect(typeof result.clientes_nuevos.sugerencias).toBe('number');
  });

  it('crea/actualiza fila en ubicaciones_bodega para D-016A / 101-26-038700-012-GLP empresa 2 con saldo 128', async () => {
    // Ejecutar el post-proceso que sincroniza ubicaciones_bodega desde productos
    await syncPostProcess(sql);

    // Verificar que la fila existe con los datos esperados
    const rows = await sql`
      SELECT saldo
      FROM ubicaciones_bodega
      WHERE codigo = 'D-016A'
        AND nroingreso = '101-26-038700-012-GLP'
        AND empresa_id = 2
    `;

    expect(rows).toHaveLength(1);
    expect(Number(rows[0].saldo)).toBe(128);
  });
});

describe('POST /api/cron/sync-inventar — smoke E2E', () => {
  it('responde 200 e incluye las claves nuevas en el body', async () => {
    const { POST } = await import('@/app/api/cron/sync-inventar/route');

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      // Si no hay CRON_SECRET definido, el endpoint debe rechazar con 401
      const req = new Request('http://localhost/api/cron/sync-inventar', {
        method: 'POST',
      });
      const res = await POST(req);
      // Sin secret, esperamos 401 — eso es esperado si la variable no está seteada
      expect(res.status).toBe(401);
      return;
    }

    const req = new Request('http://localhost/api/cron/sync-inventar', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);

    // Claves que YA existían en el cron
    expect(body).toHaveProperty('sanjh_count');
    expect(body).toHaveProperty('vida_count');

    // Claves NUEVAS que el cron NO retorna hoy — estas DEBEN fallar en Fase B
    expect(body).toHaveProperty('alertas_generadas');
    expect(body).toHaveProperty('alertas_stock_bajo');
    expect(body).toHaveProperty('client_ratings_updated');
    expect(body).toHaveProperty('clientes_nuevos');
    expect(body).toHaveProperty('sugerencias_nuevas');
  });
});
