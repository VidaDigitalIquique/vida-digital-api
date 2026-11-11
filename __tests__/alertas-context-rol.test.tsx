/**
 * D5 — AlertasProvider no debe llamar APIs que el rol no puede usar.
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, act, cleanup } from '@testing-library/react';
import { AlertasProvider, useAlertas } from '@/contexts/AlertasContext';

type Sesion = { data: { user?: { rol?: string } } | null; status: string };
let mockSesion: Sesion = { data: null, status: 'unauthenticated' };

jest.mock('next-auth/react', () => ({
  useSession: () => mockSesion,
}));

let api: ReturnType<typeof useAlertas> | null = null;
function Consumidor() {
  api = useAlertas();
  return (
    <span data-testid="counts">
      {api.alertasCount}/{api.stockBajoCount}/{api.seguimientosCount}
    </span>
  );
}

const URLS = ['/api/deseados/alertas', '/api/alertas-stock', '/api/seguimientos/alertas'];
const COUNTS: Record<string, number> = {
  '/api/deseados/alertas': 3,
  '/api/alertas-stock': 4,
  '/api/seguimientos/alertas': 5,
};

let fetchMock: jest.Mock;

beforeEach(() => {
  api = null;
  mockSesion = { data: null, status: 'unauthenticated' };
  fetchMock = jest.fn(async (url: string) => ({
    ok: true,
    json: async () => ({ count: COUNTS[url] ?? 0 }),
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => cleanup());

function montar() {
  return render(
    <AlertasProvider>
      <Consumidor />
    </AlertasProvider>
  );
}

function urlsLlamadas() {
  return fetchMock.mock.calls.map((c) => c[0]);
}

describe('AlertasProvider segun rol', () => {
  test('bodeguero: no llama ninguna API al montar ni al refrescar', async () => {
    mockSesion = { data: { user: { rol: 'bodeguero' } }, status: 'authenticated' };
    montar();
    await act(async () => {});

    await act(async () => {
      await api!.refreshAlertas();
      await api!.refreshStockBajo();
      await api!.refreshSeguimientos();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('admin: llama las 3 APIs una vez y toma los counts', async () => {
    mockSesion = { data: { user: { rol: 'admin' } }, status: 'authenticated' };
    const { getByTestId } = montar();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    URLS.forEach((u) => expect(urlsLlamadas().filter((x) => x === u)).toHaveLength(1));
    await waitFor(() => expect(getByTestId('counts').textContent).toBe('3/4/5'));
  });

  test('vendedor: llama las 3 APIs', async () => {
    mockSesion = { data: { user: { rol: 'vendedor' } }, status: 'authenticated' };
    montar();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    URLS.forEach((u) => expect(urlsLlamadas()).toContain(u));
  });

  test('sesion loading: no llama; al pasar a admin, llama las 3', async () => {
    mockSesion = { data: null, status: 'loading' };
    const { rerender } = montar();
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();

    mockSesion = { data: { user: { rol: 'admin' } }, status: 'authenticated' };
    rerender(
      <AlertasProvider>
        <Consumidor />
      </AlertasProvider>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  test('sin sesion (unauthenticated): no llama ninguna API', async () => {
    mockSesion = { data: null, status: 'unauthenticated' };
    montar();
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
