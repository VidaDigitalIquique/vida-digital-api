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

/* eslint-disable @typescript-eslint/no-require-imports -- setup de jest: corre en CJS */
// Polyfills jsdom (G3) — el orden importa: undici se evalua al requerirse y necesita TextEncoder.
// Nota (R2): el IntersectionObserver avisa isIntersecting:true a proposito; un no-op silencioso
// romperia los asserts de visibilidad. No ejercita visibilidad real (jsdom no tiene layout).
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

// jsdom no trae Web Streams; undici (Request) las necesita al evaluarse.
const { ReadableStream, TransformStream, WritableStream } = require('stream/web');
if (!global.ReadableStream) global.ReadableStream = ReadableStream;
if (!global.TransformStream) global.TransformStream = TransformStream;
if (!global.WritableStream) global.WritableStream = WritableStream;
// Solo MessagePort: undici lo exige al evaluarse. MessageChannel real de worker_threads NO se
// inyecta: react-dom/scheduler lo usaria para sus tareas y dejaria un MessagePort abierto que
// impide que jest termine (open handle).
if (!global.MessagePort) global.MessagePort = class MessagePort {};

const { Request, Response, Headers, fetch } = require('undici'); // CJS verificado (main: index.js)
if (!global.Request) global.Request = Request;
if (!global.Response) global.Response = Response; // next/server (NextResponse) lo necesita
if (!global.Headers) global.Headers = Headers;
if (!global.fetch) global.fetch = fetch; // jsdom no trae fetch; las cards lo usan al montar

if (!global.IntersectionObserver) {
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ isIntersecting: true, target: el }], this); }
    unobserve() {} disconnect() {} takeRecords() { return []; }
  };
}
