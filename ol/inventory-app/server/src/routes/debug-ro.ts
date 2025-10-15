import { Router } from "express";
import { getPool } from "../lib/sql";
import { DATA_SOURCES } from "../config/data-sources";

const router = Router();
const pool = getPool();

type ResolvedTable = { schema: string | null; table: string };

async function resolveTable(table: string, preferredSchema?: string): Promise<ResolvedTable> {
  if (preferredSchema) {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [preferredSchema, table]
    );
    if (r.rowCount > 0) return { schema: preferredSchema, table };
  }
  const sql = `
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE lower(table_name) = lower($1)
      AND table_type = 'BASE TABLE'
      AND table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY CASE WHEN table_schema='public' THEN 0 ELSE 1 END, table_schema
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [table]);
  if (rows.length === 0) return { schema: null, table };
  return { schema: String(rows[0].table_schema), table: String(rows[0].table_name) };
}

async function getColumns(table: string, schema?: string): Promise<{ schema: string | null; table: string; columns: string[] }> {
  const resolved = await resolveTable(table, schema);
  if (!resolved.schema) return { schema: null, table: resolved.table, columns: [] };
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
     ORDER BY ordinal_position`,
    [resolved.schema, resolved.table]
  );
  return { schema: resolved.schema, table: resolved.table, columns: rows.map(r => String(r.column_name)) };
}

function safeIdent(id: string | null | undefined): string | null {
  if (!id) return null;
  return /^[a-zA-Z0-9_]+$/.test(id) ? id : null;
}

router.get("/columns", async (_req, res) => {
  try {
    const p = await getColumns((DATA_SOURCES as any).producto.table, (DATA_SOURCES as any).producto.schema);
    const i = await getColumns((DATA_SOURCES as any).inventar.table, (DATA_SOURCES as any).inventar.schema);
    res.json({
      producto: p.columns,
      inventar: i.columns,
      resolved: { producto: { schema: p.schema, table: p.table }, inventar: { schema: i.schema, table: i.table } },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "columns error" });
  }
});

router.get("/producto", async (req, res) => {
  try {
    const src: any = (DATA_SOURCES as any).producto;
    const resolved = await resolveTable(src.table, src.schema);
    const codeCol = safeIdent(src.code);
    const descCol = safeIdent(src.description);
    const limit = Math.min(parseInt(String(req.query.limit ?? "10"), 10) || 10, 100);
    const code = req.query.code as string | undefined;

    if (!resolved.schema) return res.status(404).json({ error: `Tabla ${src.table} no encontrada` });

    if (code && codeCol) {
      const sql = `SELECT * FROM "${resolved.schema}"."${resolved.table}" WHERE "${codeCol}" = $1 LIMIT ${limit}`;
      const { rows } = await pool.query(sql, [code]);
      return res.json({ rows, used: { schema: resolved.schema, table: resolved.table, codeCol } });
    } else {
      const pickCols: string[] = [];
      if (codeCol) pickCols.push(`"${codeCol}" as code`);
      if (descCol) pickCols.push(`"${descCol}" as description`);
      const cols = pickCols.length ? pickCols.join(", ") : "*";
      const sql = `SELECT ${cols} FROM "${resolved.schema}"."${resolved.table}" LIMIT ${limit}`;
      const { rows } = await pool.query(sql);
      return res.json({ rows, used: { schema: resolved.schema, table: resolved.table, codeCol: codeCol || null, description: descCol || null } });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message || "producto error" });
  }
});

router.get("/inventar", async (req, res) => {
  try {
    const src: any = (DATA_SOURCES as any).inventar;
    const resolved = await resolveTable(src.table, src.schema);
    const codeCol = safeIdent(src.code);
    const stockBoxes = safeIdent(src.stock_boxes);
    const stockUnits = safeIdent(src.stock_units);
    const limit = Math.min(parseInt(String(req.query.limit ?? "10"), 10) || 10, 100);
    const code = req.query.code as string | undefined;

    if (!resolved.schema) return res.status(404).json({ error: `Tabla ${src.table} no encontrada` });

    if (code && codeCol) {
      const sql = `SELECT * FROM "${resolved.schema}"."${resolved.table}" WHERE "${codeCol}" = $1 LIMIT ${limit}`;
      const { rows } = await pool.query(sql, [code]);
      return res.json({ rows, used: { schema: resolved.schema, table: resolved.table, codeCol } });
    } else {
      const pickCols: string[] = [];
      if (codeCol) pickCols.push(`"${codeCol}" as code`);
      if (stockBoxes) pickCols.push(`"${stockBoxes}" as stock_boxes`);
      if (stockUnits) pickCols.push(`"${stockUnits}" as stock_units`);
      const cols = pickCols.length ? pickCols.join(", ") : "*";
      const sql = `SELECT ${cols} FROM "${resolved.schema}"."${resolved.table}" LIMIT ${limit}`;
      const { rows } = await pool.query(sql);
      return res.json({ rows, used: { schema: resolved.schema, table: resolved.table, codeCol: codeCol || null, stock_boxes: stockBoxes || null, stock_units: stockUnits || null } });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message || "inventar error" });
  }
});

export default router;
