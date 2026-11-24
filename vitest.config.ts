import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    env: {
      // D6: nunca la URL de produccion; sin rama de pruebas, falla cerrado.
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://test-guard:test-guard@127.0.0.1:9/test-guard',
    },
    environmentOptions: {},
  },
});
