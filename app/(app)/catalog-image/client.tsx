'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type AppState = 'connecting' | 'ready' | 'generating' | 'done' | 'error';
type Step = 'removing_bg' | 'generating_image' | 'composing' | 'uploading' | null;

const STEP_LABELS: Record<string, string> = {
  removing_bg: 'Removiendo fondo…',
  generating_image: 'Generando imagen con IA…',
  composing: 'Componiendo imagen…',
  uploading: 'Subiendo a Cloudinary…',
};

export function stepLabel(step: string | null): string {
  if (!step) return '';
  return STEP_LABELS[step] ?? '';
}

export function ImagePreview({ result_url }: { result_url: string }) {
  return <img src={result_url} alt="Resultado generado" style={{ maxWidth: '100%' }} />;
}

export function CatalogImageClient() {
  const [state, setState] = useState<AppState>('connecting');
  const [productCode, setProductCode] = useState('');
  const [packingText, setPackingText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<Step>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    fetch('/api/catalog-image/health', { signal: controller.signal })
      .then(res => {
        if (!cancelled) setState(res.ok ? 'ready' : 'error');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback((id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/catalog-image/job/${id}`);
        const data = await res.json();
        if (data.step) setStep(data.step);
        if (data.status === 'done') {
          stopPolling();
          setResultUrl(data.result_url);
          setState('done');
        } else if (data.status === 'error') {
          stopPolling();
          setErrorMsg(data.error ?? 'Error desconocido');
          setState('error');
        }
      } catch {
        stopPolling();
        setErrorMsg('Error de conexión');
        setState('error');
      }
    }, 3_000);
  }, [stopPolling]);

  const reset = () => {
    stopPolling();
    setStep(null);
    setResultUrl(null);
    setErrorMsg(null);
    setState('ready');
  };

  const handleGenerate = async () => {
    setState('generating');
    setStep(null);
    setErrorMsg(null);
    const form = new FormData();
    files.forEach(f => form.append('images', f));
    form.append('product_code', productCode);
    form.append('packing_text', packingText);
    try {
      const res = await fetch('/api/catalog-image/job', { method: 'POST', body: form });
      const data = await res.json();
      startPolling(data.job_id);
    } catch {
      setErrorMsg('Error al crear el job');
      setState('error');
    }
  };

  const canGenerate =
    state === 'ready' &&
    productCode.trim() !== '' &&
    packingText.trim() !== '' &&
    files.length > 0;

  return (
    <div>
      {state === 'connecting' && <p>Conectando con el servicio…</p>}
      {state === 'ready' && <p>Servicio listo ✓</p>}
      {state === 'generating' && step && <p>{stepLabel(step)}</p>}
      {state === 'error' && (
        <>
          <p>{errorMsg ?? 'Error al conectar con el servicio'}</p>
          <button onClick={reset}>Reintentar</button>
        </>
      )}

      {state !== 'done' && (
        <>
          <input
            placeholder="Código de producto"
            value={productCode}
            onChange={e => setProductCode(e.target.value)}
            disabled={state !== 'ready'}
          />
          <input
            placeholder="Texto de packing"
            value={packingText}
            onChange={e => setPackingText(e.target.value)}
            disabled={state !== 'ready'}
          />
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={e => setFiles(Array.from(e.target.files ?? []))}
            disabled={state !== 'ready'}
          />
          <button onClick={handleGenerate} disabled={!canGenerate}>
            Generar
          </button>
        </>
      )}

      {state === 'done' && resultUrl && (
        <>
          <ImagePreview result_url={resultUrl} />
          <button onClick={reset}>Aprobar</button>
          <button onClick={reset}>Regenerar</button>
        </>
      )}
    </div>
  );
}
