import { z } from 'zod';

export const ImageUploadInputSchema = z.object({
  productoId: z.number().int().positive(),
  file: z.instanceof(File).refine(
    f => ['image/jpeg','image/jpg','image/png','image/webp'].includes(f.type),
    { message: 'Solo se aceptan JPG, PNG o WEBP' }
  ).refine(
    f => f.size <= 5 * 1024 * 1024,
    { message: 'Imagen debe ser menor a 5MB' }
  )
});

export const ImageUploadOutputSchema = z.object({
  imagen_url: z.string().url(),
  public_id: z.string()
});
