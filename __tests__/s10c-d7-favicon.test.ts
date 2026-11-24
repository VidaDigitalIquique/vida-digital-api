/**
 * @jest-environment node
 *
 * s10c / D7 — Fase B.
 * Solo puede existir UN favicon.ico. El Director midio produccion:
 * GET /favicon.ico devuelve 766 bytes = app/favicon.ico.
 * Por eso se conserva app/favicon.ico y debe desaparecer public/favicon.ico.
 *
 * ROJO hoy: existen los dos.
 */
import fs from 'fs'
import path from 'path'

const raiz = process.cwd()

describe('D7 — favicon.ico unico', () => {
  it('existe app/favicon.ico (el que sirve produccion)', () => {
    expect(fs.existsSync(path.join(raiz, 'app', 'favicon.ico'))).toBe(true)
  })

  it('no existe public/favicon.ico (conflicto que causa el 500 en dev)', () => {
    expect(fs.existsSync(path.join(raiz, 'public', 'favicon.ico'))).toBe(false)
  })
})
