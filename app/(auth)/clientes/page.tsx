import { Suspense } from 'react';
import { getClientes } from '@/lib/queries';
import { ClientesList } from './ClientesList';
import { Card } from '@/components/ui/Card';

function ClientesLoadingFallback() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4 animate-pulse">
          <div className="h-16 bg-gray-200 rounded-lg" />
        </Card>
      ))}
    </div>
  );
}

async function ClientesContent() {
  const clientes = await getClientes();
  return <ClientesList initialClientes={clientes} />;
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<ClientesLoadingFallback />}>
      <ClientesContent />
    </Suspense>
  );
}
