const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}

export function formatMesAnio(mes: number, anio: number): string {
  return `${nombreMes(mes)} ${anio}`;
}
