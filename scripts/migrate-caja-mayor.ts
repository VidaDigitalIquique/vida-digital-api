/**
 * Migración del Excel "Caja Mayor (Bank).xlsm" → caja_movimientos + caja_movimiento_notas.
 *
 * Uso: npx tsx --env-file=.env scripts/migrate-caja-mayor.ts "<ruta al Excel>"
 * Ejemplo: npx tsx --env-file=.env scripts/migrate-caja-mayor.ts "C:\Users\pablo\Downloads\Caja Mayor (Bank).xlsm"
 */

import { neon } from "@neondatabase/serverless";
import * as XLSX from "xlsx";
import * as path from "path";

// ─── Config ──────────────────────────────────────────────────────

const excelArg = process.argv[2];

if (!excelArg) {
  console.error("ERROR: Debes especificar la ruta al archivo Excel.");
  console.error("Uso: npx tsx --env-file=.env scripts/migrate-caja-mayor.ts \"<ruta al Excel>\"");
  console.error('Ejemplo: npx tsx --env-file=.env scripts/migrate-caja-mayor.ts "C:\\Users\\pablo\\Downloads\\Caja Mayor (Bank).xlsm"');
  process.exit(1);
}

const EXCEL_PATH = path.resolve(excelArg);

// Cuentas bancarias según seed del PRD
const CUENTAS = {
  dolar: {
    santander: 1,       // Santander USD
    scotiabankSJ: 3,    // Scotiabank SJ USD
    scotiabankVD: 5,    // Scotiabank VD USD
  },
  peso: {
    santander: 2,       // Santander CLP
    scotiabankSJ: 4,    // Scotiabank SJ CLP
    scotiabankVD: 6,    // Scotiabank VD CLP
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────

function roundUpToHalf(value: number): number {
  return Math.ceil(value * 2) / 2;
}

function excelDateToISO(serial: number): string {
  // Excel epoch: 1900-01-01 = serial 1 (with the 1900 leap year bug)
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 86400000;
  const date = new Date(excelEpoch.getTime() + serial * msPerDay);
  return date.toISOString().slice(0, 10);
}

function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function parseNotaNumbers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const str = String(raw).trim();
  // Split by /, -, or whitespace; filter empty; normalize
  const parts = str.split(/[/\-\s]+/).filter(Boolean);
  // Keep only numeric-looking tokens (note numbers)
  return parts.filter((p) => /^\d+$/.test(p));
}

type MovementRow = {
  fecha: string;
  tipo: "cobro" | "gasto";
  nombre_cliente: string | null;
  notas_raw: string | null;
  cuenta_id: number;
  moneda: "USD" | "CLP";
  monto: number;
  monto_usd: number;
  tipo_cambio: number | null;
  forma_pago: "efectivo" | "cheque" | "transferencia";
  observaciones: string | null;
  empresa: "vida" | "sanjh" | null;
};

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL no está definida. Usa --env-file=.env");
    process.exit(1);
  }

  const sql = neon(connectionString);

  console.log("Leyendo Excel:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);

  const dolarSheet = wb.Sheets["Dolar"];
  const pesoSheet = wb.Sheets["Peso"];

  if (!dolarSheet || !pesoSheet) {
    console.error("No se encontraron las hojas 'Dolar' y 'Peso' en el Excel.");
    process.exit(1);
  }

  const dolarData = XLSX.utils.sheet_to_json<any[]>(dolarSheet, { header: 1, defval: null });
  const pesoData = XLSX.utils.sheet_to_json<any[]>(pesoSheet, { header: 1, defval: null });

  // ─── Parse Dolar sheet ─────────────────────────────────────────

  function parseDolarSheet(data: any[][]): MovementRow[] {
    const movements: MovementRow[] = [];
    let lastDate: string | null = null;

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.every((c: any) => c === null || c === "")) continue;

      // Propagate date
      const fechaRaw = row[0];
      const clienteRaw = row[1];
      const notaRaw = row[2];
      const santanderRaw = row[3];
      const scotiaSJRaw = row[4];
      const scotiaVDRaw = row[5];
      const notasRaw = row[6];
      const altNameRaw = row[7]; // Columna H sin nombre — nombre cliente alternativo

      if (fechaRaw !== null && fechaRaw !== "" && fechaRaw !== undefined) {
        if (typeof fechaRaw === "number") {
          lastDate = excelDateToISO(fechaRaw);
        } else {
          lastDate = String(fechaRaw).trim();
        }
      }

      if (!lastDate) continue; // Skip rows before first date

      // Determine forma_pago from Santander column if it's text
      let rowFormaPago: "efectivo" | "cheque" | "transferencia" | null = null;
      if (typeof santanderRaw === "string" && santanderRaw.trim() && isNaN(Number(santanderRaw))) {
        const s = santanderRaw.trim().toLowerCase();
        if (s.includes("cheque")) rowFormaPago = "cheque";
        else if (s.includes("transferencia") || s.includes("transf")) rowFormaPago = "transferencia";
        else if (s.includes("cash") || s.includes("efectivo")) rowFormaPago = "efectivo";
      }

      // Determine nombre_cliente: prefer CLIENTE column, fallback to altName (col 7)
      let nombreCliente: string | null = null;
      if (clienteRaw && String(clienteRaw).trim()) {
        nombreCliente = String(clienteRaw).trim();
      } else if (altNameRaw && String(altNameRaw).trim()) {
        nombreCliente = String(altNameRaw).trim();
      }

      const columnaNotas = notaRaw ? String(notaRaw).trim() : null;

      // Observaciones: content from NOTAS column, or CLIENTE if it looks like a description
      let observaciones: string | null = null;
      if (notasRaw && String(notasRaw).trim()) {
        observaciones = String(notasRaw).trim();
      }

      // Bank columns: [santander, scotiaSJ, scotiaVD] → cuenta IDs
      const bankColumns = [
        { raw: santanderRaw, cuentaId: CUENTAS.dolar.santander },
        { raw: scotiaSJRaw, cuentaId: CUENTAS.dolar.scotiabankSJ },
        { raw: scotiaVDRaw, cuentaId: CUENTAS.dolar.scotiabankVD },
      ];

      for (const bc of bankColumns) {
        const val = parseNumeric(bc.raw);
        if (val === null || val === 0) continue;

        const tipo: "cobro" | "gasto" = val >= 0 ? "cobro" : "gasto";
        const absVal = Math.abs(val);
        const formaPago = rowFormaPago || "transferencia"; // default if no text hint

        movements.push({
          fecha: lastDate,
          tipo,
          nombre_cliente: nombreCliente,
          notas_raw: columnaNotas,
          cuenta_id: bc.cuentaId,
          moneda: "USD",
          monto: absVal,
          monto_usd: absVal,
          tipo_cambio: null,
          forma_pago: formaPago,
          observaciones,
          empresa: null, // Will be resolved later via movidcto lookup
        });
      }
    }

    return movements;
  }

  // ─── Parse Peso sheet ──────────────────────────────────────────

  function parsePesoSheet(data: any[][]): MovementRow[] {
    const movements: MovementRow[] = [];
    let lastDate: string | null = null;

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.every((c: any) => c === null || c === "")) continue;

      const fechaRaw = row[0];
      const clienteRaw = row[1];
      const notaRaw = row[2];
      const santanderRaw = row[3];
      const scotiaSJRaw = row[4];
      const scotiaVDRaw = row[5];
      const montoDolarRaw = row[6];  // Pre-calculated USD equivalent
      const cambioRaw = row[7];       // Exchange rate used
      const notasRaw = row[8];
      const altNameRaw = row[9];      // Columna J sin nombre

      if (fechaRaw !== null && fechaRaw !== "" && fechaRaw !== undefined) {
        if (typeof fechaRaw === "number") {
          lastDate = excelDateToISO(fechaRaw);
        } else {
          lastDate = String(fechaRaw).trim();
        }
      }

      if (!lastDate) continue;

      // Determine forma_pago from PESOS SANTANDER column if text
      let rowFormaPago: "efectivo" | "cheque" | "transferencia" | null = null;
      if (typeof santanderRaw === "string" && santanderRaw.trim() && isNaN(Number(santanderRaw))) {
        const s = santanderRaw.trim().toLowerCase();
        if (s.includes("cheque")) rowFormaPago = "cheque";
        else if (s.includes("transferencia") || s.includes("transf")) rowFormaPago = "transferencia";
        else if (s.includes("cash") || s.includes("efectivo")) rowFormaPago = "efectivo";
      }

      let nombreCliente: string | null = null;
      if (clienteRaw && String(clienteRaw).trim()) {
        nombreCliente = String(clienteRaw).trim();
      } else if (altNameRaw && String(altNameRaw).trim()) {
        nombreCliente = String(altNameRaw).trim();
      }

      const columnaNotas = notaRaw ? String(notaRaw).trim() : null;

      let observaciones: string | null = null;
      if (notasRaw && String(notasRaw).trim()) {
        observaciones = String(notasRaw).trim();
      }

      // Exchange rate: prefer row's CAMBIO, fallback to pre-calculated (MONTO PESOS / MONTO DOLAR)
      let tipoCambio = parseNumeric(cambioRaw);
      const montoDolarPre = parseNumeric(montoDolarRaw);

      const bankColumns = [
        { raw: santanderRaw, cuentaId: CUENTAS.peso.santander },
        { raw: scotiaSJRaw, cuentaId: CUENTAS.peso.scotiabankSJ },
        { raw: scotiaVDRaw, cuentaId: CUENTAS.peso.scotiabankVD },
      ];

      for (const bc of bankColumns) {
        const val = parseNumeric(bc.raw);
        if (val === null || val === 0) continue;

        const tipo: "cobro" | "gasto" = val >= 0 ? "cobro" : "gasto";
        const absVal = Math.abs(val);
        const formaPago = rowFormaPago || "transferencia";

        // Calculate monto_usd
        let montoUsd: number;
        let tc: number | null = tipoCambio;

        if (montoDolarPre !== null && montoDolarPre !== 0 && tc === null) {
          // Infer rate from pre-calculated values
          tc = Math.round(absVal / montoDolarPre);
        }

        if (tc && tc > 0) {
          montoUsd = roundUpToHalf(absVal / tc);
        } else {
          // Fallback: use dolar_dia from caja_config (will be resolved later)
          montoUsd = 0; // placeholder
          tc = null;
        }

        movements.push({
          fecha: lastDate,
          tipo,
          nombre_cliente: nombreCliente,
          notas_raw: columnaNotas,
          cuenta_id: bc.cuentaId,
          moneda: "CLP",
          monto: absVal,
          monto_usd: montoUsd,
          tipo_cambio: tc,
          forma_pago: formaPago,
          observaciones,
          empresa: null,
        });
      }
    }

    return movements;
  }

  const dolarMovs = parseDolarSheet(dolarData);
  const pesoMovs = parsePesoSheet(pesoData);
  const allMovs = [...dolarMovs, ...pesoMovs];

  console.log(`Filas parseadas: Dolar=${dolarMovs.length}, Peso=${pesoMovs.length}, Total=${allMovs.length}`);

  // ─── Resolve fallback tipo_cambio for CLP rows ──────────────────

  let dolarDiaConfig = 0;
  try {
    const cfgRows = await sql`SELECT valor FROM caja_config WHERE clave = 'dolar_dia'`;
    dolarDiaConfig = parseFloat(cfgRows[0]?.valor || "0");
  } catch {
    // Table might not exist yet; will handle below
  }

  for (const mov of allMovs) {
    if (mov.moneda === "CLP" && mov.monto_usd === 0) {
      if (dolarDiaConfig > 0) {
        mov.monto_usd = roundUpToHalf(mov.monto / dolarDiaConfig);
        mov.tipo_cambio = dolarDiaConfig;
      } else {
        mov.monto_usd = roundUpToHalf(mov.monto / 980); // fallback hardcoded
        mov.tipo_cambio = 980;
      }
    }
  }

  // ─── Resolve kcodcli2 and empresa ───────────────────────────────

  // Cache for client lookups
  const clientCache = new Map<string, { kcodcli2: number; empresa: "vida" | "sanjh" } | null>();

  async function resolveClient(nombre: string | null): Promise<{
    kcodcli2: number | null;
    empresa: "vida" | "sanjh" | null;
  }> {
    if (!nombre) return { kcodcli2: null, empresa: null };

    const key = nombre.toLowerCase().trim();
    if (clientCache.has(key)) {
      const cached = clientCache.get(key)!;
      if (cached === null) return { kcodcli2: null, empresa: null };
      return { kcodcli2: cached.kcodcli2, empresa: cached.empresa };
    }

    // Search vida first, then sanjh
    const vidaRows = await sql`
      SELECT DISTINCT kcodcli2 FROM vida.movidcto
      WHERE cliente ILIKE ${"%" + nombre + "%"} AND tipomovi = 'V'
      LIMIT 1
    `;
    if (vidaRows.length > 0) {
      const kc = parseInt(String(vidaRows[0].kcodcli2), 10);
      clientCache.set(key, { kcodcli2: kc, empresa: "vida" });
      return { kcodcli2: kc, empresa: "vida" };
    }

    const sanjhRows = await sql`
      SELECT DISTINCT kcodcli2 FROM sanjh.movidcto
      WHERE cliente ILIKE ${"%" + nombre + "%"} AND tipomovi = 'V'
      LIMIT 1
    `;
    if (sanjhRows.length > 0) {
      const kc = parseInt(String(sanjhRows[0].kcodcli2), 10);
      clientCache.set(key, { kcodcli2: kc, empresa: "sanjh" });
      return { kcodcli2: kc, empresa: "sanjh" };
    }

    clientCache.set(key, null);
    return { kcodcli2: null, empresa: null };
  }

  // ─── Resolve notas → imputaciones ───────────────────────────────

  async function resolveNotas(
    movMontoUsd: number,
    notasRaw: string | null,
    empresa: "vida" | "sanjh" | null,
  ): Promise<{ empresa: string; knumfoli: string; monto_aplicado: number }[]> {
    if (!notasRaw || !empresa || movMontoUsd <= 0) return [];

    const numeros = parseNotaNumbers(notasRaw);
    if (numeros.length === 0) return [];

    // Fetch val_rea for each nota
    interface NotaInfo {
      knumfoli: string;
      val_rea: number;
      fechanvt: string;
    }

    const notas: NotaInfo[] = [];
    for (const num of numeros) {
      const rows = empresa === "vida"
        ? await sql`SELECT knumfoli, val_rea, fechanvt::text FROM vida.movidcto WHERE knumfoli = ${num} AND tipomovi = 'V' LIMIT 1`
        : await sql`SELECT knumfoli, val_rea, fechanvt::text FROM sanjh.movidcto WHERE knumfoli = ${num} AND tipomovi = 'V' LIMIT 1`;
      if (rows.length > 0) {
        notas.push({
          knumfoli: num,
          val_rea: parseFloat(String(rows[0].val_rea)),
          fechanvt: String(rows[0].fechanvt),
        });
      }
    }

    if (notas.length === 0) return [];

    // Sort by fechanvt ASC (oldest first)
    notas.sort((a, b) => a.fechanvt.localeCompare(b.fechanvt));

    // Apply monto_usd sequentially
    const imputaciones: { empresa: string; knumfoli: string; monto_aplicado: number }[] = [];
    let remaining = movMontoUsd;

    for (const nota of notas) {
      if (remaining <= 0.005) break;
      const aplicar = Math.min(nota.val_rea, remaining);
      if (aplicar > 0.005) {
        imputaciones.push({
          empresa,
          knumfoli: nota.knumfoli,
          monto_aplicado: Math.round(aplicar * 100) / 100,
        });
        remaining -= aplicar;
      }
    }

    return imputaciones;
  }

  // ─── TRANSACTION: Insert everything ──────────────────────────────

  let totalMovimientos = 0;
  let totalImputaciones = 0;
  let totalErrores = 0;

  try {
    // Use raw SQL transaction via Neon (Neon supports multiple statements)
    console.log("Iniciando migración...");

    for (let i = 0; i < allMovs.length; i++) {
      const mov = allMovs[i];

      try {
        // Resolve client
        const { kcodcli2, empresa } = await resolveClient(mov.nombre_cliente);
        mov.empresa = empresa;

        // If it's a gasto and the nombre_cliente doesn't match any client,
        // move it to observaciones
        let finalObs = mov.observaciones;
        let finalNombreCliente = mov.nombre_cliente;
        if (mov.tipo === "gasto" && !kcodcli2 && mov.nombre_cliente) {
          finalObs = finalObs
            ? `${finalObs}; ${mov.nombre_cliente}`
            : mov.nombre_cliente;
          // Still keep nombre_cliente in the field for traceability
        }

        // Insert movement
        const inserted = await sql`
          INSERT INTO caja_movimientos (
            fecha, tipo, kcodcli2, nombre_cliente, cuenta_id, moneda,
            monto, monto_usd, tipo_cambio, forma_pago, observaciones,
            empresa, usuario_id, usuario_nombre
          ) VALUES (
            ${mov.fecha}::date,
            ${mov.tipo},
            ${kcodcli2 ?? null},
            ${finalNombreCliente ?? null},
            ${mov.cuenta_id},
            ${mov.moneda},
            ${mov.monto},
            ${mov.monto_usd},
            ${mov.tipo_cambio},
            ${mov.forma_pago},
            ${finalObs ?? null},
            ${mov.empresa ?? null},
            1,
            'Migración Excel'
          )
          RETURNING id, monto_usd
        `;

        const movimientoId = inserted[0].id as number;
        const montoUsdInsertado = parseFloat(String(inserted[0].monto_usd));
        totalMovimientos++;

        // Resolve and insert imputaciones
        const imputaciones = await resolveNotas(montoUsdInsertado, mov.notas_raw, mov.empresa);
        for (const imp of imputaciones) {
          await sql`
            INSERT INTO caja_movimiento_notas (movimiento_id, empresa, knumfoli, monto_aplicado)
            VALUES (${movimientoId}, ${imp.empresa}, ${imp.knumfoli}, ${imp.monto_aplicado})
          `;
          totalImputaciones++;
        }

        if ((i + 1) % 100 === 0) {
          console.log(`  Progreso: ${i + 1}/${allMovs.length} filas...`);
        }
      } catch (rowError: any) {
        console.error(`  Error en fila ${i + 1}: ${rowError.message}`);
        totalErrores++;
      }
    }

    console.log("\n========== RESUMEN ==========");
    console.log(`Filas procesadas:      ${allMovs.length}`);
    console.log(`Movimientos creados:    ${totalMovimientos}`);
    console.log(`Imputaciones creadas:   ${totalImputaciones}`);
    console.log(`Filas con error:        ${totalErrores}`);
    console.log("==============================");
  } catch (fatalError: any) {
    console.error("ERROR FATAL:", fatalError.message);
    console.error("La migración se detuvo. Los registros insertados hasta ahora están confirmados.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
