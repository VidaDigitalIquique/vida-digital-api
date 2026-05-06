/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PettycashClient } from './client_page';

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const mov = {
  id: 1,
  fecha: '2026-05-06',
  tipo: 'ingreso' as const,
  concepto: 'Venta',
  monto: 10000,
  creado_por: 'admin',
  created_at: '2026-05-06T12:00:00Z',
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [mov], saldo: 10000, total: 1 }),
  }) as any;
});

// RED: falla hasta que se agregue botón editar en client_page.tsx
test('smoke: botón editar presente para admin', async () => {
  render(<PettycashClient {...({ isAdmin: true } as any)} />);
  await waitFor(() => {
    expect(screen.getAllByLabelText('Editar registro')).toHaveLength(1);
  });
});
