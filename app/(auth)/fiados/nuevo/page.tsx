'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClienteConSaldo } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useUsuario } from '@/hooks/useUsuario';
import { SelectorCliente } from '@/components/clientes/SelectorCliente';
import { formatearMoneda } from '@/lib/utils';

interface ProductoForm {
  producto: string;
  // Se guardan como texto para permitir edición libre (borrar el campo, etc.);
  // se convierten a número al calcular el total y al enviar.
  cantidad: string;
  valor_unitario: string;
}

function NuevoFiadoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { usuario } = useUsuario();

  const [paso, setPaso] = useState(1);
  const [clientePreseleccionadoId, setClientePreseleccionadoId] = useState<string | null>(null);
  const [clientePreseleccionadoCargado, setClientePreseleccionadoCargado] = useState(false);
  const [cargandoPreseleccionado, setCargandoPreseleccionado] = useState(false);
  const [clienteBloqueadoError, setClienteBloqueadoError] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteConSaldo | null>(null);
  const [quienPidio, setQuienPidio] = useState<'cliente' | 'familiar'>('cliente');
  const [familiar, setFamiliar] = useState('');
  const [productos, setProductos] = useState<ProductoForm[]>([{ producto: '', cantidad: '1', valor_unitario: '' }]);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mostrarModalConfirmar, setMostrarModalConfirmar] = useState(false);

  useEffect(() => {
    const clienteId = searchParams.get('cliente');
    if (clienteId) {
      setClientePreseleccionadoId(clienteId);
      cargarCliente(clienteId);
      setClientePreseleccionadoCargado(true);
    }
  }, [searchParams]);

  const cargarCliente = async (id: string) => {
    setCargandoPreseleccionado(true);
    try {
      const response = await fetch(`/api/clientes/${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.estado === 'bloqueado') {
          setClienteBloqueadoError(true);
          return;
        }
        setClienteSeleccionado(data);
        setPaso(2);
      }
    } catch (err) {
      console.error('Error al cargar cliente:', err);
    } finally {
      setCargandoPreseleccionado(false);
    }
  };

  const seleccionarCliente = (cliente: ClienteConSaldo) => {
    if (cliente.estado === 'bloqueado') {
      alert('Este cliente está bloqueado.');
      return;
    }
    if (cliente.saldo >= cliente.tope_credito) {
      alert('Este cliente ya alcanzó su tope de crédito.');
      return;
    }
    setClienteSeleccionado(cliente);
    setPaso(2);
  };

  const agregarProducto = () => {
    setProductos([...productos, { producto: '', cantidad: '1', valor_unitario: '' }]);
  };

  const eliminarProducto = (index: number) => {
    if (productos.length === 1) return;
    setProductos(productos.filter((_, i) => i !== index));
  };

  const actualizarProducto = (index: number, campo: keyof ProductoForm, valor: string) => {
    const nuevos = [...productos];
    nuevos[index] = { ...nuevos[index], [campo]: valor };
    setProductos(nuevos);
  };

  const total = productos.reduce((sum, p) => sum + ((Number(p.cantidad) || 0) * (Number(p.valor_unitario) || 0)), 0);
  const nuevoSaldo = clienteSeleccionado ? clienteSeleccionado.saldo + total : 0;
  const disponible = clienteSeleccionado ? clienteSeleccionado.tope_credito - clienteSeleccionado.saldo : 0;
  const superaTope = nuevoSaldo > (clienteSeleccionado?.tope_credito || 0);

  const handleConfirmar = async () => {
    setError('');

    const productosValidos = productos.filter(p => p.producto.trim() !== '' && Number(p.cantidad) > 0 && Number(p.valor_unitario) > 0);
    if (productosValidos.length === 0) {
      setError('Agrega al menos un producto');
      return;
    }

    if (quienPidio === 'familiar' && !familiar.trim()) {
      setError('Ingresa el nombre del familiar');
      return;
    }

    if (superaTope) {
      setError('Este fiado supera el tope de crédito disponible');
      return;
    }

    setGuardando(true);
    setMostrarModalConfirmar(false);
    try {
      const response = await fetch('/api/fiados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteSeleccionado?.id,
          quien_pidio: quienPidio,
          familiar: familiar.trim() || null,
          nota: nota.trim() || null,
          productos: productosValidos.map(p => ({
            producto: p.producto.trim(),
            cantidad: Number(p.cantidad),
            valor_unitario: Number(p.valor_unitario),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear fiado');
      }

      router.push(`/clientes/${clienteSeleccionado?.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar fiado');
    } finally {
      setGuardando(false);
    }
  };

  const reiniciar = () => {
    setPaso(1);
    setClienteSeleccionado(null);
    setQuienPidio('cliente');
    setFamiliar('');
    setProductos([{ producto: '', cantidad: '1', valor_unitario: '' }]);
    setNota('');
    setError('');
    setClientePreseleccionadoId(null);
    setClientePreseleccionadoCargado(false);
  };

  if (clienteBloqueadoError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Fiado</h1>
        </div>
        <Card className="p-6 text-center space-y-3 bg-red-50 border border-red-200">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <p className="font-semibold text-lg text-red-800">Cliente bloqueado</p>
          <p className="text-red-600 text-sm">No se pueden registrar fiados a este cliente. Si tiene deuda pendiente, puede registrar un abono.</p>
          <Button variant="outline" className="w-full h-12" onClick={() => router.back()}>
            Volver
          </Button>
        </Card>
      </div>
    );
  }

  if (cargandoPreseleccionado) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Fiado</h1>
        </div>
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-center text-gray-500">Cargando cliente...</p>
      </div>
    );
  }

