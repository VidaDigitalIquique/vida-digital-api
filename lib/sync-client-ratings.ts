type ClienteRating = {
  kcodclie: string;
  pais: string | null;
  ciudad: string | null;
  promedio_usd: number;
  total_compras: number;
  estrellas: number;
};

export function calcularEstrellas(pais: string, promedio: number): number {
  if (promedio < 100) return 0;

  const p = (pais ?? '').toUpperCase().trim();

  if (p === 'CHILE') {
    if (promedio <= 500)  return 1;
    if (promedio <= 1000) return 2;
    if (promedio <= 1500) return 3;
    if (promedio <= 2000) return 4;
    return 5;
  }

  if (p === 'PERU') {
    if (promedio <= 1000) return 1;
    if (promedio <= 2000) return 2;
    if (promedio <= 3000) return 3;
    if (promedio <= 4000) return 4;
    return 5;
  }

  // Cualquier otro país
  if (promedio <= 1500) return 1;
  if (promedio <= 2500) return 2;
  if (promedio <= 3500) return 3;
  if (promedio <= 4500) return 4;
  return 5;
}

export async function syncClientRatings(sql: any): Promise<{ updated: number }> {
  const rows = await sql`
    WITH ventas AS (
      SELECT m.kcodcli2, m.knumfoli, SUM(i.precread * i.cantsali) AS total_folio
      FROM vida.movidcto m
      JOIN vida.itemdcto i ON i.knumfoli = m.knumfoli
      WHERE m.tipomovi = 'V' AND i.cantsali > 0 AND m.kcodcli2 IS NOT NULL
      GROUP BY m.kcodcli2, m.knumfoli
      UNION ALL
      SELECT m.kcodcli2, m.knumfoli, SUM(i.precread * i.cantsali) AS total_folio
      FROM sanjh.movidcto m
      JOIN sanjh.itemdcto i ON i.knumfoli = m.knumfoli
      WHERE m.tipomovi = 'V' AND i.cantsali > 0 AND m.kcodcli2 IS NOT NULL
      GROUP BY m.kcodcli2, m.knumfoli
    ),
    promedios AS (
      SELECT kcodcli2, AVG(total_folio) AS promedio_usd, COUNT(*) AS total_compras
      FROM ventas
      GROUP BY kcodcli2
    )
    SELECT p.kcodcli2 AS kcodclie, c.pais, c.ciudad,
           ROUND(p.promedio_usd::numeric, 2) AS promedio_usd,
           p.total_compras
    FROM promedios p
    JOIN vida.clientes c ON c.kcodclie = p.kcodcli2
  `;

  if (rows.length === 0) return { updated: 0 };

  const processed: ClienteRating[] = rows.map((row: any) => ({
    kcodclie:      row.kcodclie,
    pais:          row.pais ?? null,
    ciudad:        row.ciudad ?? null,
    promedio_usd:  Number(row.promedio_usd),
    total_compras: Number(row.total_compras ?? 0),
    estrellas:     calcularEstrellas(row.pais ?? '', Number(row.promedio_usd)),
  }));

  // Construye el TemplateStringsArray dinámicamente.
  // Invariante: strings.length === values.length + 1
  // Cada fila aporta 6 valores: kcodclie, pais, ciudad, promedio_usd, estrellas, total_compras
  const strings: string[] = [
    'INSERT INTO public.cliente_ratings ' +
    '(kcodclie, pais, ciudad, promedio_usd, estrellas, total_compras, updated_at) VALUES (',
  ];
  const values: any[] = [];

  processed.forEach((row, i) => {
    values.push(row.kcodclie);      strings.push(', ');
    values.push(row.pais);           strings.push(', ');
    values.push(row.ciudad);         strings.push(', ');
    values.push(row.promedio_usd);   strings.push(', ');
    values.push(row.estrellas);      strings.push(', ');
    values.push(Number(row.total_compras));

    strings.push(
      i < processed.length - 1
        ? ', now()), ('
        : ', now()) ON CONFLICT (kcodclie) DO UPDATE SET ' +
          'pais = EXCLUDED.pais, ' +
          'ciudad = EXCLUDED.ciudad, ' +
          'promedio_usd = EXCLUDED.promedio_usd, ' +
          'estrellas = EXCLUDED.estrellas, ' +
          'total_compras = EXCLUDED.total_compras, ' +
          'updated_at = now()'
    );
  });

  const stringsArr = Object.assign(strings, { raw: strings }) as unknown as TemplateStringsArray;
  await sql(stringsArr, ...values);

  return { updated: processed.length };
}
