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
    console.log("[BCENTRAL] BCENTRAL_USER presente:", !!user);
    console.log("[BCENTRAL] BCENTRAL_PASS presente:", !!pass);
    if (!user || !pass) {
      console.log("[BCENTRAL] Faltan credenciales, abortando");
      return null;
    }

    const hoy = new Date();
    const hace7Dias = new Date(hoy);
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const firstdate = hace7Dias.toISOString().slice(0, 10);
    const lastdate = hoy.toISOString().slice(0, 10);

    const params = new URLSearchParams({
      user,
      pass,
      firstdate,
      lastdate,
      timeseries: "F073.TCO.PRE.Z.D",
      function: "GetSeries",
    });

    const baseUrl = "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx";
    const urlSinCreds = `${baseUrl}?firstdate=${firstdate}&lastdate=${lastdate}&timeseries=F073.TCO.PRE.Z.D&function=GetSeries&user=***&pass=***`;
    console.log("[BCENTRAL] URL:", urlSinCreds);

    const res = await fetch(
      `${baseUrl}?${params}`,
      { signal: AbortSignal.timeout(10_000), cache: "no-store" }
    );

    console.log("[BCENTRAL] HTTP status:", res.status, res.statusText);
    console.log("[BCENTRAL] Content-Type:", res.headers.get("content-type"));

    if (!res.ok) {
      const errorBody = await res.text();
      console.log("[BCENTRAL] Error body (primeros 500 chars):", errorBody.slice(0, 500));
      return null;
    }

    const raw = await res.text();
    console.log("[BCENTRAL] Raw response (primeros 500 chars):", raw.slice(0, 500));

    let json: any;
    try {
      json = JSON.parse(raw);
      console.log("[BCENTRAL] JSON parseado OK. Keys en raíz:", Object.keys(json));
    } catch (parseErr: any) {
      console.log("[BCENTRAL] Error al parsear JSON:", parseErr.message);
      return null;
    }

    // Estructura: { Codigo, Series: { Obs: [{ indexDateString, value, statusCode }] } }
    const obs: Array<{
      indexDateString: string;
      value: string;
      statusCode: string;
    }> = json?.Series?.Obs;
    if (!obs || !Array.isArray(obs)) {
      console.log("[BCENTRAL] Series.Obs no es array. json.Series:", JSON.stringify(json?.Series).slice(0, 200));
      return null;
    }
    console.log("[BCENTRAL] Cantidad de Obs:", obs.length);

    // Tomar el último con statusCode OK
    let lastValue: string | null = null;
    let lastDate: string | null = null;

    for (const o of obs) {
      if (o.statusCode === "OK") {
        lastValue = o.value;
        lastDate = o.indexDateString; // DD-MM-YYYY
      }
    }

    console.log("[BCENTRAL] Último valor OK encontrado:", lastValue, "fecha:", lastDate);

    if (!lastValue) {
      console.log("[BCENTRAL] No se encontró ningún Obs con statusCode OK");
      return null;
    }

    const valor = Math.round((parseFloat(lastValue) + 12) / 10) * 10;

    // Convertir DD-MM-YYYY → YYYY-MM-DD
    let fecha = hoy.toISOString().slice(0, 10);
    if (lastDate && /^\d{2}-\d{2}-\d{4}$/.test(lastDate)) {
      const [d, m, y] = lastDate.split("-");
      fecha = `${y}-${m}-${d}`;
    }

    console.log("[BCENTRAL] Éxito — valor:", valor, "fecha:", fecha);
    return { valor, fecha, fuente: "bcentral" };
  } catch (err: any) {
    console.log("[BCENTRAL] Excepción:", err.message, err.stack?.slice(0, 300));
    return null;
  }
}
