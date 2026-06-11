import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';
import { QUERY_LIMIT_DEFAULT } from '@/lib/constants';
import type { ClienteRelacion, UsuarioRelacion } from '@/lib/database.types';

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
      .from('fiados')
      .select(`
        id,
        cliente_id,
        quien_pidio,
        familiar,
        nota,
        total,
        created_at,
        usuario_id,
        clientes!inner(nombre),
        usuarios!inner(nombre)
      `)
      .order('created_at', { ascending: false })
      .limit(QUERY_LIMIT_DEFAULT);

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

    const { data: fiados, error } = await query;

    if (error) {
      console.error('Error fetching fiados:', error);
      return NextResponse.json({ error: 'Error al obtener fiados' }, { status: 500 });
    }

    const fiadosConDetalles = await Promise.all(
      (fiados || []).map(async (fiado) => {
        const { data: detalles } = await supabase
          .from('fiado_detalle')
          .select('id, producto, cantidad, valor_unitario, subtotal')
          .eq('fiado_id', fiado.id);

        const puedeCancelar = puedeCancelarFiado(fiado, usuario.id, usuario.rol === 'dueño');

        return {
          id: fiado.id,
          cliente_id: fiado.cliente_id,
          cliente_nombre: (fiado.clientes as ClienteRelacion | null)?.nombre ?? '',
          usuario_nombre: (fiado.usuarios as UsuarioRelacion | null)?.nombre ?? '',
          quien_pidio: fiado.quien_pidio,
          familiar: fiado.familiar,
          nota: fiado.nota,
          total: fiado.total,
          created_at: fiado.created_at,
          puede_cancelar: puedeCancelar,
          detalles: detalles || [],
        };
      })
    );

    return NextResponse.json(fiadosConDetalles);
  } catch (error) {
    console.error('GET /api/fiados error:', error);
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
    const { cliente_id, quien_pidio, familiar, nota, productos } = body;

    if (!cliente_id) {
      return NextResponse.json({ error: 'Cliente es requerido' }, { status: 400 });
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json({ error: 'Al menos un producto es requerido' }, { status: 400 });
    }

    for (const p of productos) {
      if (!p.producto || p.producto.trim() === '') {
        return NextResponse.json({ error: 'Todos los productos deben tener nombre' }, { status: 400 });
      }
      if (!p.cantidad || p.cantidad <= 0) {
        return NextResponse.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 });
      }
      if (!p.valor_unitario || p.valor_unitario <= 0) {
        return NextResponse.json({ error: 'El valor unitario debe ser mayor a 0' }, { status: 400 });
      }
    }

    if (quien_pidio === 'familiar' && (!familiar || familiar.trim() === '')) {
      return NextResponse.json(
        { error: 'El nombre del familiar es requerido' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    if (cliente.estado === 'bloqueado') {
      return NextResponse.json(
        { error: 'Este cliente está bloqueado y no puede fiar' },
        { status: 400 }
      );
    }

    const productosConSubtotal = productos.map((p: { producto: string; cantidad: number; valor_unitario: number }) => ({
      producto: p.producto.trim(),
      cantidad: p.cantidad,
      valor_unitario: p.valor_unitario,
      subtotal: p.cantidad * p.valor_unitario,
    }));

    const total = productosConSubtotal.reduce((sum: number, p: { subtotal: number }) => sum + p.subtotal, 0);

    const { data: saldos } = await supabase
      .from('saldos_clientes')
      .select('saldo, tope_credito')
      .eq('id', cliente_id)
      .single();

    const saldoActual = saldos?.saldo || 0;
    const tope = cliente.tope_credito;
    const nuevoSaldo = saldoActual + total;

    if (nuevoSaldo > tope) {
      const disponible = tope - saldoActual;
      return NextResponse.json({
        error: `Este fiado supera el tope de crédito. Saldo actual: $${saldoActual.toLocaleString('es-CO')}. Tope: $${tope.toLocaleString('es-CO')}. Disponible: $${disponible.toLocaleString('es-CO')}`,
      }, { status: 400 });
    }

    const { data: fiado, error: fiadoError } = await supabase
      .from('fiados')
      .insert({
        cliente_id,
        usuario_id: usuario.id,
        quien_pidio: quien_pidio || 'cliente',
        familiar: familiar?.trim() || null,
        nota: nota?.trim() || null,
        total,
      })
      .select()
      .single();

    if (fiadoError || !fiado) {
      console.error('Error creating fiado:', fiadoError);
      return NextResponse.json({ error: 'Error al crear fiado' }, { status: 500 });
    }

    const detallesParaInsert = productosConSubtotal.map((p: { producto: string; cantidad: number; valor_unitario: number; subtotal: number }) => ({
      fiado_id: fiado.id,
      producto: p.producto,
      cantidad: p.cantidad,
      valor_unitario: p.valor_unitario,
      subtotal: p.subtotal,
    }));

    const { error: detallesError } = await supabase
      .from('fiado_detalle')
      .insert(detallesParaInsert);

    if (detallesError) {
      console.error('Error creating detalles:', detallesError);
      await supabase.from('fiados').delete().eq('id', fiado.id);
      return NextResponse.json({ error: 'Error al crear productos del fiado' }, { status: 500 });
    }

    await supabase.from('auditoria').insert({
      tabla: 'fiados',
      registro_id: fiado.id,
      accion: 'crear',
      usuario_id: usuario.id,
      datos_despues: fiado,
    });

    const { data: detalles } = await supabase
      .from('fiado_detalle')
      .select('id, producto, cantidad, valor_unitario, subtotal')
      .eq('fiado_id', fiado.id);

    return NextResponse.json({
      fiado: {
        ...fiado,
        cliente_nombre: cliente.nombre,
        usuario_nombre: usuario.nombre,
        detalles: detalles || [],
      },
      nuevo_saldo: nuevoSaldo,
      tope,
      disponible: tope - nuevoSaldo,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/fiados error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}