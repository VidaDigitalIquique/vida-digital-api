import type { EjecutorSql, PlanFotos } from './fotos-sync';

export async function aplicarPlan(
  sql: EjecutorSql,
  plan: PlanFotos,
  opciones: { maxAcciones?: number } = {}
): Promise<{ aplicadas: number; pendientes: number; errores: number }> {
  const maxAcciones = opciones.maxAcciones ?? Infinity;
  const total = plan.bloqueado ? 0 : plan.acciones.length;
  const ejecutables = plan.bloqueado ? [] : plan.acciones.slice(0, maxAcciones);

  let aplicadas = 0;
  let errores = 0;
  for (const accion of ejecutables) {
    try {
      if (accion.tipo === 'limpiar') {
        await sql`UPDATE public.productos SET imagen_url = NULL, public_id = NULL, updated_at = NOW() WHERE id = ${accion.id}`;
      } else {
        await sql`UPDATE public.productos SET imagen_url = ${accion.imagen_url}, public_id = ${accion.public_id}, updated_at = NOW() WHERE id = ${accion.id}`;
      }
      aplicadas++;
    } catch {
      errores++;
    }
  }

  return { aplicadas, pendientes: total - aplicadas - errores, errores };
}
