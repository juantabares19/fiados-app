'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatearMoneda, formatearFechaCorta, formatearHora } from '@/lib/utils';

interface DetalleProducto {
  producto: string;
  cantidad: number;
  valor_unitario: number;
  subtotal: number;
}

interface Movimiento {
  tipo: 'fiado' | 'abono';
  id: string;
  total?: number;
  monto?: number;
  quien_pidio?: 'cliente' | 'familiar';
  familiar?: string | null;
  nota?: string | null;
  usuario_nombre: string;
  created_at: string;
  puede_cancelar?: boolean;
  detalles?: DetalleProducto[];
  metodo_pago?: string;
}

interface Resumen {
  total_fiado: number;
  total_abonado: number;
  saldo: number;
}

interface HistorialResponse {
  movimientos: Movimiento[];
  total_registros: number;
  pagina: number;
  total_paginas: number;
  resumen: Resumen;
}

type FilterTipo = 'todos' | 'fiados' | 'abonos';

export default function HistorialPage() {
  const params = useParams();
  const router = useRouter();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FilterTipo>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargandoMas, setCargandoMas] = useState(false);

  const clienteId = params.id as string;

  const cargarHistorial = useCallback(async (
    tipo: FilterTipo,
    desde?: string,
    hasta?: string,
    page: number = 1,
    append: boolean = false
  ) => {
    try {
      const params = new URLSearchParams();
      params.set('cliente_id', clienteId);
      params.set('limite', '15');
      params.set('pagina', String(page));
      if (tipo !== 'todos') params.set('tipo', tipo);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);

      const response = await fetch(`/api/clientes/${clienteId}/historial?${params.toString()}`);
      if (!response.ok) throw new Error('Error al cargar historial');

      const data: HistorialResponse = await response.json();

      if (append) {
        setMovimientos(prev => [...prev, ...data.movimientos]);
      } else {
        setMovimientos(data.movimientos);
      }
      setResumen(data.resumen);
      setTotalPaginas(data.total_paginas);
      setPagina(page);
      setError('');
    } catch {
      setError('No se pudo cargar el historial');
    } finally {
      setCargando(false);
      setCargandoMas(false);
    }
  }, [clienteId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set('cliente_id', clienteId);
        params.set('limite', '15');
        params.set('pagina', '1');
        if (filtroTipo !== 'todos') params.set('tipo', filtroTipo);
        if (fechaDesde) params.set('desde', fechaDesde);
        if (fechaHasta) params.set('hasta', fechaHasta);

        const response = await fetch(`/api/clientes/${clienteId}/historial?${params.toString()}`);
        if (!active) return;
        if (!response.ok) throw new Error('Error al cargar historial');
        const data: HistorialResponse = await response.json();
        if (!active) return;
        setMovimientos(data.movimientos);
        setResumen(data.resumen);
        setTotalPaginas(data.total_paginas);
        setPagina(1);
        setError('');
      } catch {
        if (active) setError('No se pudo cargar el historial');
      } finally {
        if (active) setCargando(false);
      }
    })();
    return () => { active = false; };
  }, [filtroTipo, fechaDesde, fechaHasta, clienteId]);

  const aplicarFiltro = () => {
    setPagina(1);
    setCargando(true);
    cargarHistorial(filtroTipo, fechaDesde || undefined, fechaHasta || undefined, 1, false);
  };

  const cargarMas = () => {
    if (pagina < totalPaginas) {
      setCargandoMas(true);
      cargarHistorial(filtroTipo, fechaDesde || undefined, fechaHasta || undefined, pagina + 1, true);
    }
  };

  const cambiarTipo = (tipo: FilterTipo) => {
    setFiltroTipo(tipo);
    setPagina(1);
  };

  const gruposPorMes = (movs: Movimiento[]): Record<string, Movimiento[]> => {
    const grupos: Record<string, Movimiento[]> = {};
    movs.forEach(m => {
      const fecha = new Date(m.created_at);
      const mes = fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' }).toUpperCase();
      if (!grupos[mes]) grupos[mes] = [];
      grupos[mes].push(m);
    });
    return grupos;
  };

  const grupos = gruposPorMes(movimientos);

  const toggleActivo = filtroTipo === 'todos' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700';
  const toggleFiado = filtroTipo === 'fiados' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700';
  const toggleAbono = filtroTipo === 'abonos' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/clientes/${clienteId}`)}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Historial</h1>
      </div>

      {resumen && (
        <Card className="p-4 bg-slate-50">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Total fiado</p>
              <p className="text-lg font-bold text-red-600">{formatearMoneda(resumen.total_fiado)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total abonado</p>
              <p className="text-lg font-bold text-green-600">{formatearMoneda(resumen.total_abonado)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">SALDO ACTUAL</p>
            <p className={`text-2xl font-bold ${resumen.saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatearMoneda(resumen.saldo)}
            </p>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <p className="text-sm font-medium text-gray-500 mb-3">Filtrar por tipo</p>
        <div className="flex gap-2">
          <button
            onClick={() => cambiarTipo('todos')}
            className={`flex-1 h-12 rounded-lg font-medium text-sm transition-colors ${toggleActivo}`}
          >
            Todos
          </button>
          <button
            onClick={() => cambiarTipo('fiados')}
            className={`flex-1 h-12 rounded-lg font-medium text-sm transition-colors ${toggleFiado}`}
          >
            Fiados
          </button>
          <button
            onClick={() => cambiarTipo('abonos')}
            className={`flex-1 h-12 rounded-lg font-medium text-sm transition-colors ${toggleAbono}`}
          >
            Abonos
          </button>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium text-gray-500 mb-3">Periodo</p>
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full h-12 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full h-12 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <Button onClick={aplicarFiltro} className="h-12 mt-5" size="sm">
            Aplicar
          </Button>
        </div>
      </Card>

      {cargando && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-16 bg-gray-200 rounded" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-center">{error}</p>
        </Card>
      )}

      {!cargando && !error && movimientos.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-500">
            {fechaDesde || fechaHasta
              ? 'No hay movimientos en el periodo seleccionado.'
              : 'No hay movimientos registrados para este cliente.'}
          </p>
          {(fechaDesde || fechaHasta) && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => { setFechaDesde(''); setFechaHasta(''); }}
            >
              Limpiar filtros
            </Button>
          )}
        </Card>
      )}

      {!cargando && !error && Object.keys(grupos).length > 0 && (
        <div className="space-y-6">
          {Object.entries(grupos).map(([mes, movs]) => (
            <div key={mes}>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">{mes}</h3>
              <div className="space-y-3">
                {movs.map(mov => {
                  if (mov.tipo === 'fiado') {
                    return (
                      <Card key={mov.id} className="p-3 border-l-4 border-red-400">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-red-500 font-bold">🔴</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {formatearFechaCorta(mov.created_at)} — {formatearHora(mov.created_at)}
                              </p>
                              <p className="text-xs text-gray-500">Fiado {formatearMoneda(mov.total || 0)}</p>
                            </div>
                          </div>
                          <p className="font-bold text-red-600">{formatearMoneda(mov.total || 0)}</p>
                        </div>
                        {mov.detalles && mov.detalles.length > 0 && (
                          <p className="text-sm text-gray-600">
                            {mov.detalles.map(d => `${d.producto} x${d.cantidad}`).join(', ')}
                          </p>
                        )}
                        {mov.quien_pidio === 'familiar' && mov.familiar && (
                          <p className="text-xs text-gray-500">Pidió: {mov.familiar}</p>
                        )}
                        {mov.quien_pidio === 'cliente' && (
                          <p className="text-xs text-gray-500">Pidió: cliente</p>
                        )}
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs text-gray-400">Reg: {mov.usuario_nombre}</p>
                          {mov.puede_cancelar && <Badge variant="danger">Cancelable</Badge>}
                        </div>
                      </Card>
                    );
                  } else {
                    return (
                      <Card key={mov.id} className="p-3 border-l-4 border-green-400">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-green-500 font-bold">🟢</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {formatearFechaCorta(mov.created_at)} — {formatearHora(mov.created_at)}
                              </p>
                              <p className="text-xs text-gray-500">Abono {formatearMoneda(mov.monto || 0)}</p>
                            </div>
                          </div>
                          <p className="font-bold text-green-600">{formatearMoneda(mov.monto || 0)}</p>
                        </div>
                        {mov.metodo_pago && (
                          <p className="text-sm text-gray-600 capitalize">{mov.metodo_pago}</p>
                        )}
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs text-gray-400">Reg: {mov.usuario_nombre}</p>
                        </div>
                        {mov.nota && (
                          <p className="text-xs text-gray-400 mt-1 italic">&ldquo;{mov.nota}&rdquo;</p>
                        )}
                      </Card>
                    );
                  }
                })}
              </div>
            </div>
          ))}

          {pagina < totalPaginas && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={cargarMas}
                disabled={cargandoMas}
                className="min-w-48"
              >
                {cargandoMas ? 'Cargando...' : 'Cargar más'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}