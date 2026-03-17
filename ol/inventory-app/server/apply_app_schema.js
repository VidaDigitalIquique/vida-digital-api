const fs = require("fs");
const { Client } = require("pg");
require("dotenv").config(); // carga .env

(async () => {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.error("ERROR: Falta DATABASE_URL en .env");
      process.exit(1);
    }
    const sql = fs.readFileSync("app_schema.sql", "utf8");
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log("OK: app_* schema applied");
  } catch (e) {
    console.error("FAIL:", e.message);
    process.exit(1);
  }
})();