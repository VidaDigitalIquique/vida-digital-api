/**
 * Tests PBT-IA — Slice: Botón Editar Catálogo
 * Estado inicial: ROJO (la funcionalidad no existe aún)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CatalogoAdminClient } from './client_page';

// --- Mocks globales ---

jest.mock('@/hooks/useEmpresaId', () => ({
  useEmpresaId: () => ({ empresaId: 1, isLoaded: true }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('next/dynamic', () => () => {
  const Comp = () => null;
  return Comp;
});

const SESSION_OWNER = { user: { id: 'user-1', empresas: [1] } };
const SESSION_OTHER = { user: { id: 'user-2', empresas: [1] } };

const MOCK_CATALOGO = {
  id: 'cat-1',
  titulo: 'Catálogo Test',
  descripcion: 'Desc',
  slug: 'catalogo-test',
  activo: true,
  user_id: 'user-1',
};

const MOCK_PRODUCTOS = [
  { codigo: 'P1', detalle: 'Producto A', precio_catalogo: 100 },
  { codigo: 'P2', detalle: 'Producto B', precio_catalogo: 200 },
];

// Fetch mock base: lista catálogos + catálogo público por slug + PUT
function mockFetch() {
  global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
    // GET lista
    if (url.includes('/api/catalogos?empresa=')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [MOCK_CATALOGO] }) });
    }
    // GET catálogo público por slug (productos keyed por codigo)
    if (url.match(/\/api\/catalogos\/public\/catalogo-test$/)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { productos: MOCK_PRODUCTOS } }) });
    }
    // PUT guardar
    if (url.match(/\/api\/catalogos\/cat-1$/) && opts?.method === 'PUT') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'Catálogo actualizado' }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// --- Tests ---

describe('Botón Editar — visibilidad', () => {
  it('muestra el botón Editar al dueño del catálogo', async () => {
    mockFetch();
    render(<CatalogoAdminClient session={SESSION_OWNER} />);
    await waitFor(() => screen.getByText('Catálogo Test'));
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
  });

  it('NO muestra el botón Editar a otro usuario', async () => {
    mockFetch();
    render(<CatalogoAdminClient session={SESSION_OTHER} />);
    await waitFor(() => screen.getByText('Catálogo Test'));
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });
});

describe('Modal de edición — apertura y carga', () => {
  it('abre el modal y muestra los productos del catálogo al hacer click en Editar', async () => {
    mockFetch();
    render(<CatalogoAdminClient session={SESSION_OWNER} />);
    await waitFor(() => screen.getByText('Catálogo Test'));
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await waitFor(() => {
      expect(screen.getByText('Producto A')).toBeInTheDocument();
      expect(screen.getByText('Producto B')).toBeInTheDocument();
    });
  });
});

describe('Modal de edición — eliminar producto', () => {
  it('elimina un producto del listado al hacer click en su ícono de basura', async () => {
    mockFetch();
    render(<CatalogoAdminClient session={SESSION_OWNER} />);
    await waitFor(() => screen.getByText('Catálogo Test'));
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await waitFor(() => screen.getByText('Producto A'));

    const trashButtons = screen.getAllByRole('button', { name: /eliminar producto/i });
    fireEvent.click(trashButtons[0]); // elimina Producto A

    await waitFor(() => {
      expect(screen.queryByText('Producto A')).not.toBeInTheDocument();
      expect(screen.getByText('Producto B')).toBeInTheDocument();
    });
  });
});

describe('Modal de edición — guardar cambios', () => {
  it('llama PUT con palabras_excluir al guardar y cierra el modal', async () => {
    mockFetch();
    render(<CatalogoAdminClient session={SESSION_OWNER} />);
    await waitFor(() => screen.getByText('Catálogo Test'));
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await waitFor(() => screen.getByText('Producto A'));

    // Eliminar Producto A
    const trashButtons = screen.getAllByRole('button', { name: /eliminar producto/i });
    fireEvent.click(trashButtons[0]);

    // Guardar
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find(
        ([url, opts]: [string, any]) => url.includes('cat-1') && opts?.method === 'PUT'
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall[1].body);
      // El código eliminado queda excluido (contrato actual del endpoint)
      expect(body.palabras_excluir).toContain('P1');
      expect(body.palabras_excluir).not.toContain('P2');
      expect(body).toHaveProperty('margen_precio');
      expect(body).toHaveProperty('precio_overrides');
      // Modal cerrado
      expect(screen.queryByText('Producto A')).not.toBeInTheDocument();
      expect(screen.queryByText('Producto B')).not.toBeInTheDocument();
    });
  });
});
