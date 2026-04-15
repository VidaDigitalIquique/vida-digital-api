import { render, screen, fireEvent } from '@testing-library/react';
import { ProductDrawer } from './ProductDrawer';
import { Producto, UserSession } from '@/types';

global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) });

const mockProducto: Producto = {
  id: 1,
  empresa_id: 1,
  codigo: 'TEST-P',
  detalle: 'Test Product',
  prcventa: 100,
  prcminimo: 80,
  costo: 50,
  cif: 40,
  saldo: 10,
  umed: 'UND',
  cantcaja: 1,
  pesocaja: 1,
  cubicaja: 1,
  nroingreso: '2024-001',
  es_nuevo: true,
  categoria: null,
  imagen_url: 'http://test.com/image.png',
  fecha_ingreso: new Date(),
  updated_at: new Date()
};

const mockAdmin: UserSession = {
  id: '1',
  rut: '1-1',
  nombre: 'Admin',
  rol: 'admin',
  empresas: [1]
};

const mockUser: UserSession = {
  id: '2',
  rut: '2-2',
  nombre: 'Vendedor',
  rol: 'vendedor',
  empresas: [1]
};

describe('ProductDrawer Image Upload', () => {
  it('shows the image upload button after selecting a file for admin users', () => {
    render(
      <ProductDrawer 
        producto={mockProducto} 
        empresaNombre="IMPORT EXPORT SANJH LTDA." 
        session={mockAdmin} 
        open={true} 
        onOpenChange={() => {}} 
        onUpdated={() => {}} 
      />
    );

    // Initial state: no button
    expect(screen.queryByRole('button', { name: /subir imagen/i })).not.toBeInTheDocument();

    // Simulate file selection
    const file = new File(['fake content'], 'test.png', { type: 'image/png' });
    const input = screen.getByTestId('upload-input'); // I'll add this test id
    
    fireEvent.change(input, { target: { files: [file] } });

    // NOW it should be in the document
    const uploadButton = screen.queryByRole('button', { name: /subir imagen/i });
    expect(uploadButton).toBeInTheDocument();
  });

  it('does not show the upload button for non-admin users', () => {
    render(
      <ProductDrawer 
        producto={mockProducto} 
        empresaNombre="IMPORT EXPORT SANJH LTDA." 
        session={mockUser} 
        open={true} 
        onOpenChange={() => {}} 
        onUpdated={() => {}} 
      />
    );

    const uploadButton = screen.queryByRole('button', { name: /subir imagen/i });
    expect(uploadButton).not.toBeInTheDocument();
  });
});
