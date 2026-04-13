import { filterDespachosHoy, formatDespachoEstado } from "../app/(app)/dashboard/dashboard-utils";

const hoy = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
const ayer = new Date(Date.now() - 86400000).toISOString().split("T")[0];

const despachos = [
  { id: 1, empresa_id: 1, folio: 1234, estado: "ok",        fecha_despacho: hoy,  imagen_url: "https://img1" },
  { id: 2, empresa_id: 2, folio: null, estado: "sin_folio", fecha_despacho: hoy,  imagen_url: "https://img2" },
  { id: 3, empresa_id: 1, folio: 5678, estado: "ok",        fecha_despacho: ayer, imagen_url: "https://img3" },
  { id: 4, empresa_id: 1, folio: 9999, estado: "ok",        fecha_despacho: hoy,  imagen_url: "https://img4" },
];

describe("filterDespachosHoy", () => {
  test("retorna solo despachos de hoy", () => {
    const result = filterDespachosHoy(despachos, hoy);
    expect(result.every(d => d.fecha_despacho === hoy)).toBe(true);
  });

  test("excluye despachos de días anteriores", () => {
    const result = filterDespachosHoy(despachos, hoy);
    expect(result.find(d => d.id === 3)).toBeUndefined();
  });

  test("retorna vacío si no hay despachos hoy", () => {
    const result = filterDespachosHoy(despachos, "2000-01-01");
    expect(result).toHaveLength(0);
  });

  test("retorna todos los de hoy sin importar empresa", () => {
    const result = filterDespachosHoy(despachos, hoy);
    const empresas = new Set(result.map(d => d.empresa_id));
    expect(empresas.size).toBeGreaterThan(1);
  });
});

describe("formatDespachoEstado", () => {
  test("ok retorna label legible", () => {
    expect(formatDespachoEstado("ok")).toBe("Procesado");
  });

  test("sin_folio retorna label legible", () => {
    expect(formatDespachoEstado("sin_folio")).toBe("Sin Folio");
  });

  test("valor desconocido retorna el mismo valor", () => {
    expect(formatDespachoEstado("otro")).toBe("otro");
  });
});
