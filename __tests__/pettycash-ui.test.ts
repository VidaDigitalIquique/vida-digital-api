import { formatMonto, saldoColor } from "../app/(app)/pettycash/pettycash-utils";

describe("formatMonto", () => {
  test("formatea entero sin decimales innecesarios", () => {
    expect(formatMonto(100000)).toBe("$100.000");
  });

  test("formatea con decimales cuando los tiene", () => {
    expect(formatMonto(12500.5)).toBe("$12.500,50");
  });

  test("formatea cero", () => {
    expect(formatMonto(0)).toBe("$0");
  });

  test("formatea negativo", () => {
    expect(formatMonto(-50000)).toBe("-$50.000");
  });
});

describe("saldoColor", () => {
  test("positivo → emerald", () => {
    expect(saldoColor(10000)).toBe("text-emerald-600");
  });

  test("cero → zinc", () => {
    expect(saldoColor(0)).toBe("text-zinc-500");
  });

  test("negativo → red", () => {
    expect(saldoColor(-1)).toBe("text-red-600");
  });
});
