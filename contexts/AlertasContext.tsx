'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// Mismas listas que validan las APIs (app/api/.../alertas/route.ts).
const ROLES_ALERTAS = ['admin', 'supervisor', 'vendedor'];
const ROLES_SEGUIMIENTOS = ['admin', 'vendedor'];

interface AlertasContextType {
  alertasCount: number;
  refreshAlertas: () => Promise<void>;
  stockBajoCount: number;
  refreshStockBajo: () => Promise<void>;
  seguimientosCount: number;
  refreshSeguimientos: () => Promise<void>;
}

const AlertasContext = createContext<AlertasContextType>({
  alertasCount: 0,
  refreshAlertas: async () => {},
  stockBajoCount: 0,
  refreshStockBajo: async () => {},
  seguimientosCount: 0,
  refreshSeguimientos: async () => {},
});

export function AlertasProvider({ children }: { children: React.ReactNode }) {
  const [alertasCount, setAlertasCount] = useState(0);
  const [stockBajoCount, setStockBajoCount] = useState(0);
  const [seguimientosCount, setSeguimientosCount] = useState(0);
  const { data: session, status } = useSession();
  const rol = (session?.user as { rol?: string } | undefined)?.rol;
  const autenticado = status === 'authenticated';
  const puedeAlertas = autenticado && typeof rol === 'string' && ROLES_ALERTAS.includes(rol);
  const puedeSeguimientos = autenticado && typeof rol === 'string' && ROLES_SEGUIMIENTOS.includes(rol);

  const refreshAlertas = useCallback(async () => {
    if (!puedeAlertas) return;
    try {
      const res = await fetch('/api/deseados/alertas');
      if (res.ok) {
        const data = await res.json();
        setAlertasCount(data.count || 0);
      }
    } catch {}
  }, [puedeAlertas]);

  const refreshStockBajo = useCallback(async () => {
    if (!puedeAlertas) return;
    try {
      const res = await fetch('/api/alertas-stock');
      if (res.ok) {
        const data = await res.json();
        setStockBajoCount(data.count || 0);
      }
    } catch {}
  }, [puedeAlertas]);

  const refreshSeguimientos = useCallback(async () => {
    if (!puedeSeguimientos) return;
    try {
      const res = await fetch('/api/seguimientos/alertas');
      if (res.ok) {
        const data = await res.json();
        setSeguimientosCount(data.count || 0);
      }
    } catch {}
  }, [puedeSeguimientos]);

  useEffect(() => {
    refreshAlertas();
  }, [refreshAlertas]);

  useEffect(() => {
    refreshStockBajo();
  }, [refreshStockBajo]);

  useEffect(() => {
    refreshSeguimientos();
  }, [refreshSeguimientos]);

  return (
    <AlertasContext.Provider value={{ alertasCount, refreshAlertas, stockBajoCount, refreshStockBajo, seguimientosCount, refreshSeguimientos }}>
      {children}
    </AlertasContext.Provider>
  );
}

export function useAlertas() {
  return useContext(AlertasContext);
}
