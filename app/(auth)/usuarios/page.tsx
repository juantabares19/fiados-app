'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SoloDueño } from '@/components/auth/SoloDueño';
import { useUsuario } from '@/hooks/useUsuario';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface UsuarioRow {
  id: string;
  nombre: string;
  celular: string;
  rol: 'dueño' | 'tendero';
  activo: boolean;
  created_at: string;
}

type ModalState =
  | { tipo: 'crear' }
  | { tipo: 'editar'; user: UsuarioRow }
  | { tipo: 'pin'; user: UsuarioRow }
  | { tipo: 'desactivar'; user: UsuarioRow }
  | { tipo: 'borrar'; user: UsuarioRow }
  | null;

function UsuariosContent() {
  const router = useRouter();
  const { usuario } = useUsuario();
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState<ModalState>(null);
  const [nombreForm, setNombreForm] = useState('');
  const [celularForm, setCelularForm] = useState('');
  const [pinForm, setPinForm] = useState('');
  const [rolForm, setRolForm] = useState<'dueño' | 'tendero'>('tendero');
  const [formError, setFormError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch('/api/usuarios', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setUsuarios(await res.json());
    } catch {
      setError('No se pudieron cargar los usuarios');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  const cerrarModal = () => {
    setModal(null);
    setNombreForm('');
    setCelularForm('');
    setPinForm('');
    setRolForm('tendero');
    setFormError('');
    setGuardando(false);
  };

  const abrirCrear = () => {
    cerrarModal();
    setModal({ tipo: 'crear' });
  };

  const abrirEditar = (user: UsuarioRow) => {
    cerrarModal();
    setNombreForm(user.nombre);
    setRolForm(user.rol);
    setModal({ tipo: 'editar', user });
  };

  const abrirPin = (user: UsuarioRow) => {
    cerrarModal();
    setModal({ tipo: 'pin', user });
  };

  // --- Acciones contra la API ---

  const handleCrear = async () => {
    setFormError('');
    setGuardando(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreForm.trim(),
          celular: celularForm.trim(),
          pin: pinForm.trim(),
          rol: rolForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
      cerrarModal();
      cargarUsuarios();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear usuario');
      setGuardando(false);
    }
  };

  const handleEditar = async () => {
    if (modal?.tipo !== 'editar') return;
    setFormError('');
    setGuardando(true);
    try {
      const res = await fetch(`/api/usuarios/${modal.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreForm.trim(), rol: rolForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      cerrarModal();
      cargarUsuarios();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
      setGuardando(false);
    }
  };

  const handleResetPin = async () => {
    if (modal?.tipo !== 'pin') return;
    setFormError('');
    setGuardando(true);
    try {
      const res = await fetch(`/api/usuarios/${modal.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinForm.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al resetear PIN');
      cerrarModal();
      cargarUsuarios();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al resetear PIN');
      setGuardando(false);
    }
  };

  const handleToggleActivo = async (user: UsuarioRow, activo: boolean) => {
    setError('');
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar estado');
      cerrarModal();
      cargarUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
      cerrarModal();
    }
  };

  const handleBorrar = async () => {
    if (modal?.tipo !== 'borrar') return;
    setFormError('');
    setGuardando(true);
    try {
      const res = await fetch(`/api/usuarios/${modal.user.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al borrar');
      cerrarModal();
      cargarUsuarios();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al borrar');
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/inicio')}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        </div>
        <Button size="sm" onClick={abrirCrear}>
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo
        </Button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </Card>
      )}

      {cargando && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-16 bg-gray-200 rounded" />
            </Card>
          ))}
        </div>
      )}

      {!cargando && usuarios.length > 0 && (
        <div className="space-y-3">
          {usuarios.map((u) => {
            const esYo = u.id === usuario?.id;
            return (
              <Card key={u.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{u.nombre}</p>
                      {esYo && <span className="text-xs text-blue-600">(tú)</span>}
                    </div>
                    <p className="text-sm text-gray-500">
                      {u.celular.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          u.rol === 'dueño' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {u.rol === 'dueño' ? 'Dueño' : 'Tendero'}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          u.activo ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {u.activo ? 'Activo' : 'Desactivado'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => abrirEditar(u)}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Editar
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => abrirPin(u)}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Reset PIN
                  </button>
                  {!esYo && (
                    <>
                      <span className="text-gray-300">·</span>
                      {u.activo ? (
                        <button
                          onClick={() => setModal({ tipo: 'desactivar', user: u })}
                          className="text-sm font-medium text-orange-600 hover:underline"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleActivo(u, true)}
                          className="text-sm font-medium text-green-600 hover:underline"
                        >
                          Activar
                        </button>
                      )}
                      <span className="text-gray-300">·</span>
                      <button
                        onClick={() => setModal({ tipo: 'borrar', user: u })}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Borrar
                      </button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Crear */}
      <Modal
        isOpen={modal?.tipo === 'crear'}
        onClose={cerrarModal}
        title="Nuevo usuario"
        confirmText={guardando ? 'Creando...' : 'Crear'}
        onConfirm={guardando ? undefined : handleCrear}
      >
        <div className="space-y-3">
          <Input label="Nombre" value={nombreForm} onChange={(e) => setNombreForm(e.target.value)} maxLength={100} />
          <Input
            label="Celular (10 dígitos)"
            type="tel"
            inputMode="numeric"
            value={celularForm}
            onChange={(e) => setCelularForm(e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
          <Input
            label="PIN (4 dígitos)"
            type="tel"
            inputMode="numeric"
            value={pinForm}
            onChange={(e) => setPinForm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">Rol</label>
            <div className="grid grid-cols-2 gap-2">
              {(['tendero', 'dueño'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRolForm(r)}
                  className={`h-12 rounded-xl border-2 font-medium ${
                    rolForm === r ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {r === 'dueño' ? 'Dueño' : 'Tendero'}
                </button>
              ))}
            </div>
          </div>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
        </div>
      </Modal>

      {/* Editar */}
      <Modal
        isOpen={modal?.tipo === 'editar'}
        onClose={cerrarModal}
        title="Editar usuario"
        confirmText={guardando ? 'Guardando...' : 'Guardar'}
        onConfirm={guardando ? undefined : handleEditar}
      >
        <div className="space-y-3">
          <Input label="Nombre" value={nombreForm} onChange={(e) => setNombreForm(e.target.value)} maxLength={100} />
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">Rol</label>
            <div className="grid grid-cols-2 gap-2">
              {(['tendero', 'dueño'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRolForm(r)}
                  disabled={modal?.tipo === 'editar' && modal.user.id === usuario?.id}
                  className={`h-12 rounded-xl border-2 font-medium disabled:opacity-50 ${
                    rolForm === r ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {r === 'dueño' ? 'Dueño' : 'Tendero'}
                </button>
              ))}
            </div>
          </div>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
        </div>
      </Modal>

      {/* Reset PIN */}
      <Modal
        isOpen={modal?.tipo === 'pin'}
        onClose={cerrarModal}
        title="Resetear PIN"
        confirmText={guardando ? 'Guardando...' : 'Resetear'}
        onConfirm={guardando ? undefined : handleResetPin}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Se asignará un PIN nuevo y se cerrará la sesión actual de ese usuario.
          </p>
          <Input
            label="Nuevo PIN (4 dígitos)"
            type="tel"
            inputMode="numeric"
            value={pinForm}
            onChange={(e) => setPinForm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
        </div>
      </Modal>

      {/* Desactivar */}
      <Modal
        isOpen={modal?.tipo === 'desactivar'}
        onClose={cerrarModal}
        title="Desactivar usuario"
        variant="danger"
        confirmText="Desactivar"
        onConfirm={() => modal?.tipo === 'desactivar' && handleToggleActivo(modal.user, false)}
      >
        <p>
          ¿Desactivar a <strong>{modal?.tipo === 'desactivar' ? modal.user.nombre : ''}</strong>? Su sesión se cerrará de
          inmediato y no podrá iniciar sesión hasta reactivarlo.
        </p>
      </Modal>

      {/* Borrar */}
      <Modal
        isOpen={modal?.tipo === 'borrar'}
        onClose={cerrarModal}
        title="Borrar usuario"
        variant="danger"
        confirmText={guardando ? 'Borrando...' : 'Borrar'}
        onConfirm={guardando ? undefined : handleBorrar}
      >
        <div className="space-y-2">
          <p>
            ¿Borrar permanentemente a <strong>{modal?.tipo === 'borrar' ? modal.user.nombre : ''}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Si el usuario tiene movimientos registrados no se podrá borrar; en ese caso desactívalo.
          </p>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
        </div>
      </Modal>
    </div>
  );
}

export default function UsuariosPage() {
  return (
    <SoloDueño>
      <UsuariosContent />
    </SoloDueño>
  );
}
