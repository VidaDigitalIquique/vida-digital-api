import { z } from "zod";

export const DeudaCreateSchema = z.object({
  usuario_id: z.number().int().positive(),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
});

export const DeudaPatchSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("pagar"), monto: z.number().positive() }),
  z.object({ accion: z.literal("editar"), monto: z.number().optional(), descripcion: z.string().optional() }),
  z.object({ accion: z.literal("editar_pago"), pago_id: z.number().int().positive(), monto: z.number().positive() }),
]);

export type DeudaCreate = z.infer<typeof DeudaCreateSchema>;
export type DeudaPatch = z.infer<typeof DeudaPatchSchema>;
