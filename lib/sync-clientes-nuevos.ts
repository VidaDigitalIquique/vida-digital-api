export async function matchClientesNuevos(
  _nuevos: { kcodclie: number; nombre: string }[],
  _deseados: { id: number; nombre: string }[],
  _sql: any,
): Promise<number> {
  // Stub — Slice 3 implementará la lógica heurística + IA
  return 0;
}

async function insertKnownClients(kcodclieList: any[], sql: any): Promise<void> {
  if (kcodclieList.length === 0) return;

  // Construye TemplateStringsArray dinámicamente.
  // Invariante: strings.length === values.length + 1
  const strings: string[] = ['INSERT INTO public.clientes_conocidos (kcodclie) VALUES ('];
  const values: any[] = [];

  kcodclieList.forEach((kcodclie, i) => {
    values.push(kcodclie);
    strings.push(
      i < kcodclieList.length - 1
        ? '), ('
        : ') ON CONFLICT (kcodclie) DO NOTHING',
    );
  });

  const stringsArr = Object.assign(strings, { raw: strings }) as unknown as TemplateStringsArray;
  await sql(stringsArr, ...values);
}

export async function syncClientesNuevos(
  sql: any,
): Promise<{ nuevos: number; sugerencias: number }> {
  // Paso 1 — kcodclie actuales en WinFac
  const winfacRows = await sql`
    SELECT DISTINCT kcodclie FROM vida.clientes
    UNION
    SELECT DISTINCT kcodclie FROM sanjh.clientes
  `;

  // Paso 2 — kcodclie ya conocidos en public
  const conocidosRows = await sql`
    SELECT kcodclie FROM public.clientes_conocidos
  `;

  const conocidosSet = new Set(conocidosRows.map((r: any) => Number(r.kcodclie)));

  // Paso 3 — Cold start: registrar baseline sin contar como nuevos
  if (conocidosSet.size === 0) {
    await insertKnownClients(
      winfacRows.map((r: any) => r.kcodclie),
      sql,
    );
    return { nuevos: 0, sugerencias: 0 };
  }

  // Paso 4 — Detectar nuevos
  const nuevosKcodclie = winfacRows
    .map((r: any) => r.kcodclie)
    .filter((k: any) => !conocidosSet.has(Number(k)));

  if (nuevosKcodclie.length === 0) {
    return { nuevos: 0, sugerencias: 0 };
  }

  // Paso 5 — Obtener clientes_deseados para intentar el match
  const deseadosRows = await sql`
    SELECT id, nombre FROM public.clientes_deseados
  `;

  // Paso 6 — Match heurístico (stub en este slice)
  const sugerencias = await matchClientesNuevos(
    nuevosKcodclie.map((k: any) => ({ kcodclie: Number(k), nombre: '' })),
    deseadosRows,
    sql,
  );

  // Paso 7 — Registrar los nuevos como conocidos
  await insertKnownClients(nuevosKcodclie, sql);

  // Paso 8 — Retornar resultado
  return { nuevos: nuevosKcodclie.length, sugerencias };
}
