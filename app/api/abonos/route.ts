import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';
import { esNumeroPositivo, parseEntero } from '@/lib/validation';
import { inicioDia, finDia } from '@/lib/fechas';
import { QUERY_LIMIT_DEFAULT } from '@/lib/constants';

const METODOS_PAGO = ['efectivo', 'nequi', 'daviplata', 'llaves', 'otro'];

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get('cliente_id');
    const fecha = searchParams.get('fecha');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const pageParam = searchParams.get('page');
    const usePagination = pageParam !== null;
    const page = Math.max(1, parseEntero(pageParam, 1));
    const limit = Math.min(100, Math.max(1, parseEntero(searchParams.get('limit'), QUERY_LIMIT_DEFAULT)));
    const offset = (page - 1) * limit;

    const supabase = supabaseAdmin;

    let query = supabase
      .from('abonos')
      .select(`
        id,
        cliente_id,
        usuario_id,
        monto,
        metodo_pago,
        nota,
        created_at,
        usuarios!inner(nombre)
      `)
      .order('created_at', { ascending: false });

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    if (fecha) {
      query = query.gte('created_at', inicioDia(fecha)).lte('created_at', finDia(fecha));
    } else if (desde && hasta) {
      query = query.gte('created_at', inicioDia(desde)).lte('created_at', finDia(hasta));
    }

    const { data: abonos, error } = await (usePagination
      ? query.range(offset, offset + limit - 1)
      : query.limit(QUERY_LIMIT_DEFAULT));

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
      usuario_id: abono.usuario_id ?? '',
      usuario_nombre: (abono.usuarios as unknown as { nombre: string } | null)?.nombre ?? '',
      monto: abono.monto,
      metodo_pago: abono.metodo_pago,
      nota: abono.nota,
      created_at: abono.created_at,
    }));

    if (usePagination) {
      let countQuery = supabase.from('abonos').select('*', { count: 'exact', head: true });
      if (clienteId) countQuery = countQuery.eq('cliente_id', clienteId);
      if (fecha) {
        countQuery = countQuery.gte('created_at', inicioDia(fecha)).lte('created_at', finDia(fecha));
      } else if (desde && hasta) {
        countQuery = countQuery.gte('created_at', inicioDia(desde)).lte('created_at', finDia(hasta));
      }
      const { count } = await countQuery;
      return NextResponse.json({
        data: abonosConCliente,
        pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
      });
    }

    return NextResponse.json(abonosConCliente);
  } catch (error) {
    console.error('GET /api/abonos error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if ('error' in auth) return auth.error;
    const { usuario } = auth;

    const body = await request.json();
    const { cliente_id, monto, metodo_pago, nota } = body;

    if (!cliente_id) {
      return NextResponse.json({ error: 'Cliente es requerido' }, { status: 400 });
    }

    if (!esNumeroPositivo(monto)) {
      return NextResponse.json({ error: 'El monto debe ser un número válido mayor a 0' }, { status: 400 });
    }

    if (!metodo_pago || !METODOS_PAGO.includes(metodo_pago)) {
      return NextResponse.json(
        { error: 'Método de pago inválido' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Operación atómica: valida saldo e inserta abono+auditoría bajo un lock de
    // la fila del cliente. Cierra la race condition de sobrepago (saldo negativo).
    const { data, error } = await supabase.rpc('crear_abono', {
      p_cliente_id: cliente_id,
      p_usuario_id: usuario.id,
      p_monto: monto,
      p_metodo_pago: metodo_pago,
      p_nota: nota ?? null,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('CLIENTE_NO_ENCONTRADO')) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }
      if (msg.includes('MONTO_INVALIDO')) {
        return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
      }
      if (msg.includes('METODO_INVALIDO')) {
        return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
      }
      if (msg.includes('SIN_SALDO')) {
        return NextResponse.json({ error: 'Este cliente no tiene saldo pendiente' }, { status: 400 });
      }
      if (msg.includes('ABONO_EXCEDE_SALDO')) {
        const saldoActual = Number(msg.match(/ABONO_EXCEDE_SALDO\|([^|\s]+)/)?.[1] ?? 0);
        return NextResponse.json({
          error: `El abono ($${Number(monto).toLocaleString('es-CO')}) supera el saldo pendiente ($${saldoActual.toLocaleString('es-CO')})`,
        }, { status: 400 });
      }
      console.error('Error RPC crear_abono:', error);
      return NextResponse.json({ error: 'Error al crear abono' }, { status: 500 });
    }

    const result = data as {
      abono: { id: string; cliente_id: string; monto: number; metodo_pago: string; nota: string | null; created_at: string };
      cliente_nombre: string;
      saldo_anterior: number;
      nuevo_saldo: number;
      cliente_al_dia: boolean;
    };

    return NextResponse.json({
      abono: {
        id: result.abono.id,
        cliente_id: result.abono.cliente_id,
        cliente_nombre: result.cliente_nombre,
        usuario_nombre: usuario.nombre,
        monto: result.abono.monto,
        metodo_pago: result.abono.metodo_pago,
        nota: result.abono.nota,
        created_at: result.abono.created_at,
      },
      saldo_anterior: result.saldo_anterior,
      nuevo_saldo: result.nuevo_saldo,
      cliente_al_dia: result.cliente_al_dia,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/abonos error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}