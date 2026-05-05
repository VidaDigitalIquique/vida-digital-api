import { z } from "zod";

export const PettycashCreateSchema = z.object({
  tipo: z.enum(["ingreso", "egreso"]),
  concepto: z.string().min(1).max(255),
  monto: z.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  empresa_id: z.number().int().positive().optional(),
});

export type PettycashCreate = z.infer<typeof PettycashCreateSchema>;
