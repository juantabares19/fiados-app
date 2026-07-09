'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ConfigData {
  nombre_tienda: string;
  [key: string]: string;
}

interface ConfigContextType {
  config: ConfigData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/configuracion');
      if (!res.ok) throw new Error('Error al cargar configuración');
      const data = await res.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar configuración:', err);
      setError('No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/configuracion');
        if (!active) return;
        if (!res.ok) throw new Error('Error al cargar configuración');
        const data = await res.json();
        if (!active) return;
        setConfig(data);
        setError(null);
      } catch (err) {
        console.error('Error al cargar configuración:', err);
        if (active) setError('No se pudo cargar la configuración');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, error, refetch: fetchConfig }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig debe usarse dentro de un ConfigProvider');
  }
  return context;
}
