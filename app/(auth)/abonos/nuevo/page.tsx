'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClienteConSaldo } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SelectorCliente } from '@/components/clientes/SelectorCliente';
import { formatearMoneda } from '@/lib/utils';
import { generarMensajeConfirmacionAbono, abrirWhatsApp } from '@/lib/whatsapp';
import { useConfig } from '@/state/ConfigContext';

interface AbonoCreado {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  monto: number;
  metodo_pago: string;
  nota: string | null;
  created_at: string;
}

function NuevoAbonoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { config } = useConfig();
  const nombreTienda = config?.nombre_tienda ?? 'Mi Tienda';

  const [paso, setPaso] = useState(1);
  // Inicializado desde la URL para evitar un parpadeo del buscador antes de que
  // el useEffect cargue al cliente preseleccionado.
  const [clientePreseleccionadoId, setClientePreseleccionadoId] = useState<string | null>(
    () => searchParams.get('cliente')
  );
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteConSaldo | null>(null);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [abonoCreado, setAbonoCreado] = useState<AbonoCreado | null>(null);
  const [clienteAlDia, setClienteAlDia] = useState(false);

  useEffect(() => {
    const clienteId = searchParams.get('cliente');
    if (!clienteId) return;
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/clientes/${clienteId}`);
        if (!active) return;
        if (response.ok) {
          const data = await response.json();
          if (!active) return;
          setClienteSeleccionado(data);
          setPaso(2);
        } else {
          // No se pudo cargar: caer al buscador en vez de quedar en pantalla de carga.
          setClientePreseleccionadoId(null);
        }
      } catch (err) {
        console.error('Error al cargar cliente:', err);
        if (active) setClientePreseleccionadoId(null);
      }
    })();
    return () => { active = false; };
  }, [searchParams]);

  const seleccionarCliente = (cliente: ClienteConSaldo) => {
    if (cliente.saldo <= 0) {
      alert('Este cliente no tiene saldo pendiente.');
      return;
    }
    setClienteSeleccionado(cliente);
    setPaso(2);
  };

  const montoNumero = parseInt(monto.replace(/\D/g, '')) || 0;
  const saldoActual = clienteSeleccionado?.saldo || 0;
  const nuevoSaldo = saldoActual - montoNumero;
  const superaSaldo = montoNumero > saldoActual;
  const montoValido = montoNumero > 0 && !superaSaldo;

  const handlePagarTodo = () => {
    setMonto(saldoActual.toString());
  };

  const handleConfirmar = async () => {
    setError('');

    if (!montoValido) {
      if (montoNumero > saldoActual) {
        setError('El monto supera el saldo pendiente');
      } else {
        setError('Ingresa un monto válido');
      }
      return;
    }

    setGuardando(true);
    try {
      const response = await fetch('/api/abonos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteSeleccionado?.id,
          monto: montoNumero,
          metodo_pago: metodoPago,
          nota: nota.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear abono');
      }

      setAbonoCreado(data.abono);
      setClienteAlDia(data.cliente_al_dia);
      setPaso(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar abono');
    } finally {
      setGuardando(false);
    }
  };

  const reiniciar = () => {
    setPaso(1);
    setClientePreseleccionadoId(null);
    setClienteSeleccionado(null);
    setMonto('');
    setMetodoPago('efectivo');
    setNota('');
    setError('');
    setAbonoCreado(null);
    setClienteAlDia(false);
  };

  // Llegamos con ?cliente= y aún estamos cargando sus datos: mostrar carga, no el buscador.
  if (clientePreseleccionadoId && !clienteSeleccionado) {
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
          <h1 className="text-2xl font-bold text-gray-900">Registrar Abono</h1>
        </div>
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-center text-gray-500">Cargando cliente...</p>
      </div>
    );
  }

  if (paso === 2 && clienteSeleccionado && saldoActual <= 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Registrar Abono</h1>
        </div>

        <Card className="p-6 text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <p className="font-semibold text-lg text-gray-900">{clienteSeleccionado.nombre}</p>
          <p className="text-gray-600">Este cliente no tiene saldo pendiente. No hay nada que abonar.</p>
          <Button variant="outline" className="w-full h-12" onClick={() => router.back()}>
            Volver
          </Button>
        </Card>
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
          <h1 className="text-2xl font-bold text-gray-900">Registrar Abono</h1>
        </div>

        {clienteSeleccionado.estado === 'bloqueado' && (
          <Card className="p-3 bg-orange-50 border border-orange-200">
            <p className="text-orange-800 text-sm text-center">
              ⚠️ Cliente bloqueado — solo se puede registrar el abono de deuda pendiente.
            </p>
          </Card>
        )}

        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500 mb-1">{clienteSeleccionado.nombre}</p>
          <p className="text-sm text-gray-500">SALDO PENDIENTE</p>
          <p className="text-3xl font-bold text-red-600">{formatearMoneda(saldoActual)}</p>
        </Card>

        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Monto del abono</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">$</span>
            <input
              type="tel"
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className="w-full h-14 pl-10 pr-4 text-2xl rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handlePagarTodo}
            className="w-full mt-2 h-10 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 flex items-center justify-center gap-2 text-sm"
          >
            Pagar todo: {formatearMoneda(saldoActual)}
          </button>
        </Card>

        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">Método de pago</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'efectivo', label: 'Efectivo', icon: '💵' },
              { value: 'nequi', label: 'Nequi', icon: '📱' },
              { value: 'daviplata', label: 'Daviplata', icon: '📱' },
              { value: 'llaves', label: 'Llaves', icon: '🔑' },
              { value: 'otro', label: 'Otro', icon: '💳' },
            ].map((m) => (
              <button
                key={m.value}
                onClick={() => setMetodoPago(m.value)}
                className={`p-3 rounded-xl border-2 transition-colors flex flex-col items-center ${
                  metodoPago === m.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl mb-1">{m.icon}</span>
                <span className="text-xs font-medium">{m.label}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Nota (opcional)</label>
          <input
            type="text"
            placeholder="Ej: Pagó por Nequi"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-base"
          />
        </Card>

        {montoNumero > 0 && (
          <Card className="p-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Nuevo saldo:</span>
              <span className={`text-lg font-semibold ${superaSaldo ? 'text-red-600' : 'text-gray-900'}`}>
                {formatearMoneda(nuevoSaldo)}
              </span>
            </div>
            {superaSaldo && (
              <p className="text-red-600 text-sm mt-1">El monto supera el saldo pendiente</p>
            )}
          </Card>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}

        <Button
          variant="success"
          className="w-full h-14 text-lg"
          disabled={guardando || !montoValido}
          onClick={handleConfirmar}
        >
          {guardando ? 'Registrando...' : 'REGISTRAR ABONO'}
        </Button>
      </div>
    );
  }

  if (paso === 3 && abonoCreado) {
    return (
      <div className="space-y-6 text-center">
        <div className="pt-8">
          {clienteAlDia ? (
            <>
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🎉</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">¡Cliente al día!</h1>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">¡Abono registrado!</h1>
            </>
          )}
        </div>

        <Card className="p-4 text-left">
          <p className="font-semibold text-lg mb-1">{abonoCreado.cliente_nombre}</p>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Abono:</span>
              <span className="font-bold text-green-600">{formatearMoneda(abonoCreado.monto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Método:</span>
              <span className="capitalize">{abonoCreado.metodo_pago}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Saldo pendiente:</span>
              <span className={`font-semibold ${clienteAlDia ? 'text-green-600' : 'text-red-600'}`}>
                {formatearMoneda(saldoActual - montoNumero)}
              </span>
            </div>
          </div>
        </Card>

        <Button
          variant="outline"
          className="w-full h-12"
          onClick={() => {
            if (!clienteSeleccionado?.celular) return;
            const mensaje = generarMensajeConfirmacionAbono(
              { nombre: abonoCreado!.cliente_nombre },
              nombreTienda,
              { monto: abonoCreado!.monto, metodo_pago: abonoCreado!.metodo_pago },
              saldoActual - montoNumero
            );
            abrirWhatsApp(clienteSeleccionado.celular, mensaje);
          }}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Enviar por WhatsApp
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={reiniciar}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Nuevo abono
          </Button>
          <Button onClick={() => router.push('/inicio')}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Ir al inicio
          </Button>
        </div>
      </div>
    );
  }

  // Paso 1: sin cliente preseleccionado, buscar y elegir.
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
        <h1 className="text-2xl font-bold text-gray-900">Registrar Abono</h1>
      </div>

      <SelectorCliente onSeleccionar={seleccionarCliente} />
    </div>
  );
}

export default function NuevoAbonoPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NuevoAbonoContent />
    </Suspense>
  );
}