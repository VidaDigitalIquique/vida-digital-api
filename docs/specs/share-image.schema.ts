import { z } from 'zod';

export const ShareImageInputSchema = z.object({
  imageUrl: z.string().url(),
  filename: z.string().min(1),        // e.g. "VD-017.jpg"
  title: z.string().min(1),           // e.g. "VD-017 — SANDWICHERA ELÉCTRICA"
});

export const ShareImageResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('shared') }),
  z.object({ status: z.literal('downloaded') }),   // fallback if Web Share API unavailable
  z.object({ status: z.literal('unsupported') }),  // browser doesn't support either
  z.object({ status: z.literal('error'), message: z.string() }),
]);
