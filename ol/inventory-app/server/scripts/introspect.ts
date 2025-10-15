import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

function pick(cols: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const hit = cols.find(c => p.test(c));
    if (hit) return hit;
  }
  return null;
}

async function getColumns(pool: Pool, table: string): Promise<string[]> {
  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `;
  const { rows } = await pool.query(q, [table]);
  return rows.map(r => String(r.column_name));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("ERROR: Falta DATABASE_URL en .env");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const productoCols = await getColumns(pool, "producto");
    const inventarCols = await getColumns(pool, "inventar");

    const producto_code = pick(productoCols, [/^(codigo|code|sku|id_prod|cod(_)?producto)$/i]) ?? "codigo";
    const producto_desc = pick(productoCols, [/^(descripcion|description|nombre|name|desc)$/i]) ?? "descripcion";
    const producto_cost = pick(productoCols, [/^(costo(_?usd)?|cost(_?usd)?)$/i]) ?? null;
    const producto_price = pick(productoCols, [/^(precio(_?usd)?|price(_?usd)?)$/i]) ?? null;
    const producto_qty = pick(productoCols, [/^(unidades[_ ]?por[_ ]?caja|qty[_ ]?per[_ ]?box|u[_ ]?x[_ ]?caja|units[_ ]?per[_ ]?box|cant[_ ]?caja)$/i]) ?? null;

    const inventar_code = pick(inventarCols, [/^(codigo|code|sku|id_prod|cod(_)?producto)$/i]) ?? "codigo";
    const inventar_stock_boxes = pick(inventarCols, [/^(stock[_ ]?cajas|cajas|inv[_ ]?cajas|cajas[_ ]?stock)$/i]) ?? null;
    const inventar_stock_units = pick(inventarCols, [/^(stock[_ ]?unidades|unidades|inv[_ ]?unidades|units|qty|cantidad)$/i]) ?? null;
    const derive = !inventar_stock_boxes && !!inventar_stock_units;

    const out = `export const DATA_SOURCES = {
  producto: { table: 'producto', code: '${producto_code}', description: '${producto_desc}', cost_usd: ${producto_cost ? `'${producto_cost}'` : "null"}, price_usd: ${producto_price ? `'${producto_price}'` : "null"}, qty_per_box: ${producto_qty ? `'${producto_qty}'` : "null"} },
  inventar: { table: 'inventar', code: '${inventar_code}', stock_boxes: ${inventar_stock_boxes ? `'${inventar_stock_boxes}'` : "null"}, stock_units: ${inventar_stock_units ? `'${inventar_stock_units}'` : "null"}, derive_boxes_from_units: ${derive} },
  clientes: { table: 'clientes' },
  itemdcto: { table: 'itemdcto' },
  movidcto: { table: 'movidcto' }
} as const;
`;

    const targetDir = path.join("src", "config");
    fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, "data-sources.ts");
    fs.writeFileSync(target, out, { encoding: "utf8" });

    console.log("OK: data-sources.ts generado en", target);
    console.log("Mapeo detectado:", {
      producto: { code: producto_code, description: producto_desc, cost_usd: producto_cost, price_usd: producto_price, qty_per_box: producto_qty },
      inventar: { code: inventar_code, stock_boxes: inventar_stock_boxes, stock_units: inventar_stock_units, derive_boxes_from_units: derive }
    });
  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error("FAIL introspect:", e.message);
  process.exit(1);
});
