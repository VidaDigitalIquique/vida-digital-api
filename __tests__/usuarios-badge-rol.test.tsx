import { render, screen, waitFor } from '@testing-library/react';
import { UsuariosClient } from '@/app/(app)/admin/usuarios/client_page';

const USUARIOS = [
  { id: 1, rut: '99.999.991-1', nombre: 'Admin Sintetico', rol: 'admin', activo: true, empresas: [1] },
  { id: 2, rut: '99.999.993-3', nombre: 'Bodega Sintetica', rol: 'bodeguero', activo: true, empresas: [1] },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: USUARIOS }) }) as any;
});

describe('usuarios — badge de rol con clases reales (s20)', () => {
  it('el badge de admin lleva purple y no amber; el de bodeguero lleva amber', async () => {
    render(<UsuariosClient empresasList={[{ id: 1, nombre: 'VIDA DIGITAL' }]} currentUserId={99} />);

    const admin = await screen.findByText('ADMIN');
    const bodega = await screen.findByText('BODEGUERO');
    await waitFor(() => expect(admin.className).toContain('bg-purple-50'));

    // Sin el bug: className es la condicion resuelta, no el texto de la condicion.
    expect(admin.className).not.toContain('${');
    expect(admin.className).not.toContain('bg-amber-50');
    expect(admin.className).toContain('text-purple-700');

    expect(bodega.className).not.toContain('${');
    expect(bodega.className).toContain('bg-amber-50');
    expect(bodega.className).not.toContain('bg-purple-50');
  });
});
