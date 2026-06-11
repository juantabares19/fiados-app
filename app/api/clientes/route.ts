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
    const buscar = searchParams.get('buscar');
    const filtro = searchParams.get('filtro') || 'todos';

    const supabase = supabaseAdmin;

    let query = supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true });

    if (filtro === 'bloqueados') {
      query = query.eq('estado', 'bloqueado');
    } else if (filtro === 'con_deuda' || filtro === 'al_dia') {
      query = query.eq('estado', 'activo');
    } else {
      query = query.eq('estado', 'activo');
    }

    if (buscar && buscar.trim()) {
      const searchTerm = `%${buscar.trim()}%`;
      query = query.or(`nombre.ilike.${searchTerm},apodo.ilike.${searchTerm}`);
    }

    const { data: clientes, error } = await query;

    if (error) {
      console.error('Error fetching clientes:', error);
      return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
    }

    const clienteIds = (clientes || []).map(c => c.id);

    let saldosMap: Record<string, number> = {};
    if (clienteIds.length > 0) {
      const { data: saldos } = await supabase
        .from('saldos_clientes')
        .select('id, saldo')
        .in('id', clienteIds);

      (saldos || []).forEach(s => {
        saldosMap[s.id] = s.saldo || 0;
      });
    }

    let clientesConSaldo = (clientes || []).map(cliente => ({
      ...cliente,
      saldo: saldosMap[cliente.id] || 0,
    }));

    if (filtro === 'con_deuda') {
      clientesConSaldo = clientesConSaldo.filter(c => c.saldo > 0);
    } else if (filtro === 'al_dia') {
      clientesConSaldo = clientesConSaldo.filter(c => c.saldo === 0);
    }

    return NextResponse.json(clientesConSaldo);
  } catch (error) {
    console.error('GET /api/clientes error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { nombre, apodo, celular, tope_credito, familiares } = body;

    if (!nombre || nombre.trim().length < 2) {
      return NextResponse.json(
        { error: 'El nombre debe tener al menos 2 caracteres' },
        { status: 400 }
      );
    }

    if (!celular || !/^\d{10}$/.test(celular)) {
      return NextResponse.json(
        { error: 'El celular debe tener 10 dígitos' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    const { data: existente } = await supabase
      .from('clientes')
      .select('id')
      .eq('celular', celular)
      .single();

    if (existente) {
      return NextResponse.json(
        { error: 'Ya existe un cliente con este número' },
        { status: 409 }
      );
    }

    const topeFinal = usuario.rol === 'dueño'
      ? (tope_credito && tope_credito > 0 ? tope_credito : 50000)
      : 50000;

    const { data: cliente, error } = await supabase
      .from('clientes')
      .insert({
        nombre: nombre.trim(),
        apodo: apodo?.trim() || null,
        celular,
        tope_credito: topeFinal,
        familiares: familiares?.trim() || null,
        estado: 'activo',
        created_by: usuario.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating cliente:', error);
      return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
    }

    await supabase.from('auditoria').insert({
      tabla: 'clientes',
      registro_id: cliente.id,
      accion: 'crear',
      usuario_id: usuario.id,
      datos_despues: cliente,
    });

    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    console.error('POST /api/clientes error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}