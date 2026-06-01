'use client';

import { ClienteConSaldo } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatearMoneda } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ClienteCardProps {
  cliente: ClienteConSaldo;
  onClick?: (cliente: ClienteConSaldo) => void;
  mostrarAcciones?: boolean;
}

export function ClienteCard({ cliente, onClick, mostrarAcciones = true }: ClienteCardProps) {
  const tieneSaldo = cliente.saldo > 0;
  const estaBloqueado = cliente.estado === 'bloqueado';

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-shadow hover:shadow-md',
        estaBloqueado && 'opacity-75'
      )}
      onClick={() => onClick?.(cliente)}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">
            {cliente.nombre}
            {cliente.apodo && (
              <span className="text-gray-500 font-normal ml-1">
                ({cliente.apodo})
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.036 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {cliente.celular.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
          </p>
        </div>
        {estaBloqueado ? (
          <Badge variant="neutral">BLOQUEADO</Badge>
        ) : tieneSaldo ? (
          <Badge variant="danger">{formatearMoneda(cliente.saldo)}</Badge>
        ) : (
          <Badge variant="success">Al día</Badge>
        )}
      </div>

      {mostrarAcciones && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Tope: <span className="font-medium text-gray-700">{formatearMoneda(cliente.tope_credito)}</span>
          </p>
        </div>
      )}
    </Card>
  );
}