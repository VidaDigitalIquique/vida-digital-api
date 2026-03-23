import { z } from "zod";

export const CompanySwitcherPropsSchema = z.object({
  activeEmpresaId: z.number().int().positive(),
  onSwitch: z.function().args(z.number().int().positive()).returns(z.void()),
});

export const CompanySwitcherOpenEventSchema = z.object({
  action: z.literal("open"),
  open: z.literal(true),
});

export const CompanySwitcherSelectEventSchema = z.object({
  action: z.literal("select"),
  selectedId: z.number().int().positive(),
  calledWith: z.number().int().positive(),
  open: z.literal(false),
});

export const CompanySwitcherWithinSheetSchema = z.object({
  action: z.literal("open-within-sheet"),
  open: z.literal(true),
});

export const CompanySwitcherBehaviorContract = z.object({
  props: CompanySwitcherPropsSchema,
  events: z.array(
    z.union([
      CompanySwitcherOpenEventSchema,
      CompanySwitcherSelectEventSchema,
      CompanySwitcherWithinSheetSchema,
    ]),
  ),
});
