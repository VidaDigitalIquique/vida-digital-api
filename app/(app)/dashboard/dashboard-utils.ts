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

export type ColumnaDespachos = {
  fecha: string;
  label: string;
  despachos: { id: number; folio: string; imagen_url: string | null; hora: string }[];
};

const TZ = 'America/Santiago';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function generateColumnas(rows: Record<string, any>[], referenceDate?: Date): ColumnaDespachos[] {
  const ref = referenceDate || new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
  const horaFmt = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

  const fechas: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(ref.getTime() - i * 86400000);
    fechas.push(fmt.format(d));
  }

  const grupos: Record<string, typeof rows> = {};
  for (const r of rows) {
    const fecha = fmt.format(new Date(r.created_at));
    if (!grupos[fecha]) grupos[fecha] = [];
    grupos[fecha].push(r);
  }

  return fechas.map((fecha, i) => {
    const [y, m, d] = fecha.split('-');
    const label = i === 0 ? `Hoy — ${d} ${MESES[parseInt(m, 10) - 1]}` : `${d} ${MESES[parseInt(m, 10) - 1]}`;
    const despachos = (grupos[fecha] || []).map(r => ({
      id: r.id,
      folio: r.folio,
      imagen_url: r.imagen_url,
      hora: horaFmt.format(new Date(r.created_at)),
    }));
    return { fecha, label, despachos };
  });
}
