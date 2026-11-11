const TZ = 'America/Santiago';
// Meses abreviados de date-fns locale es (ICU dice "sept" en septiembre).
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function partes(d: Date | string, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const fecha = typeof d === 'string' ? new Date(d) : d;
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hourCycle: 'h23', ...opts }).formatToParts(fecha)) {
    p[x.type] = x.value;
  }
  return p;
}

/** "09-11-2026" desde el texto YYYY-MM-DD. Puro: no usa Date ni depende de zona horaria. */
export function fechaDiaCL(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** "11 nov 2026, 10:30" = format(d, "dd MMM yyyy, HH:mm", { locale: es }) en Chile. */
export function fechaHoraCL(d: Date | string): string {
  const p = partes(d, { day: '2-digit', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${p.day} ${MESES[Number(p.month) - 1]} ${p.year}, ${p.hour}:${p.minute}`;
}

/** "08-06-2026, 11:50:49 a. m." = toLocaleString("es-CL") en Chile, con espacio normal. */
export function fechaHoraLargaCL(d: Date | string): string {
  const p = partes(d, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const h = Number(p.hour);
  return `${p.day}-${p.month}-${p.year}, ${h % 12 === 0 ? 12 : h % 12}:${p.minute}:${p.second} ${h < 12 ? 'a.' : 'p.'} m.`;
}

/** "HH:mm" = toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) en Chile. */
export function horaCL(d: Date | string): string {
  const p = partes(d, { hour: '2-digit', minute: '2-digit' });
  return `${p.hour}:${p.minute}`;
}

/** yyyy-mm-dd del dia en Chile. */
export function hoyCL(d: Date = new Date()): string {
  const p = partes(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${p.year}-${p.month}-${p.day}`;
}

function restarDiasISO(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - dias * 86400000).toISOString().slice(0, 10);
}

/** yyyy-mm-dd del lunes de la semana (hora Chile) de d; un lunes devuelve el mismo dia. */
export function lunesSemanaCL(d: Date = new Date()): string {
  const hoy = hoyCL(d);
  const diaSemana = new Date(`${hoy}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return restarDiasISO(hoy, (diaSemana + 6) % 7);
}

export function primerDiaMesCL(d: Date = new Date()): string {
  return `${hoyCL(d).slice(0, 7)}-01`;
}

export function ultimoDiaMesCL(d: Date = new Date()): string {
  const [anio, mes] = hoyCL(d).split('-').map(Number);
  return `${anio}-${String(mes).padStart(2, '0')}-${new Date(Date.UTC(anio, mes, 0)).getUTCDate()}`;
}
