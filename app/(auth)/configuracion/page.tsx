'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SoloDueño } from '@/components/auth/SoloDueño';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatearMoneda } from '@/lib/utils';

interface Configuracion {
  nombre_tienda: string;
  [key: string]: string;
}

function ConfiguracionContent() {
  const router = useRouter();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [nombreTienda, setNombreTienda] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const response = await fetch('/api/configuracion');
        if (response.ok) {
          const data: Configuracion = await response.json();
          setConfig(data);
          setNombreTienda(data.nombre_tienda || 'Mi Tienda');
        }
      } catch (err) {
        console.error('Error cargando config:', err);
      }
    };
    cargarConfig();
  }, []);

  const handleGuardar = async () => {
    setGuardando(true);
    setMensaje('');
    try {
      const response = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: 'nombre_tienda', valor: nombreTienda }),
      });
      if (response.ok) {
        setMensaje('Cambios guardados');
        setTimeout(() => setMensaje(''), 3000);
      } else {
        setMensaje('Error al guardar');
      }
    } catch (err) {
      setMensaje('Error al guardar');
    } finally {
      setGuardando(false);
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
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-700">Información de la tienda</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de la tienda
          </label>
          <input
            type="text"
            value={nombreTienda}
            onChange={(e) => setNombreTienda(e.target.value)}
            className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none text-lg"
            placeholder="Mi Tienda"
          />
          <p className="text-xs text-gray-400 mt-1">
            Este nombre aparece en los mensajes de WhatsApp
          </p>
        </div>

        <Button
          className="w-full h-12"
          onClick={handleGuardar}
          disabled={guardando || !nombreTienda.trim()}
        >
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </Button>

        {mensaje && (
          <p className={`text-center text-sm ${mensaje.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {mensaje}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Acerca de</h2>
        <div className="space-y-2 text-sm text-gray-500">
          <p><span className="font-medium">Versión:</span> 1.0.0</p>
          <p><span className="font-medium">Desarrollado para:</span> Tienda de barrio</p>
        </div>
      </Card>
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <SoloDueño>
      <ConfiguracionContent />
    </SoloDueño>
  );
}