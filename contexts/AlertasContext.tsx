'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AlertasContextType {
  alertasCount: number;
  refreshAlertas: () => Promise<void>;
  stockBajoCount: number;
  refreshStockBajo: () => Promise<void>;
}

const AlertasContext = createContext<AlertasContextType>({
  alertasCount: 0,
  refreshAlertas: async () => {},
  stockBajoCount: 0,
  refreshStockBajo: async () => {},
});

export function AlertasProvider({ children }: { children: React.ReactNode }) {
  const [alertasCount, setAlertasCount] = useState(0);
  const [stockBajoCount, setStockBajoCount] = useState(0);

  const refreshAlertas = useCallback(async () => {
    try {
      const res = await fetch('/api/deseados/alertas');
      if (res.ok) {
        const data = await res.json();
        setAlertasCount(data.count || 0);
      }
    } catch {}
  }, []);

  const refreshStockBajo = useCallback(async () => {
    try {
      const res = await fetch('/api/alertas-stock');
      if (res.ok) {
        const data = await res.json();
        setStockBajoCount(data.count || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshAlertas();
  }, [refreshAlertas]);

  useEffect(() => {
    refreshStockBajo();
  }, [refreshStockBajo]);

  return (
    <AlertasContext.Provider value={{ alertasCount, refreshAlertas, stockBajoCount, refreshStockBajo }}>
      {children}
    </AlertasContext.Provider>
  );
}

export function useAlertas() {
  return useContext(AlertasContext);
}
