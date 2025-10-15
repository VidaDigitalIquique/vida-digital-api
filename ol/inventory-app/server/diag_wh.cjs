const { Client } = require("pg");
require("dotenv").config({ path: __dirname + "/.env" });

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("FALTA DATABASE_URL"); process.exit(1); }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const qCols = `
    SELECT table_name, column_name, data_type
      FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name IN ('app_physical_count','app_location','app_audit_log')
     ORDER BY table_name, ordinal_position
  `;

  console.log("=== COLUMNAS ===");
  const cols = await client.query(qCols);
  const grouped = cols.rows.reduce((acc, r) => {
    acc[r.table_name] = acc[r.table_name] || [];
    acc[r.table_name].push({ column: r.column_name, type: r.data_type });
    return acc;
  }, {});
  console.dir(grouped, { depth: null });

  // Probar app_audit_log (dentro de TX → ROLLBACK)
  console.log("\n=== PROBAR INSERT app_audit_log (ROLLBACK) ===");
  try {
    await client.query("BEGIN");
    const id = "diag-" + Math.random().toString(16).slice(2);
    await client.query(
      `INSERT INTO app_audit_log (id, "actorUserId", action, entity, "entityId", diff)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [id, "system", "DIAG_TEST", "diag_entity", "diag_entity_id", JSON.stringify({ping:true})]
    );
    await client.query("ROLLBACK");
    console.log("OK insert (rollback).");
  } catch (e) {
    await client.query("ROLLBACK").catch(()=>{});
    console.error("ERROR insert audit:", e.message);
  }

  // Probar app_physical_count (dentro de TX → ROLLBACK)
  console.log("\n=== PROBAR INSERT app_physical_count (ROLLBACK) ===");
  try {
    const loc = await client.query(`SELECT id FROM app_location WHERE code = 'D1' LIMIT 1`);
    if (loc.rowCount === 0) throw new Error("No existe location code 'D1'");

    const id = "diag-" + Math.random().toString(16).slice(2);
    // Descubrir nombres de columnas compatibles
    const ccols = await client.query(`
      SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='app_physical_count'
    `);
    const names = ccols.rows.map(r => r.column_name.toLowerCase());
    const colProd = names.includes("productcode") ? '"productCode"' :
                    names.includes("productcode".toLowerCase()) ? '"productcode"' : null;
    const colBoxes = names.includes("countedboxes") ? '"countedBoxes"' :
                     names.includes("countedboxes".toLowerCase()) ? '"countedboxes"' : null;
    const colAt = names.includes("countedat") ? '"countedAt"' :
                  names.includes("countedat".toLowerCase()) ? '"countedat"' : null;
    const colNote = names.includes("note") ? '"note"' : null;
    if (!colProd || !colBoxes) throw new Error("Faltan columnas productCode/countedBoxes en app_physical_count");

    const cols = ['id', colProd, 'location_id', colBoxes];
    const vals = ['$1','$2','$3','$4'];
    const args = [id, 'SF-2074', loc.rows[0].id, 1];

    if (colNote) { cols.push(colNote); vals.push('$5'); args.push('diag note'); }
    if (colAt)   { cols.push(colAt);   vals.push('now()'); }

    await client.query("BEGIN");
    await client.query(`INSERT INTO app_physical_count (${cols.join(',')}) VALUES (${vals.join(',')})`, args);
    await client.query("ROLLBACK");
    console.log("OK insert (rollback).");
  } catch (e) {
    await client.query("ROLLBACK").catch(()=>{});
    console.error("ERROR insert count:", e.message);
  }

  await client.end();
})();