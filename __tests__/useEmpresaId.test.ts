import { renderHook, act } from '@testing-library/react';
import { useEmpresaId } from '@/hooks/useEmpresaId';

describe('useEmpresaId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns 1 as default when localStorage is empty', () => {
    const { result } = renderHook(() => useEmpresaId());
    expect(result.current.empresaId).toBe(1);
  });

  test('returns stored ID when localStorage has "2"', () => {
    localStorage.setItem('vidadigital_empresa', '2');
    const { result } = renderHook(() => useEmpresaId());
    expect(result.current.empresaId).toBe(2);
  });

  test('never returns 0 or NaN', () => {
    localStorage.setItem('vidadigital_empresa', '0');
    const { result } = renderHook(() => useEmpresaId());
    expect(result.current.empresaId).toBeGreaterThanOrEqual(1);
  });

  test('updates when empresaChanged event fires', () => {
    localStorage.setItem('vidadigital_empresa', '1');
    const { result } = renderHook(() => useEmpresaId());
    act(() => {
      localStorage.setItem('vidadigital_empresa', '2');
      window.dispatchEvent(new Event('empresaChanged'));
    });
    expect(result.current.empresaId).toBe(2);
  });
});
