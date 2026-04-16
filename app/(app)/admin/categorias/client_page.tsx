'use client';

type Categoria = {
  id: number;
  nombre: string;
  total_productos: number;
};

export function CategoriasClient({ categorias }: { categorias: Categoria[] }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categorías</h1>
      <div className="text-zinc-500">Interfaz de categorías — próximamente</div>
    </div>
  );
}
