'use client';

type PaginacionNotasProps = {
  pagina: number;
  tamanoPagina: 25 | 50 | 100;
  total: number;
  onPaginaChange: (pagina: number) => void;
  onTamanoPaginaChange: (tamano: 25 | 50 | 100) => void;
};

export function PaginacionNotas({
  pagina, tamanoPagina, total, onPaginaChange, onTamanoPaginaChange,
}: PaginacionNotasProps) {
  const paginas = Math.max(1, Math.ceil(total / tamanoPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * tamanoPagina + 1;
  const hasta = Math.min(pagina * tamanoPagina, total);
  const control = 'min-h-10 rounded-md border px-3 py-2 disabled:opacity-50';

  return (
    <nav aria-label="Paginación de notas" className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex flex-wrap items-center gap-2">
        Notas por página
        <select
          aria-label="Notas por página"
          value={tamanoPagina}
          onChange={(e) => onTamanoPaginaChange(Number(e.target.value) as 25 | 50 | 100)}
          className={`${control} bg-transparent`}
        >
          {[25, 50, 100].map((tamano) => <option key={tamano} value={tamano}>{tamano}</option>)}
        </select>
      </label>
      <span>Mostrando {desde}-{hasta} de {total}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={control} disabled={pagina === 1} onClick={() => onPaginaChange(pagina - 1)}>
          Anterior
        </button>
        <span>Página {pagina} de {paginas}</span>
        <button type="button" className={control} disabled={pagina === paginas} onClick={() => onPaginaChange(pagina + 1)}>
          Siguiente
        </button>
      </div>
    </nav>
  );
}
