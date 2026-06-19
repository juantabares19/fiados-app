import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const orden = searchParams.get('orden') || 'deuda';

    const supabase = supabaseAdmin;

    let query = supabase
      .from('saldos_clientes')
      .select('id, nombre, celular, estado, saldo')
      .order('saldo', { ascending: false });

    if (orden === 'nombre') {
      query = supabase
        .from('saldos_clientes')
        .select('id, nombre, celular, estado, saldo')
        .order('nombre', { ascending: true });
    }

    const { data: clientes, error } = await query;

    if (error) {
      console.error('Error fetching saldos:', error);
      return NextResponse.json({ error: 'Error al obtener saldos' }, { status: 500 });
    }

    const carteraTotal = (clientes || [])
      .filter(c => c.saldo > 0)
      .reduce((sum, c) => sum + (c.saldo || 0), 0);

    const clientesConDeuda = (clientes || []).filter(c => c.saldo > 0).length;

    return NextResponse.json({
      clientes: clientes || [],
      cartera_total: carteraTotal,
      clientes_con_deuda: clientesConDeuda,
    });
  } catch (error) {
    console.error('GET /api/clientes/saldos error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}