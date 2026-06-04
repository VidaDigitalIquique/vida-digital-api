"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, X, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { roundUpToHalf, formatMonto } from "@/docs/specs/caja-mayor.spec";
import type { ResumenClienteResponse, MovimientoConCuenta, SaldoCuenta, NotaVentaConSaldo, NotaBusquedaResult, MovimientoOCierre } from "@/docs/specs/caja-mayor.spec";

interface Cuenta {
  id: number;
  nombre: string;
  moneda: "USD" | "CLP";
  activa: boolean;
  orden: number;
}

interface ClienteOption {
  kcodcli2: number;
  nombre: string;
  empresas: ("vida" | "sanjh")[];
  total_compras: number;
  ultima_compra: string;
}

const LABELS: Record<string, string> = {
  vida: "Vida Digital",
  sanjh: "SANJH",
};

export function CajaMayorClient({
  dolarDia,
  cuentas,
  userName,
  userRol,
}: {
  dolarDia: number;
  cuentas: Cuenta[];
  userName: string;
  userRol: string;
}) {
  // ─── Form state ──────────────────────────────────────
  const [tipo, setTipo] = useState<"cobro" | "gasto">("cobro");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [cliente, setCliente] = useState<ClienteOption | null>(null);
  const [empresa, setEmpresa] = useState<"vida" | "sanjh" | "">("");
  const [moneda, setMoneda] = useState<"USD" | "CLP">("USD");
  const [monto, setMonto] = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [formaPago, setFormaPago] = useState<"efectivo" | "cheque" | "transferencia">("transferencia");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  // ─── Imputación manual ─────────────────────────────────
  const [imputacionManual, setImputacionManual] = useState(false);
  const [notaSeleccionada, setNotaSeleccionada] = useState<NotaVentaConSaldo | null>(null);
  const [notasPendientes, setNotasPendientes] = useState<NotaVentaConSaldo[]>([]);
  const [notasPendientesLoading, setNotasPendientesLoading] = useState(false);

  // ─── Búsqueda unificada ───────────────────────────────
  type ResultadoBusqueda =
    | { tipo: "cliente"; cliente: ClienteOption }
    | { tipo: "nota"; nota: NotaBusquedaResult };
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ResultadoBusqueda[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ─── Resumen de notas del cliente ───────────────────
  const [resumen, setResumen] = useState<ResumenClienteResponse | null>(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "pendiente" | "pagada">("todas");
  const [notaExpandida, setNotaExpandida] = useState<string | null>(null);

  // ─── Movimientos table state ──────────────────────────
  const [movimientos, setMovimientos] = useState<MovimientoOCierre[]>([]);
  const [movsLoading, setMovsLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [filtros, setFiltros] = useState({ moneda: "", cuenta_id: "", tipo: "", empresa: "", desde: "", hasta: "" });
  const [saldos, setSaldos] = useState<SaldoCuenta[]>([]);

  // ─── Cierre de período ────────────────────────────────
  const [cierreModalOpen, setCierreModalOpen] = useState(false);
  const [cierreLoading, setCierreLoading] = useState(false);

  // ─── Edit modal state ─────────────────────────────────
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMov, setEditMov] = useState<MovimientoConCuenta | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  // Edit form fields (reuse same structure as create form)
  const [editTipo, setEditTipo] = useState<"cobro" | "gasto">("cobro");
  const [editFecha, setEditFecha] = useState("");
  const [editClienteQuery, setEditClienteQuery] = useState("");
  const [editCliente, setEditCliente] = useState<ClienteOption | null>(null);
  const [editEmpresa, setEditEmpresa] = useState<"vida" | "sanjh" | "">("");
  const [editMoneda, setEditMoneda] = useState<"USD" | "CLP">("USD");
  const [editMonto, setEditMonto] = useState("");
  const [editCuentaId, setEditCuentaId] = useState("");
  const [editFormaPago, setEditFormaPago] = useState<"efectivo" | "cheque" | "transferencia">("transferencia");
  const [editObs, setEditObs] = useState("");
  const [editDeleteConfirm, setEditDeleteConfirm] = useState(false);

  // ─── Fetch movimientos ────────────────────────────────
  const fetchMovimientos = useCallback((page = 1) => {
    setMovsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (filtros.moneda) params.set("moneda", filtros.moneda);
    if (filtros.cuenta_id) params.set("cuenta_id", filtros.cuenta_id);
    if (filtros.tipo) params.set("tipo", filtros.tipo);
    if (filtros.empresa) params.set("empresa", filtros.empresa);
    if (filtros.desde) params.set("desde", filtros.desde);
    if (filtros.hasta) params.set("hasta", filtros.hasta);
    fetch(`/api/caja/movimientos?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setMovimientos((json.data || []) as MovimientoOCierre[]);
        setPagination(json.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
      })
      .catch(() => {})
      .finally(() => setMovsLoading(false));
  }, [filtros]);

  // ─── Fetch saldos ─────────────────────────────────────
  const fetchSaldos = useCallback(() => {
    fetch("/api/caja/resumen-cuentas")
      .then((r) => r.json())
      .then((json) => setSaldos(json.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchMovimientos(1); fetchSaldos(); }, [fetchMovimientos, fetchSaldos]);
  useEffect(() => { if (!cliente) fetchMovimientos(1); }, [cliente, fetchMovimientos]);

  useEffect(() => {
    if (!cliente) {
      setResumen(null);
      return;
    }
    setResumenLoading(true);
    fetch(`/api/caja/resumen/${cliente.kcodcli2}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setResumen(json.data);
        else setResumen(null);
      })
      .catch(() => setResumen(null))
      .finally(() => setResumenLoading(false));
  }, [cliente]);

  const notasFiltradas = useMemo(() => {
    if (!resumen) return [];
    if (filtroEstado === "todas") return resumen.notas;
    if (filtroEstado === "pendiente") return resumen.notas.filter((n) => n.saldo_pendiente > 0.005);
    return resumen.notas.filter((n) => n.saldo_pendiente <= 0.005);
  }, [resumen, filtroEstado]);

  // ─── Derived ─────────────────────────────────────────
  const cuentasFiltradas = useMemo(
    () => cuentas.filter((c) => c.moneda === moneda),
    [cuentas, moneda]
  );

  const montoUSD = useMemo(() => {
    const n = parseFloat(monto);
    if (isNaN(n) || n <= 0) return null;
    if (moneda === "USD") return n;
    if (dolarDia <= 0) return null;
    return roundUpToHalf(n / dolarDia);
  }, [monto, moneda, dolarDia]);

  const canSubmit =
    !saving &&
    fecha &&
    (tipo === "gasto" || !!cliente) &&
    cuentaId &&
    parseFloat(monto) > 0 &&
    (tipo === "gasto" || !!empresa);

  // ─── Búsqueda unificada (cliente o nota) ──────────────
  useEffect(() => {
    const isDigits = /^\d+$/.test(searchQuery);

    if ((isDigits && searchQuery.length < 3) || (!isDigits && searchQuery.length < 2)) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    const endpoint = isDigits
      ? `/api/caja/nota-busqueda?q=${encodeURIComponent(searchQuery)}`
      : `/api/caja/clientes?q=${encodeURIComponent(searchQuery)}`;

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        const data: any[] = json.data || [];
        const results: ResultadoBusqueda[] = isDigits
          ? data.map((n) => ({ tipo: "nota" as const, nota: n as NotaBusquedaResult }))
          : data.map((c) => ({ tipo: "cliente" as const, cliente: c as ClienteOption }));
        setSearchResults(results);
        setSearchOpen(results.length > 0);
      }
      setSearchLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-select empresa when client has only one
  useEffect(() => {
    if (cliente) {
      if (cliente.empresas.length === 1) {
        setEmpresa(cliente.empresas[0]);
      } else {
        setEmpresa("");
      }
    } else {
      setEmpresa("");
    }
  }, [cliente]);

  // Auto-select first available cuenta when moneda changes
  useEffect(() => {
    if (cuentasFiltradas.length > 0) {
      setCuentaId(String(cuentasFiltradas[0].id));
    } else {
      setCuentaId("");
    }
  }, [moneda, cuentasFiltradas]);

  const selectCliente = (c: ClienteOption) => {
    setCliente(c);
    setSearchQuery(c.nombre);
    setSearchOpen(false);
  };

  const selectNota = (n: NotaBusquedaResult) => {
    const clienteOpt: ClienteOption = {
      kcodcli2: n.kcodcli2,
      nombre: n.nombre_cliente,
      empresas: [n.empresa],
      total_compras: 0,
      ultima_compra: "",
    };
    setCliente(clienteOpt);
    setSearchQuery("");
    setEmpresa(n.empresa);
    setNotaSeleccionada({
      knumfoli: n.knumfoli,
      fechanvt: n.fechanvt,
      val_rea: n.val_rea,
      total_pagado: n.val_rea - n.saldo_pendiente,
      saldo_pendiente: n.saldo_pendiente,
      empresa: n.empresa,
    });
    setImputacionManual(true);
    setSearchResults([]);
    setSearchOpen(false);
  };

  // ─── Fetch notas pendientes para imputación manual ───
  useEffect(() => {
    if (!imputacionManual || !cliente) {
      setNotasPendientes([]);
      setNotaSeleccionada(null);
      return;
    }
    setNotaSeleccionada(null);
    setNotasPendientesLoading(true);
    fetch(`/api/caja/notas/${cliente.kcodcli2}`)
      .then((r) => r.json())
      .then((json) => {
        const todas: NotaVentaConSaldo[] = json.data || [];
        const pendientes = todas.filter((n) => {
          if (n.saldo_pendiente <= 0.005) return false;
          if (empresa && n.empresa !== empresa) return false;
          return true;
        });
        setNotasPendientes(pendientes);
      })
      .catch(() => setNotasPendientes([]))
      .finally(() => setNotasPendientesLoading(false));
  }, [imputacionManual, cliente, empresa]);

  const clearCliente = () => {
    setCliente(null);
    setSearchQuery("");
    setSearchOpen(false);
    setEmpresa("");
    setImputacionManual(false);
    setNotaSeleccionada(null);
    setNotasPendientes([]);
  };

  // ─── Edit modal ──────────────────────────────────────
  const openEditModal = (mov: MovimientoConCuenta) => {
    setEditMov(mov);
    setEditTipo(mov.tipo as "cobro" | "gasto");
    setEditFecha(mov.fecha);
    setEditMonto(String(mov.monto));
    setEditMoneda(mov.moneda as "USD" | "CLP");
    setEditCuentaId(String(mov.cuenta_id));
    setEditFormaPago(mov.forma_pago as "efectivo" | "cheque" | "transferencia");
    setEditObs(mov.observaciones || "");
    setEditEmpresa((mov.empresa as "vida" | "sanjh" | "") || "");
    if (mov.kcodcli2) {
      setEditCliente({ kcodcli2: mov.kcodcli2, nombre: mov.nombre_cliente || "", empresas: mov.empresa ? [mov.empresa as "vida" | "sanjh"] : [], total_compras: 0, ultima_compra: "" });
      setEditClienteQuery(mov.nombre_cliente || "");
    } else {
      setEditCliente(null);
      setEditClienteQuery("");
    }
    setEditDeleteConfirm(false);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!editMov || !editFecha || !editCuentaId || !parseFloat(editMonto)) return;
    setEditSaving(true);
    const body: Record<string, unknown> = {
      fecha: editFecha,
      tipo: editTipo,
      kcodcli2: editCliente?.kcodcli2 ? Number(editCliente.kcodcli2) : null,
      nombre_cliente: editCliente?.nombre ?? null,
      cuenta_id: parseInt(editCuentaId, 10),
      moneda: editMoneda,
      monto: parseFloat(editMonto),
      forma_pago: editFormaPago,
      observaciones: editObs.trim() || null,
      empresa: editEmpresa || null,
    };
    const res = await fetch(`/api/caja/movimientos/${editMov.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success("Movimiento actualizado");
      setEditModalOpen(false);
      fetchMovimientos(pagination.page);
      fetchSaldos();
    } else {
      const err = await res.json();
      toast.error(err.error || "Error al actualizar");
    }
    setEditSaving(false);
  };

  const handleEditDelete = async () => {
    if (!editMov) return;
    await fetch(`/api/caja/movimientos/${editMov.id}`, { method: "DELETE" });
    toast.success("Movimiento eliminado");
    setEditModalOpen(false);
    fetchMovimientos(1);
    fetchSaldos();
  };

  // ─── Submit ──────────────────────────────────────────
  const handleSubmit = async () => {
    setSaving(true);
    const body: Record<string, unknown> = {
      fecha,
      tipo,
      kcodcli2: cliente?.kcodcli2 ? Number(cliente.kcodcli2) : null,
      nombre_cliente: cliente?.nombre ?? null,
      cuenta_id: parseInt(cuentaId, 10),
      moneda,
      monto: parseFloat(monto),
      forma_pago: formaPago,
      observaciones: observaciones.trim() || null,
      empresa: empresa || null,
    };

    const res = await fetch("/api/caja/movimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const created = await res.json();
      const movimientoId = created.data?.id;

      // Imputación manual a nota específica
      if (movimientoId && imputacionManual && notaSeleccionada && tipo === "cobro" && montoUSD) {
        let remaining = montoUSD;
        const notasParaImputar: { empresa: string; knumfoli: string; monto_aplicado: number }[] = [];

        // Aplicar a la nota seleccionada
        const aplicado = Math.min(remaining, notaSeleccionada.saldo_pendiente);
        if (aplicado > 0.005) {
          notasParaImputar.push({
            empresa: notaSeleccionada.empresa,
            knumfoli: notaSeleccionada.knumfoli,
            monto_aplicado: aplicado,
          });
          remaining -= aplicado;
        }

        // Excedente → siguientes notas más antiguas
        if (remaining > 0.005) {
          const sorted = [...notasPendientes].sort((a, b) => a.fechanvt.localeCompare(b.fechanvt));
          for (const nota of sorted) {
            if (nota.knumfoli === notaSeleccionada.knumfoli && nota.empresa === notaSeleccionada.empresa) continue;
            if (remaining <= 0.005) break;
            const aplicar = Math.min(remaining, nota.saldo_pendiente);
            if (aplicar > 0.005) {
              notasParaImputar.push({ empresa: nota.empresa, knumfoli: nota.knumfoli, monto_aplicado: aplicar });
              remaining -= aplicar;
            }
          }
        }

        if (notasParaImputar.length > 0) {
          await fetch(`/api/caja/movimientos/${movimientoId}/notas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notas: notasParaImputar }),
          });
        }
      }

      toast.success(`Movimiento registrado — ${tipo === "cobro" ? "Cobro" : "Gasto"} por $${formatMonto(parseFloat(monto), moneda)} ${moneda}`);
      // Reset form
      setFecha(new Date().toISOString().slice(0, 10));
      clearCliente();
      setMonto("");
      setObservaciones("");
      if (moneda === "CLP") setMoneda("USD");
      setFormaPago("transferencia");
      fetchMovimientos(1);
      fetchSaldos();
    } else {
      const err = await res.json();
      const msg = err.error?.fieldErrors
        ? Object.values(err.error.fieldErrors).flat().join(", ")
        : err.error || "Error al registrar";
      toast.error(msg);
    }
    setSaving(false);
  };

  // ─── Cierre de período ────────────────────────────────
  const handleCierre = async () => {
    setCierreLoading(true);
    const res = await fetch("/api/caja/cierres", { method: "POST" });
    if (res.ok) {
      const json = await res.json();
      toast.success(`Cierre creado — ${json.data.fecha_desde} al ${json.data.fecha_hasta}`);
      setCierreModalOpen(false);
      fetchMovimientos(1);
      fetchSaldos();
    } else {
      const err = await res.json();
      toast.error(err.error || "Error al crear cierre");
    }
    setCierreLoading(false);
  };

  const handleDeleteCierre = async (id: number) => {
    if (!confirm("¿Eliminar este cierre? Los movimientos no se borrarán, solo el snapshot del cierre.")) return;
    const res = await fetch(`/api/caja/cierres/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Cierre eliminado");
      fetchMovimientos(pagination.page);
      fetchSaldos();
    } else {
      const err = await res.json();
      toast.error(err.error || "Error al eliminar cierre");
    }
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 w-full fade-in p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caja Mayor</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Registrar cobro o gasto {userName ? `— ${userName}` : ""}
          </p>
        </div>
        {userRol === "admin" && (
          <Button onClick={() => setCierreModalOpen(true)} variant="outline">
            🔒 Cierre de Período
          </Button>
        )}
      </div>

      {/* Dollar banner */}
      {dolarDia > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 text-sm text-blue-800 dark:text-blue-200">
          💱 Dólar del día: <strong>${formatMonto(dolarDia, "CLP")}</strong>
        </div>
      )}

      <div className="border rounded-xl p-5 space-y-5">
        {/* ─── Tipo toggle ──────────────────────────── */}
        <div className="flex rounded-lg border p-1 bg-muted/50">
          {(["cobro", "gasto"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTipo(t);
                if (t === "gasto") {
                  clearCliente();
                  setImputacionManual(false);
                  setNotaSeleccionada(null);
                }
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tipo === t
                  ? "bg-background shadow-sm text-foreground"
                  : "text-zinc-500 hover:text-foreground"
              }`}
            >
              {t === "cobro" ? "💰 Cobro" : "📤 Gasto"}
            </button>
          ))}
        </div>

        {/* ─── Fecha ────────────────────────────────── */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Fecha</label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        {/* ─── Búsqueda unificada (solo cobro) ────── */}
        {tipo === "cobro" ? (
          <div className="space-y-1 relative">
            <label className="text-sm font-medium">
              {cliente ? (notaSeleccionada ? "Nota de venta" : "Cliente") : "Buscar"}{" "}
              <span className="text-red-500">*</span>
            </label>
            {cliente ? (
              notaSeleccionada ? (
                /* Nota seleccionada — info card verde */
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      📄 Nota #{notaSeleccionada.knumfoli} — {cliente.nombre}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {notaSeleccionada.fechanvt} · {LABELS[notaSeleccionada.empresa]} · Total: ${formatMonto(notaSeleccionada.val_rea, "CLP")} · Pend: ${formatMonto(notaSeleccionada.saldo_pendiente, "USD")}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={clearCliente}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                /* Cliente seleccionado — card gris */
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{cliente.nombre}</div>
                    <div className="text-xs text-zinc-500">
                      {cliente.empresas.map((e) => LABELS[e]).join(" + ")} · {cliente.total_compras} compras · última {cliente.ultima_compra}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={clearCliente}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )
            ) : (
              /* Input unificado + dropdown */
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre de cliente o número de nota..."
                    className="pl-9"
                    autoComplete="off"
                  />
                  {searchLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-zinc-400" />
                  )}
                </div>
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full border rounded-lg bg-background shadow-lg max-h-72 overflow-y-auto">
                    {searchResults.map((r) =>
                      r.tipo === "cliente" ? (
                        <button
                          key={`cliente-${r.cliente.kcodcli2}`}
                          onClick={() => selectCliente(r.cliente)}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base shrink-0">👤</span>
                            <span className="text-sm font-medium truncate">{r.cliente.nombre}</span>
                          </div>
                          <div className="text-xs text-zinc-500 flex items-center gap-1 ml-7">
                            {r.cliente.empresas.map((e) => (
                              <Badge key={e} variant="outline" className="text-[10px] px-1 py-0">
                                {LABELS[e]}
                              </Badge>
                            ))}
                            <span>· {r.cliente.total_compras} compras · {r.cliente.ultima_compra}</span>
                          </div>
                        </button>
                      ) : (
                        <button
                          key={`nota-${r.nota.empresa}:${r.nota.knumfoli}`}
                          onClick={() => selectNota(r.nota)}
                          className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b last:border-0 ${
                            r.nota.saldo_pendiente <= 0.005 ? "opacity-60" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base shrink-0">📄</span>
                              <span className="text-sm font-medium">#{r.nota.knumfoli}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {LABELS[r.nota.empresa]}
                            </Badge>
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5 ml-7">
                            {r.nota.fechanvt} · {r.nota.nombre_cliente} · Total: ${formatMonto(r.nota.val_rea, "CLP")}
                            {" · "}
                            <span className={r.nota.saldo_pendiente <= 0.005 ? "text-green-600" : "text-red-600 font-medium"}>
                              Pend: ${formatMonto(r.nota.saldo_pendiente, "USD")}
                            </span>
                          </div>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* ─── Imputación manual ────────────────────── */}
        {tipo === "cobro" && cliente && (
          <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={imputacionManual}
                onChange={(e) => setImputacionManual(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300"
              />
              <span className="text-sm font-medium">¿Imputar a nota específica?</span>
            </label>

            {imputacionManual && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Seleccionar nota de venta</label>
                {notasPendientesLoading ? (
                  <div className="text-sm text-zinc-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Cargando notas pendientes...
                  </div>
                ) : notasPendientes.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">No hay notas pendientes para este cliente{empresa ? " en " + LABELS[empresa] : ""}.</p>
                ) : (
                  <select
                    value={notaSeleccionada ? `${notaSeleccionada.empresa}:${notaSeleccionada.knumfoli}` : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) { setNotaSeleccionada(null); return; }
                      const idx = val.lastIndexOf(":");
                      const emp = val.slice(0, idx);
                      const knum = val.slice(idx + 1);
                      setNotaSeleccionada(notasPendientes.find((n) => n.empresa === emp && n.knumfoli === knum) || null);
                    }}
                    className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
                  >
                    <option value="">— Seleccionar nota —</option>
                    {notasPendientes.map((n) => (
                      <option key={`${n.empresa}:${n.knumfoli}`} value={`${n.empresa}:${n.knumfoli}`}>
                        #{n.knumfoli} · {n.fechanvt} · ${formatMonto(n.val_rea, "CLP")} · Pend: ${formatMonto(n.saldo_pendiente, "USD")}
                      </option>
                    ))}
                  </select>
                )}

                {/* Preview de imputación */}
                {notaSeleccionada && montoUSD !== null && (
                  <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-sm text-green-800 dark:text-green-200 mt-2">
                    {montoUSD <= notaSeleccionada.saldo_pendiente ? (
                      <>Se imputarán <strong>${formatMonto(montoUSD, "USD")} USD</strong> a la nota #{notaSeleccionada.knumfoli} ({notaSeleccionada.empresa === "vida" ? "Vida Digital" : "SANJH"}).</>
                    ) : (
                      <div>
                        <p>Se imputarán <strong>${formatMonto(notaSeleccionada.saldo_pendiente, "USD")} USD</strong> a la nota #{notaSeleccionada.knumfoli}.</p>
                        <p className="mt-0.5">Excedente de <strong>${formatMonto(montoUSD - notaSeleccionada.saldo_pendiente, "USD")} USD</strong> → siguiente nota más antigua.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Empresa ──────────────────────────────── */}
        {cliente && cliente.empresas.length === 2 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Empresa</label>
            <select
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value as "vida" | "sanjh")}
              className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
            >
              <option value="">Seleccionar empresa</option>
              {cliente.empresas.map((e) => (
                <option key={e} value={e}>{LABELS[e]}</option>
              ))}
            </select>
          </div>
        )}

        {/* ─── Monto + Moneda ───────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="text-sm font-medium">Monto</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder={moneda === "USD" ? "0.00" : "0"}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Moneda</label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as "USD" | "CLP")}
              className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
            >
              <option value="USD">USD</option>
              <option value="CLP">CLP</option>
            </select>
          </div>
        </div>

        {/* ─── CLP → USD preview ────────────────────── */}
        {moneda === "CLP" && montoUSD !== null && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            ≈ <strong>{formatMonto(montoUSD, "USD")} USD</strong> (tasa: ${formatMonto(dolarDia, "CLP")})
            <span className="text-xs block mt-0.5">Redondeado al múltiplo de 0.5 más cercano hacia arriba</span>
          </div>
        )}

        {/* ─── Cuenta bancaria ──────────────────────── */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Cuenta bancaria</label>
          <select
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
            className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
          >
            {cuentasFiltradas.length === 0 ? (
              <option value="">No hay cuentas en {moneda}</option>
            ) : (
              cuentasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.moneda})
                </option>
              ))
            )}
          </select>
        </div>

        {/* ─── Forma de pago ────────────────────────── */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Forma de pago</label>
          <div className="flex rounded-lg border p-1 bg-muted/50">
            {(["efectivo", "cheque", "transferencia"] as const).map((fp) => (
              <button
                key={fp}
                onClick={() => setFormaPago(fp)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  formaPago === fp
                    ? "bg-background shadow-sm text-foreground"
                    : "text-zinc-500 hover:text-foreground"
                }`}
              >
                {fp === "efectivo" ? "💵 Efectivo" : fp === "cheque" ? "📝 Cheque" : "🏦 Transferencia"}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Observaciones ────────────────────────── */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Observaciones (opcional)</label>
          <Input
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej: Abono factura 2648"
          />
        </div>

        {/* ─── Submit ────────────────────────────────── */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
          size="lg"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : null}
          {tipo === "cobro" ? "💰 Registrar cobro" : "📤 Registrar gasto"}
        </Button>
      </div>

      {/* ─── Saldos por cuenta ─────────────────────────── */}
      {!cliente && saldos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {saldos.map((s) => (
            <div key={`${s.cuenta_id}`} className="border rounded-lg p-3 text-center">
              <div className="text-xs text-zinc-500 truncate">{s.cuenta_nombre}</div>
              <div className="text-[10px] text-zinc-400">{s.moneda}</div>
              <div className={`text-sm font-bold mt-1 ${s.saldo_neto >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                {s.moneda === "CLP" ? "$" : ""}{formatMonto(s.saldo_neto, s.moneda)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Filtros + Tabla de movimientos ────────────── */}
      {!cliente && (
        <div className="border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">Movimientos</h2>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <select value={filtros.moneda} onChange={(e) => setFiltros((f) => ({ ...f, moneda: e.target.value }))} className="h-8 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900">
              <option value="">Todas monedas</option><option value="USD">USD</option><option value="CLP">CLP</option>
            </select>
            <select value={filtros.tipo} onChange={(e) => setFiltros((f) => ({ ...f, tipo: e.target.value }))} className="h-8 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900">
              <option value="">Todos tipos</option><option value="cobro">Cobro</option><option value="gasto">Gasto</option>
            </select>
            <select value={filtros.empresa} onChange={(e) => setFiltros((f) => ({ ...f, empresa: e.target.value }))} className="h-8 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900">
              <option value="">Todas empresas</option><option value="vida">Vida Digital</option><option value="sanjh">SANJH</option>
            </select>
            <Input type="date" value={filtros.desde} onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))} className="h-8 w-[140px] text-xs" />
            <Input type="date" value={filtros.hasta} onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))} className="h-8 w-[140px] text-xs" />
            <select value={filtros.cuenta_id} onChange={(e) => setFiltros((f) => ({ ...f, cuenta_id: e.target.value }))} className="h-8 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900">
              <option value="">Todas cuentas</option>
              {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
            </select>
          </div>

          {/* Tabla */}
          {movsLoading ? (
            <div className="text-sm text-zinc-400 text-center py-8"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Cargando...</div>
          ) : movimientos.length === 0 ? (
            <p className="text-sm text-zinc-400 italic text-center py-4">Sin movimientos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-zinc-500 uppercase">
                    <th className="py-2 pr-2 font-medium">Fecha</th>
                    <th className="py-2 pr-2 font-medium">Tipo</th>
                    <th className="py-2 pr-2 font-medium">Cliente</th>
                    <th className="py-2 pr-2 font-medium">Emp.</th>
                    <th className="py-2 pr-2 font-medium">Nota(s)</th>
                    <th className="py-2 pr-2 font-medium text-right">CLP</th>
                    <th className="py-2 pr-2 font-medium">Cuenta</th>
                    <th className="py-2 pr-2 font-medium text-right">USD</th>
                    <th className="py-2 pr-2 font-medium max-w-[80px]">Observación</th>
                    <th className="py-2 w-[60px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((item) =>
                    item.tipo_fila === "cierre" ? (
                      <tr key={`cierre-${item.data.id}`} className="bg-blue-100 dark:bg-blue-950/40 border-b">
                        <td colSpan={10} className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-blue-800 dark:text-blue-300 text-sm">
                                🔒 CIERRE DE PERÍODO — {item.data.fecha_desde} al {item.data.fecha_hasta}
                              </span>
                              <span className="text-xs text-blue-600 dark:text-blue-400 ml-3">
                                por {item.data.usuario_nombre}
                              </span>
                            </div>
                            {userRol === "admin" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handleDeleteCierre(item.data.id)}
                                title="Eliminar cierre"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
                            {item.data.resumen
                              .filter((c) => c.saldo_final !== 0 || c.total_cobros !== 0 || c.total_gastos !== 0)
                              .map((c) => (
                                <div key={c.cuenta_id} className="text-xs bg-white/60 dark:bg-zinc-800/60 rounded p-1.5">
                                  <div className="font-medium truncate">{c.cuenta_nombre}</div>
                                  <div className="text-zinc-500">{c.moneda}</div>
                                  <div>Depósito total: {c.moneda === "CLP" ? "$" : ""}{formatMonto(c.total_cobros, c.moneda)}</div>
                                  <div>Gasto total: {c.moneda === "CLP" ? "$" : ""}{formatMonto(c.total_gastos, c.moneda)}</div>
                                  <div className={c.saldo_final >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                                    Saldo: {c.moneda === "CLP" ? "$" : ""}{formatMonto(c.saldo_final, c.moneda)}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={item.data.id} className="border-b hover:bg-muted/50">
                        <td className="py-1.5 pr-2 whitespace-nowrap">{item.data.fecha}</td>
                        <td className="py-1.5 pr-2">{item.data.tipo === "cobro" ? "💰" : "📤"}</td>
                        <td className="py-1.5 pr-2 max-w-[120px] truncate">{item.data.nombre_cliente || "—"}</td>
                        <td className="py-1.5 pr-2">
                          {item.data.empresa ? <Badge variant="outline" className="text-[10px] px-1 py-0">{item.data.empresa === "vida" ? "VD" : "SJ"}</Badge> : "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-xs text-zinc-500 max-w-[100px] truncate">
                          {item.data.notas_imputadas?.length ? item.data.notas_imputadas.join(", ") : "—"}
                        </td>
                        <td className={`py-1.5 pr-2 text-right font-medium whitespace-nowrap ${item.data.tipo === "cobro" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                          {item.data.moneda === "CLP"
                            ? `${item.data.tipo === "gasto" ? "-" : ""}$${formatMonto(item.data.monto, "CLP")}`
                            : "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-xs text-zinc-500 max-w-[100px] truncate">{item.data.cuenta_nombre}</td>
                        <td className={`py-1.5 pr-2 text-right font-medium whitespace-nowrap ${item.data.tipo === "cobro" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                          {item.data.tipo === "gasto" ? "-" : ""}{formatMonto((item.data.monto_usd ?? item.data.monto), "USD")}
                        </td>
                        <td className="py-1.5 pr-2 text-xs text-zinc-500 max-w-[80px] truncate" title={item.data.observaciones || undefined}>
                          {item.data.observaciones || "—"}
                        </td>
                        <td className="py-1.5 flex gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditModal(item.data as MovimientoConCuenta)} title="Editar"><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => { openEditModal(item.data as MovimientoConCuenta); setEditDeleteConfirm(true); }} title="Eliminar"><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-2">
              <span>{pagination.total} movimientos</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => fetchMovimientos(pagination.page - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="px-2 py-1">{pagination.page} / {pagination.totalPages}</span>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchMovimientos(pagination.page + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tabla de notas del cliente ────────────────── */}
      {cliente && (
        <div className="border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">
              Notas de {cliente.nombre}
            </h2>
            {resumenLoading && (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            )}
          </div>

          {/* Filtros */}
          <div className="flex rounded-lg border p-1 bg-muted/50 w-fit">
            {(["todas", "pendiente", "pagada"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroEstado(f)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  filtroEstado === f
                    ? "bg-background shadow-sm text-foreground"
                    : "text-zinc-500 hover:text-foreground"
                }`}
              >
                {f === "todas" ? "Todas" : f === "pendiente" ? "Pendientes" : "Pagadas"}
              </button>
            ))}
          </div>

          {/* Tabla */}
          {!resumen ? (
            <p className="text-sm text-zinc-400 italic">Sin datos de notas.</p>
          ) : notasFiltradas.length === 0 ? (
            <p className="text-sm text-zinc-400 italic">
              {filtroEstado === "pendiente" ? "Sin notas pendientes." : "Sin notas pagadas."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-zinc-500 uppercase">
                    <th className="py-2 pr-2 font-medium">Nota</th>
                    <th className="py-2 pr-2 font-medium">Fecha</th>
                    <th className="py-2 pr-2 font-medium">Emp.</th>
                    <th className="py-2 pr-2 font-medium text-right">Total</th>
                    <th className="py-2 pr-2 font-medium text-right">Pagado</th>
                    <th className="py-2 font-medium text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {notasFiltradas.map((n) => {
                    const key = `${n.empresa}:${n.knumfoli}`;
                    const expanded = notaExpandida === key;
                    const saldado = n.saldo_pendiente <= 0.005;
                    return (
                      <tr key={key}>
                        <td colSpan={6} className="p-0">
                          <button
                            onClick={() => setNotaExpandida(expanded ? null : key)}
                            className={`w-full text-left border-b transition-colors ${
                              saldado
                                ? "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50"
                                : "bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50"
                            }`}
                          >
                            <div className="flex items-center px-2 py-2 gap-2">
                              <span className="font-medium min-w-[60px]">{n.knumfoli}</span>
                              <span className="text-zinc-500 min-w-[80px]">{n.fechanvt}</span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0 min-w-[40px]">
                                {n.empresa === "vida" ? "VD" : "SJ"}
                              </Badge>
                              <span className="text-right min-w-[70px]">${formatMonto(n.val_rea, "CLP")}</span>
                              <span className="text-right min-w-[70px]">${formatMonto(n.total_pagado, "CLP")}</span>
                              <span className={`text-right min-w-[70px] font-semibold ${saldado ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                                ${formatMonto(n.saldo_pendiente, "USD")}
                              </span>
                            </div>

                            {/* Expanded: payment detail */}
                            {expanded && n.pagos.length > 0 && (
                              <div className="px-3 pb-3 pt-1 border-t border-dashed">
                                {n.pagos.map((p, i) => (
                                  <div key={i} className="text-xs text-zinc-500 mt-1">
                                    Mov #{p.movimiento_id} — {p.fecha} — {p.forma_pago}
                                    {" · "}
                                    {p.moneda_original === "CLP"
                                      ? `${formatMonto(p.monto_original, "CLP")} CLP → ${formatMonto(p.monto_usd, "USD")} USD (tasa: ${p.tipo_cambio})`
                                      : `${formatMonto(p.monto_usd, "USD")} USD`}
                                  </div>
                                ))}
                              </div>
                            )}
                            {expanded && n.pagos.length === 0 && (
                              <div className="px-3 pb-3 pt-1 border-t border-dashed text-xs text-zinc-400 italic">
                                Sin pagos registrados
                              </div>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totales */}
                <tfoot>
                  <tr className="border-t-2 text-xs font-semibold">
                    <td className="py-2 pr-2" colSpan={3}>TOTALES</td>
                    <td className="py-2 pr-2 text-right">${formatMonto(resumen.totales.total_vendido, "CLP")}</td>
                    <td className="py-2 pr-2 text-right">${formatMonto(resumen.totales.total_pagado, "CLP")}</td>
                    <td className={`py-2 text-right ${resumen.totales.total_pendiente > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                      ${formatMonto(resumen.totales.total_pendiente, "USD")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Modal cierre de período ────────────────── */}
      <Dialog open={cierreModalOpen} onOpenChange={setCierreModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>🔒 Cierre de Período</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-zinc-500">
              Se calculará automáticamente el resumen por cuenta desde el último cierre hasta hoy.
              Los movimientos no se eliminan — solo se guarda un snapshot con los saldos al día de hoy.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              ⚠️ Esta acción no se puede deshacer fácilmente. Asegúrate de que todos los
              movimientos del período estén registrados.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCierreModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCierre} disabled={cierreLoading}>
              {cierreLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirmar cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal editar movimiento ──────────────────── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Movimiento #{editMov?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Tipo */}
            <div className="flex rounded-lg border p-1 bg-muted/50">
              {(["cobro", "gasto"] as const).map((t) => (
                <button key={t} onClick={() => setEditTipo(t)} className={`flex-1 py-1.5 text-xs font-medium rounded-md ${editTipo === t ? "bg-background shadow-sm" : "text-zinc-500"}`}>
                  {t === "cobro" ? "💰 Cobro" : "📤 Gasto"}
                </button>
              ))}
            </div>
            {/* Fecha */}
            <div className="space-y-1"><label className="text-xs font-medium">Fecha</label><Input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} /></div>
            {/* Cliente */}
            {editTipo === "cobro" && (
              <div className="space-y-1">
                <label className="text-xs font-medium">Cliente</label>
                <Input value={editClienteQuery} onChange={(e) => setEditClienteQuery(e.target.value)} placeholder="Nombre del cliente" />
              </div>
            )}
            {/* Empresa */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Empresa</label>
              <select value={editEmpresa} onChange={(e) => setEditEmpresa(e.target.value as "vida" | "sanjh" | "")} className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm">
                <option value="">—</option><option value="vida">Vida Digital</option><option value="sanjh">SANJH</option>
              </select>
            </div>
            {/* Monto + Moneda */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1"><label className="text-xs font-medium">Monto</label><Input type="number" min="0" step="0.01" value={editMonto} onChange={(e) => setEditMonto(e.target.value)} /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Moneda</label><select value={editMoneda} onChange={(e) => setEditMoneda(e.target.value as "USD" | "CLP")} className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm"><option value="USD">USD</option><option value="CLP">CLP</option></select></div>
            </div>
            {/* Cuenta */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Cuenta bancaria</label>
              <select value={editCuentaId} onChange={(e) => setEditCuentaId(e.target.value)} className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm">
                {cuentas.filter((c) => c.moneda === editMoneda).map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>)}
              </select>
            </div>
            {/* Forma de pago */}
            <div className="space-y-1"><label className="text-xs font-medium">Forma de pago</label>
              <select value={editFormaPago} onChange={(e) => setEditFormaPago(e.target.value as "efectivo" | "cheque" | "transferencia")} className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm">
                <option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="transferencia">Transferencia</option>
              </select>
            </div>
            {/* Observaciones */}
            <div className="space-y-1"><label className="text-xs font-medium">Observaciones</label><Input value={editObs} onChange={(e) => setEditObs(e.target.value)} placeholder="Opcional" /></div>

            {/* Delete confirmation */}
            {editDeleteConfirm && (
              <div className="border border-red-300 dark:border-red-700 rounded-lg p-3 bg-red-50 dark:bg-red-950/30">
                <p className="text-sm text-red-700 dark:text-red-400 mb-2">¿Eliminar este movimiento permanentemente?</p>
                <Button variant="outline" size="sm" className="w-full text-red-600 hover:bg-red-100" onClick={handleEditDelete}>⚠ Eliminar movimiento</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
