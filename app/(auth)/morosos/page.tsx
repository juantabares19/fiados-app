// TODO: Migrar a Server Component + Client Component separado (depende de useConfig y SoloDueño que requieren contexto cliente)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SoloDueño } from '@/components/auth/SoloDueño';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatearMoneda, formatearFechaCorta, calcularEstadoMora } from '@/lib/utils';
import { generarMensajeRecordatorio, BotonWhatsApp } from '@/lib/whatsapp';
import { useConfig } from '@/contexts/ConfigContext';

interface ClienteMora {
  id: string;
  nombre: string;
  apodo: string | null;
  celular: string;
  saldo: number;
  tope_credito: number;
  dias_sin_movimiento: number;
  ultimo_movimiento: string | null;
  estado_mora: 'al_dia' | 'moroso' | 'critico';
}

interface ResumenMora {
  total_morosos: number;
  total_criticos: number;
  deuda_morosos: number;
  deuda_criticos: number;
  cartera_total: number;
  porcentaje_en_riesgo: number;
}

interface MorososResponse {
  resumen: ResumenMora;
  clientes: ClienteMora[];
}

type FilterTipo = 'todos' | 'morosos' | 'criticos';

function MorososContent() {
  const router = useRouter();
  const { config } = useConfig();
  const nombreTienda = config?.nombre_tienda ?? 'Mi Tienda';
  const [clientes, setClientes] = useState<ClienteMora[]>([]);
  const [resumen, setResumen] = useState<ResumenMora | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<FilterTipo>('todos');

  const cargarMorosos = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const response = await fetch('/api/morosos');
      if (!response.ok) throw new Error('Error al cargar morosos');
      const data: MorososResponse = await response.json();
      setClientes(data.clientes);
      setResumen(data.resumen);
    } catch (err) {
      setError('No se pudo cargar la información de morosos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarMorosos();
  }, [cargarMorosos]);

  const clientesFiltrados = clientes.filter(c => {
    if (filtro === 'morosos' && c.estado_mora !== 'moroso') return false;
    if (filtro === 'criticos' && c.estado_mora !== 'critico') return false;
    return true;
  });

  const clientesCriticos = clientesFiltrados.filter(c => c.estado_mora === 'critico');
  const clientesMorosos = clientesFiltrados.filter(c => c.estado_mora === 'moroso');

  const handleCobrar = (cliente: ClienteMora) => {
    const msg = generarMensajeRecordatorio(cliente, nombreTienda);
    BotonWhatsApp.enviar(cliente.celular, msg);
  };

  const handleCobrarTodos = () => {
    clientesFiltrados.forEach(cliente => {
      const msg = generarMensajeRecordatorio(cliente, nombreTienda);
      BotonWhatsApp.enviar(cliente.celular, msg);
    });
  };

  const toggleActivo = filtro === 'todos' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200';
  const toggleMoroso = filtro === 'morosos' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200';
  const toggleCritico = filtro === 'criticos' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/inicio')}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Morosos</h1>
          <p className="text-xs text-gray-400">clientes con más de 15 días sin abonar</p>
        </div>
      </div>

      {cargando && (
        <div className="space-y-3">
          <Card className="p-4 animate-pulse">
            <div className="h-24 bg-gray-200 rounded" />
          </Card>
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-center">{error}</p>
          <Button variant="outline" className="mt-2 w-full" onClick={cargarMorosos}>
            Reintentar
          </Button>
        </Card>
      )}

      {!cargando && !error && resumen && (
        <>
          <Card className="p-4 bg-red-50 border border-red-200">
            <div className="text-center">
              <p className="text-sm font-medium text-red-600 mb-1">CARTERA EN RIESGO</p>
              <p className="text-xs text-red-400 mb-2">deuda acumulada de clientes con mora activa</p>
              <p className="text-3xl font-bold text-red-700">
                {formatearMoneda(resumen.deuda_morosos + resumen.deuda_criticos)}
                <span className="text-lg ml-1">({resumen.porcentaje_en_riesgo}%)</span>
              </p>
              <div className="flex justify-center gap-4 mt-2 text-sm">
                <span className="text-red-600">🔴 {resumen.total_criticos} críticos</span>
                <span className="text-orange-600">🟠 {resumen.total_morosos - resumen.total_criticos} morosos</span>
              </div>
            </div>
          </Card>

          <Card className="p-3 bg-gray-50 border border-gray-200">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              🟠 <span className="font-medium">Moroso:</span> entre 15 y 30 días sin abonar
              {'  ·  '}
              🔴 <span className="font-medium">Crítico:</span> más de 30 días sin abonar
            </p>
          </Card>

          <div className="flex gap-2">
            <button
              onClick={() => setFiltro('todos')}
              className={`flex-1 h-10 rounded-lg font-medium text-sm border transition-colors ${toggleActivo}`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltro('morosos')}
              className={`flex-1 h-10 rounded-lg font-medium text-sm border transition-colors ${toggleMoroso}`}
            >
              Morosos
            </button>
            <button
              onClick={() => setFiltro('criticos')}
              className={`flex-1 h-10 rounded-lg font-medium text-sm border transition-colors ${toggleCritico}`}
            >
              Críticos
            </button>
          </div>

          {clientesCriticos.length === 0 && clientesMorosos.length === 0 && (
            <EmptyState
              title="🎉 ¡Todos al día!"
              description="No hay clientes morosos en este momento."
              icon={
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          )}

          {(clientesCriticos.length > 0 || clientesMorosos.length > 0) && (
            <div className="space-y-4">
              {clientesCriticos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-2">🔴 CRÍTICOS (+30 días)</h3>
                  <div className="space-y-2">
                    {clientesCriticos.map(cliente => {
                      const estado = calcularEstadoMora(cliente.saldo, cliente.dias_sin_movimiento);
                      return (
                        <Card key={cliente.id} className="p-4 bg-red-50 border border-red-100">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold text-gray-900">{cliente.nombre}</p>
                              {cliente.apodo && <p className="text-sm text-gray-500">({cliente.apodo})</p>}
                            </div>
                            <span className={`text-lg font-bold ${estado.color}`}>
                              {formatearMoneda(cliente.saldo)}
                            </span>
                          </div>
                          <p className="text-sm text-red-600 font-medium">
                            {cliente.dias_sin_movimiento} días sin pagar
                          </p>
                          {cliente.ultimo_movimiento && (
                            <p className="text-xs text-gray-400">
                              Último: {formatearFechaCorta(cliente.ultimo_movimiento)}
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" onClick={() => handleCobrar(cliente)}>
                              📱 Cobrar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => router.push(`/clientes/${cliente.id}`)}>
                              👤 Ver
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {clientesMorosos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-600 mb-2">🟠 MOROSOS (15-30 días)</h3>
                  <div className="space-y-2">
                    {clientesMorosos.map(cliente => {
                      const estado = calcularEstadoMora(cliente.saldo, cliente.dias_sin_movimiento);
                      return (
                        <Card key={cliente.id} className="p-4 bg-orange-50 border border-orange-100">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-semibold text-gray-900">{cliente.nombre}</p>
                              {cliente.apodo && <p className="text-sm text-gray-500">({cliente.apodo})</p>}
                            </div>
                            <span className={`text-lg font-bold ${estado.color}`}>
                              {formatearMoneda(cliente.saldo)}
                            </span>
                          </div>
                          <p className="text-sm text-orange-600 font-medium">
                            {cliente.dias_sin_movimiento} días sin pagar
                          </p>
                          {cliente.ultimo_movimiento && (
                            <p className="text-xs text-gray-400">
                              Último: {formatearFechaCorta(cliente.ultimo_movimiento)}
                            </p>
                          )}
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" onClick={() => handleCobrar(cliente)}>
                              📱 Cobrar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => router.push(`/clientes/${cliente.id}`)}>
                              👤 Ver
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button
                className="w-full h-12"
                onClick={handleCobrarTodos}
              >
                📱 Cobrar a todos
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MorososPage() {
  return (
    <SoloDueño>
      <MorososContent />
    </SoloDueño>
  );
}