'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface Usuario {
  id: string;
  nombre: string;
  celular: string;
  rol: 'dueño' | 'tendero';
}

interface UsuarioContextType {
  usuario: Usuario | null;
  cargando: boolean;
  esDueño: boolean;
  cerrarSesion: () => Promise<void>;
}

const UsuarioContext = createContext<UsuarioContextType | undefined>(undefined);

export function UsuarioProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();

  const esDueño = usuario?.rol === 'dueño';

  const cerrarSesion = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUsuario(null);
      router.push('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }, [router]);

  useEffect(() => {
    const obtenerUsuario = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUsuario(data.usuario);
        } else {
          setUsuario(null);
        }
      } catch {
        setUsuario(null);
      } finally {
        setCargando(false);
      }
    };

    obtenerUsuario();
  }, []);

  return (
    <UsuarioContext.Provider value={{ usuario, cargando, esDueño, cerrarSesion }}>
      {children}
    </UsuarioContext.Provider>
  );
}

export function useUsuario() {
  const context = useContext(UsuarioContext);
  if (context === undefined) {
    return {
      usuario: null,
      cargando: true,
      esDueño: false,
      cerrarSesion: async () => {},
    };
  }
  return context;
}