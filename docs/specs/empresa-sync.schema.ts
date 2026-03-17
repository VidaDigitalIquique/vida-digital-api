import { z } from 'zod';

export const EmpresaIdSchema = z.number().int().min(1).max(2);

export const LocalStorageEmpresaSchema = z.object({
  key: z.literal('vidadigital_empresa'),
  value: z.string().regex(/^[12]$/) // must be "1" or "2"
});

export const UseEmpresaIdOutputSchema = z.object({
  empresaId: EmpresaIdSchema,      // never 0, never NaN, never null
  isLoaded: z.boolean()            // false during SSR, true after hydration
});
