/**
 * @jest-environment node
 */

import {
  claveCodigo,
  claveDePublicId,
  derivarPublicIdProducto,
  planificarReconciliacion,
  aplicarPlan,
  type ProductoFoto,
  type RecursoFoto,
  type PlanFotos,
} from '../lib/fotos-sync';

const CLOUD = 'dxkidwxjl';
const U = (p: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/${p}`;
const P = (
  id: number,
  codigo: string,
  imagen_url: string | null = null,
  public_id: string | null = null
): ProductoFoto => ({ id, codigo, imagen_url, public_id });
const R = (
  public_id: string,
  extra: { secure_url?: string; created_at?: string | null } = {}
): RecursoFoto => ({
  public_id,
  secure_url: extra.secure_url ?? U(`${public_id}.jpg`),
  created_at: extra.created_at ?? null,
});

describe('fotos-sync — normalización', () => {
  it('claveCodigo recorta y pasa a mayúsculas', () => {
    expect(claveCodigo('  V-4in1 ')).toBe('V-4IN1');
  });

  it('claveDePublicId quita prefijo productos/ y extensión', () => {
    expect(claveDePublicId('productos/TG23/L7.jpg')).toBe('TG23/L7');
    expect(claveDePublicId('productos/CH-002 CH-003.PNG')).toBe('CH-002 CH-003');
  });

  it('derivarPublicIdProducto solo acepta nuestras fotos de productos', () => {
    expect(derivarPublicIdProducto(U('productos/V-4in1.jpg'), CLOUD)).toBe('productos/V-4in1.jpg');
    expect(derivarPublicIdProducto(U('v123/productos/25301'), CLOUD)).toBe('productos/25301');
    expect(derivarPublicIdProducto('https://i.imgur.com/abc.jpg', CLOUD)).toBeNull();
    expect(derivarPublicIdProducto(U('despachos/x.jpg'), CLOUD)).toBeNull();
    expect(derivarPublicIdProducto(U('q_auto/productos/x.jpg'), CLOUD)).toBeNull();
    expect(derivarPublicIdProducto('no-es-url', CLOUD)).toBeNull();
  });
});

describe('fotos-sync — guardas', () => {
  it('1. listado vacío bloquea con cloudinary_vacio', () => {
    const plan = planificarReconciliacion([], [], CLOUD);
    expect(plan.bloqueado).toBe('cloudinary_vacio');
    expect(plan.acciones).toHaveLength(0);
  });

  it('2. listado null bloquea con cloudinary_no_disponible', () => {
    const plan = planificarReconciliacion([P(1, 'A')], null, CLOUD);
    expect(plan.bloqueado).toBe('cloudinary_no_disponible');
    expect(plan.acciones).toHaveLength(0);
  });

  it('3. listadoIncompleto bloquea', () => {
    const plan = planificarReconciliacion(
      [P(1, 'A')],
      [R('productos/A')],
      CLOUD,
      { listadoIncompleto: true }
    );
    expect(plan.bloqueado).toBe('listado_incompleto');
    expect(plan.acciones).toHaveLength(0);
  });

  it('4. 21% limpiables sobre 100 con URL bloquea por borrado_masivo', () => {
    const productos: ProductoFoto[] = [];
    const recursos: RecursoFoto[] = [];
    for (let i = 0; i < 21; i++) productos.push(P(i + 1, `MISS-${i}`, U(`productos/MISS-${i}.jpg`)));
    for (let i = 0; i < 79; i++) {
      productos.push(P(100 + i, `OK-${i}`, U(`productos/OK-${i}.jpg`)));
      recursos.push(R(`productos/OK-${i}`));
    }
    const plan = planificarReconciliacion(productos, recursos, CLOUD);
    expect(plan.bloqueado).toBe('borrado_masivo');
    expect(plan.acciones).toHaveLength(0);
    expect(plan.conteos.con_url).toBe(100);
    expect(plan.conteos.limpiadas).toBe(21);
  });

  it('5. 49 filas con 20 limpiables no bloquea (piso de 50)', () => {
    const productos: ProductoFoto[] = [];
    const recursos: RecursoFoto[] = [];
    for (let i = 0; i < 20; i++) productos.push(P(i + 1, `M-${i}`, U(`productos/M-${i}.jpg`)));
    for (let i = 0; i < 29; i++) {
      productos.push(P(100 + i, `O-${i}`, U(`productos/O-${i}.jpg`)));
      recursos.push(R(`productos/O-${i}`));
    }
    const plan = planificarReconciliacion(productos, recursos, CLOUD);
    expect(plan.bloqueado).toBeNull();
  });

  it('6. 293 limpiables sobre 3023 con URL (9.7%) no bloquea', () => {
    const productos: ProductoFoto[] = [];
    const recursos: RecursoFoto[] = [];
    for (let i = 0; i < 293; i++) productos.push(P(i + 1, `GONE-${i}`, U(`productos/GONE-${i}.jpg`)));
    for (let i = 0; i < 2730; i++) {
      productos.push(P(1000 + i, `FINE-${i}`, U(`productos/FINE-${i}.jpg`), `productos/FINE-${i}`));
      recursos.push(R(`productos/FINE-${i}`));
    }
    const plan = planificarReconciliacion(productos, recursos, CLOUD);
    expect(plan.bloqueado).toBeNull();
    expect(plan.conteos.con_url).toBe(3023);
    expect(plan.conteos.limpiadas).toBe(293);
    expect(plan.conteos.sin_cambio).toBe(2730);
  });
});

describe('fotos-sync — plan', () => {
  it('7. V-4IN1 sin foto se vincula con el recurso productos/V-4in1', () => {
    const plan = planificarReconciliacion([P(1, 'V-4IN1')], [R('productos/V-4in1')], CLOUD);
    expect(plan.bloqueado).toBeNull();
    expect(plan.acciones).toEqual([
      {
        tipo: 'vincular',
        id: 1,
        codigo: 'V-4IN1',
        imagen_url: U('productos/V-4in1.jpg'),
        public_id: 'productos/V-4in1',
        motivo: 'sin_imagen',
      },
    ]);
    expect(plan.conteos.vinculadas).toBe(1);
  });

  it('8. gana el recurso con el caso exacto', () => {
    const plan = planificarReconciliacion(
      [P(1, 'V-4IN1')],
      [
        R('productos/V-4in1', { created_at: '2026-05-01T00:00:00Z' }),
        R('productos/V-4IN1', { created_at: '2026-01-01T00:00:00Z' }),
      ],
      CLOUD
    );
    expect(plan.acciones[0]).toMatchObject({ tipo: 'vincular', public_id: 'productos/V-4IN1' });
  });

  it('9. sin caso exacto gana el created_at más reciente', () => {
    const plan = planificarReconciliacion(
      [P(1, 'V-4IN1')],
      [
        R('productos/V-4in1', { created_at: '2026-01-01T00:00:00Z' }),
        R('productos/v-4in1', { created_at: '2026-05-01T00:00:00Z' }),
      ],
      CLOUD
    );
    expect(plan.acciones[0]).toMatchObject({ tipo: 'vincular', public_id: 'productos/v-4in1' });
  });

  it('10. URL propia sin versión se reapunta al recurso existente', () => {
    const plan = planificarReconciliacion(
      [P(900, '25301', U('productos/25301'))],
      [R('productos/25301')],
      CLOUD
    );
    expect(plan.acciones[0]).toMatchObject({
      tipo: 'reapuntar',
      id: 900,
      imagen_url: U('productos/25301.jpg'),
      public_id: 'productos/25301',
    });
  });

  it('11. URL propia sin recurso se limpia', () => {
    const plan = planificarReconciliacion(
      [P(901, '25301', U('productos/25301.jpg'))],
      [R('productos/OTRO')],
      CLOUD
    );
    expect(plan.acciones[0]).toMatchObject({ tipo: 'limpiar', motivo: 'url_rota_sin_recurso' });
  });

  it('12. URL de otro host queda ajena e intacta', () => {
    const plan = planificarReconciliacion(
      [P(1, 'A', 'https://i.imgur.com/abc.jpg')],
      [R('productos/A')],
      CLOUD
    );
    expect(plan.acciones).toHaveLength(0);
    expect(plan.conteos.ajenas).toBe(1);
    expect(plan.conteos.con_url).toBe(1);
  });

  it('13. URL de nuestro cloud en otra carpeta queda ajena', () => {
    const plan = planificarReconciliacion(
      [P(1, 'A', U('despachos/x.jpg'))],
      [R('productos/A')],
      CLOUD
    );
    expect(plan.acciones).toHaveLength(0);
    expect(plan.conteos.ajenas).toBe(1);
  });

  it('14. TG23/L7 y CH-002 CH-003 usan la URL literal del listado (incluye %20)', () => {
    const urlEspacios = `https://res.cloudinary.com/${CLOUD}/image/upload/productos/CH-002%20CH-003.jpg`;
    const plan = planificarReconciliacion(
      [P(1, ' tg23/l7 '), P(2, 'CH-002 CH-003')],
      [
        R('productos/TG23/L7'),
        { public_id: 'productos/CH-002 CH-003', secure_url: urlEspacios, created_at: null },
      ],
      CLOUD
    );
    expect(plan.acciones).toEqual([
      { tipo: 'vincular', id: 1, codigo: ' tg23/l7 ', imagen_url: U('productos/TG23/L7.jpg'), public_id: 'productos/TG23/L7', motivo: 'sin_imagen' },
      { tipo: 'vincular', id: 2, codigo: 'CH-002 CH-003', imagen_url: urlEspacios, public_id: 'productos/CH-002 CH-003', motivo: 'sin_imagen' },
    ]);
  });

  it('15. public_id en otro caso se reapunta al recurso del código', () => {
    const plan = planificarReconciliacion(
      [P(1, 'V-4IN1', null, 'productos/v-4in1')],
      [R('productos/V-4in1')],
      CLOUD
    );
    expect(plan.acciones[0]).toMatchObject({ tipo: 'reapuntar', public_id: 'productos/V-4in1' });
  });

  it('16. public_id huérfano se limpia', () => {
    const plan = planificarReconciliacion(
      [P(903, 'A', null, 'productos/A-VIEJO')],
      [R('productos/OTRO')],
      CLOUD
    );
    expect(plan.acciones[0]).toMatchObject({ tipo: 'limpiar', motivo: 'public_id_huerfano' });
  });

  it('17. sin foto y sin recurso no genera acción (sin_recurso)', () => {
    const plan = planificarReconciliacion([P(1, 'A')], [R('productos/OTRO')], CLOUD);
    expect(plan.acciones).toHaveLength(0);
    expect(plan.conteos.sin_recurso).toBe(1);
  });

  it('18. idempotencia: replanificar tras aplicar da 0 acciones', () => {
    const productos = [
      P(1, 'A'),
      P(2, 'B', U('productos/B-VIEJO.jpg')),
      P(3, 'C', U('productos/C-GONE.jpg')),
      P(4, 'D', U('productos/D.jpg'), 'productos/D'),
    ];
    const recursos = [R('productos/A'), R('productos/B'), R('productos/D')];
    const plan1 = planificarReconciliacion(productos, recursos, CLOUD);
    expect(plan1.acciones).toHaveLength(3);

    const aplicados = productos.map((p) => {
      const accion = plan1.acciones.find((a) => a.id === p.id);
      return accion ? { ...p, imagen_url: accion.imagen_url, public_id: accion.public_id } : p;
    });
    const plan2 = planificarReconciliacion(aplicados, recursos, CLOUD);
    expect(plan2.acciones).toHaveLength(0);
    expect(plan2.conteos.sin_cambio).toBe(3);
    expect(plan2.conteos.sin_recurso).toBe(1);
  });

  it('19. maxAcciones: 2 de 5 deja 3 pendientes', async () => {
    const productos = Array.from({ length: 5 }, (_, i) => P(i + 1, `A-${i}`));
    const recursos = Array.from({ length: 5 }, (_, i) => R(`productos/A-${i}`));
    const plan = planificarReconciliacion(productos, recursos, CLOUD);
    expect(plan.acciones).toHaveLength(5);

    const llamadas: unknown[] = [];
    const sql = async (strings: TemplateStringsArray, ...valores: unknown[]) => {
      llamadas.push({ strings, valores });
      return [];
    };
    const res = await aplicarPlan(sql, plan, { maxAcciones: 2 });
    expect(res).toEqual({ aplicadas: 2, pendientes: 3, errores: 0 });
    expect(llamadas).toHaveLength(2);
  });

  it('20. un UPDATE que lanza cuenta error y sigue con el resto', async () => {
    const plan: PlanFotos = planificarReconciliacion(
      [P(1, 'A'), P(2, 'B')],
      [R('productos/A'), R('productos/B')],
      CLOUD
    );
    let n = 0;
    const sql = async () => {
      n++;
      if (n === 1) throw new Error('boom');
      return [];
    };
    const res = await aplicarPlan(sql, plan);
    expect(res).toEqual({ aplicadas: 1, pendientes: 0, errores: 1 });
  });
});
