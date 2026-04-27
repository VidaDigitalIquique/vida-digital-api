export type CatalogoBusqueda = {
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
};

export function filtrarCatalogos<T extends CatalogoBusqueda>(catalogos: T[], busqueda: string): T[] {
  const q = busqueda.trim();
  if (!q) return catalogos;

  const palabras = q.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return catalogos;

  const regexes = palabras.map(palabra => new RegExp('\\b' + palabra + '\\b', 'i'));

  return catalogos.filter(catalogo => {
    const titulo = catalogo.titulo ?? '';
    const descripcion = catalogo.descripcion ?? '';
    const categoria = catalogo.categoria ?? '';

    return regexes.some(rx => rx.test(titulo) || rx.test(descripcion) || rx.test(categoria));
  });
}
