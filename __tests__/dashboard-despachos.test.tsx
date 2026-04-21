/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardClient } from '@/app/(app)/dashboard/client_page';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

const baseProps = {
  stats: {},
  stockCompare: [],
  despachosHoyCount: 2,
  ultimoDia: null,
  penultimoDia: null,
};

const despachosHoy = [
  { id: 1, folio: '12345', imagen_url: 'https://example.com/img1.jpg', created_at: '2026-04-21T10:30:00Z' },
  { id: 2, folio: '67890', imagen_url: 'https://example.com/img2.jpg', created_at: '2026-04-21T11:00:00Z' },
];

describe('DashboardClient — sección Despachos de Bodega', () => {
  test('muestra los folios de los despachos de hoy', () => {
    render(<DashboardClient {...baseProps} despachosHoy={despachosHoy} />);

    expect(screen.getByText('#12345')).toBeInTheDocument();
    expect(screen.getByText('#67890')).toBeInTheDocument();
  });

  test('al hacer clic en un folio se abre el modal con la info del despacho', () => {
    render(<DashboardClient {...baseProps} despachosHoy={despachosHoy} />);

    fireEvent.click(screen.getByText('#12345'));

    expect(screen.getByText(/nota de venta/i)).toBeVisible();
  });

  test('si no hay despachos hoy muestra mensaje vacío', () => {
    render(<DashboardClient {...baseProps} despachosHoy={[]} despachosHoyCount={0} />);

    expect(screen.getByText(/sin despachos/i)).toBeInTheDocument();
  });
});
