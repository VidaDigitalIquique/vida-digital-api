import { renderHook, act } from '@testing-library/react';
import { useNumericInput } from './useNumericInput';

describe('useNumericInput', () => {
  it('retorna el valor como string cuando no es cero', () => {
    const { result } = renderHook(() => useNumericInput('500', jest.fn()));
    expect(result.current.value).toBe('500');
  });

  it('muestra vacío al hacer focus con valor 0 (number)', () => {
    const { result } = renderHook(() => useNumericInput(0, jest.fn()));
    act(() => { result.current.onFocus({} as any); });
    expect(result.current.value).toBe('');
  });

  it('muestra vacío al hacer focus con valor "0" (string)', () => {
    const { result } = renderHook(() => useNumericInput('0', jest.fn()));
    act(() => { result.current.onFocus({} as any); });
    expect(result.current.value).toBe('');
  });

  it('llama onChange("0") al blur con campo vacío', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useNumericInput('0', onChange));
    act(() => { result.current.onFocus({} as any); });
    act(() => { result.current.onBlur({ target: { value: '' } } as any); });
    expect(onChange).toHaveBeenCalledWith('0');
  });

  it('no llama onChange al blur si el campo tiene valor', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useNumericInput('500', onChange));
    act(() => { result.current.onBlur({ target: { value: '500' } } as any); });
    expect(onChange).not.toHaveBeenCalled();
  });
});
