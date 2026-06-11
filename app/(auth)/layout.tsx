'use client';

import { useState, useCallback } from 'react';
import { useUsuario } from '@/hooks/useUsuario';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { UsuarioProvider } from '@/hooks/useUsuario';
import { ConfigProvider } from '@/contexts/ConfigContext';

function AuthLayoutInner({ children }: { children: React.ReactNode }) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const { usuario, cerrarSesion } = useUsuario();

  const handleLogout = useCallback(async () => {
    setIsNavOpen(false);
    await cerrarSesion();
  }, [cerrarSesion]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={usuario?.nombre || 'Usuario'} onMenuClick={() => setIsNavOpen(true)} />
      <MobileNav
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        userRole={usuario?.rol || 'tendero'}
        userName={usuario?.nombre || 'Usuario'}
        onLogout={handleLogout}
      />
      <main className="p-4 pb-24">
        {children}
      </main>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <UsuarioProvider>
      <ConfigProvider>
        <AuthLayoutInner>{children}</AuthLayoutInner>
      </ConfigProvider>
    </UsuarioProvider>
  );
}