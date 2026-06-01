'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useUsuario } from '@/hooks/useUsuario';
import { formatearMoneda, formatearFechaCorta, formatearFecha, formatearHora } from '@/lib/utils';

interface Abono {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  usuario_id: string;
  usuario_nombre: string;
  monto: number;
  metodo_pago: string;
  nota: string | null;
  created_at: string;
}

interface AbonosAgrupados {
  [key: string]: Abono[];
}

const METODOS_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  llaves: 'Llaves',
  otro: 'Otro',
};

export default function AbonosPage() {
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abonoAEliminar, setAbonoAEliminar] = useState<Abono | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const { esDueño } = useUsuario();
  const router = useRouter();

  const cargarAbonos = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const response = await fetch('/api/abonos');
      if (!response.ok) throw new Error('Error al obtener abonos');
      const data = await response.json();
      setAbonos(data);
    } catch (err) {
      setError('No se pudieron cargar los abonos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarAbonos();
  }, [cargarAbonos]);

  const handleEliminar = async () => {
    if (!abonoAEliminar) return;
    setEliminando(true);
    try {
      const response = await fetch(`/api/abonos/${abonoAEliminar.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar');
      }
      setAbonoAEliminar(null);
      cargarAbonos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar abono');
    } finally {
      setEliminando(false);
    }
  };

  const agruparPorDia = (abonos: Abono[]): AbonosAgrupados => {
    const grupos: AbonosAgrupados = {};
    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    abonos.forEach((abono) => {
      const fecha = abono.created_at.split('T')[0];
      let label = formatearFechaCorta(fecha);

      if (fecha === hoy) label = `Hoy, ${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`;
      else if (fecha === ayer) label = `Ayer, ${new Date(Date.now() - 86400000).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}`;
      else label = formatearFecha(fecha);

      if (!grupos[label]) grupos[label] = [];
      grupos[label].push(abono);
    });

    return grupos;
  };

  const abonosAgrupados = agruparPorDia(abonos);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Abonos</h1>
        <Button size="sm" onClick={() => router.push('/abonos/nuevo')}>
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Registrar
        </Button>
      </div>

      {cargando && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-16 bg-gray-200 rounded-lg" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-center">{error}</p>
          <Button variant="outline" className="mt-2 w-full" onClick={cargarAbonos}>
            Reintentar
          </Button>
        </Card>
      )}

      {!cargando && !error && abonos.length === 0 && (
        <EmptyState
          title="No hay abonos registrados"
          description="¡Registra el primer abono de tu tienda!"
          icon={
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          action={
            <Button onClick={() => router.push('/abonos/nuevo')}>+ Registrar abono</Button>
          }
        />
      )}

      {!cargando && !error && abonos.length > 0 && (
        <div className="space-y-6">
          {Object.entries(abonosAgrupados).map(([fecha, abonosDelDia]) => (
            <div key={fecha}>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">{fecha}</h2>
              <div className="space-y-3">
                {abonosDelDia.map((abono) => (
                  <Card
                    key={abono.id}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => router.push(`/clientes/${abono.cliente_id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{abono.cliente_nombre}</p>
                        <p className="text-sm text-gray-500">{formatearHora(abono.created_at)}</p>
                      </div>
                      <p className="text-xl font-bold text-green-600">{formatearMoneda(abono.monto)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="success">{METODOS_LABELS[abono.metodo_pago] || abono.metodo_pago}</Badge>
                      {abono.nota && <span className="text-sm text-gray-400">— {abono.nota}</span>}
                    </div>

                    <p className="text-xs text-gray-400 mt-1">Reg: {abono.usuario_nombre}</p>

                    {esDueño && (
                      <button
                        className="mt-2 text-sm text-red-600 font-medium hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAbonoAEliminar(abono);
                        }}
                      >
                        Eliminar
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
        isOpen={!!abonoAEliminar}
        onClose={() => setAbonoAEliminar(null)}
        title="Eliminar abono"
        confirmText="Sí, eliminar"
        cancelText="No"
        variant="danger"
        onConfirm={handleEliminar}
      >
        {abonoAEliminar && (
          <>
            <p className="mb-2">
              ¿Eliminar este abono de <strong>{formatearMoneda(abonoAEliminar.monto)}</strong> para <strong>{abonoAEliminar.cliente_nombre}</strong>?
            </p>
            <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
          </>
        )}
      </Modal>
    </div>
  );
}