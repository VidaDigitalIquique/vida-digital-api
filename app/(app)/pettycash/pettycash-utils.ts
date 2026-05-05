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
