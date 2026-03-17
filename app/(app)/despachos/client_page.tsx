'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileArchive, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

type QueueItemStatus = 'pending' | 'processing' | 'ok' | 'sin_folio' | 'error';

interface QueueItem {
  id: string;
  name: string;
  status: QueueItemStatus;
  base64: string; // The data URI for preview & upload
  message?: string;
}

export function DespachosClient({ activeEmpresaId }: { activeEmpresaId: number }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isExtractingZip, setIsExtractingZip] = useState(false);
  const preferredModelRef = useRef<HTMLSelectElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Convert File to Base64
  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleImagesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    // Quick validation
    const valid = files.filter(f => f.type.startsWith('image/'));
    if (valid.length < files.length) toast.warning('Algunos archivos no eran imágenes');

    const newItems: QueueItem[] = [];
    for (const file of valid) {
      try {
        const b64 = await toBase64(file);
        newItems.push({
          id: crypto.randomUUID(),
          name: file.name,
          status: 'pending',
          base64: b64,
        });
      } catch (err) {
        console.error("Error casting base64", err);
      }
    }

    setQueue(prev => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsExtractingZip(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/despachos/extract-zip', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('No se pudo extraer el ZIP');
      const { files } = await res.json();
      
      const newItems: QueueItem[] = files.map((f: any) => ({
         id: crypto.randomUUID(),
         name: f.name,
         status: 'pending',
         base64: f.base64,
      }));

      setQueue(prev => [...prev, ...newItems]);
      toast.success(`\${files.length} imágenes extraídas del ZIP`);
    } catch (err) {
      toast.error('Error al subir ZIP');
    } finally {
      setIsExtractingZip(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  const removeItem = (id: string) => {
    if (isProcessingQueue) return;
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const processQueue = async () => {
    const pendingItems = queue.filter(q => q.status === 'pending' || q.status === 'error');
    if (pendingItems.length === 0) return toast.info('No hay imágenes pendientes');

    setIsProcessingQueue(true);
    let success = 0;
    let fallback = 0;
    let errors = 0;

    const model = preferredModelRef.current?.value || 'auto';

    for (const item of pendingItems) {
      // Mark current as processing
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing', message: 'Extrayendo con IA...' } : q));

      try {
        const res = await fetch('/api/despachos/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Preferred-Model': model
          },
          body: JSON.stringify({
            empresaId: activeEmpresaId,
            filename: item.name,
            imageBase64: item.base64,
          })
        });

        const data = await res.json();
        
        if (!res.ok) {
           throw new Error(data.error || 'Error servidor');
        }

        const newStatus = data.state as QueueItemStatus;
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: newStatus, message: data.message } : q));
        
        if (newStatus === 'ok') success++;
        else if (newStatus === 'sin_folio') fallback++;
        else errors++;
        
      } catch (err: any) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', message: err.message } : q));
        errors++;
      }
    }

    setIsProcessingQueue(false);
    toast(`Proceso Finalizado`, {
      description: `\${success} exitosos / \${fallback} sin folio / \${errors} errores`,
      duration: 5000,
    });
  };

  const progress = queue.length === 0 ? 0 : Math.round((queue.filter(q => ['ok', 'sin_folio', 'error'].includes(q.status)).length / queue.length) * 100);

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Despachos & Guías</h1>
          <p className="text-zinc-500 mt-1">Sube fotos de documentos para extraer el Folio vía IA</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Panel */}
        <div className="lg:col-span-1 space-y-4">
           <div className="bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center gap-4">
              <UploadCloud className="w-12 h-12 text-blue-500" />
              <div>
                 <h3 className="font-bold text-lg">Subir Imágenes</h3>
                 <p className="text-sm text-zinc-500 mb-4 mt-1">Selecciona uno o varios JPG/PNG</p>
                 <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleImagesSelect} disabled={isProcessingQueue} />
                 <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessingQueue} className="w-full">
                    Examinar Imágenes
                 </Button>
              </div>
           </div>

           <div className="bg-white dark:bg-zinc-900 border rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center gap-4">
              <FileArchive className="w-12 h-12 text-amber-500" />
              <div>
                 <h3 className="font-bold text-lg">Subir ZIP Masivo</h3>
                 <p className="text-sm text-zinc-500 mb-4 mt-1">Extrae imágenes de un archivo .zip</p>
                 <input type="file" ref={zipInputRef} className="hidden" accept=".zip,application/zip" onChange={handleZipSelect} disabled={isExtractingZip || isProcessingQueue} />
                 <Button variant="secondary" onClick={() => zipInputRef.current?.click()} disabled={isExtractingZip || isProcessingQueue} className="w-full">
                    {isExtractingZip ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extrayendo...</> : 'Seleccionar .zip'}
                 </Button>
              </div>
           </div>

           <div className="bg-zinc-50 dark:bg-zinc-950 border border-dashed rounded-xl p-6">
              <label className="text-xs font-bold text-zinc-500 uppercase flex flex-col gap-2">
                 Modelo IA Preferido
                 <select ref={preferredModelRef} className="w-full bg-white dark:bg-zinc-900 border rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100" disabled={isProcessingQueue}>
                    <option value="auto">Automático (Llama 3 → GPT-4o)</option>
                    <option value="meta-llama/llama-3.2-90b-vision-instruct">Llama 3.2 90B Vision</option>
                    <option value="meta-llama/llama-3.2-11b-vision-instruct">Llama 3.2 11B Vision</option>
                    <option value="openai/gpt-4o">GPT-4o (Preciso)</option>
                    <option value="google/gemini-pro-1.5">Gemini 1.5 Pro</option>
                 </select>
              </label>
           </div>
        </div>

        {/* Queue Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border rounded-xl shadow-sm flex flex-col h-[600px]">
           <div className="p-4 border-b flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div>
                 <h2 className="font-bold text-lg">Cola de Procesamiento</h2>
                 <p className="text-xs text-zinc-500">{queue.length} archivo(s)</p>
              </div>
              
              <div className="flex items-center gap-3">
                 {queue.length > 0 && (
                   <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                     {progress}%
                   </div>
                 )}
                 <Button onClick={processQueue} disabled={isProcessingQueue || queue.length === 0} className="shadow-lg">
                   {isProcessingQueue ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</> : 'Procesar Cola'}
                 </Button>
                 <Button variant="outline" onClick={() => setQueue([])} disabled={isProcessingQueue || queue.length === 0}>
                   Limpiar
                 </Button>
              </div>
           </div>

           {/* Progress Bar */}
           <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `\${progress}%` }}></div>
           </div>

           <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {queue.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-zinc-400">
                    <ImageIcon className="w-16 h-16 mb-2 opacity-50" />
                    <p>La cola está vacía</p>
                 </div>
              ) : (
                queue.map((item, idx) => {
                  let statusColor = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
                  let statusIcon = <div className="w-2 h-2 rounded-full bg-zinc-400" />;
                  
                  if (item.status === 'processing') {
                    statusColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
                    statusIcon = <Loader2 className="w-4 h-4 animate-spin" />;
                  } else if (item.status === 'ok') {
                    statusColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200';
                    statusIcon = <CheckCircle2 className="w-4 h-4" />;
                  } else if (item.status === 'sin_folio') {
                    statusColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200';
                    statusIcon = <AlertCircle className="w-4 h-4" />;
                  } else if (item.status === 'error') {
                    statusColor = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border border-red-200';
                    statusIcon = <AlertCircle className="w-4 h-4" />;
                  }

                  return (
                    <div key={item.id} className={`flex items-center gap-3 p-2 rounded-lg \${statusColor} transition-colors`}>
                       <span className="text-xs font-mono opacity-50 w-6 text-center">{idx + 1}</span>
                       <div className="w-10 h-10 rounded bg-white dark:bg-black/20 overflow-hidden flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={item.base64} alt="preview" className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-xs opacity-75 truncate">{item.message || 'Esperando...'}</p>
                       </div>
                       <div className="px-3 flex-shrink-0 flex items-center gap-2">
                           {statusIcon}
                           {!isProcessingQueue && (item.status === 'pending' || item.status === 'error') && (
                             <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 p-1">✕</button>
                           )}
                       </div>
                    </div>
                  );
                })
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
