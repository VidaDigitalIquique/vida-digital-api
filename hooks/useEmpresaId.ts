import { useState, useEffect } from 'react';

export function useEmpresaId(): number {
  const [empresaId, setEmpresaId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vidadigital_empresa');
      if (stored && !isNaN(parseInt(stored, 10))) {
        return parseInt(stored, 10);
      }
    }
    return 1; // Default fallback to SANJH
  });

  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem('vidadigital_empresa');
      if (stored && !isNaN(parseInt(stored, 10))) {
        setEmpresaId(parseInt(stored, 10));
      }
    };

    window.addEventListener('storage', handler);
    window.addEventListener('empresaChanged', handler);

    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('empresaChanged', handler);
    };
  }, []);

  return empresaId;
}
