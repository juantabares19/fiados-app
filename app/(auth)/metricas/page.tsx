'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SoloDueño } from '@/components/auth/SoloDueño';
import { Card } from '@/components/ui/Card';
import { formatearMoneda } from '@/lib/utils';

interface MetricasData {
  periodo: {
    tipo: string;
    desde: string;
    hasta: string;
    label: string;
  };
  fiados: { cantidad: number; total: number };
  abonos: { cantidad: number; total: number };
  recuperacion: { porcentaje: number; diferencia: number };
  cartera: {
    total: number;
    clientes_con_deuda: number;
    clientes_al_dia: number;
    deuda_promedio: number;
  };
  mora: {
    morosos: number;
    criticos: number;
    cartera_en_riesgo: number;
    porcentaje_en_riesgo: number;
  };
  metodos_pago: Array<{ metodo: string; cantidad: number; total: number; porcentaje: number }>;
  top_deudores: Array<{ id: string; nombre: string; saldo: number }>;
  tendencia_semanal: Array<{ semana: string; fiado: number; abonado: number }>;
  tiempo_promedio_pago: number;
}

type PeriodoTipo = 'mes_actual' | 'mes_anterior' | 'ultimos_30' | 'ultimos_90';

const periodoOpciones: Record<PeriodoTipo, string> = {
  mes_actual: 'Este mes',
  mes_anterior: 'Mes anterior',
  ultimos_30: 'Últimos 30 días',
  ultimos_90: 'Últimos 90 días'
};

