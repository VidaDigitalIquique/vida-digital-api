/**
 * @jest-environment jsdom
 */
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';
import { TopNav } from '@/components/TopNav';

// jsdom de jest no define TextEncoder/TextDecoder y react-dom/server (cargado abajo con require)
// los necesita; se registran antes de requerirlo.
const g = globalThis as unknown as Record<string, unknown>;
g.TextEncoder = g.TextEncoder ?? TextEncoder;
g.TextDecoder = g.TextDecoder ?? TextDecoder;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToString } = require('react-dom/server') as typeof import('react-dom/server');

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { rol: 'admin', nombre: 'Admin Prueba' } } }),
  signOut: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/precios',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/contexts/AlertasContext', () => ({
  useAlertas: () => ({ alertasCount: 0, stockBajoCount: 0 }),
}));

jest.mock('@/components/ui/dropdown-menu', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  const Mock = ({ children }: { children?: React.ReactNode }) => R.createElement('div', null, children);
  return {
    DropdownMenu: Mock,
    DropdownMenuTrigger: Mock,
    DropdownMenuContent: Mock,
    DropdownMenuItem: Mock,
  };
});

const HORA_SERVIDOR = new Date(2026, 0, 1, 20, 0, 0); // 20h -> "Buenas noches"
const HORA_CLIENTE = new Date(2026, 0, 1, 10, 0, 0); // 10h -> "Buenos días"

async function hidratarConHorasDiferentes() {
  jest.setSystemTime(HORA_SERVIDOR);
  const html = renderToString(<TopNav />);

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  jest.setSystemTime(HORA_CLIENTE);

  const errores: string[] = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errores.push(args.map((a) => String(a)).join(' '));
  });

  g.IS_REACT_ACT_ENVIRONMENT = true;
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, <TopNav />);
  });
  spy.mockRestore();

  const texto = container.textContent ?? '';
  await act(async () => {
    root!.unmount();
  });
  container.remove();
  return { errores, texto };
}

describe('TopNav — saludo e hidratacion', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no emite errores de hidratacion cuando la hora del servidor y del cliente caen en rangos distintos', async () => {
    const { errores } = await hidratarConHorasDiferentes();

    const hidratacion = errores.filter((m) =>
      /did not match|Text content|hydrat|server-rendered/i.test(m)
    );
    expect(hidratacion).toEqual([]);
  });

  it('tras montar muestra el saludo de la hora del cliente y el primer nombre', async () => {
    const { texto } = await hidratarConHorasDiferentes();

    expect(texto).toContain('Buenos días');
    expect(texto).toContain('Admin');
  });
});
