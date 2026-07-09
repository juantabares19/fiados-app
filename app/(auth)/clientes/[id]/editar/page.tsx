'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ClienteConSaldo } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useUsuario } from '@/state/useUsuario';
import { formatearMoneda } from '@/lib/utils';

export default function EditarClientePage() {
  const params = useParams();
  const router = useRouter();
  const { esDueño } = useUsuario();

  const [cliente, setCliente] = useState<ClienteConSaldo | null>(null);
  const [nombre, setNombre] = useState('');
  const [apodo, setApodo] = useState('');
  const [celular, setCelular] = useState('');
  const [topeCredito, setTopeCredito] = useState('');
  const [familiares, setFamiliares] = useState('');
  const [estado, setEstado] = useState<'activo' | 'bloqueado'>('activo');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!esDueño) {
      router.push(`/clientes/${params.id}`);
      return;
    }

    const cargarCliente = async () => {
      try {
        const response = await fetch(`/api/clientes/${params.id}`);
        if (!response.ok) throw new Error('Error al cargar');
        const data = await response.json();
        setCliente(data);
        setNombre(data.nombre || '');
        setApodo(data.apodo || '');
        setCelular(data.celular || '');
        setTopeCredito(data.tope_credito?.toString() || '50000');
        setFamiliares(data.familiares || '');
        setEstado(data.estado || 'activo');
      } catch {
        setError('No se pudo cargar el cliente');
      } finally {
        setCargando(false);
      }
    };

    if (params.id) {
      cargarCliente();
    }
  }, [params.id, esDueño, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (nombre.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      return;
    }

    const celularLimpio = celular.replace(/\D/g, '');
    if (celularLimpio.length !== 10) {
      setError('El celular debe tener 10 dígitos');
      return;
    }

    setGuardando(true);
    try {
      const response = await fetch(`/api/clientes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apodo: apodo.trim() || null,
          celular: celularLimpio,
          tope_credito: parseFloat(topeCredito) || 50000,
          familiares: familiares.trim() || null,
          estado,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar cliente');
      }

      router.push(`/clientes/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar cliente');
    } finally {
      setGuardando(false);
    }
  };

  const saldoActual = cliente?.saldo || 0;
  const disponibleConNuevoTope = (parseFloat(topeCredito) || 0) - saldoActual;

  const handleTopeBlur = () => {
    const valor = parseFloat(topeCredito.replace(/\D/g, ''));
    if (!isNaN(valor) && valor > 0) {
      setTopeCredito(Math.round(valor).toString());
    } else {
      setTopeCredito('50000');
    }
  };

  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <Card className="p-6 animate-pulse">
          <div className="h-48 bg-gray-200 rounded" />
        </Card>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <p className="text-red-500">{error || 'Cliente no encontrado'}</p>
        <Button onClick={() => router.push('/clientes')}>Volver a clientes</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Editar Cliente</h1>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="nombre" className="block text-base font-medium text-gray-700 mb-2">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              id="nombre"
              type="text"
              placeholder="Nombre completo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full h-12 px-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors"
              disabled={guardando}
            />
          </div>

          <div>
            <label htmlFor="apodo" className="block text-base font-medium text-gray-700 mb-2">
              Apodo (opcional)
            </label>
            <input
              id="apodo"
              type="text"
              placeholder="Cómo lo conoces en la tienda"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
              className="w-full h-12 px-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors"
              disabled={guardando}
            />
          </div>

          <div>
            <label htmlFor="celular" className="block text-base font-medium text-gray-700 mb-2">
              Celular (WhatsApp) <span className="text-red-500">*</span>
            </label>
            <input
              id="celular"
              type="tel"
              inputMode="tel"
              placeholder="300 123 4567"
              value={celular.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
              onChange={(e) => setCelular(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full h-12 px-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors"
              disabled={guardando}
            />
          </div>

          <div>
            <label htmlFor="tope" className="block text-base font-medium text-gray-700 mb-2">
              Tope de crédito
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                id="tope"
                type="tel"
                inputMode="numeric"
                placeholder="50000"
                value={topeCredito}
                onChange={(e) => setTopeCredito(e.target.value.replace(/\D/g, ''))}
                onBlur={handleTopeBlur}
                className="w-full h-12 pl-8 pr-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors"
                disabled={guardando}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Debe actualmente: {formatearMoneda(saldoActual)}
            </p>
            <p className={`text-sm mt-1 font-medium ${disponibleConNuevoTope > 0 ? 'text-green-600' : 'text-red-600'}`}>
              Disponible con este tope: {formatearMoneda(disponibleConNuevoTope)}
            </p>
          </div>

          <div>
            <label htmlFor="familiares" className="block text-base font-medium text-gray-700 mb-2">
              Familiares (opcional)
            </label>
            <textarea
              id="familiares"
              placeholder="María (esposa), Carlos (hijo)"
              value={familiares}
              onChange={(e) => setFamiliares(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors resize-none"
              disabled={guardando}
            />
          </div>

          <div>
            <label htmlFor="estado" className="block text-base font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              id="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as 'activo' | 'bloqueado')}
              className="w-full h-12 px-4 text-lg rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-colors bg-white"
              disabled={guardando}
            >
              <option value="activo">Activo</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-14 text-lg"
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'GUARDAR CAMBIOS'}
          </Button>
        </form>
      </Card>
    </div>
  );
}