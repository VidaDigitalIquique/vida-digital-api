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
  columnas: [
    { fecha: '2026-05-07', label: 'Hoy — 07 may', despachos: [
      { id: 1, folio: '12345', imagen_url: 'https://example.com/img1.jpg', hora: '10:30' },
      { id: 2, folio: '67890', imagen_url: 'https://example.com/img2.jpg', hora: '11:00' },
    ]},
    { fecha: '2026-05-06', label: '06 may', despachos: [] },
    { fecha: '2026-05-05', label: '05 may', despachos: [
      { id: 3, folio: '11111', imagen_url: null, hora: '09:15' },
    ]},
    { fecha: '2026-05-04', label: '04 may', despachos: [] },
    { fecha: '2026-05-03', label: '03 may', despachos: [] },
    { fecha: '2026-05-02', label: '02 may', despachos: [] },
  ],
};

describe('DashboardClient — sección Despachos de Bodega', () => {
  test('muestra los folios de los despachos en las columnas', () => {
    render(<DashboardClient {...baseProps} />);

    expect(screen.getByText('#12345')).toBeInTheDocument();
    expect(screen.getByText('#67890')).toBeInTheDocument();
    expect(screen.getByText('#11111')).toBeInTheDocument();
  });

  test('al hacer clic en un folio se abre el modal con la info del despacho', () => {
    render(<DashboardClient {...baseProps} />);

    fireEvent.click(screen.getByText('#12345'));

    expect(screen.getByText(/nota de venta/i)).toBeVisible();
  });

  test('columnas sin despachos muestran "Sin despachos"', () => {
    render(<DashboardClient {...baseProps} />);

    const sinDespachos = screen.getAllByText('Sin despachos');
    expect(sinDespachos.length).toBe(4); // columnas[1], [3], [4], [5] = 4
  });

  test('la columna de hoy tiene el label destacado', () => {
    render(<DashboardClient {...baseProps} />);

    expect(screen.getByText('Hoy — 07 may')).toBeInTheDocument();
  });
});
