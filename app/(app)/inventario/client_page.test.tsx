import { render, screen, waitFor } from '@testing-library/react';
import { InventarioClient } from './client_page';
import { useEmpresaId } from '@/hooks/useEmpresaId';

// Mock hook
jest.mock('@/hooks/useEmpresaId');

// Mock fetch
global.fetch = jest.fn();

describe('InventarioClient Sync', () => {
  it('calls API with the correct empresaId from useEmpresaId', async () => {
    (useEmpresaId as jest.Mock).mockReturnValue({ empresaId: 42, isLoaded: true });
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], pagination: { totalPages: 1, total: 0 } })
    });

    render(<InventarioClient />);

    // It should have called fetch with empresa=42, not 0
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('empresa=42'));
    });
  });
});
