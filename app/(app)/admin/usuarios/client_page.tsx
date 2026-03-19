'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Edit, Shield, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRut } from '@/lib/utils';

export function UsuariosClient({ empresasList, currentUserId }: { empresasList: any[], currentUserId: number }) {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal forms
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Form State
  const [formId, setFormId] = useState<number | null>(null);
  const [rut, setRut] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('vendedor');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedEmpresas, setSelectedEmpresas] = useState<number[]>([]);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/usuarios');
      if (res.ok) {
        const { data } = await res.json();
        setUsuarios(data || []);
      }
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const resetForm = () => {
    setFormId(null);
    setRut('');
    setNombre('');
    setRol('vendedor');
    setPassword('');
    setIsActive(true);
    setSelectedEmpresas([empresasList[0]?.id || 1]);
    setIsEditMode(false);
  };

  const openCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEdit = (u: any) => {
    resetForm();
    setIsEditMode(true);
    setFormId(u.id);
    setRut(u.rut);
    setNombre(u.nombre);
    setRol(u.rol);
    setIsActive(u.activo);
    setSelectedEmpresas(u.empresas || []);
    setIsOpen(true);
  };

  const toggleEmpresa = (id: number) => {
    setSelectedEmpresas(prev => 
       prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!rut || !nombre || selectedEmpresas.length === 0) {
      return toast.warning('Faltan campos obligatorios o empresas');
    }

    if (!isEditMode && !password) {
      return toast.warning('Debe ingresar una contraseña para el nuevo usuario');
    }

    const payload = {
      rut: formatRut(rut),
      nombre,
      rol,
      empresas: selectedEmpresas,
      ...(password && { password }),
      ...(isEditMode && { activo: isActive }),
    };

    try {
      const url = isEditMode ? `/api/admin/usuarios/${formId}` : '/api/admin/usuarios';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
         const { error } = await res.json();
         throw new Error(error || 'Error al guardar');
      }

      toast.success(isEditMode ? 'Usuario actualizado' : 'Usuario creado exitosamente');
      setIsOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (u: any) => {
    if (!confirm(`¿Eliminar permanentemente a ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Error al eliminar');
      }
      toast.success('Usuario eliminado');
      fetchUsuarios();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in zoom-in-95 duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
             <Shield className="w-8 h-8 text-blue-600" /> Control de Acceso
          </h1>
          <p className="text-zinc-500 mt-1">Administración de Usuarios y Permisos</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
          <UserPlus className="w-5 h-5 mr-2" />
          Crear Usuario
        </Button>
      </div>

      <div className="bg-white dark:bg-zinc-950 border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50 dark:bg-zinc-900 border-b">
            <TableRow>
              <TableHead className="w-32 uppercase tracking-wide text-xs">RUT</TableHead>
              <TableHead className="uppercase tracking-wide text-xs">Nombre Completo</TableHead>
              <TableHead className="w-32 uppercase tracking-wide text-xs text-center">Rol</TableHead>
              <TableHead className="uppercase tracking-wide text-xs">Acceso a Empresas</TableHead>
              <TableHead className="w-24 uppercase tracking-wide text-xs text-center">Estado</TableHead>
              <TableHead className="w-20 text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow><TableCell colSpan={6} className="text-center py-12 text-zinc-500 animate-pulse">Cargando...</TableCell></TableRow>
            ) : usuarios.map(u => (
              <TableRow key={u.id} className={!u.activo ? "opacity-60 bg-zinc-50/50" : ""}>
                 <TableCell className="font-mono text-sm">{u.rut}</TableCell>
                 <TableCell className="font-semibold">{u.nombre}{currentUserId === u.id && ' (Tú)'}</TableCell>
                 <TableCell className="text-center">
                    <Badge variant="outline" className={`\${u.rol === 'admin' ? 'border-purple-200 text-purple-700 bg-purple-50' : u.rol === 'bodeguero' ? 'border-amber-200 text-amber-700 bg-amber-50' : u.rol === 'vendedor' ? 'border-blue-200 text-blue-700 bg-blue-50' : 'bg-transparent'}`}>
                       {u.rol.toUpperCase()}
                    </Badge>
                 </TableCell>
                 <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.empresas?.map((eid: number) => {
                         const empName = empresasList.find(e => e.id === eid)?.nombre || ('Empresa ' + eid);
                         return <Badge key={eid} variant="secondary" className="text-[10px]">{empName}</Badge>
                      })}
                    </div>
                 </TableCell>
                 <TableCell className="text-center">
                    {u.activo ? <Badge className="bg-emerald-500">Activo</Badge> : <Badge variant="destructive">Bloqueado</Badge>}
                 </TableCell>
                 <TableCell className="text-right flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                       <Edit className="w-4 h-4 text-zinc-500 hover:text-blue-600" />
                    </Button>
                    {currentUserId !== u.id && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(u)}>
                        <Trash2 className="w-4 h-4 text-zinc-500 hover:text-red-600" />
                      </Button>
                    )}
                 </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
             <DialogTitle>{isEditMode ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <label className="text-sm font-medium">RUT</label>
                 <Input value={rut} onChange={e => setRut(formatRut(e.target.value))} placeholder="12.345.678-9" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium">Contraseña {isEditMode && '(Opcional)'}</label>
                 <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isEditMode ? 'Dejar en blanco para mantener' : 'Contraseña nueva'} />
               </div>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium">Nombre Completo</label>
               <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Pérez" />
             </div>

             <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Nivel de Acceso (Rol)</label>
                  <select 
                    value={rol} 
                    onChange={e => setRol(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border rounded-md px-3 py-2 text-sm focus-visible:ring-1 focus-visible:ring-blue-500 outline-none"
                    disabled={isEditMode && currentUserId === formId}
                  >
                     <option value="vendedor">Vendedor</option>
                     <option value="bodeguero">Bodeguero</option>
                     <option value="admin">Administrador</option>
                  </select>
                </div>
                {isEditMode && currentUserId !== formId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium block">Estado de Cuenta</label>
                    <button 
                      onClick={() => setIsActive(!isActive)}
                      className={`w-full py-2 rounded-md border text-sm font-semibold transition-colors \${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}
                    >
                      {isActive ? 'Activo (Desactivar)' : 'Bloqueado (Reactivar)'}
                    </button>
                  </div>
                )}
             </div>

             <div className="space-y-2 border-t pt-4">
                <label className="text-sm font-medium">Aplica a Empresas</label>
                <div className="flex flex-col gap-2">
                   {empresasList.map(emp => {
                      const sel = selectedEmpresas.includes(emp.id);
                      return (
                         <button 
                           key={emp.id} 
                           onClick={() => toggleEmpresa(emp.id)}
                           className={`flex items-center justify-between p-2 rounded-md border text-left text-sm font-medium transition-colors \${sel ? 'border-blue-500 bg-blue-50/50 text-blue-700 dark:bg-blue-900/20' : 'bg-transparent text-zinc-600 hover:bg-zinc-50'}`}
                         >
                           {emp.nombre}
                           {sel && <Check className="w-4 h-4 text-blue-600" />}
                         </button>
                      )
                   })}
                </div>
             </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
             <Button onClick={handleSave}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


