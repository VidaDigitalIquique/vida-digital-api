'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export function SubirImagenesClient() {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageQueue, setImageQueue] = useState<{name: string, status: 'pending'|'uploading'|'ok'|'error', msg?: string}[]>([]);
  const [isSyncingImages, setIsSyncingImages] = useState(false);
  const [imageSyncDone, setImageSyncDone] = useState(false);

  const handleImageFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f =>
      ['image/jpeg','image/jpg','image/png','image/webp'].includes(f.type)
    );
    setImageFiles(files);
    setImageQueue(files.map(f => ({ name: f.name, status: 'pending' })));
    setImageSyncDone(false);
  };

  const handleImageSync = async () => {
    if (imageFiles.length === 0) return;
    setIsSyncingImages(true);
    let ok = 0, errors = 0;
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const codigo = file.name.replace(/\.[^.]+$/, '');
      setImageQueue(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'uploading' } : item
      ));
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const res = await fetch('/api/productos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, codigo }),
        });
        if (res.ok) {
          ok++;
          setImageQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'ok' } : item
          ));
        } else {
          const err = await res.json();
          errors++;
          setImageQueue(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', msg: err.error } : item
          ));
        }
      } catch {
        errors++;
        setImageQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', msg: 'Error de red' } : item
        ));
      }
    }
    setIsSyncingImages(false);
    setImageSyncDone(true);
    toast.success(`Sync completado: ${ok} subidas, ${errors} errores`);
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <UploadCloud className="w-8 h-8 text-blue-600" /> Subir Imágenes en Lote
          </h1>
          <p className="text-zinc-500 mt-1">Sube imágenes en lote desde tu PC. El nombre del archivo debe coincidir exactamente con el código del producto.</p>
        </div>
      </div>

      <div className="border-t pt-8 mt-2">
        <label className="mt-4 flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-zinc-300">
          <UploadCloud className="w-8 h-8 text-zinc-400 mb-2" />
          <span className="text-sm text-zinc-500">Clic para seleccionar imágenes (JPG, PNG, WEBP)</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageFilesSelect} />
        </label>
        {imageQueue.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">{imageQueue.length} imágenes seleccionadas</span>
              <Button onClick={handleImageSync} disabled={isSyncingImages || imageSyncDone} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSyncingImages ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sincronizando...</> : 'Iniciar Sincronización'}
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
              {imageQueue.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1">
                  {item.status === 'pending' && <div className="w-3 h-3 rounded-full bg-zinc-300" />}
                  {item.status === 'uploading' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                  {item.status === 'ok' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  {item.status === 'error' && <AlertTriangle className="w-3 h-3 text-red-500" />}
                  <span className={`font-mono truncate ${item.status === 'error' ? 'text-red-500' : ''}`}>{item.name}</span>
                  {item.msg && <span className="text-red-400 ml-auto">{item.msg}</span>}
                  {item.status === 'pending' && (
                    <button
                      onClick={() => {
                        setImageFiles(prev => prev.filter((_, idx) => idx !== i));
                        setImageQueue(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      className="ml-auto text-zinc-400 hover:text-red-500"
                      title="Eliminar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
