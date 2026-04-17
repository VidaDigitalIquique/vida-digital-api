'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AlertasContextType {
  alertasCount: number;
  refreshAlertas: () => Promise<void>;
}

const AlertasContext = createContext<AlertasContextType>({
  alertasCount: 0,
  refreshAlertas: async () => {},
});

export function AlertasProvider({ children }: { children: React.ReactNode }) {
  const [alertasCount, setAlertasCount] = useState(0);

  const refreshAlertas = useCallback(async () => {
    try {
      const res = await fetch('/api/deseados/alertas');
      if (res.ok) {
        const data = await res.json();
        setAlertasCount(data.count || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshAlertas();
  }, [refreshAlertas]);

  return (
    <AlertasContext.Provider value={{ alertasCount, refreshAlertas }}>
      {children}
    </AlertasContext.Provider>
  );
}

export function useAlertas() {
  return useContext(AlertasContext);
}
