/**
 * @jest-environment node
 *
 * s10c / D6 — Fase B.
 * `npm test` no puede apuntar DATABASE_URL a produccion.
 *
 * ROJO antes de jest.setup.js: next/jest carga .env y DATABASE_URL sigue
 * siendo la de produccion. No imprime URLs (solo compara identidades).
 */

describe('D6 — guarda de BD en tests', () => {
  it('deja registrada la URL de produccion por separado', () => {
    expect(process.env.DATABASE_URL_PROD).toBeTruthy()
  })

  it('DATABASE_URL no apunta a produccion', () => {
    expect(process.env.DATABASE_URL).not.toBe(process.env.DATABASE_URL_PROD)
  })

  it('DATABASE_URL apunta a TEST_DATABASE_URL', () => {
    expect(process.env.TEST_DATABASE_URL).toBeTruthy()
    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL)
  })
})
