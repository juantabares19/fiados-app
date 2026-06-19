import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';
import type { ClienteRelacion, UsuarioRelacion } from '@/lib/database.types';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const tenderoId = searchParams.get('tendero');

    const supabase = supabaseAdmin;

    let fechaActual = fecha;
    let fechaInicio: string | undefined;
    let fechaFin: string | undefined;

    if (desde && hasta) {
      fechaInicio = `${desde}T00:00:00`;
      fechaFin = `${hasta}T23:59:59`;
      fechaActual = `${desde} a ${hasta}`;
    } else if (fecha) {
      fechaInicio = `${fecha}T00:00:00`;
      fechaFin = `${fecha}T23:59:59`;
    } else {
      const hoy = new Date().toISOString().split('T')[0];
      fechaInicio = `${hoy}T00:00:00`;
      fechaFin = `${hoy}T23:59:59`;
      fechaActual = hoy;
    }

    const movimientos: Array<{
      tipo: 'fiado' | 'abono';
      id: string;
      hora: string;
      cliente_nombre: string;
      cliente_id: string;
      descripcion?: string;
      total?: number;
      monto?: number;
      quien_pidio?: 'cliente' | 'familiar';
      familiar?: string | null;
      metodo_pago?: string;
      usuario_nombre: string;
      usuario_id: string;
    }> = [];

    let totalFiado = 0;
    let totalAbonado = 0;
    const porTendero: Record<string, {
      usuario_nombre: string;
      usuario_id: string;
      fiados_registrados: number;
      total_fiado: number;
      abonos_registrados: number;
      total_abonado: number;
    }> = {};

    const { data: fiados } = await supabase
      .from('fiados')
      .select(`
        id,
        created_at,
        total,
        quien_pidio,
        familiar,
        cliente_id,
        usuario_id,
        clientes!inner(nombre),
        usuarios!inner(id, nombre)
      `)
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin!)
      .order('created_at', { ascending: false });

    if (fiados) {
      const fiadoIds = fiados.map(f => f.id);
      const { data: detalles } = await supabase
        .from('fiado_detalle')
        .select('fiado_id, producto')
        .in('fiado_id', fiadoIds);

      const detallesPorFiado: Record<string, string[]> = {};
      (detalles || []).forEach(d => {
        if (!detallesPorFiado[d.fiado_id]) detallesPorFiado[d.fiado_id] = [];
        detallesPorFiado[d.fiado_id].push(d.producto);
      });

      fiados.forEach(f => {
        const usuarioId = (f.usuarios as unknown as UsuarioRelacion | null)?.id ?? '';
        const usuarioNombre = (f.usuarios as unknown as UsuarioRelacion | null)?.nombre ?? '';
        const clienteNombre = (f.clientes as unknown as ClienteRelacion | null)?.nombre ?? '';

        if (tenderoId && usuarioId !== tenderoId) return;

        const descripcion = (detallesPorFiado[f.id] || []).join(', ');
        const hora = new Date(f.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

        movimientos.push({
          tipo: 'fiado',
          id: f.id,
          hora,
          cliente_nombre: clienteNombre,
          cliente_id: f.cliente_id,
          descripcion,
          total: f.total,
          quien_pidio: f.quien_pidio,
          familiar: f.familiar,
          usuario_nombre: usuarioNombre,
          usuario_id: usuarioId,
        });

        totalFiado += f.total;

        if (!porTendero[usuarioId]) {
          porTendero[usuarioId] = { usuario_nombre: usuarioNombre, usuario_id: usuarioId, fiados_registrados: 0, total_fiado: 0, abonos_registrados: 0, total_abonado: 0 };
        }
        porTendero[usuarioId].fiados_registrados++;
        porTendero[usuarioId].total_fiado += f.total;
      });
    }

    const { data: abonos } = await supabase
      .from('abonos')
      .select(`
        id,
        created_at,
        monto,
        metodo_pago,
        cliente_id,
        usuario_id,
        clientes!inner(nombre),
        usuarios!inner(id, nombre)
      `)
      .gte('created_at', fechaInicio)
      .lte('created_at', fechaFin!)
      .order('created_at', { ascending: false });

    if (abonos) {
      abonos.forEach(a => {
        const usuarioId = (a.usuarios as unknown as UsuarioRelacion | null)?.id ?? '';
        const usuarioNombre = (a.usuarios as unknown as UsuarioRelacion | null)?.nombre ?? '';
        const clienteNombre = (a.clientes as unknown as ClienteRelacion | null)?.nombre ?? '';

        if (tenderoId && usuarioId !== tenderoId) return;

        const hora = new Date(a.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

        movimientos.push({
          tipo: 'abono',
          id: a.id,
          hora,
          cliente_nombre: clienteNombre,
          cliente_id: a.cliente_id,
          monto: a.monto,
          metodo_pago: a.metodo_pago,
          usuario_nombre: usuarioNombre,
          usuario_id: usuarioId,
        });

        totalAbonado += a.monto;

        if (!porTendero[usuarioId]) {
          porTendero[usuarioId] = { usuario_nombre: usuarioNombre, usuario_id: usuarioId, fiados_registrados: 0, total_fiado: 0, abonos_registrados: 0, total_abonado: 0 };
        }
        porTendero[usuarioId].abonos_registrados++;
        porTendero[usuarioId].total_abonado += a.monto;
      });
    }

    movimientos.sort((a, b) => {
      const dateA = new Date(`${fechaActual}T${a.hora}`);
      const dateB = new Date(`${fechaActual}T${b.hora}`);
      return dateB.getTime() - dateA.getTime();
    });

    const resumen = {
      cantidad_fiados: movimientos.filter(m => m.tipo === 'fiado').length,
      total_fiado: totalFiado,
      cantidad_abonos: movimientos.filter(m => m.tipo === 'abono').length,
      total_abonado: totalAbonado,
      balance: totalAbonado - totalFiado,
    };

    return NextResponse.json({
      fecha: fechaActual,
      resumen,
      movimientos,
      por_tendero: Object.values(porTendero),
    });
  } catch (error) {
    console.error('GET /api/actividad error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}