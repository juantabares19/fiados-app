'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatearMoneda, formatearFecha, formatearFechaCorta, formatearHora } from '@/lib/utils';

interface DetalleProducto {
  id: string;
  producto: string;
  cantidad: number;
  valor_unitario: number;
  subtotal: number;
}

interface Fiado {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  usuario_nombre: string;
  quien_pidio: 'cliente' | 'familiar';
  familiar: string | null;
  nota: string | null;
  total: number;
  created_at: string;
  puede_cancelar: boolean;
  detalles: DetalleProducto[];
}

interface FiadosAgrupados {
  [key: string]: Fiado[];
}

export default function FiadosPage() {
  const [fiados, setFiados] = useState<Fiado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [fiadoACancelar, setFiadoACancelar] = useState<Fiado | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const router = useRouter();

  const cargarFiados = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const response = await fetch('/api/fiados');
      if (!response.ok) throw new Error('Error al obtener fiados');
      const data = await response.json();
      setFiados(data);
    } catch (err) {
      setError('No se pudieron cargar los fiados');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarFiados();
  }, [cargarFiados]);

  const handleCancelarFiado = async () => {
    if (!fiadoACancelar) return;
    setCancelando(true);
    try {
      const response = await fetch(`/api/fiados/${fiadoACancelar.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al cancelar');
      }
      setFiadoACancelar(null);
      cargarFiados();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cancelar fiado');
    } finally {
      setCancelando(false);
    }
  };

  const agruparPorDia = (fiados: Fiado[]): FiadosAgrupados => {
    const grupos: FiadosAgrupados = {};
    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    fiados.forEach((fiado) => {
      const fecha = fiado.created_at.split('T')[0];
      let label = formatearFechaCorta(fecha);

      if (fecha === hoy) label = `Hoy, ${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`;
      else if (fecha === ayer) label = `Ayer, ${new Date(Date.now() - 86400000).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`;
      else label = formatearFecha(fecha);

      if (!grupos[label]) grupos[label] = [];
      grupos[label].push(fiado);
    });

    return grupos;
  };

  const fiadosAgrupados = agruparPorDia(fiados);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Fiados</h1>
        <Button size="sm" onClick={() => router.push('/fiados/nuevo')}>
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo
        </Button>
      </div>

      {cargando && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-20 bg-gray-200 rounded-lg" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-center">{error}</p>
          <Button variant="outline" className="mt-2 w-full" onClick={cargarFiados}>
            Reintentar
          </Button>
        </Card>
      )}

      {!cargando && !error && fiados.length === 0 && (
        <EmptyState
          title="No hay fiados registrados"
          description="¡Registra el primer fiado de tu tienda!"
          icon={
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          action={
            <Button onClick={() => router.push('/fiados/nuevo')}>+ Registrar fiado</Button>
          }
        />
      )}

      {!cargando && !error && fiados.length > 0 && (
        <div className="space-y-6">
          {Object.entries(fiadosAgrupados).map(([fecha, fiadosDelDia]) => (
            <div key={fecha}>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">{fecha}</h2>
              <div className="space-y-3">
                {fiadosDelDia.map((fiado) => (
                  <Card
                    key={fiado.id}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/clientes/${fiado.cliente_id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{fiado.cliente_nombre}</p>
                        <p className="text-sm text-gray-500">{formatearHora(fiado.created_at)}</p>
                      </div>
                      <p className="text-xl font-bold text-red-600">{formatearMoneda(fiado.total)}</p>
                    </div>

                    <p className="text-sm text-gray-600 mb-1">
                      {fiado.detalles.map(d => d.producto).join(', ')}
                    </p>

                    {fiado.quien_pidio === 'familiar' && fiado.familiar && (
                      <p className="text-sm text-gray-500">Pidió: {fiado.familiar}</p>
                    )}

                    <p className="text-xs text-gray-400 mt-1">Reg: {fiado.usuario_nombre}</p>

                    {fiado.puede_cancelar && (
                      <button
                        className="mt-2 text-sm text-red-600 font-medium hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiadoACancelar(fiado);
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!fiadoACancelar}
        onClose={() => setFiadoACancelar(null)}
        title="Cancelar fiado"
        confirmText="Sí, cancelar"
        cancelText="No"
        variant="danger"
        onConfirm={handleCancelarFiado}
      >
        {fiadoACancelar && (
          <>
            <p className="mb-2">
              ¿Cancelar este fiado de <strong>{formatearMoneda(fiadoACancelar.total)}</strong> para <strong>{fiadoACancelar.cliente_nombre}</strong>?
            </p>
            <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
          </>
        )}
      </Modal>
    </div>
  );
}