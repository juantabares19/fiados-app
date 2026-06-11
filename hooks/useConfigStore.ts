'use client';

import { useState, useEffect } from 'react';

interface ConfigStore {
  nombreTienda: string;
  cargando: boolean;
}

export function useConfigStore() {
  const [config, setConfig] = useState<ConfigStore>({ nombreTienda: 'Mi Tienda', cargando: true });

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const response = await fetch('/api/configuracion');
        if (response.ok) {
          const data = await response.json();
          setConfig({ nombreTienda: data.nombre_tienda || 'Mi Tienda', cargando: false });
        } else {
          setConfig({ nombreTienda: 'Mi Tienda', cargando: false });
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
        setConfig({ nombreTienda: 'Mi Tienda', cargando: false });
      }
    };
    cargarConfig();
  }, []);

  return config;
}