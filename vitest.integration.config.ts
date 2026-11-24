import { defineConfig } from 'vitest/config';
import path from 'path';

// Tests de integracion: requieren TEST_DATABASE_URL (rama Neon de pruebas).
// D6: nunca la URL de produccion; sin rama de pruebas, falla cerrado.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://test-guard:test-guard@127.0.0.1:9/test-guard',
    },
  },
});
