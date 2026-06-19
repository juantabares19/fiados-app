import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if ('error' in auth) return auth.error;

    const supabase = supabaseAdmin;

    const hoy = new Date();
    const startOfDay = `${hoy.toISOString().split('T')[0]}T00:00:00`;
    const endOfDay = `${hoy.toISOString().split('T')[0]}T23:59:59`;

    const { count: fiadosHoy } = await supabase
      .from('fiados')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const { data: fiadosData } = await supabase
      .from('fiados')
      .select('total')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);
    const totalFiadoHoy = (fiadosData || []).reduce((sum, f) => sum + (f.total || 0), 0);

    const { count: abonosHoy } = await supabase
      .from('abonos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const { data: abonosData } = await supabase
      .from('abonos')
      .select('monto')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);
    const totalAbonadoHoy = (abonosData || []).reduce((sum, a) => sum + (a.monto || 0), 0);

    const { data: cartera } = await supabase
      .from('saldos_clientes')
      .select('saldo')
      .gt('saldo', 0);

    const carteraTotal = (cartera || []).reduce((sum, c) => sum + (c.saldo || 0), 0);
    const clientesConDeuda = (cartera || []).length;

    const { data: clientes } = await supabase
      .from('saldos_clientes')
      .select('id, saldo')
      .gt('saldo', 0);

    const clienteIds = (clientes || []).map(c => c.id);
    let totalMorosos = 0;

    if (clienteIds.length > 0) {
      const { data: ultimosFiados } = await supabase
        .from('fiados')
        .select('cliente_id, created_at')
        .in('cliente_id', clienteIds)
        .order('created_at', { ascending: false });

      const { data: ultimosAbonos } = await supabase
        .from('abonos')
        .select('cliente_id, created_at')
        .in('cliente_id', clienteIds)
        .order('created_at', { ascending: false });

      const ultimoMovimientoPorCliente: Record<string, string> = {};
      (ultimosFiados || []).forEach(f => {
        const actual = ultimoMovimientoPorCliente[f.cliente_id];
        if (!actual || f.created_at > actual) {
          ultimoMovimientoPorCliente[f.cliente_id] = f.created_at;
        }
      });
      (ultimosAbonos || []).forEach(a => {
        const actual = ultimoMovimientoPorCliente[a.cliente_id];
        if (!actual || a.created_at > actual) {
          ultimoMovimientoPorCliente[a.cliente_id] = a.created_at;
        }
      });

      const hoyDate = new Date();
      (clientes || []).forEach(cliente => {
        const ultimoMov = ultimoMovimientoPorCliente[cliente.id];
        if (ultimoMov) {
          const diffTime = hoyDate.getTime() - new Date(ultimoMov).getTime();
          const dias = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (dias >= 15) totalMorosos++;
        }
      });
    }

    return NextResponse.json({
      fiados_hoy: fiadosHoy || 0,
      total_fiado_hoy: totalFiadoHoy,
      abonos_hoy: abonosHoy || 0,
      total_abonado_hoy: totalAbonadoHoy,
      cartera_total: carteraTotal,
      clientes_con_deuda: clientesConDeuda,
      total_morosos: totalMorosos,
    });
  } catch (error) {
    console.error('GET /api/resumen/hoy error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}