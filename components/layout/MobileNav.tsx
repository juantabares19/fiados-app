'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { NavLinks } from './NavLinks';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: 'dueño' | 'tendero';
  userName?: string;
  onLogout: () => void;
}

export function MobileNav({
  isOpen,
  onClose,
  userRole = 'tendero',
  userName = 'Usuario',
  onLogout,
}: MobileNavProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out',
          'flex flex-col lg:hidden',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-label="Menú de navegación"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-white font-semibold text-lg">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{userRole === 'dueño' ? 'Dueño' : 'Tendero'}</p>
                <p className="font-semibold text-gray-900 truncate max-w-[140px]">{userName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Cerrar menú"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <NavLinks userRole={userRole} onNavigate={onClose} className="flex-1 overflow-y-auto p-4" />

        <div className="p-4 border-t border-gray-200">
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
      </nav>

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
