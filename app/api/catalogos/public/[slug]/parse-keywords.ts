export function parseKeywords(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
}

