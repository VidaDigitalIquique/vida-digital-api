import '@testing-library/jest-dom';

// D6: next/jest carga .env (produccion) en process.env antes de los tests.
// La URL de produccion se lee del archivo (un DATABASE_URL ya exportado en el shell
// puede apuntar a la rama de pruebas; next no pisa variables existentes).
const fs = require('fs');
const path = require('path');

function valorEnEnv(key) {
  for (const archivo of ['.env.local', '.env']) {
    const p = path.join(__dirname, archivo);
    if (!fs.existsSync(p)) continue;
    for (const linea of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const i = linea.indexOf('=');
      if (i < 1 || linea.trim().startsWith('#')) continue;
      if (linea.slice(0, i).trim() === key) {
        return linea.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return '';
}

const prodUrl = valorEnEnv('DATABASE_URL') || process.env.DATABASE_URL || '';
const testUrl = process.env.TEST_DATABASE_URL || valorEnEnv('TEST_DATABASE_URL');

if (prodUrl && testUrl && new URL(testUrl).host === new URL(prodUrl).host) {
  throw new Error(
    'ABORTA: TEST_DATABASE_URL apunta al mismo host que DATABASE_URL (produccion). Configura una rama Neon de pruebas.'
  );
}

// Guarda de Fase B (la usa __tests__/s10c-d6-db-guard.test.ts)
process.env.DATABASE_URL_PROD = prodUrl;
// Sin TEST_DATABASE_URL: host inalcanzable => todo test que consulte la BD falla de inmediato (fail-closed).
process.env.DATABASE_URL =
  testUrl || 'postgresql://test-guard:test-guard@127.0.0.1:9/test-guard';
