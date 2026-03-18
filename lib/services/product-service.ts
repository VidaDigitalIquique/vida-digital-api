import { sql } from "@/lib/db";
import { getTopShipmentKeys } from "@/utils/shipment-logic";

/**
 * Identifies the top N most recent shipments for a company and updates the 
 * es_nuevo flag accordingly.
 */
export async function recalculateNuevoFlags(empresaId: number, topN = 3): Promise<number> {
  // 1. Get all unique nroingreso values for the company
  const rows = await sql`
    SELECT DISTINCT nroingreso 
    FROM productos 
    WHERE empresa_id = ${empresaId} AND nroingreso IS NOT NULL
  `;
  const allNroIngresos = rows.map(r => r.nroingreso as string);

  // 2. Compute Top N shipment keys (format "YY-NNNNNN")
  const topKeys = getTopShipmentKeys(allNroIngresos, topN);

  if (topKeys.length === 0) {
    // If no valid shipments, clear all flags
    await sql`UPDATE productos SET es_nuevo = false WHERE empresa_id = ${empresaId}`;
    return 0;
  }

  // 3. Reset all flags for the company first
  await sql`
    UPDATE productos 
    SET es_nuevo = false 
    WHERE empresa_id = ${empresaId}
  `;

  // 4. Mark matches as nuevo using a batch update loop
  for (const key of topKeys) {
    const pattern = `%-${key}-%`;
    await sql`
      UPDATE productos 
      SET es_nuevo = true 
      WHERE empresa_id = ${empresaId} AND nroingreso LIKE ${pattern}
    `;
  }

  // 5. Return count for reporting
  const [{ count }] = await sql`
    SELECT COUNT(*)::int as count
    FROM productos 
    WHERE empresa_id = ${empresaId} AND es_nuevo = true
  `;
  
  return count;
}
