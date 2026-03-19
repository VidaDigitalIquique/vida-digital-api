'use client';

import { useState, useEffect } from 'react';
import { Producto, UserSession } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { ProductDrawer } from '@/components/ProductDrawer';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface PreciosClientProps {
  session: UserSession;
  empresasMap: Record<number, string>; // ID to Slug
}

export function PreciosClient({ session, empresasMap }: PreciosClientProps) {
  const [activeEmpresaId, setActiveEmpresaId] = useState<number>(0);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('vidadigital_empresa');
    const id = stored && !isNaN(parseInt(stored)) && parseInt(stored) > 0 
      ? parseInt(stored) 
      : 1;
    setActiveEmpresaId(id);
    setIsHydrated(true);
    const handler = () => {
      const s = localStorage.getItem('vidadigital_empresa');
      setActiveEmpresaId(s && parseInt(s) > 0 ? parseInt(s) : 1);
    };
    window.addEventListener('empresaChanged', handler);
    return () => window.removeEventListener('empresaChanged', handler);
  }, []);


  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const hasSearch = debouncedSearch.trim().length >= 2;
  const [soloStock, setSoloStock] = useState(false);
  const [soloNuevo, setSoloNuevo] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const empresaSlug = empresasMap[activeEmpresaId] || 'sanjh';

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch logic
  useEffect(() => {
    if (!isHydrated) return;

    async function fetchProducts() {
      setLoading(true);
      if (debouncedSearch.trim().length < 2) {
        setProductos([]);
        setLoading(false);
        return;
      }
      try {
        const queryParams = new URLSearchParams({
          empresa: activeEmpresaId.toString(),
          ...(debouncedSearch && { search: debouncedSearch }),
          ...(soloStock && { soloStock: 'true' }),
          ...(soloNuevo && { soloNuevo: 'true' }),
        });
        
        const res = await fetch(`/api/productos?${queryParams.toString()}`);
        if (res.ok) {
          const { data } = await res.json();
          setProductos(data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProducts();
  }, [activeEmpresaId, debouncedSearch, soloStock, soloNuevo, isHydrated]);

  const handleProductUpdate = (updatedProduct: Producto) => {
    setProductos(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    setSelectedProduct(updatedProduct);
  };

  const openDrawer = (producto: Producto) => {
    setSelectedProduct(producto);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Lista de Precios</h1>
      </div>

      <div className="sticky top-16 md:top-20 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <Input 
            type="text" 
            placeholder="Buscar por código o descripción..." 
            className="pl-10 h-12 text-base shadow-sm border-zinc-300 dark:border-zinc-700 focus-visible:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 rounded text-blue-600 focus:ring-blue-500" checked={soloStock} onChange={(e) => setSoloStock(e.target.checked)} />
            Solo con stock ✓
          </label>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-zinc-300 rounded text-blue-600 focus:ring-blue-500" checked={soloNuevo} onChange={(e) => setSoloNuevo(e.target.checked)} />
            Solo nuevos ✨
          </label>
        </div>
      </div>

      {loading && hasSearch ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-36 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
          ))}
        </div>
      ) : !hasSearch ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="text-4xl"></div>
          <p className="text-zinc-500 font-medium">Busca un producto o descripción</p>
          <p className="text-zinc-400 text-sm">Ingresa al menos 2 caracteres para ver resultados</p>
        </div>
      ) : productos.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No se encontraron productos.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {productos.map(p => (
            <ProductCard
              key={p.id}
              producto={p}
              empresaSlug={empresaSlug}
              onClick={openDrawer}
            />
          ))}
        </div>
      )}

      <ProductDrawer 
        producto={selectedProduct} 
        open={drawerOpen} 
        onOpenChange={setDrawerOpen} 
        session={session} 
        empresaSlug={empresaSlug}
        onUpdated={handleProductUpdate}
      />
    </div>
  );
}
