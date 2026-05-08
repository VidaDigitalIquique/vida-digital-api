/**
 * Tests PBT-IA — Slice 1: Mejoras UI CrearCatalogoDialog
 * Estado inicial: ROJO (cambios aún no implementados)
 */
import { render, screen } from '@testing-library/react';
import { CrearCatalogoDialog } from './CrearCatalogoDialog';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const DEFAULT_PROPS = {
  open: true,
  onOpenChange: jest.fn(),
  empresaId: 1,
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  });
});

describe('CrearCatalogoDialog — Slice 1 labels y defaults', () => {
  it('muestra "Nombre de Cliente" en lugar de "Título Comercial"', () => {
    render(<CrearCatalogoDialog {...DEFAULT_PROPS} />);
    expect(screen.getByText('Nombre de Cliente')).toBeInTheDocument();
    expect(screen.queryByText('Título Comercial')).not.toBeInTheDocument();
  });

  it('oculta visualmente el campo Descripción (nodo presente pero invisible)', () => {
    render(<CrearCatalogoDialog {...DEFAULT_PROPS} />);
    const input = screen.getByPlaceholderText('Breve mensaje para el cliente');
    expect(input.closest('div[class*="hidden"]') ?? input.closest('.hidden')).not.toBeNull();
  });

  it('label incluir usa "(separar por espacio)"', () => {
    render(<CrearCatalogoDialog {...DEFAULT_PROPS} />);
    expect(screen.getByText(/incluir solo si contiene \(separar por espacio\)/i, { selector: 'label' })).toBeInTheDocument();
  });

  it('label excluir usa "(separar por espacio)"', () => {
    render(<CrearCatalogoDialog {...DEFAULT_PROPS} />);
    const labels = screen.getAllByText(/separar por espacio/i, { selector: 'label' });
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it('checkbox "Solo productos con stock" inicia marcado por defecto', () => {
    render(<CrearCatalogoDialog {...DEFAULT_PROPS} />);
    const checkbox = screen.getByRole('checkbox', { name: /solo productos con stock/i });
    expect(checkbox).toBeChecked();
  });

  it('muestra "Mostrar inventario disponible" en lugar de "Mostrar stock disponible"', () => {
    render(<CrearCatalogoDialog {...DEFAULT_PROPS} />);
    expect(screen.getByText(/mostrar inventario disponible/i)).toBeInTheDocument();
    expect(screen.queryByText(/mostrar stock disponible/i)).not.toBeInTheDocument();
  });
});

describe('CrearCatalogoDialog — Slice 1 smoke', () => {
  it('renderiza el modal sin crash con todos los cambios aplicados', () => {
    render(<CrearCatalogoDialog {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument();
  });
});
