/**
 * Consulta el dólar observado desde la API del Banco Central de Chile.
 * Fórmula: valor_observado + 12 (redondeado a 2 decimales).
 * Retorna null si la API falla, no hay datos, o faltan credenciales.
 */
export async function getDolarObservado(): Promise<{
  valor: number;
  fecha: string;
  fuente: string;
} | null> {
  try {
    const user = process.env.BCENTRAL_USER;
    const pass = process.env.BCENTRAL_PASS;
    if (!user || !pass) return null;

    const hoy = new Date();
    const hace7Dias = new Date(hoy);
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const params = new URLSearchParams({
      user,
      pass,
      firstdate: hace7Dias.toISOString().slice(0, 10),
      lastdate: hoy.toISOString().slice(0, 10),
      timeseries: "F073.TCO.PRE.Z.D",
      function: "GetSeries",
    });

    const res = await fetch(
      `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?${params}`,
      { signal: AbortSignal.timeout(10_000), cache: "no-store" }
    );
    if (!res.ok) return null;

    const json = await res.json();

    // Estructura: { Codigo, Series: { Obs: [{ indexDateString, value, statusCode }] } }
    const obs: Array<{
      indexDateString: string;
      value: string;
      statusCode: string;
    }> = json?.Series?.Obs;
    if (!obs || !Array.isArray(obs)) return null;

    // Tomar el último con statusCode OK
    let lastValue: string | null = null;
    let lastDate: string | null = null;

    for (const o of obs) {
      if (o.statusCode === "OK") {
        lastValue = o.value;
        lastDate = o.indexDateString; // DD-MM-YYYY
      }
    }

    if (!lastValue) return null;

    const valor = Math.round((parseFloat(lastValue) + 12) * 100) / 100;

    // Convertir DD-MM-YYYY → YYYY-MM-DD
    let fecha = hoy.toISOString().slice(0, 10);
    if (lastDate && /^\d{2}-\d{2}-\d{4}$/.test(lastDate)) {
      const [d, m, y] = lastDate.split("-");
      fecha = `${y}-${m}-${d}`;
    }

    return { valor, fecha, fuente: "bcentral" };
  } catch {
    return null;
  }
}
