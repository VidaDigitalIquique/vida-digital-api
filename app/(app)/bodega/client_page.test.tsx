import { render, screen, waitFor } from '@testing-library/react';
import { BodegaClient } from './client_page';
import { useEmpresaId } from '@/hooks/useEmpresaId';

// Mock hook
jest.mock('@/hooks/useEmpresaId');

// Mock fetch
global.fetch = jest.fn();

describe('BodegaClient Sync', () => {
  it('calls API with the correct empresaId from useEmpresaId', async () => {
    (useEmpresaId as jest.Mock).mockReturnValue({ empresaId: 7, isLoaded: true });
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });

    render(<BodegaClient session={{}} empresasMap={{}} />);

    // It should have called fetch with empresa=7
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('empresa=7'));
    });
  });
});
