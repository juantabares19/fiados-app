import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';
import { inicioDia, finDia } from '@/lib/fechas';
import { parseEntero } from '@/lib/validation';
import { puedeCancelarFiado } from '@/lib/fiados';
import type { UsuarioRelacion } from '@/lib/database.types';

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ('error' in auth) return auth.error;
    const { usuario } = auth;

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('cliente_id');

    if (!clienteId) {
      return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 });
    }

    const limite = Math.min(100, Math.max(1, parseEntero(searchParams.get('limite'), 50)));
    const pagina = Math.max(1, parseEntero(searchParams.get('pagina'), 1));
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

    const desdeFecha = desde ? inicioDia(desde) : undefined;
    const hastaFecha = hasta ? finDia(hasta) : undefined;

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
      const queryFiados = supabase
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