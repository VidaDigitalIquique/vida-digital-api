'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to sync active company ID across the application.
 * Listens to storage and empresaChanged events.
 * Returns { empresaId, isLoaded } according to Empresa Sync contract.
 */
export function useEmpresaId() {
  const [empresaId, setEmpresaId] = useState<number>(1);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const getStoredId = () => {
      if (typeof window === 'undefined') return 1;
      const stored = localStorage.getItem('vidadigital_empresa');
      if (stored) {
        const parsed = parseInt(stored, 10);
        return isNaN(parsed) || parsed === 0 ? 1 : parsed;
      }
      return 1;
    };

    // Initialize
    setEmpresaId(getStoredId());
    setIsLoaded(true);

    const handleSync = () => {
      setEmpresaId(getStoredId());
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('empresaChanged', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('empresaChanged', handleSync);
    };
  }, []);

  return { empresaId, isLoaded };
}
