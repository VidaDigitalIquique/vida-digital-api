import { useState, useEffect } from 'react';

export function useEmpresaId() {
  const [empresaId, setEmpresaId] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('vidadigital_empresa');
    const id = stored && !isNaN(parseInt(stored)) && parseInt(stored) > 0 
      ? parseInt(stored) 
      : 1;
    setEmpresaId(id);
    setIsLoaded(true);
    
    const handler = () => {
      const s = localStorage.getItem('vidadigital_empresa');
      setEmpresaId(s && parseInt(s) > 0 ? parseInt(s) : 1);
    };
    
    window.addEventListener('empresaChanged', handler);
    return () => window.removeEventListener('empresaChanged', handler);
  }, []);

  return { empresaId, isLoaded };
}
