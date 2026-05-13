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
    id: 1, knumfoli: 'F001', cliente: 'Juan Pérez', monto: 50000, observaciones: 'Pagó en efectivo',
    estado: 'recibido', created_at: '2026-05-10T10:00:00.000Z', updated_at: '2026-05-10T10:00:00.000Z',
  },
  {
    id: 2, knumfoli: 'S002', cliente: 'María López', monto: 0, observaciones: null,
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

  it('abre modal al hacer clic en Nueva Garantia', async () => {
    render(<GarantiasClient />);

    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Nueva Garantía'));

    expect(screen.getByPlaceholderText('Nº Nota de Venta')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del cliente')).toBeInTheDocument();
  });

  it('crea garantia via POST y actualiza tabla', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockGarantias }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 3 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [...mockGarantias, { id: 3, knumfoli: 'F003', cliente: 'Nuevo Cliente', monto: 0, observaciones: null, estado: 'recibido', created_at: '2026-05-13T10:00:00.000Z', updated_at: '2026-05-13T10:00:00.000Z' }] }) });

    render(<GarantiasClient />);

    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Nueva Garantía'));

    fireEvent.change(screen.getByPlaceholderText('Nº Nota de Venta'), { target: { value: 'F003' } });
    fireEvent.change(screen.getByPlaceholderText('Nombre del cliente'), { target: { value: 'Nuevo Cliente' } });
    fireEvent.click(screen.getByText('Crear'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/garantias',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ knumfoli: 'F003', cliente: 'Nuevo Cliente', monto: 0, observaciones: null }),
        })
      );
    });
  });

  it('edita knumfoli inline via PATCH al hacer clic en el texto', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockGarantias }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...mockGarantias[0], knumfoli: 'F999' } }) });

    render(<GarantiasClient />);

    await waitFor(() => expect(screen.getByText('F001')).toBeInTheDocument());

    fireEvent.click(screen.getByText('F001'));

    const input = screen.getByDisplayValue('F001');
    fireEvent.change(input, { target: { value: 'F999' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/garantias/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ campo: 'knumfoli', valor: 'F999' }),
        })
      );
    });
  });

  it('abre panel de historial al hacer clic en el boton de la fila', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: mockGarantias }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([
        { id: 1, garantia_id: 1, usuario: 'Pablo', campo: 'creacion', valor_anterior: null, valor_nuevo: 'F001', created_at: '2026-05-10T10:00:00.000Z' },
      ]) });

    render(<GarantiasClient />);

    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText('Historial')[0]);

    await waitFor(() => {
      expect(screen.getByText('Historial de cambios')).toBeInTheDocument();
      expect(screen.getByText(/Por: Pablo/)).toBeInTheDocument();
    });
  });
});