if (clientePreseleccionadoCargado && clienteSeleccionado) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuevo Fiado</h1>
            <p className="text-sm text-gray-500">Paso 2 de 3</p>
          </div>
        </div>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-gray-900">{clienteSeleccionado.nombre}</p>
              {clienteSeleccionado.apodo && <p className="text-sm text-gray-500">({clienteSeleccionado.apodo})</p>}
            </div>
            <span className={`text-sm font-medium ${clienteSeleccionado.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Debe: {formatearMoneda(clienteSeleccionado.saldo)}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Tope: {formatearMoneda(clienteSeleccionado.tope_credito)} | Disponible:{' '}
            <span className={disponible > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
              {formatearMoneda(disponible)}
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-medium text-gray-700 mb-3">¿Quién lo pide?</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setQuienPidio('cliente')}
              className={`p-3 rounded-xl border-2 transition-colors ${
                quienPidio === 'cliente'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm font-medium">Cliente</span>
            </button>
            <button
              onClick={() => setQuienPidio('familiar')}
              className={`p-3 rounded-xl border-2 transition-colors ${
                quienPidio === 'familiar'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium">Familiar</span>
            </button>
          </div>

          {quienPidio === 'familiar' && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del familiar</label>
              <input
                type="text"
                placeholder="Carlos (hijo)"
                value={familiar}
                onChange={(e) => setFamiliar(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-medium text-gray-700 mb-3">PRODUCTOS</h3>
          <div className="space-y-3">
            {productos.map((prod, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-gray-500">#{index + 1}</span>
                  {productos.length > 1 && (
                    <button
                      onClick={() => eliminarProducto(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Nombre del producto"
                  value={prod.producto}
                  onChange={(e) => actualizarProducto(index, 'producto', e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 mb-2 text-base"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Cantidad</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={prod.cantidad}
                      onChange={(e) => actualizarProducto(index, 'cantidad', e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Valor unitario</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={prod.valor_unitario}
                      onChange={(e) => actualizarProducto(index, 'valor_unitario', e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base"
                      placeholder="$"
                    />
                  </div>
                </div>
                {Number(prod.cantidad) > 0 && Number(prod.valor_unitario) > 0 && (
                  <p className="text-right text-sm text-gray-500 mt-1">
                    Subtotal: {formatearMoneda(Number(prod.cantidad) * Number(prod.valor_unitario))}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={agregarProducto}
            className="w-full mt-3 h-10 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Agregar producto
          </button>
        </Card>

        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
          <input
            type="text"
            placeholder="Dijo que paga el viernes..."
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-base"
          />
        </Card>

        <Card className="p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold">TOTAL:</span>
            <span className="text-2xl font-bold text-gray-900">{formatearMoneda(total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Nuevo saldo:</span>
            <span className={`text-lg font-semibold ${superaTope ? 'text-red-600' : 'text-gray-900'}`}>
              {formatearMoneda(nuevoSaldo)}
            </span>
          </div>
          {superaTope && (
            <p className="text-red-600 text-sm mt-2 font-medium">
              Supera el tope. Disponible: {formatearMoneda(disponible)}
            </p>
          )}
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        <Button
          className="w-full h-14 text-lg"
          disabled={guardando || superaTope || total === 0}
          onClick={() => setMostrarModalConfirmar(true)}
        >
          {guardando ? 'Registrando...' : 'CONFIRMAR FIADO'}
        </Button>

        <Modal
          isOpen={mostrarModalConfirmar}
          onClose={() => setMostrarModalConfirmar(false)}
          title="Confirmar fiado"
          confirmText="Sí, confirmar"
          cancelText="Revisar"
          onConfirm={handleConfirmar}
        >
          <div className="space-y-2">
            <p><span className="font-medium">Cliente:</span> {clienteSeleccionado?.nombre}</p>
            <p><span className="font-medium">Total:</span> {formatearMoneda(total)}</p>
            <p><span className="font-medium">Nuevo saldo:</span> {formatearMoneda(nuevoSaldo)}</p>
          </div>
        </Modal>
      </div>
    );
  }

  if (paso === 1) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Fiado</h1>
        </div>

        <p className="text-sm text-gray-500">Paso 1 de 3 — Selecciona el cliente</p>

        <SelectorCliente
          onSeleccionar={seleccionarCliente}
        />
      </div>
    );
  }

  if (paso === 2 && clienteSeleccionado) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaso(1)}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nuevo Fiado</h1>
            <p className="text-sm text-gray-500">Paso 2 de 3</p>
          </div>
        </div>

        <Card className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-gray-900">{clienteSeleccionado.nombre}</p>
              {clienteSeleccionado.apodo && <p className="text-sm text-gray-500">({clienteSeleccionado.apodo})</p>}
            </div>
            <span className={`text-sm font-medium ${clienteSeleccionado.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
              Debe: {formatearMoneda(clienteSeleccionado.saldo)}
            </span>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Tope: {formatearMoneda(clienteSeleccionado.tope_credito)} | Disponible:{' '}
            <span className={disponible > 0 ? 'text-green-600 font-medium' : 'text-red-600'}>
              {formatearMoneda(disponible)}
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-medium text-gray-700 mb-3">¿Quién lo pide?</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setQuienPidio('cliente')}
              className={`p-3 rounded-xl border-2 transition-colors ${
                quienPidio === 'cliente'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm font-medium">Cliente</span>
            </button>
            <button
              onClick={() => setQuienPidio('familiar')}
              className={`p-3 rounded-xl border-2 transition-colors ${
                quienPidio === 'familiar'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium">Familiar</span>
            </button>
          </div>

          {quienPidio === 'familiar' && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del familiar</label>
              <input
                type="text"
                placeholder="Carlos (hijo)"
                value={familiar}
                onChange={(e) => setFamiliar(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-medium text-gray-700 mb-3">PRODUCTOS</h3>
          <div className="space-y-3">
            {productos.map((prod, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm text-gray-500">#{index + 1}</span>
                  {productos.length > 1 && (
                    <button
                      onClick={() => eliminarProducto(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Nombre del producto"
                  value={prod.producto}
                  onChange={(e) => actualizarProducto(index, 'producto', e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 mb-2 text-base"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Cantidad</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={prod.cantidad}
                      onChange={(e) => actualizarProducto(index, 'cantidad', e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Valor unitario</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={prod.valor_unitario}
                      onChange={(e) => actualizarProducto(index, 'valor_unitario', e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base"
                      placeholder="$"
                    />
                  </div>
                </div>
                {Number(prod.cantidad) > 0 && Number(prod.valor_unitario) > 0 && (
                  <p className="text-right text-sm text-gray-500 mt-1">
                    Subtotal: {formatearMoneda(Number(prod.cantidad) * Number(prod.valor_unitario))}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={agregarProducto}
            className="w-full mt-3 h-10 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Agregar producto
          </button>
        </Card>

        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
          <input
            type="text"
            placeholder="Dijo que paga el viernes..."
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-base"
          />
        </Card>

        <Card className="p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-lg font-semibold">TOTAL:</span>
            <span className="text-2xl font-bold text-gray-900">{formatearMoneda(total)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Nuevo saldo:</span>
            <span className={`text-lg font-semibold ${superaTope ? 'text-red-600' : 'text-gray-900'}`}>
              {formatearMoneda(nuevoSaldo)}
            </span>
          </div>
          {superaTope && (
            <p className="text-red-600 text-sm mt-2 font-medium">
              Supera el tope. Disponible: {formatearMoneda(disponible)}
            </p>
          )}
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        <Button
          className="w-full h-14 text-lg"
          disabled={guardando || superaTope || total === 0}
          onClick={() => setMostrarModalConfirmar(true)}
        >
          {guardando ? 'Registrando...' : 'CONFIRMAR FIADO'}
        </Button>

        <Modal
          isOpen={mostrarModalConfirmar}
          onClose={() => setMostrarModalConfirmar(false)}
          title="Confirmar fiado"
          confirmText="Sí, confirmar"
          cancelText="Revisar"
          onConfirm={handleConfirmar}
        >
          <div className="space-y-2">
            <p><span className="font-medium">Cliente:</span> {clienteSeleccionado?.nombre}</p>
            <p><span className="font-medium">Total:</span> {formatearMoneda(total)}</p>
            <p><span className="font-medium">Nuevo saldo:</span> {formatearMoneda(nuevoSaldo)}</p>
          </div>
        </Modal>
      </div>
    );
  }

  return null;
}

export default function NuevoFiadoPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NuevoFiadoContent />
    </Suspense>
  );
}