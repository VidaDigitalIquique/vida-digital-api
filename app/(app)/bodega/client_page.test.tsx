import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { BodegaClient } from './client_page';
import { useEmpresaId } from '@/hooks/useEmpresaId';

// Mock hook
jest.mock('@/hooks/useEmpresaId');
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('BodegaClient Sync', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls API with the correct empresaId from useEmpresaId', async () => {
    (useEmpresaId as jest.Mock).mockReturnValue({ empresaId: 7, isLoaded: true });
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });

    render(<BodegaClient session={{}} empresasMap={{}} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar ubicación o código...'), {
      target: { value: 'AB' },
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    // It should have called fetch with empresa=7
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('empresa=7'));
    });
  });

  it('sends empty strings and updates UI after save', async () => {
    (useEmpresaId as jest.Mock).mockReturnValue({ empresaId: 1, isLoaded: true });

    const mockUbicacion = {
      codigo: 'COD-1',
      detalle: 'Detalle',
      producto_imagen_url: null,
      empresa_id: 1,
      saldo_total: 24,
      cantcaja: 12,
      umed: 'UND',
      fisico_total: null,
      diferencia_total: null,
      ubicaciones: ['A1'],
      lotes: [
        {
          id: 11,
          nroingreso: 'ING-1',
          ubicacion: 'A1',
          saldo: 24,
          saldocajas: 2,
          fisico: null,
          fisico_cajas: null,
          fisico_unidades: null,
          diferencia: null,
          observaciones: 'Obs1',
          updated_at: new Date().toISOString(),
        },
      ],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [mockUbicacion] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ...mockUbicacion.lotes[0],
            ubicacion: '',
            observaciones: '',
            updated_at: new Date().toISOString(),
          },
        }),
      });

    render(<BodegaClient session={{}} empresasMap={{ 1: 'acme' }} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar ubicación o código...'), {
      target: { value: 'AB' },
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const card = await screen.findByText('COD-1');
    fireEvent.click(card);

    const loteMatches = await screen.findAllByText('A1');
    const loteButton = loteMatches.map(el => el.closest('button')).find(Boolean);
    expect(loteButton).toBeTruthy();
    fireEvent.click(loteButton as HTMLElement);

    fireEvent.change(screen.getByDisplayValue('A1'), { target: { value: '' } });
    fireEvent.change(screen.getByDisplayValue('Obs1'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar lote/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const putCall = (global.fetch as jest.Mock).mock.calls[1];
    const body = JSON.parse(putCall[1].body);
    expect(body.ubicacion).toBe('');
    expect(body.observaciones).toBe('');

    await waitFor(() => {
      expect(screen.getByText('Sin ubicación')).toBeInTheDocument();
    });
  });

  it('destaca lotes con ubicacion null con borde ambar', async () => {
    (useEmpresaId as jest.Mock).mockReturnValue({ empresaId: 1, isLoaded: true });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          codigo: 'COD-NUEVO', detalle: 'Producto nuevo', producto_imagen_url: null,
          empresa_id: 1, saldo_total: 100, cantcaja: 10, umed: 'UND',
          fisico_total: null, diferencia_total: null, ubicaciones: [],
          lotes: [{
            id: 99, nroingreso: 'ING-RECIENTE', ubicacion: null,
            saldo: 100, saldocajas: 10, fisico: null, fisico_cajas: null,
            fisico_unidades: null, diferencia: null, observaciones: null,
            updated_at: new Date().toISOString(),
          }],
        }],
      }),
    });

    render(<BodegaClient session={{}} empresasMap={{ 1: 'sanjh' }} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar ubicación o código...'), {
      target: { value: 'COD' },
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    const card = await screen.findByText('COD-NUEVO');
    fireEvent.click(card);

    const nroIng = await screen.findByText('ING-RECIENTE');
    const loteDiv = nroIng.closest('.border.rounded-xl');
    expect(loteDiv?.className).toMatch(/amber/);
  });

  it('no destaca lotes con ubicacion asignada', async () => {
    (useEmpresaId as jest.Mock).mockReturnValue({ empresaId: 1, isLoaded: true });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{
          codigo: 'COD-VIEJO', detalle: 'Producto ubicado', producto_imagen_url: null,
          empresa_id: 1, saldo_total: 50, cantcaja: 5, umed: 'UND',
          fisico_total: null, diferencia_total: null, ubicaciones: ['B3'],
          lotes: [{
            id: 100, nroingreso: 'ING-VIEJO', ubicacion: 'B3',
            saldo: 50, saldocajas: 5, fisico: null, fisico_cajas: null,
            fisico_unidades: null, diferencia: null, observaciones: null,
            updated_at: new Date().toISOString(),
          }],
        }],
      }),
    });

    render(<BodegaClient session={{}} empresasMap={{ 1: 'sanjh' }} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar ubicación o código...'), {
      target: { value: 'COD' },
    });
    await act(async () => { jest.advanceTimersByTime(300); });

    const card = await screen.findByText('COD-VIEJO');
    fireEvent.click(card);

    const nroIng = await screen.findByText('ING-VIEJO');
    const loteDiv = nroIng.closest('.border.rounded-xl');
    expect(loteDiv?.className).not.toMatch(/amber/);
  });
});
