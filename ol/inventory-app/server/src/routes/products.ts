import { Router } from "express";
import { getPool } from "../lib/sql";
import { DATA_SOURCES } from "../config/data-sources";

const router = Router();
const pool = getPool();

function safeIdent(id: string | null | undefined): string | null {
  if (!id) return null;
  return /^[a-zA-Z0-9_]+$/.test(id) ? id : null;
}

type ResolvedTable = { schema: string | null; table: string };

async function resolveTable(table: string, preferredSchema?: string): Promise<ResolvedTable> {
  if (preferredSchema) {
    const r = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2",
      [preferredSchema, table]
    );
    if (r.rowCount > 0) return { schema: preferredSchema, table };
  }
  const sql =
    "SELECT table_schema, table_name\n" +
    "FROM information_schema.tables\n" +
    "WHERE lower(table_name) = lower($1)\n" +
    "  AND table_type = 'BASE TABLE'\n" +
    "  AND table_schema NOT IN ('pg_catalog','information_schema')\n" +
    "ORDER BY CASE WHEN table_schema='public' THEN 0 ELSE 1 END, table_schema\n" +
    "LIMIT 1";
  const { rows } = await pool.query(sql, [table]);
  if (rows.length === 0) return { schema: null, table };
  return { schema: String(rows[0].table_schema), table: String(rows[0].table_name) };
}

// GET /products?q=&limit=&offset=&sort=code:asc|stock_units:desc|cost_usd:asc|qty_per_box:desc|inventory_boxes:asc
router.get("/products", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const sortRaw = String(req.query.sort ?? "code:asc");
    const [sortCol, sortDirRaw] = sortRaw.split(":");
    const sortDir = (sortDirRaw || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";
    const sortMap: Record<string, string> = {
      code: "pd.code",
      stock_units: "id.stock_units",
      cost_usd: "id.cost_usd",
      qty_per_box: "id.qty_per_box",
      inventory_boxes:
        "(CASE WHEN id.qty_per_box IS NOT NULL AND id.qty_per_box > 0 THEN (id.stock_units / id.qty_per_box) ELSE NULL END)",
    };
    const sortSql = sortMap[sortCol || "code"] ?? "pd.code";

    const prod: any = (DATA_SOURCES as any).producto;
    const inv: any = (DATA_SOURCES as any).inventar;

    const pResolved = await resolveTable(prod.table, prod.schema);
    const iResolved = await resolveTable(inv.table, inv.schema);

    if (!pResolved.schema) return res.status(404).json({ error: "Tabla " + prod.table + " no encontrada" });
    if (!iResolved.schema) return res.status(404).json({ error: "Tabla " + inv.table + " no encontrada" });

    const pCode = safeIdent(prod.code);
    const pDesc = safeIdent(prod.description);
    const iCode = safeIdent(inv.code);
    const iStockUnits = safeIdent(inv.stock_units);
    const iStockBoxes = safeIdent(inv.stock_boxes);
    const iQtyPerBox = safeIdent("cantcaja");
    const iCostUsd = safeIdent("cosunita");

    if (!pCode) return res.status(500).json({ error: "No se detectó columna de código en producto" });
    if (!iCode) return res.status(500).json({ error: "No se detectó columna de código en inventar" });

    const pSelectCols =
      'p."' + pCode + '" as code, ' + (pDesc ? 'p."' + pDesc + '" as description' : 'NULL::text as description');

    const iSelectCols = [
      'i."' + iCode + '" as code',
      iStockUnits ? 'i."' + iStockUnits + '"::numeric as stock_units' : 'NULL::numeric as stock_units',
      iStockBoxes ? 'i."' + iStockBoxes + '"::numeric as stock_boxes' : 'NULL::numeric as stock_boxes',
      iQtyPerBox ? 'i."' + iQtyPerBox + '"::numeric as qty_per_box' : 'NULL::numeric as qty_per_box',
      iCostUsd ? 'i."' + iCostUsd + '"::numeric as cost_usd' : 'NULL::numeric as cost_usd',
    ].join(", ");

    let where = "";
    const params: any[] = [];
    if (q && pDesc) {
      params.push("%" + q + "%");
      params.push("%" + q + "%");
      where = 'WHERE p."' + pCode + '" ILIKE $1 OR p."' + pDesc + '" ILIKE $2';
    } else if (q) {
      params.push("%" + q + "%");
      where = 'WHERE p."' + pCode + '" ILIKE $1';
    }

    const finalCols = [
      "pd.code",
      "pd.description",
      "id.stock_units",
      "id.stock_boxes",
      "id.cost_usd",
      "id.qty_per_box",
      "CASE WHEN id.qty_per_box IS NOT NULL AND id.qty_per_box > 0 THEN (id.stock_units / id.qty_per_box) ELSE NULL END AS inventory_boxes",
      "NULL::numeric as physical_boxes",
      "NULL::numeric as difference_boxes",
    ].join(", ");

    const baseCte =
      "WITH psrc AS ( " +
      "  SELECT " + pSelectCols + " " +
      '  FROM "' + pResolved.schema + '"."' + pResolved.table + '" p ' +
      (where ? "  " + where + " " : "") +
      "), " +
      "p_dedup AS ( " +
      "  SELECT * FROM ( " +
      "    SELECT psrc.*, ROW_NUMBER() OVER (PARTITION BY code ORDER BY code) AS rn " +
      "    FROM psrc " +
      "  ) t WHERE rn = 1 " +
      "), " +
      "isrc AS ( " +
      "  SELECT " + iSelectCols + " " +
      '  FROM "' + iResolved.schema + '"."' + iResolved.table + '" i ' +
      "), " +
      "i_dedup AS ( " +
      "  SELECT * FROM ( " +
      "    SELECT isrc.*, ROW_NUMBER() OVER (PARTITION BY code ORDER BY code) AS rn " +
      "    FROM isrc " +
      "  ) t WHERE rn = 1 " +
      ") ";

    // total real (filtrado) sin limit/offset
    const totalSql = baseCte + " SELECT COUNT(*)::int AS total FROM p_dedup";
    const totalRes = await pool.query(totalSql, params);
    const total = totalRes.rows?.[0]?.total ?? 0;

    // listado paginado + orden
    const listSql =
      baseCte +
      " SELECT " + finalCols + " " +
      " FROM p_dedup pd " +
      " LEFT JOIN i_dedup id ON id.code = pd.code " +
      " ORDER BY " + sortSql + " " + sortDir + " " +
      " LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);

    const listParams = params.concat([limit, offset]);
    const { rows } = await pool.query(listSql, listParams);

    const markup = Number(process.env.PRICE_MARKUP ?? "0");
    const out = rows.map((r: any) => {
      const cost = r.cost_usd != null ? Number(r.cost_usd) : null;
      const price =
        cost != null && Number.isFinite(cost)
          ? (cost * (1 + (Number.isFinite(markup) ? markup : 0))).toFixed(2)
          : null;
      return { ...r, price_usd: price };
    });

    res.json({ rows: out, total });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "products error" });
  }
});

