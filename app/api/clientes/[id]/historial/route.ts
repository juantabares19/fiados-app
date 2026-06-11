import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';
import type { UsuarioRelacion } from '@/lib/database.types';

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['session_token'];
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usuario = await verifyToken(token);
    if (!usuario) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('cliente_id');

    if (!clienteId) {
      return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 });
    }

    const limite = parseInt(searchParams.get('limite') || '50');
    const pagina = parseInt(searchParams.get('pagina') || '1');
    const tipo = searchParams.get('tipo');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const supabase = supabaseAdmin;

    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('id', clienteId)
      .single();

    if (!cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const desdeFecha = desde ? `${desde}T00:00:00` : undefined;
    const hastaFecha = hasta ? `${hasta}T23:59:59` : undefined;

    let totalFiado = 0;
    let totalAbonado = 0;

    if (!tipo || tipo === 'fiado') {
      const { data: sumaFiados } = await supabase
        .from('fiados')
        .select('total')
        .eq('cliente_id', clienteId)
        .gte('created_at', desdeFecha || '1970-01-01T00:00:00')
        .lte('created_at', hastaFecha || '2100-01-01T00:00:00');
      totalFiado = (sumaFiados || []).reduce((sum, f) => sum + (f.total || 0), 0);
    }

    if (!tipo || tipo === 'abono') {
      const { data: sumaAbonos } = await supabase
        .from('abonos')
        .select('monto')
        .eq('cliente_id', clienteId)
        .gte('created_at', desdeFecha || '1970-01-01T00:00:00')
        .lte('created_at', hastaFecha || '2100-01-01T00:00:00');
      totalAbonado = (sumaAbonos || []).reduce((sum, a) => sum + (a.monto || 0), 0);
    }

    const movimientos: Array<{
      tipo: 'fiado' | 'abono';
      id: string;
      total?: number;
      monto?: number;
      quien_pidio?: 'cliente' | 'familiar';
      familiar?: string | null;
      nota?: string | null;
      usuario_nombre: string;
      created_at: string;
      puede_cancelar?: boolean;
      detalles?: Array<{ producto: string; cantidad: number; valor_unitario: number; subtotal: number }>;
      metodo_pago?: string;
    }> = [];

    if (!tipo || tipo === 'fiado') {
      let queryFiados = supabase
        .from('fiados')
        .select(`id, total, quien_pidio, familiar, nota, created_at, usuario_id, usuarios!inner(nombre)`)
        .eq('cliente_id', clienteId)
        .gte('created_at', desdeFecha || '1970-01-01T00:00:00')
        .lte('created_at', hastaFecha || '2100-01-01T00:00:00')
        .order('created_at', { ascending: false });

      const { data: fiados } = await queryFiados;

      if (fiados && fiados.length > 0) {
        const fiadoIds = fiados.map(f => f.id);
        const { data: detallesMap } = await supabase
          .from('fiado_detalle')
          .select('id, producto, cantidad, valor_unitario, subtotal, fiado_id')
          .in('fiado_id', fiadoIds);

        const detallesPorFiado: Record<string, Array<{ producto: string; cantidad: number; valor_unitario: number; subtotal: number }>> = {};
        (detallesMap || []).forEach(d => {
          if (!detallesPorFiado[d.fiado_id]) detallesPorFiado[d.fiado_id] = [];
          detallesPorFiado[d.fiado_id].push({ producto: d.producto, cantidad: d.cantidad, valor_unitario: d.valor_unitario, subtotal: d.subtotal });
        });

        fiados.forEach(f => {
          const puedeCancelar = puedeCancelarFiado(
            { created_at: f.created_at, usuario_id: f.usuario_id },
            usuario.id,
            usuario.rol === 'dueño'
          );
          movimientos.push({
            tipo: 'fiado',
            id: f.id,
            total: f.total,
            quien_pidio: f.quien_pidio,
            familiar: f.familiar,
            nota: f.nota,
            usuario_nombre: (f.usuarios as unknown as UsuarioRelacion | null)?.nombre ?? '',
            created_at: f.created_at,
            puede_cancelar: puedeCancelar,
            detalles: detallesPorFiado[f.id] || [],
          });
        });
      }
    }

    if (!tipo || tipo === 'abono') {
      const { data: abonos } = await supabase
        .from('abonos')
        .select(`id, monto, metodo_pago, nota, created_at, usuarios!inner(nombre)`)
        .eq('cliente_id', clienteId)
        .gte('created_at', desdeFecha || '1970-01-01T00:00:00')
        .lte('created_at', hastaFecha || '2100-01-01T00:00:00')
        .order('created_at', { ascending: false });

      if (abonos) {
        abonos.forEach(a => {
          movimientos.push({
            tipo: 'abono',
            id: a.id,
            monto: a.monto,
            metodo_pago: a.metodo_pago,
            nota: a.nota,
            usuario_nombre: (a.usuarios as unknown as UsuarioRelacion | null)?.nombre ?? '',
            created_at: a.created_at,
          });
        });
      }
    }

    movimientos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalRegistros = movimientos.length;
    const totalPaginas = Math.ceil(totalRegistros / limite);
    const inicio = (pagina - 1) * limite;
    const fin = inicio + limite;
    const movimientosPaginados = movimientos.slice(inicio, fin);

    const { data: saldos } = await supabase
      .from('saldos_clientes')
      .select('saldo')
      .eq('id', clienteId)
      .single();

    const saldoActual = saldos?.saldo || 0;

    return NextResponse.json({
      movimientos: movimientosPaginados,
      total_registros: totalRegistros,
      pagina,
      total_paginas: totalPaginas,
      resumen: {
        total_fiado: totalFiado,
        total_abonado: totalAbonado,
        saldo: saldoActual,
      },
    });
  } catch (error) {
    console.error('GET /api/clientes/[id]/historial error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

function puedeCancelarFiado(
  fiado: { created_at: string; usuario_id: string },
  usuarioId: string,
  esDueño: boolean
): boolean {
  if (esDueño) return true;
  const cincoMinutos = 5 * 60 * 1000;
  const hace5Min = new Date(Date.now() - cincoMinutos);
  const creado = new Date(fiado.created_at);
  return creado > hace5Min && fiado.usuario_id === usuarioId;
}