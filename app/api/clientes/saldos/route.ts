import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
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