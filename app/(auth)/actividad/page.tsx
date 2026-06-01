'use client';

import { SoloDueño } from '@/components/auth/SoloDueño';
import { Card } from '@/components/ui/Card';

export default function ActividadPage() {
  return (
    <SoloDueño>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Actividad Diaria</h1>
        <Card className="p-8 text-center">
          <p className="text-gray-500">Página de actividad en desarrollo</p>
        </Card>
      </div>
    </SoloDueño>
  );
}