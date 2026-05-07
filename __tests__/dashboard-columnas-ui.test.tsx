/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardClient } from '@/app/(app)/dashboard/client_page';

jest.mock('date-fns', () => ({
  format: (date: Date) => (date instanceof Date ? date.toISOString() : String(date)),
}));
jest.mock('date-fns/locale', () => ({ es: {} }));

const stats = {};
const stockCompare: any[] = [];

const columnas = [
  { fecha: '2026-05-07', label: 'Hoy — 07 may', despachos: [
    { id: 1, folio: 'F100', imagen_url: null, hora: '10:30' },
  ]},
  { fecha: '2026-05-06', label: '06 may', despachos: [] },
  { fecha: '2026-05-05', label: '05 may', despachos: [
    { id: 2, folio: 'F99', imagen_url: null, hora: '09:15' },
  ]},
  { fecha: '2026-05-04', label: '04 may', despachos: [] },
  { fecha: '2026-05-03', label: '03 may', despachos: [] },
  { fecha: '2026-05-02', label: '02 may', despachos: [] },
];

describe('DashboardClient — columnas de despachos', () => {
  test('renderiza 6 columnas con encabezados de fecha', () => {
    render(<DashboardClient stats={stats} stockCompare={stockCompare} columnas={columnas} />);

    expect(screen.getByText('Hoy — 07 may')).toBeInTheDocument();
    expect(screen.getByText('06 may')).toBeInTheDocument();
    expect(screen.getByText('05 may')).toBeInTheDocument();
  });

  test('muestra "Sin despachos" en columnas vacías', () => {
    render(<DashboardClient stats={stats} stockCompare={stockCompare} columnas={columnas} />);

    const sinDespachos = screen.getAllByText('Sin despachos');
    expect(sinDespachos.length).toBe(4);
  });

  test('muestra folios de despachos existentes', () => {
    render(<DashboardClient stats={stats} stockCompare={stockCompare} columnas={columnas} />);

    expect(screen.getByText('#F100')).toBeInTheDocument();
    expect(screen.getByText('#F99')).toBeInTheDocument();
  });
});
