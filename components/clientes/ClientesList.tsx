'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ClienteConSaldo } from '@/lib/types';
import { ClienteCard } from '@/components/clientes/ClienteCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';

type FiltroClientes = 'todos' | 'con_deuda' | 'al_dia' | 'bloqueados';

interface ClientesListProps {
  initialClientes: ClienteConSaldo[];
}

export function ClientesList({ initialClientes }: ClientesListProps) {
  const [clientes, setClientes] = useState<ClienteConSaldo[]>(initialClientes);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<FiltroClientes>('todos');
  const isFirstRender = useRef(true);
  const usuarioInteractuo = useRef(false);
  const router = useRouter();

  const cargarClientes = useCallback(async (termino: string, fil: FiltroClientes) => {
    setCargando(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (termino) params.set('buscar', termino);
      if (fil !== 'todos') params.set('filtro', fil);
      const response = await fetch(`/api/clientes?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Error al obtener clientes');
      const data = await response.json();
      setClientes(data);
    } catch {
      setError('No se pudieron cargar los clientes');
      setClientes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  // Refresco silencioso al montar: initialClientes puede venir del cache de la
  // pagina, asi que tras registrar un fiado/abono los saldos cambian. No mostramos
  // skeleton (mantenemos la lista visible) para evitar parpadeo.
  useEffect(() => {
    let activo = true;
    fetch('/api/clientes', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      // No pisar un filtro/busqueda si el usuario ya empezo a interactuar.
      .then((data) => { if (activo && !usuarioInteractuo.current) setClientes(data); })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    usuarioInteractuo.current = true;
    const timeoutId = setTimeout(() => {
      cargarClientes(buscar, filtro);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [buscar, filtro, cargarClientes]);

  const handleClienteClick = (cliente: ClienteConSaldo) => {
    router.push(`/clientes/${cliente.id}`);
  };

  const toggleActivo = filtro === 'todos' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200';
  const toggleDeuda = filtro === 'con_deuda' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200';
  const toggleAlDia = filtro === 'al_dia' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200';
  const toggleBloqueados = filtro === 'bloqueados' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <Link href="/clientes/nuevo">
          <Button size="sm">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuevo
          </Button>
        </Link>
      </div>

      <SearchInput
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        placeholder="Buscar cliente por nombre o apodo..."
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFiltro('todos')} className={`flex-1 min-w-fit h-12 px-4 rounded-lg font-medium text-sm border transition-colors ${toggleActivo}`}>
          Todos
        </button>
        <button onClick={() => setFiltro('con_deuda')} className={`flex-1 min-w-fit h-12 px-4 rounded-lg font-medium text-sm border transition-colors ${toggleDeuda}`}>
          Con deuda
        </button>
        <button onClick={() => setFiltro('al_dia')} className={`flex-1 min-w-fit h-12 px-4 rounded-lg font-medium text-sm border transition-colors ${toggleAlDia}`}>
          Al día
        </button>
        <button onClick={() => setFiltro('bloqueados')} className={`flex-1 min-w-fit h-12 px-4 rounded-lg font-medium text-sm border transition-colors ${toggleBloqueados}`}>
          Bloqueados
        </button>
      </div>

      {cargando && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-16 bg-gray-200 rounded-lg" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-red-600 text-center">{error}</p>
          <Button variant="outline" className="mt-2 w-full" onClick={() => cargarClientes(buscar, filtro)}>
            Reintentar
          </Button>
        </Card>
      )}

      {!cargando && !error && clientes.length === 0 && (
        <EmptyState
          title={
            filtro === 'con_deuda'
              ? 'No hay clientes con deuda'
              : filtro === 'al_dia'
              ? 'No hay clientes al día'
              : filtro === 'bloqueados'
              ? 'No hay clientes bloqueados'
              : 'No hay clientes registrados'
          }
          description="¡Agrega el primero para comenzar a gestionar los fiados de tu tienda!"
          icon={
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          action={
            filtro === 'todos' ? (
              <Link href="/clientes/nuevo">
                <Button>+ Agregar cliente</Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={() => setFiltro('todos')}>
                Ver todos
              </Button>
            )
          }
        />
      )}

      {!cargando && !error && clientes.length > 0 && (
        <div className="space-y-3">
          {clientes.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              onClick={handleClienteClick}
              mostrarAcciones={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
