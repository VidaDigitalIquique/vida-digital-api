import { z } from "zod";

export const CompanySwitcherMobilePropsSchema = z.object({
  activeEmpresaId: z.number().int().positive(),
  onSwitch: z.function(),
});

export const CompanySwitcherMobileTriggerEventSchema = z.object({
  action: z.literal("trigger-click"),
  sheetOpen: z.literal(true),
  dropdownOpen: z.literal(true),
});

export const CompanySwitcherMobileSelectEventSchema = z.object({
  action: z.literal("select-item"),
  selectedId: z.number().int().positive(),
  calledWith: z.number().int().positive(),
  sheetOpen: z.literal(false),
  dropdownOpen: z.literal(false),
});

export const CompanySwitcherMobileBehaviorContract = z.object({
  props: CompanySwitcherMobilePropsSchema,
  events: z.array(
    z.union([
      CompanySwitcherMobileTriggerEventSchema,
      CompanySwitcherMobileSelectEventSchema,
    ]),
  ),
});
