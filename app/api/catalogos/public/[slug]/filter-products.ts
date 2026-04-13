export type CatalogoProducto = {
  codigo: string;
  detalle?: string | null;
};

export function filterProducts(
  productos: CatalogoProducto[],
  codigosIncluir: string[],
  keywordsIncluir: string[],
  keywordsExcluir: string[]
) {
  const incluir = keywordsIncluir.filter(Boolean);
  const excluir = keywordsExcluir.filter(Boolean);

  return productos.filter((p) => {
    const haystack = `${p.codigo} ${p.detalle ?? ""}`.toLowerCase();

    if (codigosIncluir.length > 0 || incluir.length > 0) {
      const codigoUpper = p.codigo.toUpperCase();
      const matchesCodigo = codigosIncluir.includes(codigoUpper);
      const matchesKeyword = incluir.some((kw) => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?<![a-záéíóúñ])${escaped}(?![a-záéíóúñ])`, "i").test(haystack);
      });
      if (!matchesCodigo && !matchesKeyword) return false;
    }

    if (excluir.length > 0) {
      const matchesExcluir = excluir.some((kw) => {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(?<![a-záéíóúñ])${escaped}(?![a-záéíóúñ])`, "i").test(haystack);
      });
      if (matchesExcluir) return false;
    }

    console.log('DEBUG filter:', p.codigo, '| excluir:', keywordsExcluir, '| haystack:', haystack);
    return true;
  });
}