function MetricasContent() {
  const router = useRouter();
  const [metricas, setMetricas] = useState<MetricasData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoTipo>('mes_actual');

  useEffect(() => {
    const cargarMetricas = async () => {
      setCargando(true);
      try {
        const response = await fetch(`/api/metricas?periodo=${periodo}`);
        if (response.ok) {
          const data = await response.json();
          setMetricas(data);
        }
      } catch (err) {
        console.error('Error cargando métricas:', err);
      } finally {
        setCargando(false);
      }
    };
    cargarMetricas();
  }, [periodo]);

  const handlePeriodoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPeriodo(e.target.value as PeriodoTipo);
  };

  const getMetodoColor = (metodo: string): string => {
    switch (metodo.toLowerCase()) {
      case 'efectivo': return 'bg-gray-400';
      case 'nequi': return 'bg-blue-400';
      case 'daviplata': return 'bg-orange-400';
      case 'llaves': return 'bg-purple-400';
      default: return 'bg-gray-400';
    }
  };

  const getMetodoLabel = (metodo: string): string => {
    switch (metodo.toLowerCase()) {
      case 'nequi': return 'Nequi';
      case 'daviplata': return 'Daviplata';
      case 'efectivo': return 'Efectivo';
      case 'llaves': return 'Llaves';
      default: return metodo;
    }
  };

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
        <h1 className="text-xl font-bold text-gray-900">Métricas</h1>
      </div>

      <select
        value={periodo}
        onChange={handlePeriodoChange}
        className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-lg font-medium bg-white"
      >
        {Object.entries(periodoOpciones).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {cargando && !metricas && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="animate-pulse bg-gray-200 rounded-xl h-24"></div>
            <div className="animate-pulse bg-gray-200 rounded-xl h-24"></div>
          </div>
          <div className="animate-pulse bg-gray-200 rounded-xl h-28"></div>
          <div className="animate-pulse bg-gray-200 rounded-xl h-32"></div>
          <div className="animate-pulse bg-gray-200 rounded-xl h-48"></div>
          <div className="animate-pulse bg-gray-200 rounded-xl h-36"></div>
          <div className="animate-pulse bg-gray-200 rounded-xl h-24"></div>
        </div>
      )}

      {metricas && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 bg-red-50 border border-red-100">
              {cargando ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-16"></div>
                  <div className="h-8 bg-gray-300 rounded w-24"></div>
                  <div className="h-3 bg-gray-300 rounded w-20"></div>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-red-600 uppercase mb-1">Fiado</p>
                  <p className="text-2xl font-bold text-red-700">{formatearMoneda(metricas.fiados.total)}</p>
                  <p className="text-sm text-red-500">{metricas.fiados.cantidad} fiados</p>
                  <div className="w-full bg-red-200 rounded-full h-2 mt-2">
                    <div className="bg-red-500 h-2 rounded-full"></div>
                  </div>
                </>
              )}
            </Card>

            <Card className="p-4 bg-green-50 border border-green-100">
              {cargando ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-16"></div>
                  <div className="h-8 bg-gray-300 rounded w-24"></div>
                  <div className="h-3 bg-gray-300 rounded w-20"></div>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-green-600 uppercase mb-1">Abonado</p>
                  <p className="text-2xl font-bold text-green-700">{formatearMoneda(metricas.abonos.total)}</p>
                  <p className="text-sm text-green-500">{metricas.abonos.cantidad} abonos</p>
                  <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                    <div className="bg-green-500 h-2 rounded-full"></div>
                  </div>
                </>
              )}
            </Card>
          </div>

          <Card className="p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">RECUPERACIÓN</p>
            {cargando ? (
              <div className="animate-pulse space-y-2">
                <div className="h-6 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-28"></div>
              </div>
            ) : (
              <>
                <p className="text-xl font-bold text-gray-900">{metricas.recuperacion.porcentaje}%</p>
                <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
                  <div
                    className="bg-green-500 h-4 rounded-full"
                    style={{ width: `${Math.min(metricas.recuperacion.porcentaje, 100)}%` }}
                  ></div>
                </div>
                <p className={`text-sm mt-2 ${metricas.recuperacion.diferencia < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {metricas.recuperacion.diferencia < 0
                    ? `Faltan: ${formatearMoneda(Math.abs(metricas.recuperacion.diferencia))}`
                    : `Sobran: ${formatearMoneda(metricas.recuperacion.diferencia)}`}
                </p>
              </>
            )}
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">CARTERA ACTUAL</p>
            {cargando ? (
              <div className="animate-pulse space-y-2">
                <div className="h-6 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                <div className="h-4 bg-gray-200 rounded w-36"></div>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">{formatearMoneda(metricas.cartera.total)}</p>
                <p className="text-sm text-gray-500">{metricas.cartera.clientes_con_deuda} clientes con deuda</p>
                <p className="text-sm text-gray-500 mt-1">Deuda promedio: <span className="font-medium">{formatearMoneda(metricas.cartera.deuda_promedio)}</span></p>
                <div className="border-t border-gray-100 mt-3 pt-3">
                  <p className="text-sm text-red-600 font-medium">
                    En riesgo: {formatearMoneda(metricas.mora.cartera_en_riesgo)}
                  </p>
                  <button
                    onClick={() => router.push('/morosos')}
                    className="text-sm text-blue-600 hover:underline mt-1"
                  >
                    {metricas.mora.morosos} morosos, {metricas.mora.criticos} crít.
                  </button>
                </div>
              </>
            )}
          </Card>

          {metricas.tendencia_semanal.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">TENDENCIA SEMANAL</p>
              {cargando ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex gap-2">
                      <div className="h-6 bg-gray-200 rounded w-24"></div>
                      <div className="h-6 bg-gray-200 rounded flex-1"></div>
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {metricas.tendencia_semanal.map((semana, idx) => {
                    const maxValor = Math.max(...metricas.tendencia_semanal.map(s => Math.max(s.fiado, s.abonado)));
                    const fiadoWidth = maxValor > 0 ? (semana.fiado / maxValor) * 100 : 0;
                    const abonadoWidth = maxValor > 0 ? (semana.abonado / maxValor) * 100 : 0;
                    return (
                      <div key={idx}>
                        <p className="text-xs text-gray-500 mb-1">{semana.semana}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-16 text-xs text-red-600">Fiado</span>
                            <div className="flex-1 bg-red-100 rounded h-4">
                              <div className="bg-red-400 h-4 rounded" style={{ width: `${fiadoWidth}%` }}></div>
                            </div>
                            <span className="w-20 text-xs text-right text-red-600">{formatearMoneda(semana.fiado)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 text-xs text-green-600">Abonado</span>
                            <div className="flex-1 bg-green-100 rounded h-4">
                              <div className="bg-green-400 h-4 rounded" style={{ width: `${abonadoWidth}%` }}></div>
                            </div>
                            <span className="w-20 text-xs text-right text-green-600">{formatearMoneda(semana.abonado)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {metricas.top_deudores.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">TOP 5 DEUDORES</p>
              {cargando ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-2">
                      <div className="h-4 bg-gray-200 rounded w-6"></div>
                      <div className="h-5 bg-gray-200 rounded flex-1"></div>
                      <div className="h-5 bg-gray-200 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {metricas.top_deudores.map((deudor, idx) => {
                    const maxSaldo = metricas.top_deudores[0].saldo;
                    const width = maxSaldo > 0 ? (deudor.saldo / maxSaldo) * 100 : 0;
                    return (
                      <button
                        key={deudor.id}
                        onClick={() => router.push(`/clientes/${deudor.id}`)}
                        className="w-full flex items-center gap-2 text-left hover:bg-gray-50 rounded-lg p-1"
                      >
                        <span className="w-6 text-sm font-medium text-gray-500">{idx + 1}.</span>
                        <span className="flex-1 text-sm font-medium text-gray-800 truncate">{deudor.nombre}</span>
                        <div className="flex-1 bg-red-100 rounded h-4">
                          <div className="bg-red-400 h-4 rounded" style={{ width: `${width}%` }}></div>
                        </div>
                        <span className="w-20 text-sm text-right font-medium text-red-600">{formatearMoneda(deudor.saldo)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {metricas.metodos_pago.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">MÉTODOS DE PAGO</p>
              {cargando ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-2">
                      <div className="h-5 bg-gray-200 rounded w-20"></div>
                      <div className="h-5 bg-gray-200 rounded w-16"></div>
                      <div className="h-5 bg-gray-200 rounded flex-1"></div>
                      <div className="h-5 bg-gray-200 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {metricas.metodos_pago.map((mp, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{getMetodoLabel(mp.metodo)}</span>
                        <span className="text-sm text-gray-500">{mp.porcentaje}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-6 rounded ${getMetodoColor(mp.metodo)}`}></div>
                        <div className="flex-1 bg-gray-100 rounded h-4">
                          <div className={`h-4 rounded ${getMetodoColor(mp.metodo)}`} style={{ width: `${mp.porcentaje}%` }}></div>
                        </div>
                        <span className="w-24 text-sm text-right text-gray-600">{formatearMoneda(mp.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">INDICADORES</p>
            {cargando ? (
              <div className="animate-pulse space-y-2">
                <div className="h-5 bg-gray-200 rounded w-40"></div>
                <div className="h-5 bg-gray-200 rounded w-32"></div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">Tiempo promedio de pago:</span>
                  <span className="text-sm font-bold text-gray-800">{metricas.tiempo_promedio_pago} días</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">Clientes al día:</span>
                  <span className="text-sm font-bold text-gray-800">
                    {metricas.cartera.clientes_al_dia} de {metricas.cartera.clientes_al_dia + metricas.cartera.clientes_con_deuda}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default function MetricasPage() {
  return (
    <SoloDueño>
      <MetricasContent />
    </SoloDueño>
  );
}