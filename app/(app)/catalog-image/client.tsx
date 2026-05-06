'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type AppState = 'connecting' | 'offline' | 'ready' | 'generating' | 'done' | 'error';
type Step = 'removing_bg' | 'generating_image' | 'composing' | 'uploading' | null;

const STEP_LABELS: Record<string, string> = {
  removing_bg: 'Removiendo fondo…',
  generating_image: 'Generando imagen con IA…',
  composing: 'Componiendo imagen…',
  uploading: 'Subiendo a Cloudinary…',
};

const STEP_PCT: Record<string, number> = {
  removing_bg: 25,
  generating_image: 50,
  composing: 75,
  uploading: 100,
};

export function stepLabel(step: string | null): string {
  if (!step) return '';
  return STEP_LABELS[step] ?? '';
}

export function stepProgress(step: string | null): number {
  if (!step) return 0;
  return STEP_PCT[step] ?? 0;
}

export function ImagePreview({ result_url }: { result_url: string }) {
  return <img src={result_url} alt="Resultado generado" style={{ maxWidth: '100%' }} />;
}

export function ProgressBar({ step }: { step: Step }) {
  const pct = stepProgress(step);
  return (
    <div style={{ background: '#e5e7eb', borderRadius: 4, height: 8, overflow: 'hidden', margin: '8px 0' }}>
      <div style={{ background: '#3b82f6', width: `${pct}%`, height: '100%', transition: 'width 0.5s ease' }} />
    </div>
  );
}

function ImagePlaceholder() {
  return (
    <div style={{
      width: '100%', aspectRatio: '4/3', background: '#f3f4f6',
      borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#9ca3af', fontSize: 14, border: '2px dashed #e5e7eb',
    }}>
      La imagen generada aparecerá aquí
    </div>
  );
}

function ImageSkeleton() {
  return (
    <div style={{
      width: '100%', aspectRatio: '4/3', background: 'linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)',
      backgroundSize: '200% 100%', borderRadius: 8, animation: 'shimmer 1.5s infinite',
    }} />
  );
}

export function CatalogImageClient() {
  const [state, setState] = useState<AppState>('connecting');
  const [productCode, setProductCode] = useState('');
  const [packingText, setPackingText] = useState('');
  const [colors, setColors] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<Step>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectAttempt, setConnectAttempt] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tryConnect = useCallback(() => {
    setState('connecting');
    setConnectAttempt(0);
    const base = process.env.NEXT_PUBLIC_CATALOG_SERVICE_URL;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 12; i++) {
        if (cancelled) return;
        setConnectAttempt(i + 1);
        try {
          const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(55_000) });
          if (res.ok) { if (!cancelled) setState('ready'); return; }
        } catch { /* servicio aún despertando */ }
        if (cancelled) return;
        await new Promise(r => setTimeout(r, 15_000));
      }
      if (!cancelled) setState('offline');
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cleanup = tryConnect();
    return cleanup;
  }, [tryConnect]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
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
        setErrorMsg('Error de conexión con el servicio');
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
    if (colors.trim()) form.append('colors', colors.trim());
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
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} } @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Banner de estado */}
      {state === 'connecting' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <div style={{ width: 16, height: 16, border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ color: '#6b7280', fontSize: 14 }}>
            Despertando servicio… intento {connectAttempt}/12
          </span>
        </div>
      )}
      {state === 'offline' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8 }}>
          <span style={{ color: '#6b7280', fontSize: 14 }}>Servicio inactivo</span>
          <button onClick={tryConnect} style={{ marginLeft: 'auto', fontSize: 13, padding: '4px 12px', borderRadius: 6, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Despertar servicio
          </button>
        </div>
      )}
      {state === 'ready' && (
        <p style={{ color: '#16a34a', fontSize: 14 }}>Servicio listo ✓</p>
      )}
      {state === 'error' && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#dc2626', fontSize: 14 }}>{errorMsg ?? 'Ocurrió un error'}</span>
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 13, padding: '4px 12px', borderRadius: 6, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      )}

      {/* Área de imagen */}
      {state === 'done' && resultUrl ? (
        <ImagePreview result_url={resultUrl} />
      ) : state === 'generating' ? (
        <ImageSkeleton />
      ) : (
        <ImagePlaceholder />
      )}

      {/* Barra de progreso */}
      {state === 'generating' && (
        <>
          <ProgressBar step={step} />
          <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>{stepLabel(step)}</p>
        </>
      )}

      {/* Formulario */}
      {state !== 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            placeholder="Código de producto *"
            value={productCode}
            onChange={e => setProductCode(e.target.value)}
            disabled={state !== 'ready'}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          />
          <input
            placeholder="Texto de packing *"
            value={packingText}
            onChange={e => setPackingText(e.target.value)}
            disabled={state !== 'ready'}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          />
          <input
            placeholder="Colores del producto (opcional)"
            value={colors}
            onChange={e => setColors(e.target.value)}
            disabled={state !== 'ready'}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}
          />
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={e => setFiles(Array.from(e.target.files ?? []))}
            disabled={state !== 'ready'}
            style={{ fontSize: 13 }}
          />
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            style={{ padding: '10px 16px', borderRadius: 6, background: canGenerate ? '#3b82f6' : '#e5e7eb', color: canGenerate ? '#fff' : '#9ca3af', border: 'none', cursor: canGenerate ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 600 }}
          >
            Generar
          </button>
        </div>
      )}

      {/* Acciones post-generación */}
      {state === 'done' && resultUrl && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={reset} style={{ flex: 1, padding: '10px 16px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Aprobar
          </button>
          <a href={resultUrl} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '10px 16px', borderRadius: 6, background: '#6b7280', color: '#fff', textDecoration: 'none', textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
            Descargar
          </a>
          <button onClick={reset} style={{ flex: 1, padding: '10px 16px', borderRadius: 6, background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Regenerar
          </button>
        </div>
      )}
    </div>
  );
}
