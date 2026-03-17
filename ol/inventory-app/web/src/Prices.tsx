import React, { useEffect, useMemo, useState } from "react";

const API = "http://localhost:4000";

type ProductRow = {
  code: string;
  description: string | null;
  stock_units: number | string | null;
  stock_boxes: number | string | null;
  cost_usd: number | string | null;
  qty_per_box: number | string | null;
  inventory_boxes: number | string | null;
  price_usd?: number | string | null;
};

type LocationRow = {
  location_id: string;
  location_code: string;
  location_name: string | null;
  countedBoxes: number | null;
  countedAt: string | null;
  note: string | null;
};

type RecentRow = {
  id: string;
  productCode: string;
  countedBoxes: number | null;
  countedAt: string | null;
  note: string | null;
  locationCode: string;
  locationName: string | null;
};

type Summary = {
  productCode: string;
  inventory_boxes: number;
  physical_boxes: number;
  difference_boxes: number;
  difference_percent: number;
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

function num(n: any): number | null {
  if (n === null || n === undefined) return null;
  const v = typeof n === "number" ? n : Number(String(n).replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

function fmt2(n: number | null) {
  if (n === null) return "ï¿½?,????";
  return new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function Badge({ tone = "neutral", children }: { tone?: "ok"|"warn"|"danger"|"neutral"; children: React.ReactNode }) {
  const map: Record<string,string> = {
    ok: "bg-green-100 text-green-800",
    warn: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    neutral: "bg-gray-100 text-gray-800",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[tone]}`}>{children}</span>;
}

/** ====================== */
export default function Prices() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [q, setQ] = useState<string>("");
  const [sort, setSort] = useState<string>("code:asc");
  const [limit, setLimit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const [modalCode, setModalCode] = useState<string | null>(null);
  const [modalDesc, setModalDesc] = useState<string>("");

  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  async function load() {
    setLoading(true);
    try {
      const url = new URL(API + "/products");
      if (q) url.searchParams.set("q", q);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("sort", sort);
      const data = await getJson<{ rows: ProductRow[]; total: number }>(url.toString());
      setRows(data.rows);
      setTotal(data.total ?? data.rows.length);
    } catch (e: any) {
      console.error(e);
      alert("Error cargando productos:\n" + (e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [q, sort, limit, offset]);

  function exportCSV() {
    const header = ["C?fï¿½digo","Descripci?fï¿½n","Costo USD","Precio USD","Unidades","Unid/Caja","Cajas (te?fï¿½rico)"];
    const csv = [
      header.join("\t"),
      ...rows.map(r => [
        r.code,
        (r.description ?? "").replace(/\s+/g, " ").trim(),
        fmt2(num(r.cost_usd)),
        fmt2(num(r.price_usd as any)),
        fmt2(num(r.stock_units)),
        fmt2(num(r.qty_per_box)),
        fmt2(num(r.inventory_boxes)),
      ].join("\t"))
    ].join("\r\n");
    const blob = new Blob([csv], { type: "text/tab-separated-values;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "precios.tsv";
    a.click();
  }

  function openWarehouseModal(r: ProductRow) {
    setModalCode(r.code);
    setModalDesc((r.description ?? "").toString());
  }

  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <input
            placeholder="Buscar por c?fï¿½digo o descripci?fï¿½n..."
            className="border rounded px-3 py-2 w-[360px]"
            value={q}
            onChange={e => { setOffset(0); setQ(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          />
          <select className="border rounded px-2 py-2"
                  value={sort}
                  onChange={(e)=> { setOffset(0); setSort(e.target.value); }}>
            <option value="code:asc">C?fï¿½digo ï¿½?????~</option>
            <option value="code:desc">C?fï¿½digo ï¿½?????o</option>
            <option value="cost_usd:desc">Costo ï¿½?????o</option>
            <option value="cost_usd:asc">Costo ï¿½?????~</option>
            <option value="inventory_boxes:desc">Cajas te?fï¿½rico ï¿½?????o</option>
            <option value="inventory_boxes:asc">Cajas te?fï¿½rico ï¿½?????~</option>
            <option value="qty_per_box:desc">Unid/Caja ï¿½?????o</option>
            <option value="qty_per_box:asc">Unid/Caja ï¿½?????~</option>
            <option value="stock_units:desc">Unidades ï¿½?????o</option>
            <option value="stock_units:asc">Unidades ï¿½?????~</option>
          </select>
          <button className="border rounded px-3 py-2" onClick={() => load()}>Buscar</button>
        </div>
        <div className="flex items-center gap-2">
          <button className="border rounded px-3 py-2" onClick={exportCSV}>Exportar CSV</button>
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-2">
        Total: <b>{total}</b> &nbsp;|&nbsp; P?fï¿½gina {page} de {pages}
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">C?fï¿½digo</th>
              <th className="text-left px-3 py-2">Descripci?fï¿½n</th>
              <th className="text-right px-3 py-2">Costo USD</th>
              <th className="text-right px-3 py-2">Precio USD</th>
              <th className="text-right px-3 py-2">Unidades</th>
              <th className="text-right px-3 py-2">Unid/Caja</th>
              <th className="text-right px-3 py-2">Cajas (te?fï¿½rico)</th>
              <th className="text-center px-3 py-2">Bodega</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const cost = num(r.cost_usd);
              const price = num(r.price_usd as any);
              return (
                <tr key={r.code} className={idx % 2 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-3 py-2">
                    <a className="text-sky-700 underline cursor-pointer" onClick={() => openWarehouseModal(r)}>{r.code}</a>
                  </td>
                  <td className="px-3 py-2">{r.description}</td>
                  <td className="px-3 py-2 text-right">{fmt2(cost)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt2(price)}</td>
                  <td className="px-3 py-2 text-right">{fmt2(num(r.stock_units))}</td>
                  <td className="px-3 py-2 text-right">{fmt2(num(r.qty_per_box))}</td>
                  <td className="px-3 py-2 text-right">{fmt2(num(r.inventory_boxes))}</td>
                  <td className="px-3 py-2 text-center">
                    <button className="px-2 py-1 text-xs rounded bg-gray-800 text-white"
                            onClick={() => openWarehouseModal(r)}>Bodega</button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={8}>Sin resultadosï¿½?,?ï¿½</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button className="border rounded px-3 py-1 disabled:opacity-50"
                disabled={offset<=0}
                onClick={()=> setOffset(Math.max(0, offset - limit))}>ï¿½???ï¿½ Anterior</button>
        <button className="border rounded px-3 py-1 disabled:opacity-50"
                disabled={offset + limit >= total}
                onClick={()=> setOffset(offset + limit)}>Siguiente ï¿½?????T</button>
        <span className="text-sm text-gray-600">Mostrando {Math.min(total, offset+1)}ï¿½?,???o{Math.min(total, offset+rows.length)} de {total}</span>
      </div>

      {modalCode && (
        <WarehouseModal
          code={modalCode}
          description={modalDesc}
          onClose={()=> setModalCode(null)}
        />
      )}
    </div>
  );
}

/** ====================== Modal Bodega ====================== */

function WarehouseModal({ code, description, onClose }:{
  code: string;
  description: string;
  onClose: () => void;
}) {
  const [locations, setLocations] = useState<{code:string;name:string|null}[]>([]);
  const [counts, setCounts] = useState<LocationRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[] | null>(null); // null = no intentado; [] = vac?fï¿½o
  const [summary, setSummary] = useState<Summary | null>(null);

  const [selLoc, setSelLoc] = useState<string>("");
  const [boxes, setBoxes] = useState<string>("");
  const [note, setNote] = useState<string>("");

  async function loadAll() {
    // ubicaciones (ya las devuelve GET /wh/locations)
    const locs = await getJson<{code:string;name:string|null;id:string}[]>(API + "/wh/locations");
    setLocations(locs.map(l => ({ code: l.code, name: l.name })));

    // counts por ubicaci?fï¿½n del producto
    const c = await getJson<LocationRow[]>(API + `/wh/counts?code=${encodeURIComponent(code)}`);
    // backend ya normaliza countedBoxes a n?fï¿½mero; por si acaso:
    setCounts(c.map(x => ({...x, countedBoxes: num(x.countedBoxes) } as any)));

    // resumen diferencias
    try {
      const s = await getJson<Summary>(API + `/wh/summary?productCode=${encodeURIComponent(code)}`);
      setSummary(s);
    } catch (e) {
      setSummary(null);
    }

    // recientes (si existe ruta)
    try {
      const r = await getJson<RecentRow[]>(API + `/wh/recent?productCode=${encodeURIComponent(code)}&limit=10`);
      setRecent(r.map(rr => ({...rr, countedBoxes: num(rr.countedBoxes)} as any)));
    } catch {
      setRecent([]); // no romper, solo ocultar bloque si viene vac?fï¿½o
    }
  }

  useEffect(() => { loadAll(); }, [code]);

  async function saveCount() {
    const counted = Number(boxes);
    if (!selLoc) return alert("Selecciona ubicaci?fï¿½n");
    if (!Number.isFinite(counted)) return alert("Ingresa cajas contadas (n?fï¿½mero)");
    await getJson(API + "/wh/counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productCode: code,
        locationCode: selLoc,
        countedBoxes: counted,
        note: note?.trim() || null
      })
    });
    setBoxes("");
    setNote("");
    await loadAll();
    alert("Conteo guardado");
  }

  async function updateRecent(id: string, newBoxes: number, newNote: string) {
    await getJson(API + `/wh/counts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countedBoxes: newBoxes, note: newNote || null })
    });
    await loadAll();
  }

  async function deleteRecent(id: string) {
    if (!confirm("?,ï¿½Eliminar conteo?")) return;
    await getJson(API + `/wh/counts/${id}`, { method: "DELETE" });
    await loadAll();
  }

  const diffTone: "ok"|"warn"|"danger" = useMemo(() => {
    if (!summary) return "neutral" as any;
    const p = Math.abs(summary.difference_percent || 0);
    if (p < 5) return "ok";
    if (p < 15) return "warn";
    return "danger";
  }, [summary]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[980px] max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <div className="text-lg font-semibold">Ubicaci�n Bodega ï¿½?,???? <span className="font-mono">{code}</span></div>
            <div className="text-xs text-gray-500 max-w-[820px] truncate">{description}</div>
          </div>
          <button className="px-3 py-1 rounded border" onClick={onClose}>Cerrar</button>
        </div>

        {/* Resumen */}
        <div className="px-5 pt-4">
          {summary ? (
            <div className="flex flex-wrap gap-3 items-center">
              <div className="text-sm">F?fï¿½sicas: <b>{fmt2(summary.physical_boxes)}</b></div>
              <div className="text-sm">Te?fï¿½rico: <b>{fmt2(summary.inventory_boxes)}</b></div>
              <div className="text-sm">Diferencia: <b>{fmt2(summary.difference_boxes)}</b></div>
              <Badge tone={diffTone}>
                {fmt2(summary.difference_percent)}%
              </Badge>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Sin resumen disponible.</div>
          )}
        </div>

        {/* Guardar r?fï¿½pido */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Ubicaci?fï¿½n</label>
              <select className="border rounded px-2 py-2 w-full" value={selLoc} onChange={e=> setSelLoc(e.target.value)}>
                <option value="">-- Selecciona --</option>
                {locations.map(l => <option key={l.code} value={l.code}>{l.code} ï¿½?,???? {l.name || "ï¿½?,????"}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Cajas contadas</label>
              <input className="border rounded px-2 py-2 w-full" inputMode="decimal"
                     value={boxes} onChange={e=> setBoxes(e.target.value)} />
            </div>
            <div className="col-span-5">
              <label className="block text-xs text-gray-500 mb-1">Nota (opcional)</label>
              <input className="border rounded px-2 py-2 w-full"
                     placeholder="observacionesï¿½?,?ï¿½" value={note} onChange={e=> setNote(e.target.value)} />
            </div>
            <div className="col-span-2 flex items-end">
              <button className="w-full rounded bg-gray-900 text-white py-2"
                      onClick={saveCount}>Guardar</button>
            </div>
          </div>
        </div>

        {/* Tabla por ubicaci?fï¿½n */}
        <div className="px-5 pt-6">
          <div className="text-sm font-semibold mb-2">?fsltimo conteo por ubicaci?fï¿½n</div>
          <div className="border rounded overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Ubicaci?fï¿½n</th>
                  <th className="text-left px-3 py-2">Nombre</th>
                  <th className="text-right px-3 py-2">Cajas</th>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c, i)=> (
                  <tr key={c.location_id} className={i%2?"bg-white":"bg-gray-50/50"}>
                    <td className="px-3 py-2">{c.location_code}</td>
                    <td className="px-3 py-2">{c.location_name || "ï¿½?,????"}</td>
                    <td className="px-3 py-2 text-right">{c.countedBoxes ?? "ï¿½?,????"}</td>
                    <td className="px-3 py-2">{c.countedAt ? new Date(c.countedAt).toLocaleString() : "ï¿½?,????"}</td>
                    <td className="px-3 py-2">{c.note || "ï¿½?,????"}</td>
                  </tr>
                ))}
                {counts.length===0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-500">Sin datosï¿½?,?ï¿½</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recientes (solo si existe la ruta) */}
        {Array.isArray(recent) && recent.length > 0 && (
          <div className="px-5 pt-6 pb-6">
            <div className="text-sm font-semibold mb-2">?fsltimos conteos</div>
            <div className="border rounded overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Ubicaci?fï¿½n</th>
                    <th className="text-right px-3 py-2">Cajas</th>
                    <th className="text-left px-3 py-2">Nota</th>
                    <th className="text-center px-3 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {recent!.map((r, i)=> <RecentRowView key={r.id} row={r} onUpdate={updateRecent} onDelete={deleteRecent} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function RecentRowView({ row, onUpdate, onDelete }:{
  row: RecentRow;
  onUpdate: (id:string, boxes:number, note:string)=>Promise<void>;
  onDelete: (id:string)=>Promise<void>;
}) {
  const [edit, setEdit] = useState<boolean>(false);
  const [boxes, setBoxes] = useState<string>(row.countedBoxes!=null ? String(row.countedBoxes) : "");
  const [note, setNote] = useState<string>(row.note || "");

  async function save() {
    const n = Number(boxes);
    if (!Number.isFinite(n)) return alert("Cajas debe ser n?fï¿½mero");
    await onUpdate(row.id, n, note.trim());
    setEdit(false);
  }

  return (
    <tr className="odd:bg-gray-50/50">
      <td className="px-3 py-2">{row.countedAt ? new Date(row.countedAt).toLocaleString() : "ï¿½?,????"}</td>
      <td className="px-3 py-2">{row.locationCode} ï¿½?,???? {row.locationName || "ï¿½?,????"}</td>
      <td className="px-3 py-2 text-right">
        {edit ? (
          <input className="border rounded px-2 py-1 w-[80px] text-right" value={boxes} onChange={e=> setBoxes(e.target.value)} />
        ) : (row.countedBoxes ?? "ï¿½?,????")}
      </td>
      <td className="px-3 py-2">
        {edit ? (
          <input className="border rounded px-2 py-1 w-full" value={note} onChange={e=> setNote(e.target.value)} />
        ) : (row.note || "ï¿½?,????")}
      </td>
      <td className="px-3 py-2 text-center">
        {!edit ? (
          <div className="flex gap-2 justify-center">
            <button className="px-2 py-1 text-xs border rounded" onClick={()=> setEdit(true)}>Editar</button>
            <button className="px-2 py-1 text-xs border rounded text-red-700" onClick={()=> onDelete(row.id)}>Borrar</button>
          </div>
        ) : (
          <div className="flex gap-2 justify-center">
            <button className="px-2 py-1 text-xs border rounded bg-gray-900 text-white" onClick={save}>Guardar</button>
            <button className="px-2 py-1 text-xs border rounded" onClick={()=> setEdit(false)}>Cancelar</button>
          </div>
        )}
      </td>
    </tr>
  );
}