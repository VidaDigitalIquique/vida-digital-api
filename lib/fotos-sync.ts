/**
 * Reconciliación pura entre el listado de Cloudinary y public.productos.
 * No hace red ni escrituras: planificarReconciliacion decide, aplicarPlan ejecuta.
 */

export type ProductoFoto = { id: number; codigo: string; imagen_url: string | null; public_id: string | null };
export type RecursoFoto = { public_id: string; secure_url: string; created_at?: string | null };
export type AccionFoto =
  | { tipo: 'vincular'; id: number; codigo: string; imagen_url: string; public_id: string; motivo: 'sin_imagen' }
  | { tipo: 'reapuntar'; id: number; codigo: string; imagen_url: string; public_id: string;
      motivo: 'url_no_canonica' | 'url_rota_reapuntada' }
  | { tipo: 'limpiar'; id: number; codigo: string; imagen_url: null; public_id: null;
      motivo: 'url_rota_sin_recurso' | 'public_id_huerfano' };
export type Bloqueo = 'cloudinary_vacio' | 'cloudinary_no_disponible' | 'borrado_masivo' | 'listado_incompleto' | null;
export interface ConteosPlan {
  vinculadas: number; reapuntadas: number; limpiadas: number;
  sin_cambio: number; sin_recurso: number; ajenas: number; con_url: number;
}
export interface PlanFotos {
  acciones: AccionFoto[]; bloqueado: Bloqueo; conteos: ConteosPlan; desincronizadas_restantes: number;
}
export type EjecutorSql = (strings: TemplateStringsArray, ...valores: unknown[]) => Promise<unknown>;

const EXTENSION = /\.(jpe?g|png|webp|gif)$/i;

export function claveCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

/** Quita el prefijo productos/ y la extensión, sin normalizar el caso. */
function restoPublicId(publicId: string): string {
  const prefijo = 'productos/';
  const resto = publicId.startsWith(prefijo) ? publicId.slice(prefijo.length) : publicId;
  return resto.replace(EXTENSION, '');
}

export function claveDePublicId(publicId: string): string {
  return claveCodigo(restoPublicId(publicId));
}

export function derivarPublicIdProducto(url: string, cloudName: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const esCloudinary =
    parsed.hostname === 'res.cloudinary.com' || /^res-\d+\.cloudinary\.com$/.test(parsed.hostname);
  if (!esCloudinary) return null;

  const prefijo = `/${cloudName}/image/upload/`;
  if (!parsed.pathname.startsWith(prefijo)) return null;

  const resto = parsed.pathname.slice(prefijo.length).replace(/^v\d+\//, '');
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(resto);
  } catch {
    return null;
  }
  return decodificado.startsWith('productos/') ? decodificado : null;
}

function fechaRecurso(recurso: RecursoFoto): number {
  const ms = recurso.created_at ? Date.parse(recurso.created_at) : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}

/** Gana el caso exacto; si no hay, created_at más reciente; desempate public_id asc. */
function elegirRecurso(codigo: string, candidatos: RecursoFoto[]): RecursoFoto {
  const exacto = candidatos.find((r) => restoPublicId(r.public_id) === codigo.trim());
  if (exacto) return exacto;
  return [...candidatos].sort((a, b) => {
    const dif = fechaRecurso(b) - fechaRecurso(a);
    if (dif !== 0) return dif;
    return a.public_id < b.public_id ? -1 : a.public_id > b.public_id ? 1 : 0;
  })[0];
}

export function planificarReconciliacion(
  productos: ProductoFoto[],
  recursos: RecursoFoto[] | null,
  cloudName: string,
  opciones: { umbralBorrado?: number; minFilasParaUmbral?: number; listadoIncompleto?: boolean } = {}
): PlanFotos {
  const { umbralBorrado = 0.2, minFilasParaUmbral = 50, listadoIncompleto = false } = opciones;
  const conteos: ConteosPlan = {
    vinculadas: 0, reapuntadas: 0, limpiadas: 0, sin_cambio: 0, sin_recurso: 0, ajenas: 0, con_url: 0,
  };
  const acciones: AccionFoto[] = [];
  const vacio = (bloqueado: Bloqueo): PlanFotos => ({ acciones: [], bloqueado, conteos, desincronizadas_restantes: 0 });

  if (recursos === null) return vacio('cloudinary_no_disponible');
  if (recursos.length === 0) return vacio('cloudinary_vacio');

  const porClave = new Map<string, RecursoFoto[]>();
  for (const recurso of recursos) {
    const clave = claveDePublicId(recurso.public_id);
    const lista = porClave.get(clave);
    if (lista) lista.push(recurso);
    else porClave.set(clave, [recurso]);
  }

  for (const producto of productos) {
    if (producto.imagen_url != null) conteos.con_url++;
    const candidatos = porClave.get(claveCodigo(producto.codigo));
    const recurso = candidatos ? elegirRecurso(producto.codigo, candidatos) : undefined;
    const base = { id: producto.id, codigo: producto.codigo };
    const foto = recurso && { imagen_url: recurso.secure_url, public_id: recurso.public_id };

    if (producto.imagen_url == null) {
      if (producto.public_id == null) {
        if (!foto) { conteos.sin_recurso++; continue; }
        acciones.push({ tipo: 'vincular', ...base, ...foto, motivo: 'sin_imagen' });
        conteos.vinculadas++;
      } else if (foto) {
        acciones.push({ tipo: 'reapuntar', ...base, ...foto, motivo: 'url_no_canonica' });
        conteos.reapuntadas++;
      } else {
        acciones.push({ tipo: 'limpiar', ...base, imagen_url: null, public_id: null, motivo: 'public_id_huerfano' });
        conteos.limpiadas++;
      }
      continue;
    }

    if (derivarPublicIdProducto(producto.imagen_url, cloudName) === null) { conteos.ajenas++; continue; }
    if (!foto) {
      acciones.push({ tipo: 'limpiar', ...base, imagen_url: null, public_id: null, motivo: 'url_rota_sin_recurso' });
      conteos.limpiadas++;
      continue;
    }
    if (producto.public_id === foto.public_id && producto.imagen_url === foto.imagen_url) { conteos.sin_cambio++; continue; }
    acciones.push({
      tipo: 'reapuntar', ...base, ...foto,
      motivo: producto.public_id === foto.public_id ? 'url_no_canonica' : 'url_rota_reapuntada',
    });
    conteos.reapuntadas++;
  }

  acciones.sort((a, b) => a.id - b.id);

  let bloqueado: Bloqueo = null;
  if (listadoIncompleto) bloqueado = 'listado_incompleto';
  else if (conteos.limpiadas > 0 && conteos.con_url >= minFilasParaUmbral &&
    conteos.limpiadas / conteos.con_url > umbralBorrado) bloqueado = 'borrado_masivo';

  if (bloqueado) return vacio(bloqueado);
  return { acciones, bloqueado: null, conteos, desincronizadas_restantes: acciones.length };
}

export { aplicarPlan } from './fotos-sync-ejecutor';
