import { z } from "zod";

export const DeudaCreateSchema = z.object({
  tipo: z.enum(["prestamo", "adelanto", "quincena"]),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
});

export const DeudaPatchSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("aceptar") }),
  z.object({ accion: z.literal("rechazar"), motivo: z.string().min(1) }),
  z.object({ accion: z.literal("confirmar") }),
]);

export type DeudaCreate = z.infer<typeof DeudaCreateSchema>;
export type DeudaPatch = z.infer<typeof DeudaPatchSchema>;

export function buildConceptoDeuda(tipo: string, nombre: string, fecha: Date): string {
  return `${tipo} ${nombre} ${fecha.toLocaleDateString("es-CL")}`;
}
