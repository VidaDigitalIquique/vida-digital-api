import { z } from "zod";

export const SueldoCreateSchema = z.object({
  usuario_id: z.number().int().positive(),
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2000).max(2100),
  tipo: z.enum(["sueldo", "adelanto", "quincena"]).default("sueldo"),
  monto: z.number().positive().optional(),
  monto_base: z.number().positive().optional(),
  monto_final: z.number().positive().optional(),
  descripcion: z.string().optional(),
});

export type SueldoCreate = z.infer<typeof SueldoCreateSchema>;

export const UltimoMontoBaseSchema = z.object({
  ultimo_monto_base: z.number().nullable(),
  usuario_id: z.number(),
  nombre: z.string(),
});

export type UltimoMontoBase = z.infer<typeof UltimoMontoBaseSchema>;

export const MontoBaseSaveSchema = z.object({
  usuario_id: z.number().int().positive(),
  monto_base: z.number().min(0),
});

export type MontoBaseSave = z.infer<typeof MontoBaseSaveSchema>;

export function buildConceptoPettycash(nombre: string, mes: number, anio: number): string {
  return `Sueldo ${nombre} ${mes}/${anio}`;
}
