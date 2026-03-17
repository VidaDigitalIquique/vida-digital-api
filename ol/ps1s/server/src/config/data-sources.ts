/**
 * data-sources.ts
 * Mapeos explÃ­citos de tablas/columnas reales â†’ campos lÃ³gicos usados en rutas del server.
 *
 * TODO: Ajusta schema, tablas y columnas a tu Neon. Este archivo es solo un ejemplo coherente.
 */

export type ColumnMap = {
  /** tabla completa "schema.table" */
  table: string;
  /** columna cÃ³digo Ãºnico del producto */
  code: string;
  /** columna descripciÃ³n del producto */
  description?: string;
  /** costo y precio en USD (opcional segÃºn origen) */
  costUSD?: string;
  priceUSD?: string;
  /** stock en unidades y/o en cajas */
  unitsInStock?: string;
  boxesInStock?: string;
  /** unidades por caja */
  unitsPerBox?: string;
  /** ubicaciÃ³n/section en bodega */
  location?: string;
  section?: string;
  /** marca de tiempo de actualizaciÃ³n */
  updatedAt?: string;
};

export const DataSources = {
  products: {
    table: "public.producto",         // TODO: schema y tabla reales
    code: "codunico",                 // TODO
    description: "descrip",           // TODO
    costUSD: "costo_usd",             // TODO (o null si no existe)
    priceUSD: "precio_usd",           // TODO
    unitsInStock: "stocdisp",         // TODO (si el stock vive en otra tabla, deja null y Ãºnelas en la query)
    unitsPerBox: "cant_x_caja",       // TODO
    updatedAt: "updated_at",          // TODO
  } as ColumnMap,

  inventory: {
    table: "public.inventar",         // TODO: origen con stock por ubicaciÃ³n
    code: "codunico",                 // TODO
    location: "ubicacion",            // TODO
    unitsInStock: "stocdisp",         // TODO
    boxesInStock: "stoc_cajas",       // TODO
    updatedAt: "updated_at",          // TODO
  } as ColumnMap,

  locations: {
    table: "public.ubicaciones",      // TODO: catÃ¡logo de ubicaciones/secciones
    code: "codunico",                 // TODO (si aplica)
    section: "seccion",               // TODO
    location: "ubicacion",            // TODO
    updatedAt: "updated_at",          // TODO
  } as ColumnMap,
} as const;

export type DataSources = typeof DataSources;