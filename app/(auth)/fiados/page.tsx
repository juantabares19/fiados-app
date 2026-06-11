import { Suspense } from 'react';
import { getFiados } from '@/lib/queries';
import { FiadosList } from './FiadosList';
import { Card } from '@/components/ui/Card';

function FiadosLoadingFallback() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4 animate-pulse">
          <div className="h-20 bg-gray-200 rounded-lg" />
        </Card>
      ))}
    </div>
  );
}

async function FiadosContent() {
  const fiados = await getFiados();
  return <FiadosList initialFiados={fiados} />;
}

export default function FiadosPage() {
  return (
    <Suspense fallback={<FiadosLoadingFallback />}>
      <FiadosContent />
    </Suspense>
  );
}
