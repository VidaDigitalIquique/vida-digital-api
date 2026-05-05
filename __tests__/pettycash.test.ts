import { PettycashCreateSchema } from "../docs/specs/pettycash.spec";

describe("PettycashCreateSchema", () => {
  test("válido ingreso mínimo", () => {
    const result = PettycashCreateSchema.safeParse({
      tipo: "ingreso",
      concepto: "Venta efectivo",
      monto: 50000,
    });
    expect(result.success).toBe(true);
  });

  test("válido egreso con fecha y empresa_id", () => {
    const result = PettycashCreateSchema.safeParse({
      tipo: "egreso",
      concepto: "Compra útiles",
      monto: 12500.5,
      fecha: "2026-05-05",
      empresa_id: 1,
    });
    expect(result.success).toBe(true);
  });

  test("rechaza tipo inválido", () => {
    const result = PettycashCreateSchema.safeParse({
      tipo: "transferencia",
      concepto: "Test",
      monto: 1000,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza monto negativo", () => {
    const result = PettycashCreateSchema.safeParse({
      tipo: "egreso",
      concepto: "Test",
      monto: -500,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza monto cero", () => {
    const result = PettycashCreateSchema.safeParse({
      tipo: "ingreso",
      concepto: "Test",
      monto: 0,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza concepto vacío", () => {
    const result = PettycashCreateSchema.safeParse({
      tipo: "ingreso",
      concepto: "",
      monto: 1000,
    });
    expect(result.success).toBe(false);
  });

  test("rechaza fecha con formato inválido", () => {
    const result = PettycashCreateSchema.safeParse({
      tipo: "egreso",
      concepto: "Test",
      monto: 1000,
      fecha: "05/05/2026",
    });
    expect(result.success).toBe(false);
  });

  test("fecha es opcional", () => {
    const result = PettycashCreateSchema.safeParse({
      tipo: "ingreso",
      concepto: "Test",
      monto: 1000,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fecha).toBeUndefined();
  });
});

describe("lógica de saldo", () => {
  function calcSaldo(movimientos: { tipo: string; monto: number }[]): number {
    return movimientos.reduce((acc, m) => {
      return m.tipo === "ingreso" ? acc + m.monto : acc - m.monto;
    }, 0);
  }

  test("saldo con solo ingresos", () => {
    const movs = [
      { tipo: "ingreso", monto: 100000 },
      { tipo: "ingreso", monto: 50000 },
    ];
    expect(calcSaldo(movs)).toBe(150000);
  });

  test("saldo con ingresos y egresos", () => {
    const movs = [
      { tipo: "ingreso", monto: 100000 },
      { tipo: "egreso", monto: 30000 },
    ];
    expect(calcSaldo(movs)).toBe(70000);
  });

  test("saldo negativo posible", () => {
    const movs = [
      { tipo: "ingreso", monto: 10000 },
      { tipo: "egreso", monto: 50000 },
    ];
    expect(calcSaldo(movs)).toBe(-40000);
  });
});
