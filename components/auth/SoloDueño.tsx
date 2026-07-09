'use client';

import { useUsuario } from '@/state/useUsuario';
import { Card } from '@/components/ui/Card';

export function SoloDueño({ children }: { children: React.ReactNode }) {
  const { usuario, esDueño } = useUsuario();

  if (!usuario) {
    return null;
  }

  if (!esDueño) {
    return (
      <div className="p-4">
        <Card className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso restringido</h2>
          <p className="text-gray-500">No tienes permiso para ver esta sección.</p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}