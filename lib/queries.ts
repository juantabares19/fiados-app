import { supabaseAdmin } from '@/lib/supabase/server';
import { QUERY_LIMIT_DEFAULT } from '@/lib/constants';
import type { ClienteConSaldo } from '@/lib/types';
import type { ClienteRelacion, UsuarioRelacion } from '@/lib/database.types';

export async function getClientes(buscar?: string, filtro?: string): Promise<ClienteConSaldo[]> {
  let query = supabaseAdmin
    .from('clientes')
    .select('*')
    .order('nombre', { ascending: true });

  if (filtro === 'bloqueados') {
    query = query.eq('estado', 'bloqueado');
  } else {
    query = query.eq('estado', 'activo');
  }

  if (buscar?.trim()) {
    const searchTerm = `%${buscar.trim()}%`;
    query = query.or(`nombre.ilike.${searchTerm},apodo.ilike.${searchTerm}`);
  }

  const { data: clientes, error } = await query;
  if (error) throw error;

  const clienteIds = (clientes || []).map(c => c.id);
  const saldosMap: Record<string, number> = {};
  if (clienteIds.length > 0) {
    const { data: saldos } = await supabaseAdmin
      .from('saldos_clientes')
      .select('id, saldo')
      .in('id', clienteIds);
    (saldos || []).forEach(s => { saldosMap[s.id] = s.saldo || 0; });
  }

  let result: ClienteConSaldo[] = (clientes || []).map(cliente => ({
    ...cliente,
    saldo: saldosMap[cliente.id] || 0,
  }));

  if (filtro === 'con_deuda') result = result.filter(c => c.saldo > 0);
  else if (filtro === 'al_dia') result = result.filter(c => c.saldo === 0);

  return result;
}

export interface FiadoRaw {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  usuario_nombre: string;
  usuario_id: string;
  quien_pidio: 'cliente' | 'familiar';
  familiar: string | null;
  nota: string | null;
  total: number;
  created_at: string;
  detalles: Array<{
    id: string;
    producto: string;
    cantidad: number;
    valor_unitario: number;
    subtotal: number;
  }>;
}

export async function getFiados(): Promise<FiadoRaw[]> {
  const { data, error } = await supabaseAdmin
    .from('fiados')
    .select(`
      id, cliente_id, quien_pidio, familiar, nota, total, created_at, usuario_id,
      clientes!inner(nombre),
      usuarios!inner(nombre),
      fiado_detalle(id, producto, cantidad, valor_unitario, subtotal)
    `)
    .order('created_at', { ascending: false })
    .limit(QUERY_LIMIT_DEFAULT);

  if (error) throw error;

  return (data || []).map(f => ({
    id: f.id,
    cliente_id: f.cliente_id,
    cliente_nombre: (f.clientes as ClienteRelacion | null)?.nombre ?? '',
    usuario_nombre: (f.usuarios as UsuarioRelacion | null)?.nombre ?? '',
    usuario_id: f.usuario_id,
    quien_pidio: f.quien_pidio as 'cliente' | 'familiar',
    familiar: f.familiar,
    nota: f.nota,
    total: f.total,
    created_at: f.created_at,
    detalles: (f.fiado_detalle as Array<{ id: string; producto: string; cantidad: number; valor_unitario: number; subtotal: number }> | null) || [],
  }));
}
