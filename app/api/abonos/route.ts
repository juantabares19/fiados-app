import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

const METODOS_PAGO = ['efectivo', 'nequi', 'daviplata', 'llaves', 'otro'];

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
    const fecha = searchParams.get('fecha');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const supabase = supabaseAdmin;

    let query = supabase
      .from('abonos')
      .select(`
        id,
        cliente_id,
        monto,
        metodo_pago,
        nota,
        created_at,
        usuarios!inner(nombre)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    if (fecha) {
      const startOfDay = `${fecha}T00:00:00`;
      const endOfDay = `${fecha}T23:59:59`;
      query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
    } else if (desde && hasta) {
      query = query.gte('created_at', `${desde}T00:00:00`).lte('created_at', `${hasta}T23:59:59`);
    }

    const { data: abonos, error } = await query;

    if (error) {
      console.error('Error fetching abonos:', error);
      return NextResponse.json({ error: 'Error al obtener abonos' }, { status: 500 });
    }

    const clienteIds = [...new Set((abonos || []).map(a => a.cliente_id))];
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nombre')
      .in('id', clienteIds);

    const clientesMap = (clientes || []).reduce((acc: Record<string, string>, c) => {
      acc[c.id] = c.nombre;
      return acc;
    }, {});

    const abonosConCliente = (abonos || []).map(abono => ({
      id: abono.id,
      cliente_id: abono.cliente_id,
      cliente_nombre: clientesMap[abono.cliente_id] || '',
      usuario_id: (abono.usuarios as unknown as { id: string })?.id || '',
      usuario_nombre: (abono.usuarios as unknown as { nombre: string })?.nombre || '',
      monto: abono.monto,
      metodo_pago: abono.metodo_pago,
      nota: abono.nota,
      created_at: abono.created_at,
    }));

    return NextResponse.json(abonosConCliente);
  } catch (error) {
    console.error('GET /api/abonos error:', error);
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
    const { cliente_id, monto, metodo_pago, nota } = body;

    if (!cliente_id) {
      return NextResponse.json({ error: 'Cliente es requerido' }, { status: 400 });
    }

    if (!monto || monto <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    if (!metodo_pago || !METODOS_PAGO.includes(metodo_pago)) {
      return NextResponse.json(
        { error: 'Método de pago inválido' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const { data: saldos } = await supabase
      .from('saldos_clientes')
      .select('saldo')
      .eq('id', cliente_id)
      .single();

    const saldoActual = saldos?.saldo || 0;

    if (saldoActual === 0) {
      return NextResponse.json(
        { error: 'Este cliente no tiene saldo pendiente' },
        { status: 400 }
      );
    }

    if (monto > saldoActual) {
      return NextResponse.json({
        error: `El abono ($${monto.toLocaleString('es-CO')}) supera el saldo pendiente ($${saldoActual.toLocaleString('es-CO')})`,
      }, { status: 400 });
    }

    const { data: abono, error: abonoError } = await supabase
      .from('abonos')
      .insert({
        cliente_id,
        usuario_id: usuario.id,
        monto,
        metodo_pago,
        nota: nota?.trim() || null,
      })
      .select()
      .single();

    if (abonoError || !abono) {
      console.error('Error creating abono:', abonoError);
      return NextResponse.json({ error: 'Error al crear abono' }, { status: 500 });
    }

    await supabase.from('auditoria').insert({
      tabla: 'abonos',
      registro_id: abono.id,
      accion: 'crear',
      usuario_id: usuario.id,
      datos_despues: abono,
    });

    const { data: nuevoSaldos } = await supabase
      .from('saldos_clientes')
      .select('saldo')
      .eq('id', cliente_id)
      .single();

    const nuevoSaldo = nuevoSaldos?.saldo || 0;

    return NextResponse.json({
      abono: {
        id: abono.id,
        cliente_id: abono.cliente_id,
        cliente_nombre: cliente.nombre,
        usuario_nombre: usuario.nombre,
        monto: abono.monto,
        metodo_pago: abono.metodo_pago,
        nota: abono.nota,
        created_at: abono.created_at,
      },
      saldo_anterior: saldoActual,
      nuevo_saldo: nuevoSaldo,
      cliente_al_dia: nuevoSaldo === 0,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/abonos error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}