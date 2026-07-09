'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SoloDueño } from '@/components/auth/SoloDueño';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatearMoneda } from '@/lib/utils';

interface Movimiento {
  tipo: 'fiado' | 'abono';
  id: string;
  hora: string;
  cliente_nombre: string;
  cliente_id: string;
  descripcion?: string;
  total?: number;
  monto?: number;
  quien_pidio?: 'cliente' | 'familiar';
  familiar?: string | null;
  metodo_pago?: string;
  usuario_nombre: string;
  usuario_id: string;
}

interface Resumen {
  cantidad_fiados: number;
  total_fiado: number;
  cantidad_abonos: number;
  total_abonado: number;
  balance: number;
}

interface Tendero {
  usuario_nombre: string;
  usuario_id: string;
  fiados_registrados: number;
  total_fiado: number;
  abonos_registrados: number;
  total_abonado: number;
}

interface ActividadResponse {
  fecha: string;
  resumen: Resumen;
  movimientos: Movimiento[];
  por_tendero: Tendero[];
}

type FilterTipo = 'todos' | 'fiados' | 'abonos';

function getNombreDia(date: Date): string {
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return dias[date.getDay()];
}

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ActividadContent() {
  const router = useRouter();
  const [fechaActual, setFechaActual] = useState(new Date());
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [porTendero, setPorTendero] = useState<Tendero[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FilterTipo>('todos');
  const [filtroTendero, setFiltroTendero] = useState<string>('todos');

  const fechaStr = formatDateLocal(fechaActual);
  const esHoy = formatDateLocal(new Date()) === fechaStr;
  const nombreDia = getNombreDia(fechaActual);
  const fechaFormateada = fechaActual.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/actividad?fecha=${fechaStr}`);
        if (!active) return;
        if (!response.ok) throw new Error('Error al cargar actividad');
        const data: ActividadResponse = await response.json();
        if (!active) return;
        setResumen(data.resumen);
        setMovimientos(data.movimientos);
        setPorTendero(data.por_tendero);
        setError('');
      } catch {
        if (active) setError('No se pudo cargar la actividad');
      } finally {
        if (active) setCargando(false);
      }
    })();
    return () => { active = false; };
  }, [fechaStr, refreshKey]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && esHoy) {
        setRefreshKey(k => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [esHoy]);

  const diaAnterior = () => {
    const nueva = new Date(fechaActual);
    nueva.setDate(nueva.getDate() - 1);
    setFechaActual(nueva);
  };

  const diaSiguiente = () => {
    if (esHoy) return;
    const nueva = new Date(fechaActual);
    nueva.setDate(nueva.getDate() + 1);
    setFechaActual(nueva);
  };

  const irHoy = () => {
    setFechaActual(new Date());
  };

  const movimientosFiltrados = movimientos.filter(m => {
    if (filtroTipo === 'fiados' && m.tipo !== 'fiado') return false;
    if (filtroTipo === 'abonos' && m.tipo !== 'abono') return false;
    if (filtroTendero !== 'todos' && m.usuario_id !== filtroTendero) return false;
    return true;
  });

  const balanceNegativo = (resumen?.balance || 0) < 0;

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
        <h1 className="text-xl font-bold text-gray-900">Actividad</h1>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={diaAnterior}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{fechaFormateada}</p>
          <p className="text-sm text-gray-500">{nombreDia}</p>
        </div>
        <button
          onClick={diaSiguiente}
          disabled={esHoy}
          className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
            esHoy ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <button
        onClick={irHoy}
        className={`w-full h-10 rounded-lg font-medium text-sm transition-colors ${
          esHoy
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        disabled={esHoy}
      >
        Hoy
      </button>

      {cargando && (
        <div className="space-y-3">
          <Card className="p-4 animate-pulse">
            <div className="h-20 bg-gray-200 rounded" />
          </Card>
          <Card className="p-4 animate-pulse">
            <div className="h-32 bg-gray-200 rounded" />
          </Card>
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-center">{error}</p>
          <Button variant="outline" className="mt-2 w-full" onClick={() => { setCargando(true); setError(''); setRefreshKey(k => k + 1); }}>
            Reintentar
          </Button>
        </Card>
      )}

      {!cargando && !error && resumen && (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="border-r border-gray-100">
                <p className="text-xs text-gray-500">FIADOS</p>
                <p className="text-2xl font-bold text-red-600">{resumen.cantidad_fiados}</p>
                <p className="text-sm font-semibold text-red-600">{formatearMoneda(resumen.total_fiado)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ABONOS</p>
                <p className="text-2xl font-bold text-green-600">{resumen.cantidad_abonos}</p>
                <p className="text-sm font-semibold text-green-600">{formatearMoneda(resumen.total_abonado)}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">BALANCE</p>
              <p className={`text-xl font-bold ${balanceNegativo ? 'text-red-600' : 'text-green-600'}`}>
                {formatearMoneda(Math.abs(resumen.balance))}
                {balanceNegativo ? ' 🔴' : ' 🟢'}
              </p>
            </div>
          </Card>

          {porTendero.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Por tendero</p>
              <div className="space-y-3">
                {porTendero.map(t => (
                  <div key={t.usuario_id} className="border-b border-gray-50 pb-2 last:border-0">
                    <p className="font-medium text-gray-900">{t.usuario_nombre}</p>
                    <p className="text-xs text-gray-500">
                      {t.fiados_registrados} fiados ({formatearMoneda(t.total_fiado)}) | {t.abonos_registrados} abonos ({formatearMoneda(t.total_abonado)})
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFiltroTipo('todos')}
              className={`flex-1 min-w-fit h-10 px-4 rounded-lg font-medium text-sm border transition-colors ${
                filtroTipo === 'todos' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTipo('fiados')}
              className={`flex-1 min-w-fit h-10 px-4 rounded-lg font-medium text-sm border transition-colors ${
                filtroTipo === 'fiados' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              Fiados
            </button>
            <button
              onClick={() => setFiltroTipo('abonos')}
              className={`flex-1 min-w-fit h-10 px-4 rounded-lg font-medium text-sm border transition-colors ${
                filtroTipo === 'abonos' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              Abonos
            </button>
          </div>

          {porTendero.length > 1 && (
            <select
              value={filtroTendero}
              onChange={(e) => setFiltroTendero(e.target.value)}
              className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="todos">Todos los tenderos</option>
              {porTendero.map(t => (
                <option key={t.usuario_id} value={t.usuario_id}>{t.usuario_nombre}</option>
              ))}
            </select>
          )}

          {movimientosFiltrados.length === 0 && (
            <EmptyState
              title="No hubo movimientos este día"
              description="No se registró ninguna actividad en esta fecha."
              icon={
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
          )}

          {movimientosFiltrados.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500">DETALLE</h3>
              {movimientosFiltrados.map(mov => (
                <Card
                  key={mov.id}
                  className={`p-3 border-l-4 ${mov.tipo === 'fiado' ? 'border-red-400' : 'border-green-400'}`}
                  onClick={() => router.push(`/clientes/${mov.cliente_id}`)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">{mov.hora}</span>
                      <span className={`font-bold ${mov.tipo === 'fiado' ? 'text-red-500' : 'text-green-500'}`}>
                        {mov.tipo === 'fiado' ? '🔴' : '🟢'}
                      </span>
                      <span className="font-semibold text-gray-900">{mov.cliente_nombre}</span>
                      <Badge variant={mov.tipo === 'fiado' ? 'danger' : 'success'}>{mov.tipo === 'fiado' ? 'Fiado' : 'Abono'}</Badge>
                    </div>
                    <span className={`font-bold ${mov.tipo === 'fiado' ? 'text-red-600' : 'text-green-600'}`}>
                      {formatearMoneda(mov.tipo === 'fiado' ? mov.total! : mov.monto!)}
                    </span>
                  </div>
                  {mov.tipo === 'fiado' && mov.descripcion && (
                    <p className="text-sm text-gray-600">{mov.descripcion}</p>
                  )}
                  {mov.tipo === 'fiado' && mov.quien_pidio === 'familiar' && mov.familiar && (
                    <p className="text-xs text-gray-500">Pidió: {mov.familiar}</p>
                  )}
                  {mov.tipo === 'abono' && mov.metodo_pago && (
                    <p className="text-sm text-gray-600 capitalize">{mov.metodo_pago}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Reg: {mov.usuario_nombre}</p>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ActividadPage() {
  return (
    <SoloDueño>
      <ActividadContent />
    </SoloDueño>
  );
}