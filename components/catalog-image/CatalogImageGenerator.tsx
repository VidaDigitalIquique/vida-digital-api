'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { PlusCircle, X, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';

const POSITIONS = [
  { value: 'top-center', label: 'Arriba centro' },
  { value: 'top-left', label: 'Arriba izquierda' },
  { value: 'top-right', label: 'Arriba derecha' },
  { value: 'bottom-center', label: 'Abajo centro' },
  { value: 'bottom-left', label: 'Abajo izquierda' },
  { value: 'bottom-right', label: 'Abajo derecha' },
];

function toBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).replace(/^data:.+;base64,/, ''));
    reader.readAsDataURL(file);
  });
}

type State = 'idle' | 'ready' | 'loading' | 'preview' | 'success';

export function CatalogImageGenerator() {
  const [productCode, setProductCode] = useState('');
  const [packingText, setPackingText] = useState('');
  const [colors, setColors] = useState('');
  const [textPosition, setTextPosition] = useState('bottom-center');
  const [textColor, setTextColor] = useState('white');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canGenerate = productCode.trim() && packingText.trim() && files.length > 0;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} excede 10MB`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
    valid.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url]);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setFiles((prev) => prev.filter((_, j) => j !== i));
    setPreviews((prev) => prev.filter((_, j) => j !== i));
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError(null);
    setState('loading');
    try {
      const imagesBase64 = await Promise.all(files.map(toBase64));
      const mimeTypes = files.map((f) => f.type || 'image/jpeg');
      const res = await fetch('/api/catalog-image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imagesBase64,
          mimeTypes,
          productCode: productCode.trim(),
          packingText: packingText.trim(),
          colors: colors.trim() || undefined,
          textPosition,
          textColor,
          uploadToCloudinary: false,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error generando imagen');
      }
      const data = await res.json();
      setResultUrl(data.result_url);
      setState('preview');
    } catch (e: any) {
      setError(e.message);
      setState('ready');
    }
  };

  const handleApprove = async () => {
    setState('loading');
    try {
      const imagesBase64 = await Promise.all(files.map(toBase64));
      const mimeTypes = files.map((f) => f.type || 'image/jpeg');
      const res = await fetch('/api/catalog-image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imagesBase64,
          mimeTypes,
          productCode: productCode.trim(),
          packingText: packingText.trim(),
          colors: colors.trim() || undefined,
          textPosition,
          textColor,
          uploadToCloudinary: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }
      setState('success');
      toast.success('Imagen guardada en Cloudinary');
    } catch (e: any) {
      setError(e.message);
      setState('preview');
    }
  };

  const handleRegenerate = () => {
    setResultUrl(null);
    setError(null);
    setState('ready');
  };

  const handleReset = () => {
    setResultUrl(null);
    setError(null);
    setState('idle');
    files.forEach((_, i) => URL.revokeObjectURL(previews[i]));
    setFiles([]);
    setPreviews([]);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto fade-in zoom-in-95 duration-200">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Generar Imagen de Catálogo</h1>
        <p className="text-zinc-500 mt-1">Subí fotos de bodega y generá una imagen profesional con IA</p>
      </div>

      {/* Product info */}
      <div className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm space-y-4">
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Producto</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Código</label>
            <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="J09A10" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Cantidad</label>
            <Input value={packingText} onChange={(e) => setPackingText(e.target.value)} placeholder="4 Sets / Caja" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Colores (opcional)</label>
          <Input value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Negro, Marrón, Gris" />
        </div>
      </div>

      {/* Text style */}
      <div className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Estilo del texto</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Posición</label>
            <select
              value={textPosition}
              onChange={(e) => setTextPosition(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Color</label>
            <select
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm"
            >
              <option value="white">Blanco</option>
              <option value="black">Negro</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dropzone */}
      <div className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Fotos de bodega ({files.length} {files.length === 1 ? 'seleccionada' : 'seleccionadas'})
        </p>
        <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
          <PlusCircle className="w-8 h-8 text-zinc-400" />
          <span className="text-sm text-zinc-500">Click para agregar fotos</span>
          <span className="text-xs text-zinc-400">JPG o PNG, máx 10MB por imagen</span>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" multiple onChange={handleFiles} className="hidden" />
        </label>
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-0 right-0 p-0.5 bg-black/60 text-white rounded-bl-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-zinc-500">Generando imagen con IA...</p>
        </div>
      )}

      {/* Preview */}
      {state === 'preview' && resultUrl && (
        <div className="bg-white dark:bg-zinc-900 border rounded-xl p-5 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Vista previa</p>
          <img src={resultUrl} alt="Preview" className="w-full rounded-lg border" />
          <div className="flex gap-2">
            <Button onClick={handleApprove} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle className="w-4 h-4 mr-2" /> Aprobar y guardar
            </Button>
            <Button onClick={handleRegenerate} variant="outline" className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" /> Regenerar
            </Button>
          </div>
        </div>
      )}

      {/* Success */}
      {state === 'success' && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 text-center space-y-4">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
          <div>
            <p className="font-bold text-emerald-700 dark:text-emerald-300">Imagen guardada en Cloudinary</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">Producto {productCode} actualizado</p>
          </div>
          <Button onClick={handleReset} variant="outline">Nuevo producto</Button>
        </div>
      )}

      {/* Generate button */}
      {(state === 'idle' || state === 'ready') && (
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Generar preview
        </Button>
      )}
    </div>
  );
}
