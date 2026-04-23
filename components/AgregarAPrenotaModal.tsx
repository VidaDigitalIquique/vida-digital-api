'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  producto: {
    codigo: string;
    detalle: string | null;
    imagen_url: string | null;
    empresa_id: number;
    prcventa: number;
    cantcaja: number;
    saldo: number;
  };
}

export function AgregarAPrenotaModal({ open, onClose, producto }: Props) {
  const [prenotas, setPrenotas] = useState<any[]>([]);
  const [prenotaId, setPrenotaId] = useState<string>('nueva');
  const [cajas, setCajas] = useState(1);
  const [precio, setPrecio] = useState(producto.prcventa);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrecio(producto.prcventa);
  }, [producto.prcventa]);

  useEffect(() => {
    if (!open) return;

    async function fetchPrenotas() {
      try {
        const res = await fetch('/api/prenotas');
        if (res.ok) {
          const { data } = await res.json();
          setPrenotas(data || []);
        } else {
          setPrenotas([]);
        }
      } catch {
        setPrenotas([]);
      }
    }

    fetchPrenotas();
  }, [open]);

  if (open === false) return null;

  const handleAgregar = async () => {
    setSaving(true);
    try {
      let id = prenotaId;
      if (prenotaId === 'nueva') {
        const res = await fetch('/api/prenotas', { method: 'POST' });
        const data = await res.json();
        id = String(data.id);
      }
      await fetch(`/api/prenotas/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: producto.codigo,
          descripcion: producto.detalle,
          imagen_url: producto.imagen_url,
          empresa_id: producto.empresa_id,
          cajas,
          unidades: cajas * producto.cantcaja,
          precio,
          saldo_zofri: producto.saldo,
        }),
      });
      toast.success('Producto agregado a pre-nota');
      onClose();
    } catch {
      toast.error('No se pudo agregar a pre-nota');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h2 className="font-bold text-lg">Agregar a Pre-Nota</h2>
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Pre-Nota</label>
          <select value={prenotaId} onChange={e => setPrenotaId(e.target.value)} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm">
            <option value="nueva">+ Nueva pre-nota</option>
            {prenotas.map(p => <option key={p.id} value={String(p.id)}>{p.titulo}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Cajas</label>
          <input type="number" min={1} value={cajas} onChange={e => setCajas(Number(e.target.value))} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-zinc-400 mt-1">{cajas * producto.cantcaja} unidades</p>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Precio USD</label>
          <input type="number" min={0} step={0.01} value={precio} onChange={e => setPrecio(Number(e.target.value))} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-zinc-50">Cancelar</button>
          <button onClick={handleAgregar} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  );
}
