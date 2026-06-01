"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Pencil, Plus, Save, Loader2 } from "lucide-react";

interface Cuenta {
  id: number;
  nombre: string;
  moneda: "USD" | "CLP";
  activa: boolean;
  orden: number;
  created_at: string;
}

interface ConfigData {
  dolar_dia: number;
  updated_at: string | null;
  updated_por: string;
}

export function CajaConfigClient({
  initialConfig,
  initialCuentas,
}: {
  initialConfig: ConfigData;
  initialCuentas: Cuenta[];
}) {
  // ─── Dólar del día ──────────────────────────────────────
  const [dolarDia, setDolarDia] = useState(String(initialConfig.dolar_dia));
  const [dolarSaving, setDolarSaving] = useState(false);
  const [dolarInfo, setDolarInfo] = useState(initialConfig);

  const handleSaveDolar = async () => {
    const num = parseFloat(dolarDia);
    if (isNaN(num) || num < 0) {
      toast.error("Ingresa un valor válido para el dólar");
      return;
    }
    setDolarSaving(true);
    const res = await fetch("/api/caja/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dolar_dia: num }),
    });
    if (res.ok) {
      const json = await res.json();
      setDolarInfo({
        dolar_dia: parseFloat(json.data.valor),
        updated_at: json.data.updated_at,
        updated_por: json.data.updated_por,
      });
      toast.success(`Dólar actualizado a $${num}`);
    } else {
      const err = await res.json();
      toast.error(err.error?.fieldErrors?.dolar_dia?.[0] || err.error || "Error al guardar");
    }
    setDolarSaving(false);
  };

  // ─── Cuentas ────────────────────────────────────────────
  const [cuentas, setCuentas] = useState<Cuenta[]>(initialCuentas);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState<Cuenta | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formMoneda, setFormMoneda] = useState<"USD" | "CLP">("USD");
  const [formOrden, setFormOrden] = useState("0");
  const [formSaving, setFormSaving] = useState(false);

  const openCreate = () => {
    setEditingCuenta(null);
    setFormNombre("");
    setFormMoneda("USD");
    setFormOrden(String(cuentas.length + 1));
    setModalOpen(true);
  };

  const openEdit = (c: Cuenta) => {
    setEditingCuenta(c);
    setFormNombre(c.nombre);
    setFormMoneda(c.moneda);
    setFormOrden(String(c.orden));
    setModalOpen(true);
  };

  const handleSaveCuenta = async () => {
    if (!formNombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setFormSaving(true);

    const body = {
      nombre: formNombre.trim(),
      moneda: formMoneda,
      orden: parseInt(formOrden, 10) || 0,
    };

    const url = editingCuenta
      ? `/api/caja/cuentas/${editingCuenta.id}`
      : "/api/caja/cuentas";
    const method = editingCuenta ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json = await res.json();
      if (editingCuenta) {
        setCuentas((prev) =>
          prev.map((c) => (c.id === editingCuenta.id ? json.data : c))
        );
        toast.success("Cuenta actualizada");
      } else {
        setCuentas((prev) => [...prev, json.data]);
        toast.success("Cuenta creada");
      }
      setModalOpen(false);
    } else {
      const err = await res.json();
      toast.error(err.error?.fieldErrors?.nombre?.[0] || err.error || "Error al guardar");
    }
    setFormSaving(false);
  };

  const handleToggleActiva = async (cuenta: Cuenta) => {
    if (cuenta.activa) {
      // Desactivar
      const res = await fetch(`/api/caja/cuentas/${cuenta.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const json = await res.json();
        setCuentas((prev) =>
          prev.map((c) => (c.id === cuenta.id ? json.data : c))
        );
        toast.success(`Cuenta "${cuenta.nombre}" desactivada`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al desactivar");
      }
    } else {
      // Reactivar (usando PATCH)
      const res = await fetch(`/api/caja/cuentas/${cuenta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activa: true }),
      });
      if (res.ok) {
        const json = await res.json();
        setCuentas((prev) =>
          prev.map((c) => (c.id === cuenta.id ? json.data : c))
        );
        toast.success(`Cuenta "${cuenta.nombre}" reactivada`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Error al reactivar");
      }
    }
  };

  const monedaBadge = (m: string) =>
    m === "USD" ? (
      <Badge variant="default" className="text-xs">
        USD
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-xs">
        CLP
      </Badge>
    );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Caja Mayor — Configuración</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Dólar del día y cuentas bancarias. Solo visible para administradores.
        </p>
      </div>

      {/* ─── Dólar del día ──────────────────────────────── */}
      <div className="border rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">
          Dólar del día
        </h2>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-zinc-500">Valor USD a CLP</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={dolarDia}
              onChange={(e) => setDolarDia(e.target.value)}
              placeholder="Ej: 980.50"
            />
          </div>
          <Button onClick={handleSaveDolar} disabled={dolarSaving}>
            {dolarSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar
          </Button>
        </div>
        {dolarInfo.updated_at && (
          <p className="text-xs text-zinc-400">
            Última actualización:{" "}
            {new Date(dolarInfo.updated_at).toLocaleString("es-CL")} por{" "}
            {dolarInfo.updated_por}
          </p>
        )}
      </div>

      {/* ─── Cuentas bancarias ───────────────────────────── */}
      <div className="border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-zinc-500">
            Cuentas bancarias
          </h2>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nueva cuenta
          </Button>
        </div>

        {cuentas.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">
            No hay cuentas configuradas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuentas.map((c) => (
                <TableRow
                  key={c.id}
                  className={c.activa ? "" : "opacity-50"}
                >
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell>{monedaBadge(c.moneda)}</TableCell>
                  <TableCell className="text-zinc-500">{c.orden}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActiva(c)}
                      className="cursor-pointer"
                      title={
                        c.activa
                          ? "Click para desactivar"
                          : "Click para reactivar"
                      }
                    >
                      <Badge
                        variant={c.activa ? "default" : "outline"}
                        className="text-xs"
                      >
                        {c.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(c)}
                      title="Editar cuenta"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ─── Modal crear/editar cuenta ───────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCuenta ? "Editar cuenta" : "Nueva cuenta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="Ej: Santander"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Moneda</label>
              <select
                value={formMoneda}
                onChange={(e) => setFormMoneda(e.target.value as "USD" | "CLP")}
                className="w-full h-9 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900"
              >
                <option value="USD">USD — Dólares</option>
                <option value="CLP">CLP — Pesos chilenos</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Orden</label>
              <Input
                type="number"
                min="0"
                value={formOrden}
                onChange={(e) => setFormOrden(e.target.value)}
                placeholder="0 = primero"
              />
              <p className="text-xs text-zinc-400">
                Define la posición en listas y dropdowns
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCuenta} disabled={formSaving}>
              {formSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {editingCuenta ? "Guardar cambios" : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
