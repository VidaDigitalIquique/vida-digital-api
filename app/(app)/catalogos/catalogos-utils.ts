export type CatalogoBusqueda = {
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
};

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function filtrarCatalogos<T extends CatalogoBusqueda>(catalogos: T[], busqueda: string): T[] {
  const q = busqueda.trim();
  if (q.length < 2) return catalogos;

  const palabras = normalizar(q).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return catalogos;

  const regexes = palabras.map(palabra => new RegExp('\\b' + palabra + '\\b', 'i'));

  return catalogos.filter(catalogo => {
    const titulo = normalizar(catalogo.titulo ?? '');
    const descripcion = normalizar(catalogo.descripcion ?? '');
    const categoria = normalizar(catalogo.categoria ?? '');

    return regexes.some(rx => rx.test(titulo) || rx.test(descripcion) || rx.test(categoria));
  });
}
