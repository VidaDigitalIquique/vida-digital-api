/**
 * @jest-environment jsdom
 *
 * s10c / D8 — Fase B.
 * Input y Button deben reenviar el ref al elemento DOM real.
 *
 * ROJO hoy: ambos son funciones planas; React avisa
 * "Function components cannot be given refs" y el ref queda en null.
 */
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const REF_WARNING = 'Function components cannot be given refs'

function espiarWarningsDeRef() {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const warnings = () =>
    spy.mock.calls
      .map((args) => args.map(String).join(' '))
      .filter((line) => line.includes(REF_WARNING))
  return { spy, warnings }
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

describe('D8 — refs en componentes ui', () => {
  it('Input (sin type) reenvia el ref al <input> real', () => {
    const { spy, warnings } = espiarWarningsDeRef()
    const ref = React.createRef<HTMLInputElement>()

    render(<Input ref={ref} defaultValue="x" />)

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(warnings()).toEqual([])
    spy.mockRestore()
  })

  it('Input type="text" reenvia el ref a traves de SpellCheckedInput', () => {
    const { spy, warnings } = espiarWarningsDeRef()
    const ref = React.createRef<HTMLInputElement>()

    render(<Input ref={ref} type="text" placeholder="buscar" />)

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(warnings()).toEqual([])
    spy.mockRestore()
  })

  it('Button reenvia el ref al boton real', () => {
    const { spy, warnings } = espiarWarningsDeRef()
    const ref = React.createRef<HTMLButtonElement>()

    render(<Button ref={ref}>Cerrar</Button>)

    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(warnings()).toEqual([])
    spy.mockRestore()
  })
})