// GET /products/:code  (detalle)
router.get("/products/:code", async (req, res) => {
  try {
    const codeParam = String(req.params.code ?? "").trim();
    if (!codeParam) return res.status(400).json({ error: "code is required" });

    const prod: any = (DATA_SOURCES as any).producto;
    const inv: any = (DATA_SOURCES as any).inventar;

    const pResolved = await resolveTable(prod.table, prod.schema);
    const iResolved = await resolveTable(inv.table, inv.schema);

    if (!pResolved.schema) return res.status(404).json({ error: "Tabla " + prod.table + " no encontrada" });
    if (!iResolved.schema) return res.status(404).json({ error: "Tabla " + inv.table + " no encontrada" });

    const pCode = safeIdent(prod.code);
    const pDesc = safeIdent(prod.description);
    const iCode = safeIdent(inv.code);
    const iStockUnits = safeIdent(inv.stock_units);
    const iStockBoxes = safeIdent(inv.stock_boxes);
    const iQtyPerBox = safeIdent("cantcaja");
    const iCostUsd = safeIdent("cosunita");

    if (!pCode) return res.status(500).json({ error: "No se detectó columna de código en producto" });
    if (!iCode) return res.status(500).json({ error: "No se detectó columna de código en inventar" });

    const pSelectCols =
      'p."' + pCode + '" as code, ' + (pDesc ? 'p."' + pDesc + '" as description' : 'NULL::text as description');

    const iSelectCols = [
      'i."' + iCode + '" as code',
      iStockUnits ? 'i."' + iStockUnits + '"::numeric as stock_units' : 'NULL::numeric as stock_units',
      iStockBoxes ? 'i."' + iStockBoxes + '"::numeric as stock_boxes' : 'NULL::numeric as stock_boxes',
      iQtyPerBox ? 'i."' + iQtyPerBox + '"::numeric as qty_per_box' : 'NULL::numeric as qty_per_box',
      iCostUsd ? 'i."' + iCostUsd + '"::numeric as cost_usd' : 'NULL::numeric as cost_usd',
    ].join(", ");

    const finalCols = [
      "pd.code",
      "pd.description",
      "id.stock_units",
      "id.stock_boxes",
      "id.cost_usd",
      "id.qty_per_box",
      "CASE WHEN id.qty_per_box IS NOT NULL AND id.qty_per_box > 0 THEN (id.stock_units / id.qty_per_box) ELSE NULL END AS inventory_boxes",
      "NULL::numeric as physical_boxes",
      "NULL::numeric as difference_boxes",
    ].join(", ");

    const sql =
      "WITH psrc AS ( " +
      "  SELECT " + pSelectCols + " " +
      '  FROM "' + pResolved.schema + '"."' + pResolved.table + '" p ' +
      '  WHERE p."' + pCode + '" = $1 ' +
      "), " +
      "ps AS ( SELECT * FROM psrc ), " +
      "isrc AS ( " +
      "  SELECT " + iSelectCols + " " +
      '  FROM "' + iResolved.schema + '"."' + iResolved.table + '" i ' +
      "), " +
      "i_dedup AS ( " +
      "  SELECT * FROM ( " +
      "    SELECT isrc.*, ROW_NUMBER() OVER (PARTITION BY code ORDER BY code) AS rn " +
      "    FROM isrc " +
      "  ) t WHERE rn = 1 " +
      ") " +
      "SELECT " + finalCols + " " +
      "FROM ps pd " +
      "LEFT JOIN i_dedup id ON id.code = pd.code " +
      "LIMIT 1";

    const { rows } = await pool.query(sql, [codeParam]);

    const markup = Number(process.env.PRICE_MARKUP ?? "0");
    const out = rows.map((r: any) => {
      const cost = r.cost_usd != null ? Number(r.cost_usd) : null;
      const price =
        cost != null && Number.isFinite(cost)
          ? (cost * (1 + (Number.isFinite(markup) ? markup : 0))).toFixed(2)
          : null;
      return { ...r, price_usd: price };
    });

    res.json(out[0] ?? null);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "product detail error" });
  }
});

export default router;