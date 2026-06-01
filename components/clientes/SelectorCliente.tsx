'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClienteConSaldo } from '@/lib/types';
import { ClienteCard } from './ClienteCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

interface SelectorClienteProps {
  onSeleccionar: (cliente: ClienteConSaldo) => void;
  clientePreseleccionadoId?: string;
}

export function SelectorCliente({ onSeleccionar, clientePreseleccionadoId }: SelectorClienteProps) {
  const [buscar, setBuscar] = useState('');
  const [clientes, setClientes] = useState<ClienteConSaldo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const buscarClientes = useCallback(async (termino: string) => {
    setCargando(true);
    setError('');
    try {
      const params = termino ? `?buscar=${encodeURIComponent(termino)}` : '';
      const response = await fetch(`/api/clientes${params}`);
      if (!response.ok) throw new Error('Error al buscar clientes');
      const data = await response.json();
      setClientes(data);
    } catch (err) {
      setError('No se pudieron cargar los clientes');
      setClientes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      buscarClientes(buscar);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [buscar, buscarClientes]);

  const clientesFiltrados = clientePreseleccionadoId
    ? clientes.filter(c => c.id !== clientePreseleccionadoId)
    : clientes;

  return (
    <div className="space-y-4">
      <SearchInput
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        placeholder="Buscar por nombre o apodo..."
      />

      {cargando && (
        <div className="flex justify-center py-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-sm text-center">{error}</p>
        </Card>
      )}

      {!cargando && clientesFiltrados.length === 0 && buscar && (
        <Card className="p-6 text-center">
          <p className="text-gray-500 mb-4">No hay clientes que coincidan con "{buscar}"</p>
          <Link href="/clientes/nuevo">
            <Button variant="outline" size="sm">
              + Registrar cliente nuevo
            </Button>
          </Link>
        </Card>
      )}

      <div className="space-y-3">
        {clientesFiltrados.map((cliente) => (
          <ClienteCard
            key={cliente.id}
            cliente={cliente}
            onClick={onSeleccionar}
            mostrarAcciones={false}
          />
        ))}
      </div>

      {clientesFiltrados.length === 0 && !buscar && (
        <div className="text-center py-4">
          <p className="text-gray-500 mb-4">No hay clientes registrados</p>
          <Link href="/clientes/nuevo">
            <Button>+ Agregar cliente</Button>
          </Link>
        </div>
      )}
    </div>
  );
}