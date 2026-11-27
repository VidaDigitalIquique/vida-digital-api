import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { DespachosClient } from '@/app/(app)/despachos/client_page';

jest.mock('sonner', () => ({
  toast: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

const toastMock = toast as unknown as { success: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: () => 'id-fijo' });
  }
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      files: [
        { name: 'guia-1.jpg', base64: 'data:image/jpeg;base64,AAA' },
        { name: 'guia-2.jpg', base64: 'data:image/jpeg;base64,BBB' },
      ],
    }),
  }) as any;
});

describe('despachos — ZIP extraido (s20)', () => {
  it('el toast muestra el numero real de imagenes, no la plantilla literal', async () => {
    const { container } = render(<DespachosClient activeEmpresaId={1} />);
    const inputZip = container.querySelector('input[type="file"][accept*=".zip"]') as HTMLInputElement;

    fireEvent.change(inputZip, {
      target: { files: [new File(['zip'], 'fotos.zip', { type: 'application/zip' })] },
    });

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('2 imágenes extraídas del ZIP'));
    // El bug dejaba el texto literal `${files.length} imágenes extraídas del ZIP`.
    expect((toastMock.success.mock.calls[0][0] as string)).not.toContain('${');
  });

  it('la barra de progreso usa el ancho real y la fila usa el color de estado', async () => {
    const { container } = render(<DespachosClient activeEmpresaId={1} />);
    const inputZip = container.querySelector('input[type="file"][accept*=".zip"]') as HTMLInputElement;

    fireEvent.change(inputZip, {
      target: { files: [new File(['zip'], 'fotos.zip', { type: 'application/zip' })] },
    });

    const fila = (await screen.findByText('guia-1.jpg')).closest('div.rounded-lg') as HTMLElement;
    expect(fila.className).not.toContain('${');
    expect(fila.className).toContain('bg-zinc-100');

    const barra = container.querySelector('div.bg-blue-500') as HTMLElement;
    expect(barra.style.width).toBe('0%');
  });
});
