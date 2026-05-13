import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GarantiasClient } from './GarantiasClient';

const mockReplace = jest.fn();
const mockPathname = '/garantias';
let searchParamsData: Record<string, string> = {};

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsData),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

global.fetch = jest.fn();

const mockGarantias = [
  {
    id: 1, knumfoli: 'F001', cliente: 'Juan Pérez',
    estado: 'recibido', created_at: '2026-05-10T10:00:00.000Z', updated_at: '2026-05-10T10:00:00.000Z',
  },
  {
    id: 2, knumfoli: 'S002', cliente: 'María López',
    estado: 'devuelto', created_at: '2026-05-11T14:00:00.000Z', updated_at: '2026-05-12T09:00:00.000Z',
  },
];

describe('GarantiasClient — tabla principal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParamsData = {};
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockGarantias }),
    });
  });

  it('renderiza tabla con datos del API', async () => {
    render(<GarantiasClient />);

    await waitFor(() => {
      expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
      expect(screen.getByText('María López')).toBeInTheDocument();
    });
  });

  it('muestra estado Recibido en rojo y Devuelto en verde', async () => {
    render(<GarantiasClient />);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const estadoSelects = selects.filter(s => (s as HTMLSelectElement).value === 'recibido' || (s as HTMLSelectElement).value === 'devuelto');
      expect(estadoSelects).toHaveLength(2);
      const recibidoSelect = estadoSelects.find(s => (s as HTMLSelectElement).value === 'recibido')!;
      const devueltoSelect = estadoSelects.find(s => (s as HTMLSelectElement).value === 'devuelto')!;
      expect(recibidoSelect.className).toMatch(/red/);
      expect(devueltoSelect.className).toMatch(/green/);
    });
  });

  it('persiste filtro mes/anio en la URL al seleccionar mes', async () => {
    render(<GarantiasClient />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    mockReplace.mockClear();

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2026-05' } });

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('mesAnio=2026-05'),
      { scroll: false }
    );
  });

  it('cambia estado via PATCH al seleccionar opcion en dropdown', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockGarantias }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...mockGarantias[0], estado: 'devuelto' } }) });

    render(<GarantiasClient />);

    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    const selects = screen.getAllByRole('combobox');
    const estadoSelect = selects[1];
    fireEvent.change(estadoSelect, { target: { value: 'devuelto' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/garantias/1'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });
});
