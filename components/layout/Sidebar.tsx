'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { NavLinks } from './NavLinks';

interface SidebarProps {
  userRole: 'dueño' | 'tendero';
  userName: string;
  onLogout: () => void;
}

export function Sidebar({ userRole, userName, onLogout }: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
      <aside
        className="hidden lg:flex fixed top-0 left-0 z-30 h-screen w-64 flex-col bg-white border-r border-gray-200"
        aria-label="Navegación principal"
      >
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-semibold text-lg">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">{userRole === 'dueño' ? 'Dueño' : 'Tendero'}</p>
              <p className="font-semibold text-gray-900 truncate">{userName}</p>
            </div>
          </div>
        </div>

        <NavLinks userRole={userRole} className="flex-1 overflow-y-auto p-3" />

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-red-600 font-medium hover:bg-red-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="Cerrar sesión"
        confirmText="Cerrar sesión"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
      >
        ¿Estás seguro de que deseas cerrar sesión?
      </Modal>
    </>
  );
}
