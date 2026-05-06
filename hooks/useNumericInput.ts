import { useState } from 'react';
import * as React from 'react';

export function useNumericInput(
  value: string | number,
  onChange: (v: string) => void
) {
  const [clearedOnFocus, setClearedOnFocus] = useState(false);

  const isZero = value === 0 || value === '0';
  const displayValue = clearedOnFocus ? '' : String(value);

  return {
    value: displayValue,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setClearedOnFocus(false);
      onChange(e.target.value);
    },
    onFocus: () => {
      if (isZero) setClearedOnFocus(true);
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      if (clearedOnFocus && e.target.value === '') onChange('0');
      setClearedOnFocus(false);
    },
  };
}
