import { SueldoCreateSchema, buildConceptoPettycash } from "../docs/specs/sueldos.spec";

describe("SueldoCreateSchema", () => {
  test("válido completo", () => {
    const result = SueldoCreateSchema.safeParse({
      trabajador_nombre: "Juan Pérez",
      mes: 5,
      anio: 2026,
      monto_base: 800000,
      monto_final: 750000,
    });
    expect(result.success).toBe(true);
  });

  test("rechaza mes < 1", () => {
    const result = SueldoCreateSchema.safeParse({
      trabajador_nombre: "Juan",
      mes: 0,
      anio: 2026,
      monto_base: 800000,
      monto_final: 800000,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza mes > 12", () => {
    const result = SueldoCreateSchema.safeParse({
      trabajador_nombre: "Juan",
      mes: 13,
      anio: 2026,
      monto_base: 800000,
      monto_final: 800000,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza monto_base negativo", () => {
    const result = SueldoCreateSchema.safeParse({
      trabajador_nombre: "Juan",
      mes: 5,
      anio: 2026,
      monto_base: -1,
      monto_final: 800000,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza monto_final cero", () => {
    const result = SueldoCreateSchema.safeParse({
      trabajador_nombre: "Juan",
      mes: 5,
      anio: 2026,
      monto_base: 800000,
      monto_final: 0,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza nombre vacío", () => {
    const result = SueldoCreateSchema.safeParse({
      trabajador_nombre: "",
      mes: 5,
      anio: 2026,
      monto_base: 800000,
      monto_final: 800000,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza anio fuera de rango", () => {
    const result = SueldoCreateSchema.safeParse({
      trabajador_nombre: "Juan",
      mes: 5,
      anio: 1999,
      monto_base: 800000,
      monto_final: 800000,
    });
    expect(result.success).toBe(false);
  });
});

describe("buildConceptoPettycash", () => {
  test("genera concepto con nombre y mes/año", () => {
    expect(buildConceptoPettycash("Juan Pérez", 5, 2026)).toBe("Sueldo Juan Pérez 5/2026");
  });

  test("funciona con nombre compuesto", () => {
    expect(buildConceptoPettycash("María José López", 12, 2025)).toBe("Sueldo María José López 12/2025");
  });
});
