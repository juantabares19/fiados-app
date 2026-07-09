'use client';

import { cn } from '@/lib/utils';

interface HeaderProps {
  userName?: string;
  onMenuClick: () => void;
}

export function Header({ userName = 'Usuario', onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 lg:px-8">
      <div className="flex items-center justify-between mx-auto max-w-6xl">
        <div>
          <p className="text-sm text-gray-500">Hola,</p>
          <h1 className="text-xl font-semibold text-gray-900 truncate max-w-[200px]">{userName}</h1>
        </div>
        <button
          onClick={onMenuClick}
          className={cn(
            'w-12 h-12 flex items-center justify-center rounded-xl',
            'bg-gray-100 hover:bg-gray-200 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            'lg:hidden'
          )}
          aria-label="Abrir menú"
        >
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}