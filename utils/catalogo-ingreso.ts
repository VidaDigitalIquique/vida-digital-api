import { sql as sqlType } from "@/lib/db";

/**
 * Retorna un Set con los códigos (UPPER) del último ingreso real a Zofri.
 * Último ingreso real = prefijo 101, año más alto, folio más alto.
 * No usa fecha_ingreso (que es fecha de sync, no de ingreso).
 */
export async function getLatestIngresoRealCodigos(
  sql: typeof sqlType,
  ambasEmpresas: boolean,
  empresaId: number
): Promise<Set<string>> {
  const latestIngreso = ambasEmpresas
    ? await sql`
        SELECT SPLIT_PART(nroingreso,'-',2) as anio, SPLIT_PART(nroingreso,'-',3) as folio
        FROM productos
        WHERE nroingreso IS NOT NULL
          AND nroingreso NOT LIKE 'INICIAL%'
          AND SPLIT_PART(nroingreso,'-',1) = '101'
        ORDER BY SPLIT_PART(nroingreso,'-',2) DESC, SPLIT_PART(nroingreso,'-',3)::integer DESC
        LIMIT 1
      `
    : await sql`
        SELECT SPLIT_PART(nroingreso,'-',2) as anio, SPLIT_PART(nroingreso,'-',3) as folio
        FROM productos
        WHERE empresa_id = ${empresaId}
          AND nroingreso IS NOT NULL
          AND nroingreso NOT LIKE 'INICIAL%'
          AND SPLIT_PART(nroingreso,'-',1) = '101'
        ORDER BY SPLIT_PART(nroingreso,'-',2) DESC, SPLIT_PART(nroingreso,'-',3)::integer DESC
        LIMIT 1
      `;

  const anio = latestIngreso[0]?.anio as string | undefined;
  const folio = latestIngreso[0]?.folio as string | undefined;

  if (!anio || !folio) return new Set();

  const pattern = `101-${anio}-${folio}-%`;
  const codigoRows = ambasEmpresas
    ? await sql`SELECT DISTINCT UPPER(codigo) as codigo FROM productos WHERE nroingreso LIKE ${pattern}`
    : await sql`SELECT DISTINCT UPPER(codigo) as codigo FROM productos WHERE empresa_id = ${empresaId} AND nroingreso LIKE ${pattern}`;

  return new Set(codigoRows.map((r: any) => r.codigo as string));
}
