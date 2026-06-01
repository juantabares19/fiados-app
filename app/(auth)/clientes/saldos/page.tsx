'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { formatearMoneda } from '@/lib/utils';

interface ClienteSaldo {
  id: string;
  nombre: string;
  celular: string;
  estado: string;
  saldo: number;
}

interface SaldosResponse {
  clientes: ClienteSaldo[];
  cartera_total: number;
  clientes_con_deuda: number;
}

type OrdenType = 'deuda' | 'nombre';

export default function SaldosPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteSaldo[]>([]);
  const [carteraTotal, setCarteraTotal] = useState(0);
  const [clientesConDeuda, setClientesConDeuda] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [orden, setOrden] = useState<OrdenType>('deuda');

  const cargarSaldos = useCallback(async (ord: OrdenType) => {
    setCargando(true);
    setError('');
    try {
      const response = await fetch(`/api/clientes/saldos?orden=${ord}`);
      if (!response.ok) throw new Error('Error al cargar saldos');
      const data: SaldosResponse = await response.json();
      setClientes(data.clientes);
      setCarteraTotal(data.cartera_total);
      setClientesConDeuda(data.clientes_con_deuda);
    } catch (err) {
      setError('No se pudo cargar la información');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarSaldos(orden);
  }, [orden, cargarSaldos]);

  const getBadgeColor = (saldo: number): string => {
    if (saldo === 0) return 'bg-green-100 text-green-700';
    if (saldo > 40000) return 'bg-red-100 text-red-700';
    if (saldo > 20000) return 'bg-orange-100 text-orange-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const getBadgeEmoji = (saldo: number): string => {
    if (saldo === 0) return '🟢';
    if (saldo > 40000) return '🔴';
    if (saldo > 20000) return '🟠';
    return '🟡';
  };

  const clientesConDeudaLista = clientes.filter(c => c.saldo > 0);
  const clientesAlDia = clientes.filter(c => c.saldo === 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/clientes')}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Saldos</h1>
      </div>

      <Card className="p-6 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-600 font-medium text-center">CARTERA TOTAL</p>
        <p className="text-3xl font-bold text-blue-700 text-center mt-1">
          {formatearMoneda(carteraTotal)}
        </p>
        <p className="text-sm text-blue-500 text-center mt-1">
          {clientesConDeuda} cliente{clientesConDeuda !== 1 ? 's' : ''} con deuda
        </p>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Ordenar por:</p>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as OrdenType)}
          className="h-12 px-3 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="deuda">Mayor deuda</option>
          <option value="nombre">Nombre A-Z</option>
        </select>
      </div>

      {cargando && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-16 bg-gray-200 rounded-lg" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-center">{error}</p>
        </Card>
      )}

      {!cargando && !error && clientes.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No hay clientes registrados</p>
        </Card>
      )}

      {!cargando && !error && (
        <div className="space-y-4">
          {clientesConDeudaLista.length > 0 && (
            <div className="space-y-3">
              {clientesConDeudaLista.map((cliente, index) => (
                <Card
                  key={cliente.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => router.push(`/clientes/${cliente.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400 w-6 text-center">
                        {index + 1}.
                      </span>
                      <div>
                        <p className="font-semibold text-gray-900">{cliente.nombre}</p>
                        <p className="text-sm text-gray-500">{cliente.celular.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getBadgeEmoji(cliente.saldo)}</span>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getBadgeColor(cliente.saldo)}`}>
                        {formatearMoneda(cliente.saldo)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {clientesAlDia.length > 0 && (
            <div>
              <div className="flex items-center gap-2 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <p className="text-sm text-gray-400 font-medium px-2">AL DÍA</p>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="space-y-2">
                {clientesAlDia.map((cliente) => (
                  <Card
                    key={cliente.id}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow opacity-70"
                    onClick={() => router.push(`/clientes/${cliente.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">🟢</span>
                        <div>
                          <p className="font-medium text-gray-700">{cliente.nombre}</p>
                          <p className="text-sm text-gray-400">{cliente.celular.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-green-600">
                        {formatearMoneda(0)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}