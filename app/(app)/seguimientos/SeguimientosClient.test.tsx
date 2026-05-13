import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeguimientosClient } from './SeguimientosClient';

// ── Mocks ───────────────────────────────────────────────
const mockReplace = jest.fn();
const mockPathname = '/seguimientos';

let searchParamsData: Record<string, string> = {};

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsData),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

global.fetch = jest.fn();

// ── Tests ───────────────────────────────────────────────
describe('SeguimientosClient — filtros persistentes en URL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParamsData = {};
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it('usa defaults cuando no hay query params en la URL', async () => {
    render(<SeguimientosClient />);

    await waitFor(() => {
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('empresa=ambas');
      expect(callUrl).toContain('estado=activo');
    });
  });

  it('lee empresa, mesAnio y estado desde searchParams como estado inicial', async () => {
    searchParamsData = { empresa: 'vida', mesAnio: '2026-03', estado: 'todos' };

    render(<SeguimientosClient />);

    await waitFor(() => {
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('empresa=vida');
      expect(callUrl).toContain('mes=03');
      expect(callUrl).toContain('anio=2026');
      expect(callUrl).toContain('estado=todos');
    });
  });

  it('actualiza la URL al cambiar el filtro de empresa', async () => {
    render(<SeguimientosClient />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    mockReplace.mockClear();

    fireEvent.click(screen.getByText('Vida Digital'));

    expect(mockReplace).toHaveBeenCalledWith(
      '/seguimientos?empresa=vida',
      { scroll: false }
    );
  });

  it('actualiza la URL al cambiar el filtro de estado', async () => {
    searchParamsData = { empresa: 'sanjh', estado: 'activo' };
    render(<SeguimientosClient />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    mockReplace.mockClear();

    fireEvent.click(screen.getByText('Resueltos'));

    expect(mockReplace).toHaveBeenCalledWith(
      '/seguimientos?empresa=sanjh&estado=resuelto',
      { scroll: false }
    );
  });

  it('incluye mesAnio en la URL cuando se selecciona un mes', async () => {
    render(<SeguimientosClient />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    mockReplace.mockClear();

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '2026-01' } });

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('mesAnio=2026-01'),
      { scroll: false }
    );
  });
});
