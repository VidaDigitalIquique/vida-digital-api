export type DespachoRow = {
  id: number;
  empresa_id: number;
  folio: number | null;
  estado: string;
  fecha_despacho: string; // YYYY-MM-DD
  imagen_url: string;
};

export function filterDespachosHoy(despachos: DespachoRow[], hoy: string): DespachoRow[] {
  return despachos.filter((d) => d.fecha_despacho === hoy);
}

export function formatDespachoEstado(estado: string): string {
  const map: Record<string, string> = {
    ok: "Procesado",
    sin_folio: "Sin Folio",
  };
  return map[estado] ?? estado;
}
