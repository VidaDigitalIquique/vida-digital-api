export function formatMonto(monto: number): string {
  if (monto === 0) return "$0";
  const abs = Math.abs(monto);
  const formatted = abs.toLocaleString("es-CL", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return monto < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function saldoColor(saldo: number): string {
  if (saldo > 0) return "text-emerald-600";
  if (saldo < 0) return "text-red-600";
  return "text-zinc-500";
}

export function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

type MovimientoLike = { fecha: string; tipo: string; concepto: string; monto: string | number };

/** Dias 'yyyy-mm-dd' entre desde y hasta, descendente. Aritmetica UTC pura: no depende de la zona del proceso. */
export function daysInRange(desde: string, hasta: string): string[] {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  const fin = Date.UTC(y2, m2 - 1, d2);
  const days: string[] = [];
  for (let t = Date.UTC(y1, m1 - 1, d1); t <= fin; t += 86400000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days.reverse();
}

export function buildWhatsAppText(
  movimientos: MovimientoLike[],
  saldo: number,
  desde: string,
  hasta: string
): string {
  const lines: string[] = [
    '*PETTYCASH*',
    `Período: ${desde} – ${hasta}`,
    `Saldo: ${formatMonto(saldo)}`,
    '',
  ];
  movimientos.forEach(m => {
    const tipo = m.tipo === 'egreso' ? 'Gasto' : 'Ingreso';
    lines.push(`• ${m.fecha} — ${tipo}: ${m.concepto} ${formatMonto(parseFloat(String(m.monto)))}`);
  });
  return lines.join('\n');
}
