import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

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

    const supabase = await createClient();

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

    return NextResponse.json({
      fiados_hoy: fiadosHoy || 0,
      total_fiado_hoy: totalFiadoHoy,
      abonos_hoy: abonosHoy || 0,
      total_abonado_hoy: totalAbonadoHoy,
      cartera_total: carteraTotal,
      clientes_con_deuda: clientesConDeuda,
    });
  } catch (error) {
    console.error('GET /api/resumen/hoy error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}