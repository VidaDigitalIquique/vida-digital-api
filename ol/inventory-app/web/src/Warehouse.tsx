import React, { useEffect, useMemo, useState } from "react";

type Location = { id:string; code:string; name:string; notes?:string|null; createdAt?:string; updatedAt?:string };
type CountRow = { location_id:string; location_code:string; location_name:string; countedBoxes:number|null|string; countedAt:string|null; note:string|null };

const API = (import.meta as any).env?.VITE_API_URL ? String((import.meta as any).env.VITE_API_URL).replace(/\/$/,"") : "http://localhost:4000";

export default function Warehouse() {
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [locs, setLocs] = useState<Location[]>([]);

  // guardar conteo
  const [selLoc, setSelLoc] = useState<string>("");
  const [productToSave, setProductToSave] = useState("");
  const [boxesStr, setBoxesStr] = useState("");
  const [note, setNote] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // ver conteos
  const [productToView, setProductToView] = useState("");
  const [rows, setRows] = useState<CountRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoadingLocs(true);
        const r = await fetch(`${API}/wh/locations`);
        const data = await r.json();
        setLocs(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        alert("No pude cargar ubicaciones");
      } finally {
        setLoadingLocs(false);
      }
    })();
  }, []);

  const canSave = useMemo(() => {
    const b = boxesStr.replace(",", ".").trim();
    const n = Number(b);
    return selLoc && productToSave.trim().length > 0 && Number.isFinite(n);
  }, [selLoc, productToSave, boxesStr]);

  async function saveCount() {
    try {
      if (!canSave) return;
      setSaveBusy(true);
      const countedBoxes = Number(boxesStr.replace(",", "."));
      const body = {
        productCode: productToSave.trim(),
        locationCode: selLoc,
        countedBoxes,
        note: note.trim() || null,
      };
      const r = await fetch(`${API}/wh/counts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());

      setBoxesStr("");
      setNote("");
      setSavedAt(new Date());
      // refrescar si estamos viendo el mismo producto
      if (productToView.trim().toUpperCase() === productToSave.trim().toUpperCase()) {
        await loadCounts();
      }
    } catch (e:any) {
      console.error(e);
      alert("Error al guardar conteo: " + (e?.message ?? "desconocido"));
    } finally {
      setSaveBusy(false);
    }
  }

  async function loadCounts() {
    try {
      if (!productToView.trim()) { setRows([]); return; }
      setLoadingRows(true);
      const r = await fetch(`${API}/wh/counts?code=${encodeURIComponent(productToView.trim())}`);
      const data = await r.json();
      setRows(Array.isArray(data) ? data : (Array.isArray(data.value) ? data.value : []));
    } catch (e) {
      console.error(e);
      alert("No pude cargar conteos");
    } finally {
      setLoadingRows(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestión de Bodega</h1>
              <p className="mt-2 text-lg text-gray-600">
                Registra conteos por ubicación y consulta el historial de productos
              </p>
            </div>
            {savedAt && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">
                      Guardado: {savedAt.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel de Guardar Conteo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Nuevo Conteo</h2>
              <p className="text-blue-100 text-sm mt-1">Registra un conteo rápido de inventario</p>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Ubicación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ubicación en Bodega
                </label>
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={loadingLocs}
                  value={selLoc}
                  onChange={(e) => setSelLoc(e.target.value)}
                >
                  <option value="">Selecciona una ubicación</option>
                  {locs.map((l) => (
                    <option key={l.id} value={l.code}>
                      {l.code} — {l.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Código de Producto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código del Producto
                </label>
                <input
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Ejemplo: SF-2074, 002, ABC-123"
                  value={productToSave}
                  onChange={(e) => setProductToSave(e.target.value)}
                />
              </div>

              {/* Cajas y Nota */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cantidad de Cajas
                  </label>
                  <input
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="0.00"
                    inputMode="decimal"
                    value={boxesStr}
                    onChange={(e) => setBoxesStr(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observaciones
                  </label>
                  <input
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Notas opcionales..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              {/* Botón Guardar */}
              <div className="flex justify-end pt-4">
                <button
                  className={`px-8 py-3 rounded-lg font-medium transition-all ${
                    !canSave || saveBusy
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md transform hover:-translate-y-0.5'
                  }`}
                  disabled={!canSave || saveBusy}
                  onClick={saveCount}
                >
                  {saveBusy ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Guardando...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Guardar Conteo
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Panel de Consulta */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Consultar Conteos</h2>
              <p className="text-purple-100 text-sm mt-1">Busca el historial por código de producto</p>
            </div>
            
            <div className="p-6">
              {/* Buscador */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código del Producto a Consultar
                </label>
                <div className="flex space-x-3">
                  <input
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors"
                    placeholder="Ejemplo: 002, SF-2074..."
                    value={productToView}
                    onChange={(e) => setProductToView(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") loadCounts(); }}
                  />
                  <button
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors font-medium"
                    onClick={loadCounts}
                    disabled={loadingRows}
                  >
                    {loadingRows ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Buscando
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Buscar
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Tabla de Resultados */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ubicación
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cajas
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nota
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="text-sm">Ingresa un código de producto para ver los conteos</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => (
                          <tr key={r.location_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                {r.location_code}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {r.location_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                              {r.countedBoxes === null || r.countedBoxes === undefined 
                                ? <span className="text-gray-400">-</span>
                                : String(r.countedBoxes)
                              }
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                              {r.countedAt 
                                ? new Date(r.countedAt).toLocaleString('es-ES', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : '-'
                              }
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                              {r.note || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}