export function formatMonto(n: number): string {
  return `$${n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function tipoLabel(tipo: string): string {
  return ({ prestamo: 'Préstamo', adelanto: 'Adelanto', quincena: 'Quincena' } as Record<string, string>)[tipo] ?? tipo;
}

export function estadoBadge(estado: string): string {
  const map: Record<string, string> = {
    pendiente:  'bg-yellow-100 text-yellow-700',
    aceptada:   'bg-blue-100 text-blue-700',
    rechazada:  'bg-red-100 text-red-700',
    confirmada: 'bg-emerald-100 text-emerald-700',
    caduca:     'bg-zinc-100 text-zinc-500',
  };
  return map[estado] ?? 'bg-zinc-100 text-zinc-500';
}
