import { z } from "zod";

export const SueldoCreateSchema = z.object({
  usuario_id: z.number().int().positive(),
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2000).max(2100),
  monto_base: z.number().positive(),
  monto_final: z.number().positive(),
});

export type SueldoCreate = z.infer<typeof SueldoCreateSchema>;

export const UltimoMontoBaseSchema = z.object({
  ultimo_monto_base: z.number().nullable(),
  usuario_id: z.number(),
  nombre: z.string(),
});

export type UltimoMontoBase = z.infer<typeof UltimoMontoBaseSchema>;

export function buildConceptoPettycash(nombre: string, mes: number, anio: number): string {
  return `Sueldo ${nombre} ${mes}/${anio}`;
}
