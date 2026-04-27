'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Trash2, Pencil, FileDown, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

function PrenotaItemsTable({
  items,
  onEliminar,
  prenotaId,
  onActualizar,
}: {
  items: any[];
  onEliminar: (itemId: number) => void;
  prenotaId: string;
  onActualizar: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCajas, setEditCajas] = useState<number>(0);
  const [editUnidades, setEditUnidades] = useState<number>(0);
  const [editPrecio, setEditPrecio] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const handleGuardar = async (itemId: number) => {
    setSaving(true);
    try {
      await fetch(`/api/prenotas/${prenotaId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cajas: editCajas, unidades: editUnidades, precio: editPrecio }),
      });
      setEditingId(null);
      onActualizar();
    } catch {
      // silencioso
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-zinc-500">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Código</th>
              <th className="text-left px-4 py-3 font-medium">Descripción</th>
              <th className="text-left px-4 py-3 font-medium">Empresa</th>
              <th className="text-right px-4 py-3 font-medium">Cajas</th>
              <th className="text-right px-4 py-3 font-medium">Unidades</th>
              <th className="text-right px-4 py-3 font-medium">Precio</th>
              <th className="text-right px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-border align-top">
                <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">{item.codigo}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{item.descripcion}</div>
                  {Number(item.unidades) > Number(item.saldo_zofri ?? 0) && (
                    <div className="text-xs text-red-500 mt-1">⚠ Supera stock disponible</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge className={item.empresa_id === 1 ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}>
                    {item.empresa_id === 1 ? 'SANJH' : 'VIDA DIGITAL'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">{item.cajas}</td>
                <td className="px-4 py-3 text-right">{item.unidades}</td>
                <td className="px-4 py-3 text-right">${Number(item.precio).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  {editingId === item.id ? (
                    <div className="flex flex-col gap-2 items-end min-w-[140px]">
                      <div className="flex flex-col gap-1 w-full">
                        <label className="text-xs text-zinc-400">Cajas</label>
                        <input
                          type="number"
                          min={1}
                          value={editCajas}
                          onFocus={e => e.target.select()}
                          onChange={e => setEditCajas(Number(e.target.value))}
                          className="border rounded px-2 py-1 text-sm w-full"
                        />
                      </div>
                      <div className="flex flex-col gap-1 w-full">
                        <label className="text-xs text-zinc-400">Unidades</label>
                        <input
                          type="number"
                          min={1}
                          value={editUnidades}
                          onFocus={e => e.target.select()}
                          onChange={e => setEditUnidades(Number(e.target.value))}
                          className="border rounded px-2 py-1 text-sm w-full"
                        />
                      </div>
                      <div className="flex flex-col gap-1 w-full">
                        <label className="text-xs text-zinc-400">Precio USD</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={editPrecio}
                          onFocus={e => e.target.select()}
                          onChange={e => setEditPrecio(Number(e.target.value))}
                          className="border rounded px-2 py-1 text-sm w-full"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="text-xs w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => handleGuardar(item.id)}
                        disabled={saving}
                      >
                        {saving ? 'Guardando...' : 'Guardar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 w-full"
                        onClick={() => { onEliminar(item.id); setEditingId(null); }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Eliminar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs w-full"
                        onClick={() => setEditingId(null)}
                      >
                        Cerrar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditCajas(Number(item.cajas));
                        setEditUnidades(Number(item.unidades));
                        setEditPrecio(Number(item.precio));
                      }}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Editar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PrenotaDetallePage({ session, params }: { session: any; params: { id: string } }) {
  void session;
  const router = useRouter();
  const id = params.id;

  const [prenota, setPrenota] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchCliente, setSearchCliente] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<any[]>([]);
  const [searchClienteFactura, setSearchClienteFactura] = useState('');
  const [debouncedSearchFactura, setDebouncedSearchFactura] = useState('');
  const [clienteFacturaResults, setClienteFacturaResults] = useState<any[]>([]);

  const fetchPrenota = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prenotas/${id}`);
      if (res.ok) {
        const data = await res.json();
        setPrenota(data);
      } else {
        toast.error('No se pudo cargar la pre-nota');
      }
    } catch {
      toast.error('No se pudo cargar la pre-nota');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrenota();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchCliente), 400);
    return () => clearTimeout(timer);
  }, [searchCliente]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchFactura(searchClienteFactura), 400);
    return () => clearTimeout(timer);
  }, [searchClienteFactura]);

  useEffect(() => {
    async function buscarClientes() {
      if (debouncedSearch.trim().length < 2) {
        setClienteResults([]);
        return;
      }

      try {
        const res = await fetch(`/api/ventas/clientes?q=${encodeURIComponent(debouncedSearch)}&empresaSlug=vida`);
        if (res.ok) {
          const { data } = await res.json();
          setClienteResults(data || []);
        } else {
          setClienteResults([]);
        }
      } catch {
        setClienteResults([]);
      }
    }

    buscarClientes();
  }, [debouncedSearch]);

  useEffect(() => {
    async function buscarClientesFactura() {
      if (debouncedSearchFactura.trim().length < 2) {
        setClienteFacturaResults([]);
        return;
      }

      try {
        const res = await fetch(`/api/ventas/clientes?q=${encodeURIComponent(debouncedSearchFactura)}&empresaSlug=vida`);
        if (res.ok) {
          const { data } = await res.json();
          setClienteFacturaResults(data || []);
        } else {
          setClienteFacturaResults([]);
        }
      } catch {
        setClienteFacturaResults([]);
      }
    }

    buscarClientesFactura();
  }, [debouncedSearchFactura]);

  const asignarCliente = async (c: any) => {
    try {
      await fetch(`/api/prenotas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kcodclie: Number(c.kcodclie), nombre_cliente: c.nombress }),
      });
      setSearchCliente('');
      setClienteResults([]);
      await fetchPrenota();
    } catch {
      toast.error('No se pudo asignar cliente');
    }
  };

  const quitarCliente = async () => {
    try {
      await fetch(`/api/prenotas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kcodclie: null, nombre_cliente: null }),
      });
      await fetchPrenota();
    } catch {
      toast.error('No se pudo quitar cliente');
    }
  };

  const asignarClienteFactura = async (c: any) => {
    try {
      await fetch(`/api/prenotas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kcodclie_factura: Number(c.kcodclie),
          nombre_cliente_factura: c.nombress,
        }),
      });
      setSearchClienteFactura('');
      setClienteFacturaResults([]);
      await fetchPrenota();
    } catch {
      toast.error('No se pudo asignar cliente de factura');
    }
  };

  const quitarClienteFactura = async () => {
    try {
      await fetch(`/api/prenotas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kcodclie_factura: null, nombre_cliente_factura: null }),
      });
      await fetchPrenota();
    } catch {
      toast.error('No se pudo quitar cliente de factura');
    }
  };

  const cambiarTipoDocumento = async (tipo: string) => {
    try {
      await fetch(`/api/prenotas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_documento: tipo || null }),
      });
      await fetchPrenota();
    } catch {
      toast.error('No se pudo actualizar tipo de documento');
    }
  };

  const eliminarItem = async (itemId: number) => {
    try {
      await fetch(`/api/prenotas/${id}/items/${itemId}`, { method: 'DELETE' });
      await fetchPrenota();
    } catch {
      toast.error('No se pudo eliminar item');
    }
  };

  const exportarExcel = () => {
    if (!prenota?.items?.length) return;
    const sanjhItems = prenota.items.filter((i: any) => i.empresa_id === 1);
    const vidaItems = prenota.items.filter((i: any) => i.empresa_id === 2);
    const infoRows = [
      { Campo: 'Título', Valor: prenota.titulo },
      { Campo: 'Cliente comprador', Valor: prenota.nombre_cliente || '-' },
      { Campo: 'A quién va el documento', Valor: prenota.nombre_cliente_factura || '-' },
      { Campo: 'Tipo de documento', Valor: prenota.tipo_documento || '-' },
    ];

    const toRows = (items: any[]) => items.map(i => ({
      'Código': i.codigo,
      'Descripción': i.descripcion,
      'Cajas': Number(i.cajas),
      'Unidades': Number(i.unidades),
      'Precio USD': Number(i.precio),
      'Stock Zofri': Number(i.saldo_zofri),
      'Total USD': Number(i.unidades) * Number(i.precio),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(infoRows), 'Info');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(vidaItems)), 'VIDA DIGITAL');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(sanjhItems)), 'SANJH');

    const filename = `${prenota.titulo}${prenota.nombre_cliente ? ' — ' + prenota.nombre_cliente : ''}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const exportarPDF = () => {
    if (!prenota?.items?.length) return;

    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString('es-CL', {
      day: '2-digit', month: 'long', year: 'numeric'
    });

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('VidaDigital — Pre-Nota de Venta', 14, 20);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${prenota.titulo}`, 14, 30);
    let y = 37;
    if (prenota.nombre_cliente) {
      doc.text(`Cliente: ${prenota.nombre_cliente}`, 14, y);
      y += 7;
    }
    if (prenota.nombre_cliente_factura) {
      doc.text(`A quién va: ${prenota.nombre_cliente_factura}`, 14, y);
      y += 7;
    }
    if (prenota.tipo_documento) {
      doc.text(`Tipo: ${prenota.tipo_documento}`, 14, y);
      y += 7;
    }
    doc.text(`Fecha: ${fecha}`, 14, y);
    y += 8;

    // Tabla
    const startY = y;
    const rows = prenota.items.map((i: any) => [
      i.codigo,
      i.descripcion || '',
      i.empresa_id === 1 ? 'SANJH' : 'VIDA DIGITAL',
      Number(i.cajas),
      Number(i.unidades),
      `$${Number(i.precio).toFixed(2)}`,
      `$${(Number(i.unidades) * Number(i.precio)).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY,
      head: [['Código', 'Descripción', 'Empresa', 'Cajas', 'Unidades', 'Precio', 'Total']],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 65 },
        2: { cellWidth: 25 },
        3: { cellWidth: 13, halign: 'right' },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
      },
    });

    // Total general
    const total = prenota.items.reduce(
      (sum: number, i: any) => sum + Number(i.unidades) * Number(i.precio), 0
    );
    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      `Total: $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      14, finalY
    );

    const filename = `${prenota.titulo}${prenota.nombre_cliente ? ' — ' + prenota.nombre_cliente : ''}.pdf`;
    doc.save(filename);
  };

  const compartirWhatsApp = () => {
    if (!prenota?.items?.length) return;

    const total = prenota.items.reduce(
      (sum: number, i: any) => sum + Number(i.unidades) * Number(i.precio), 0
    );
    const totalStr = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const lineas = prenota.items.map((i: any) =>
      `• [${i.empresa_id === 1 ? 'SANJH' : 'VD'}] ${i.codigo} — ${i.descripcion || ''} (${i.cajas} cajas / ${i.unidades} uds) $${Number(i.precio).toFixed(2)}`
    ).join('\n');

    const mensaje = [
      `*${prenota.titulo}*`,
      prenota.nombre_cliente ? `Cliente: ${prenota.nombre_cliente}` : null,
      prenota.nombre_cliente_factura ? `A quién va: ${prenota.nombre_cliente_factura}` : null,
      prenota.tipo_documento ? `Tipo: ${prenota.tipo_documento}` : null,
      ``,
      lineas,
      ``,
      `*Total: $${totalStr}*`,
    ].filter(l => l !== null).join('\n');

    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col gap-6 fade-in zoom-in-95 duration-200">
      <div className="flex flex-col gap-3">
        <button
          onClick={() => router.push('/prenotas')}
          className="text-sm text-zinc-500 hover:text-zinc-700 w-fit"
        >
          ← Volver
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{prenota?.titulo || 'Pre-Nota'}</h1>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              variant="outline"
              onClick={exportarExcel}
              disabled={!prenota?.items?.length}
            >
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              onClick={exportarPDF}
              disabled={!prenota?.items?.length}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={compartirWhatsApp}
              disabled={!prenota?.items?.length}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar por WhatsApp
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-white dark:bg-zinc-900 shadow-sm flex flex-col gap-4">
        <h2 className="font-semibold text-base">Cliente</h2>
        {prenota?.nombre_cliente ? (
          <div className="flex items-center gap-3">
            <div className="font-medium">Cliente: {prenota.nombre_cliente}</div>
            <button onClick={quitarCliente} className="text-sm text-red-500 hover:text-red-700">✕</button>
          </div>
        ) : (
          <>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Buscar cliente..."
                value={searchCliente}
                onChange={e => setSearchCliente(e.target.value)}
                className="pl-9"
              />
            </div>
            {clienteResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {clienteResults.map(c => (
                  <button
                    key={c.kcodclie}
                    onClick={() => asignarCliente(c)}
                    className="text-left p-3 rounded-lg border border-border hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {c.nombress}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="pt-2 border-t border-border flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo de documento</label>
          <select
            value={prenota?.tipo_documento ?? ''}
            onChange={e => cambiarTipoDocumento(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">-</option>
            <option value="Traspaso">Traspaso</option>
            <option value="SRF">SRF</option>
            <option value="Reexpedición">Reexpedición</option>
            <option value="Cambio de Ubicación">Cambio de Ubicación</option>
            <option value="Régimen General">Régimen General</option>
          </select>
        </div>

        <div className="pt-2 border-t border-border flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">A quién va el documento:</label>
          {prenota?.nombre_cliente_factura ? (
            <div className="flex items-center gap-3">
              <div className="font-medium">{prenota.nombre_cliente_factura}</div>
              <button onClick={quitarClienteFactura} className="text-sm text-red-500 hover:text-red-700">✕</button>
            </div>
          ) : (
            <>
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  placeholder="Buscar cliente para factura..."
                  value={searchClienteFactura}
                  onChange={e => setSearchClienteFactura(e.target.value)}
                  className="pl-9"
                />
              </div>
              {clienteFacturaResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  {clienteFacturaResults.map(c => (
                    <button
                      key={c.kcodclie}
                      onClick={() => asignarClienteFactura(c)}
                      className="text-left p-3 rounded-lg border border-border hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      {c.nombress}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : prenota?.items?.length > 0 ? (
        <>
          {(() => {
            const total = prenota.items.reduce(
              (sum: number, item: any) => sum + Number(item.unidades) * Number(item.precio),
              0
            );
            return (
              <div className="flex items-center justify-end gap-2 px-1">
                <span className="text-sm text-zinc-500 font-medium">Total prenota:</span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })()}
          <PrenotaItemsTable items={prenota.items} onEliminar={eliminarItem} prenotaId={id} onActualizar={fetchPrenota} />
        </>
      ) : (
        <p className="text-zinc-400">No hay productos en esta pre-nota aún</p>
      )}
    </div>
  );
}
