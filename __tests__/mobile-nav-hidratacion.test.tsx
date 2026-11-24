/** @jest-environment jsdom */
import React from 'react';
import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { TextEncoder, TextDecoder } from 'util';
import { MobileNav } from '@/components/MobileNav';
const g = globalThis as unknown as Record<string, unknown>;
g.TextEncoder = g.TextEncoder ?? TextEncoder; g.TextDecoder = g.TextDecoder ?? TextDecoder;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToString } = require('react-dom/server') as typeof import('react-dom/server');
let mockPath = '/dashboard';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath, useSearchParams: () => new URLSearchParams() }));
jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));
jest.mock('@/contexts/AlertasContext', () => ({ useAlertas: () => ({ alertasCount: 0, stockBajoCount: 0, seguimientosCount: 0 }) }));
test.each([['admin', '/dashboard'], ['vendedor', '/precios'], ['bodeguero', '/bodega/despachos'], ['supervisor', '/dashboard'], [undefined, '/dashboard']] as const)('hidrata %s %s con reloj distinto', async (rol, path) => {
  mockPath = path; jest.useFakeTimers();
  const container = document.createElement('div'); document.body.appendChild(container);
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const recover = jest.fn(); let root: ReturnType<typeof hydrateRoot> | undefined;
  try {
    jest.setSystemTime(new Date('2026-01-01T20:00:00Z'));
    container.innerHTML = renderToString(<MobileNav rol={rol} />);
    const html = container.innerHTML;
    jest.setSystemTime(new Date('2026-01-02T10:00:00Z'));
    await act(async () => { root = hydrateRoot(container, <MobileNav rol={rol} />, { onRecoverableError: recover }); });
    expect(container.innerHTML).toBe(html); expect(recover).not.toHaveBeenCalled(); expect(errors).not.toHaveBeenCalled();
  } finally {
    await act(async () => root?.unmount()); container.remove(); errors.mockRestore(); jest.useRealTimers();
  }
});
