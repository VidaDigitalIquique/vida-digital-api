import { nombreMes, formatMesAnio } from "../app/(app)/sueldos/sueldos-utils";

describe("nombreMes", () => {
  test("enero → Enero", () => expect(nombreMes(1)).toBe("Enero"));
  test("mayo → Mayo", () => expect(nombreMes(5)).toBe("Mayo"));
  test("diciembre → Diciembre", () => expect(nombreMes(12)).toBe("Diciembre"));
});

describe("formatMesAnio", () => {
  test("formatea mes y año", () => expect(formatMesAnio(5, 2026)).toBe("Mayo 2026"));
  test("enero", () => expect(formatMesAnio(1, 2025)).toBe("Enero 2025"));
});
