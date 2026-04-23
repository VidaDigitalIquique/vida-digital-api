import { normalizePhone } from '@/lib/phone-utils';

export async function matchClientesNuevos(
  nuevo: { kcodclie: number; nombre: string; empresa_id: number; celular?: string | null },
  deseados: { id: number; nombre: string; whatsapp?: string | null }[],
  sql: any,
): Promise<number> {
  // FASE TELÉFONO: match directo si últimos 8 dígitos coinciden
  if (nuevo.celular) {
    const telNuevo = normalizePhone(nuevo.celular);
    if (telNuevo.length >= 7) {
      const matchTel = deseados.find(d => {
        if (!d.whatsapp) return false;
        return normalizePhone(d.whatsapp) === telNuevo;
      });
      if (matchTel) {
        await sql`
          INSERT INTO public.conversion_sugerencias
            (kcodclie, empresa_id, nombre_winfac, cliente_deseado_id, score, estado)
          VALUES
            (${nuevo.kcodclie}, ${nuevo.empresa_id}, ${nuevo.nombre},
             ${matchTel.id}, ${0.95}, 'pendiente')
          ON CONFLICT (kcodclie, cliente_deseado_id) DO NOTHING
        `;
        return 1;
      }
    }
  }

  // FASE HEURÍSTICA: normalizar y tokenizar nombres
  const normalizar = (s: string) =>
    s.toUpperCase().trim().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 3);

  const tokensNuevo = new Set(normalizar(nuevo.nombre));

  const candidatos = deseados.filter(d => {
    const tokensDeseado = normalizar(d.nombre);
    return tokensDeseado.some(t => tokensNuevo.has(t));
  });

  if (candidatos.length === 0) return 0;

  // FASE IA: llamar a Gemini con fallback de modelos y keys
  const GEMINI_API_KEYS = [
    process.env.GEMINI_API_KEY_1!,
    process.env.GEMINI_API_KEY_2!,
    process.env.GEMINI_API_KEY_3!,
  ];
  const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
  const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  const prompt = `Dado el nombre de un cliente recién registrado en el sistema ERP: "${nuevo.nombre}"
Y esta lista de clientes potencialmente relacionados:
${candidatos.map(c => `ID ${c.id}: ${c.nombre}`).join('\n')}

¿Alguno de estos clientes es la misma persona o empresa?
Responde ÚNICAMENTE con JSON válido sin markdown:
{"match": true/false, "cliente_deseado_id": number_or_null, "confidence": 0.0_to_1.0}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 100 },
  };

  try {
    let responseText = '';
    outer: for (const model of GEMINI_MODELS) {
      for (const apiKey of GEMINI_API_KEYS) {
        if (!apiKey) continue;
        const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.status === 429 || res.status === 403) continue;
        if (!res.ok) continue;
        const data = await res.json();
        responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
        if (responseText) break outer;
      }
    }

    if (!responseText) return 0;

    const clean = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (parsed.match === true && parsed.confidence >= 0.7 && parsed.cliente_deseado_id) {
      await sql`
        INSERT INTO public.conversion_sugerencias
          (kcodclie, empresa_id, nombre_winfac, cliente_deseado_id, score, estado)
        VALUES
          (${nuevo.kcodclie}, ${nuevo.empresa_id}, ${nuevo.nombre},
           ${parsed.cliente_deseado_id}, ${parsed.confidence}, 'pendiente')
        ON CONFLICT (kcodclie, cliente_deseado_id) DO NOTHING
      `;
      return 1;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function insertKnownClients(
  clients: { kcodclie: any; empresa_id: any }[],
  sql: any,
): Promise<void> {
  if (clients.length === 0) return;

  // Construye TemplateStringsArray dinámicamente.
  // Invariante: strings.length === values.length + 1
  const strings: string[] = ['INSERT INTO public.clientes_conocidos (kcodclie, empresa_id) VALUES ('];
  const values: any[] = [];

  clients.forEach((client, i) => {
    values.push(client.kcodclie);
    strings.push(', ');
    values.push(client.empresa_id);
    strings.push(
      i < clients.length - 1
        ? '), ('
        : ') ON CONFLICT (kcodclie, empresa_id) DO NOTHING',
    );
  });

  const stringsArr = Object.assign(strings, { raw: strings }) as unknown as TemplateStringsArray;
  await sql(stringsArr, ...values);
}

export async function syncClientesNuevos(
  sql: any,
): Promise<{ nuevos: number; sugerencias: number }> {
  // Paso 1 — kcodclie actuales en WinFac con nombre y empresa_id
  const winfacRows = await sql`
    SELECT kcodclie, nombress AS nombre, celular, 2 AS empresa_id FROM vida.clientes
    UNION
    SELECT kcodclie, nombress AS nombre, celular, 1 AS empresa_id FROM sanjh.clientes
  `;

  // Paso 2 — kcodclie ya conocidos en public
  const conocidosRows = await sql`
    SELECT kcodclie FROM public.clientes_conocidos
  `;

  const conocidosSet = new Set(conocidosRows.map((r: any) => Number(r.kcodclie)));

  // Paso 3 — Cold start: registrar baseline sin contar como nuevos
  if (conocidosSet.size === 0) {
    await insertKnownClients(
      winfacRows.map((r: any) => ({ kcodclie: r.kcodclie, empresa_id: r.empresa_id })),
      sql,
    );
    return { nuevos: 0, sugerencias: 0 };
  }

  // Paso 4 — Detectar nuevos
  const nuevosClientes = winfacRows.filter(
    (r: any) => !conocidosSet.has(Number(r.kcodclie)),
  );

  if (nuevosClientes.length === 0) {
    return { nuevos: 0, sugerencias: 0 };
  }

  // Paso 5 — Obtener clientes_deseados para intentar el match
  const deseadosRows = await sql`
    SELECT id, nombre, whatsapp FROM public.clientes_deseados
  `;

  // Paso 6 — Match heurístico + IA por cada cliente nuevo
  let totalSugerencias = 0;
  for (const nuevo of nuevosClientes) {
    totalSugerencias += await matchClientesNuevos(
      { kcodclie: Number(nuevo.kcodclie), nombre: nuevo.nombre ?? '', empresa_id: Number(nuevo.empresa_id), celular: nuevo.celular ?? null },
      deseadosRows,
      sql,
    );
  }

  // Paso 7 — Registrar los nuevos como conocidos
  await insertKnownClients(
    nuevosClientes.map((r: any) => ({ kcodclie: r.kcodclie, empresa_id: r.empresa_id })),
    sql,
  );

  // Paso 8 — Retornar resultado
  return { nuevos: nuevosClientes.length, sugerencias: totalSugerencias };
}
