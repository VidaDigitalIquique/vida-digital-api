const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[BOOT] FALTA env DATABASE_URL");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon
});

app.get("/", (req, res) => {
  res.status(200).json({ ok: true, service: "vida-digital-api", entrypoint: __filename });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

async function tableExists(qualified) {
  const parts = qualified.split(".");
  const schema = parts[0]; const table = parts[1];
  const { rows } = await pool.query("SELECT to_regclass($1) IS NOT NULL AS exists", [schema + "." + table]);
  return rows && rows[0] && rows[0].exists === true;
}

app.get("/db/diag", async (_req, res) => {
  try {
    const q = `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type='BASE TABLE'
        AND table_schema IN ('public','sanjh','vida')
      ORDER BY table_schema, table_name
      LIMIT 200;
    `;
    const { rows } = await pool.query(q);
    res.json({ ok: true, tables: rows });
  } catch (e) {
    console.error("[/db/diag] error:", e);
    res.status(500).json({ ok: false, error: "diag_failed", detail: String(e) });
  }
});

function parseLimitOffset(req) {
  var limit = parseInt((req.query && req.query.limit) ? req.query.limit : "50", 10); if (!limit) limit = 50;
  var offset = parseInt((req.query && req.query.offset) ? req.query.offset : "0", 10); if (!offset) offset = 0;
  limit = Math.max(1, Math.min(100, limit));
  offset = Math.max(0, offset);
  return { limit: limit, offset: offset };
}

async function fetchFrom(schema, limit, offset) {
  const sql = "SELECT * FROM " + schema + ".producto LIMIT $1 OFFSET $2";
  console.info("[/products] SQL =>", sql, { schema, limit, offset });
  const { rows } = await pool.query(sql, [limit, offset]);
  return rows.map(function(r){ return Object.assign({ __source: schema + ".producto" }, r); });
}

app.get("/products", async (req, res) => {
  try {
    const lo = parseLimitOffset(req);
    const hasSanjh = await tableExists("sanjh.producto");
    const hasVida  = await tableExists("vida.producto");

    if (!hasSanjh && !hasVida) {
      return res.status(404).json({ ok: false, error: "products_source_not_found", detail: "No existen sanjh.producto ni vida.producto" });
    }

    let data = [];
    if (hasSanjh) data = data.concat(await fetchFrom("sanjh", lo.limit, lo.offset));
    if (hasVida)  data = data.concat(await fetchFrom("vida",  lo.limit, lo.offset));

    res.json({ ok: true, combined: true, count: data.length, data: data });
  } catch (e) {
    console.error("[/products] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

app.get("/products/sanjh", async (req, res) => {
  try {
    const lo = parseLimitOffset(req);
    if (!(await tableExists("sanjh.producto"))) {
      return res.status(404).json({ ok: false, error: "not_found", detail: "sanjh.producto no existe" });
    }
    const data = await fetchFrom("sanjh", lo.limit, lo.offset);
    res.json({ ok: true, source: "sanjh.producto", count: data.length, data: data });
  } catch (e) {
    console.error("[/products/sanjh] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

app.get("/products/vida", async (req, res) => {
  try {
    const lo = parseLimitOffset(req);
    if (!(await tableExists("vida.producto"))) {
      return res.status(404).json({ ok: false, error: "not_found", detail: "vida.producto no existe" });
    }
    const data = await fetchFrom("vida", lo.limit, lo.offset);
    res.json({ ok: true, source: "vida.producto", count: data.length, data: data });
  } catch (e) {
    console.error("[/products/vida] error:", e);
    res.status(500).json({ ok: false, error: "products_failed", detail: String(e) });
  }
});

app.listen(PORT, () => {
  console.log("[BOOT] API up on port " + PORT + " | entrypoint=" + __filename);
});
