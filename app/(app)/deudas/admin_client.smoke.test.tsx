/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DeudasAdminClient } from './admin_client';

jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

const mockHistorial = {
  prestamos: [{ deuda_id: 1, pago_id: null, tipo: 'prestamo', monto: 50000, descripcion: null, fecha_hora: '2026-05-01T10:00:00Z', item_tipo: 'deuda' }],
  adelantos: [{ deuda_id: 2, pago_id: null, tipo: 'adelanto', monto: 20000, descripcion: 'Mayo', fecha_hora: '2026-05-02T10:00:00Z', item_tipo: 'deuda' }],
};

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (String(url).includes('admin/usuarios'))
      return Promise.resolve({ ok: true, json: async () => ({ data: [{ id: 1, nombre: 'Juan' }] }) });
    if (String(url).includes('historial'))
      return Promise.resolve({ ok: true, json: async () => mockHistorial });
    return Promise.resolve({ ok: true, json: async () => ({ deudas: [] }) });
  }) as any;
});

// RED: falla hasta que se agreguen las tarjetas de historial en admin_client.tsx
test('smoke: tarjetas Préstamos y Adelantos y Quincenas visibles al seleccionar trabajador', async () => {
  render(<DeudasAdminClient />);
  await screen.findByText('Juan');
  const select = screen.getAllByRole('combobox')[0];
  fireEvent.change(select, { target: { value: '1' } });
  await waitFor(() => {
    expect(screen.getByText('Préstamos')).toBeInTheDocument();
    expect(screen.getByText('Adelantos y Quincenas')).toBeInTheDocument();
  });
});
