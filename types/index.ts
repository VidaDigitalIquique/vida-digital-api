export interface Empresa {
  id: number;
  nombre: string;
  slug: string;
  created_at: Date;
}

export interface Producto {
  id: number;
  empresa_id: number;
  codigo: string;
  nroingreso: string | null;
  saldo: number;
  umed: string;
  cif: number;
  costo: number;
  prcventa: number;
  prcminimo: number;
  cantcaja: number;
  pesocaja: number;
  cubicaja: number;
  detalle: string | null;
  imagen_url: string | null;
  es_nuevo: boolean;
  fecha_ingreso: Date;
  updated_at: Date;
}

export interface UbicacionBodega {
  id: number;
  empresa_id: number;
  codigo: string;
  nroingreso: string | null;
  ubicacion: string;
  detalle: string | null;
  cantcaja: number;
  saldo: number;
  saldocajas: number;
  fisico: number | null;
  diferencia: number | null;
  observaciones: string | null;
  updated_at: Date;
}

export interface LoteBodega {
  id: number;
  nroingreso: string | null;
  ubicacion: string | null;
  saldo: number;
  saldocajas: number;
  fisico: number | null;
  diferencia: number | null;
  observaciones: string | null;
  updated_at: Date;
}

export interface UbicacionBodegaAgrupada {
  codigo: string;
  detalle: string | null;
  producto_imagen_url: string | null;
  empresa_id: number;
  saldo_total: number;
  lotes: LoteBodega[];
}

export interface InventarioConteo {
  id: number;
  ubicacion_id: number;
  empresa_id: number;
  fisico: number | null;
  diferencia: number | null;
  observaciones: string | null;
  contado_por: number;
  updated_at: Date;
}

export interface Usuario {
  id: number;
  rut: string;
  nombre: string;
  rol: 'admin' | 'bodeguero' | 'vendedor' | 'supervisor';
  password?: string;
  activo: boolean;
  created_at: Date;
}

export interface Despacho {
  id: number;
  empresa_id: number;
  folio: string | null;
  imagen_url: string;
  imagen_public_id: string;
  nombre_original: string | null;
  estado: 'ok' | 'sin_folio' | 'revision' | 'error';
  procesado_por: number | null;
  fecha_despacho: Date;
  created_at: Date;
}

export interface Catalogo {
  id: number;
  empresa_id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CatalogoItem {
  id: number;
  catalogo_id: number;
  producto_id: number;
  orden: number;
  video_url: string | null;
  nota_extra: string | null;
  created_at: Date;
}

export interface UserSession {
  id: string;
  rut: string;
  nombre: string;
  rol: string;
  empresas: number[];
}
