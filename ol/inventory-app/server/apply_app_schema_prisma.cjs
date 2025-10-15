const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  try {
    const sql = fs.readFileSync("app_schema.sql", "utf8");
    const statements = sql
      .split(/;\s*[\r\n]+/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt + ";");
    }
    console.log("OK: app_* schema applied with Prisma");
  } catch (e) {
    console.error("FAIL:", e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();