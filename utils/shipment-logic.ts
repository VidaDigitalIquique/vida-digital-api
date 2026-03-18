export function parseShipmentKey(nroingreso: string): { year: number, number: number, raw: string } | null {
  if (!nroingreso) return null;
  const parts = nroingreso.split('-');
  if (parts.length < 3) return null;

  const year = parseInt(parts[1], 10);
  const number = parseInt(parts[2], 10);
  const raw = `${parts[1]}-${parts[2]}`;

  if (isNaN(year) || isNaN(number)) return null;

  return { year, number, raw };
}

export function getTopShipmentKeys(nroIngresos: string[], topN: number): string[] {
  const shipments = nroIngresos
    .map(parseShipmentKey)
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Use a map to deduplicate by raw key
  const uniqueKeys = new Map<string, { year: number, number: number, raw: string }>();
  shipments.forEach(s => uniqueKeys.set(s.raw, s));

  // Sort by year DESC, then number DESC
  return Array.from(uniqueKeys.values())
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.number - a.number;
    })
    .slice(0, topN)
    .map(s => s.raw);
}
