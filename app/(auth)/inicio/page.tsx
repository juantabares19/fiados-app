'use client';

import { useEffect, useState } from 'react';
import { useUsuario } from '@/hooks/useUsuario';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatearFecha, formatearMoneda } from '@/lib/utils';

interface ResumenHoy {
  fiados_hoy: number;
  total_fiado_hoy: number;
  abonos_hoy: number;
  total_abonado_hoy: number;
  cartera_total: number;
  clientes_con_deuda: number;
}

export default function InicioPage() {
  const { usuario, esDueño } = useUsuario();
  const [currentDate, setCurrentDate] = useState('');
  const [resumen, setResumen] = useState<ResumenHoy | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  useEffect(() => {
    setCurrentDate(formatearFecha(new Date().toISOString()));
  }, []);

  useEffect(() => {
    const cargarResumen = async () => {
      setCargandoResumen(true);
      try {
        const response = await fetch('/api/resumen/hoy');
        if (response.ok) {
          const data = await response.json();
          setResumen(data);
        }
      } catch {
      } finally {
        setCargandoResumen(false);
      }
    };
    cargarResumen();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold text-gray-900">¡Bienvenido, {usuario?.nombre}!</h2>
        <p className="text-gray-500 mt-1">{currentDate}</p>
      </div>

      <div className="space-y-4">
        <Button
          variant="primary"
          className="w-full h-16 text-lg"
          onClick={() => window.location.href = '/fiados'}
        >
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nuevo Fiado
        </Button>

        <Button
          variant="success"
          className="w-full h-16 text-lg"
          onClick={() => window.location.href = '/abonos'}
        >
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Registrar Abono
        </Button>

        <Button
          variant="outline"
          className="w-full h-16 text-lg"
          onClick={() => window.location.href = '/clientes'}
        >
          <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Buscar Cliente
        </Button>
      </div>

      {cargandoResumen ? (
        <Card className="mt-8 p-4 animate-pulse">
          <div className="h-8 bg-gray-200 rounded mx-auto w-48" />
        </Card>
      ) : resumen ? (
        <Card className="mt-8">
          <div className="text-center text-gray-500">
            <p className="text-sm">
              Hoy: <span className="font-semibold text-gray-900">{resumen.fiados_hoy}</span> fiados
              {' | '}
              <span className="font-semibold text-gray-900">{resumen.abonos_hoy}</span> abonos
            </p>
            {esDueño && (
              <p className="text-sm mt-1">
                Cartera: <span className="font-semibold text-blue-600">{formatearMoneda(resumen.cartera_total)}</span>
                {' | '}
                <span className="font-semibold text-gray-900">{resumen.clientes_con_deuda}</span> con deuda
              </p>
            )}
          </div>
        </Card>
      ) : (
        <Card className="mt-8">
          <div className="text-center text-gray-500">
            <p className="text-sm">
              Hoy: <span className="font-semibold text-gray-900">0</span> fiados
              {' | '}
              <span className="font-semibold text-gray-900">0</span> abonos
            </p>
          </div>
        </Card>
      )}

      {esDueño && (
        <>
          <div className="pt-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Accesos rápidos</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => window.location.href = '/clientes/saldos'}
              >
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {resumen ? formatearMoneda(resumen.cartera_total) : '...'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Cartera</p>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => window.location.href = '/clientes'}
              >
                <div className="text-center">
                  <p className="text-3xl font-bold text-orange-600">{resumen?.clientes_con_deuda || '...'}</p>
                  <p className="text-sm text-gray-500 mt-1">Morosos</p>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => window.location.href = '/actividad'}
              >
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{resumen?.fiados_hoy || '...'}</p>
                  <p className="text-sm text-gray-500 mt-1">Hoy</p>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => window.location.href = '/metricas'}
              >
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">→</p>
                  <p className="text-sm text-gray-500 mt-1">Métricas</p>
                </div>
              </Card>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 text-base mt-4"
            onClick={() => window.location.href = '/configuracion'}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configuración
          </Button>
        </>
      )}
    </div>
  );
}