import { z } from 'zod';

export const NroIngresoSchema = z.string().regex(
  /^\d+-(\d{2})-(\d+)-\d+-\w+$/,
  'Invalid NROINGRESO format'
);

export const ShipmentKeySchema = z.object({
  year: z.number().int().min(20).max(99),
  number: z.number().int().positive(),
  raw: z.string()
});

export const NuevoFlagInputSchema = z.object({
  empresaId: z.number().int().positive(),
  nroIngresos: z.array(z.string()),
  topN: z.number().int().min(1).max(5).default(3)
});

export const NuevoFlagOutputSchema = z.object({
  nuevoKeys: z.array(z.string()),
  updatedCount: z.number().int()
});
