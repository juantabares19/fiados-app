import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';
import { esNumeroPositivo, CANTIDAD_MAX, parseEntero } from '@/lib/validation';
import { inicioDia, finDia } from '@/lib/fechas';
import { QUERY_LIMIT_DEFAULT } from '@/lib/constants';
import type { ClienteRelacion, UsuarioRelacion } from '@/lib/database.types';

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if ('error' in auth) return auth.error;
    const { usuario } = auth;

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
      .order('created_at', { ascending: false });

    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    if (fecha) {
      query = query.gte('created_at', inicioDia(fecha)).lte('created_at', finDia(fecha));
    } else if (desde && hasta) {
      query = query.gte('created_at', inicioDia(desde)).lte('created_at', finDia(hasta));
    }

    const { data: fiados, error } = await (usePagination
      ? query.range(offset, offset + limit - 1)
      : query.limit(QUERY_LIMIT_DEFAULT));

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
          cliente_nombre: (fiado.clientes as unknown as ClienteRelacion | null)?.nombre ?? '',
          usuario_nombre: (fiado.usuarios as unknown as UsuarioRelacion | null)?.nombre ?? '',
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

    if (usePagination) {
      let countQuery = supabase.from('fiados').select('*', { count: 'exact', head: true });
      if (clienteId) countQuery = countQuery.eq('cliente_id', clienteId);
      if (fecha) {
        countQuery = countQuery.gte('created_at', inicioDia(fecha)).lte('created_at', finDia(fecha));
      } else if (desde && hasta) {
        countQuery = countQuery.gte('created_at', inicioDia(desde)).lte('created_at', finDia(hasta));
      }
      const { count } = await countQuery;
      return NextResponse.json({
        data: fiadosConDetalles,
        pagination: { page, limit, total: count || 0, total_pages: Math.ceil((count || 0) / limit) },
      });
    }

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
    const auth = await requireUser();
    if ('error' in auth) return auth.error;
    const { usuario } = auth;

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
      if (!esNumeroPositivo(p.cantidad, CANTIDAD_MAX)) {
        return NextResponse.json({ error: 'La cantidad debe ser un número válido mayor a 0' }, { status: 400 });
      }
      if (!esNumeroPositivo(p.valor_unitario)) {
        return NextResponse.json({ error: 'El valor unitario debe ser un número válido mayor a 0' }, { status: 400 });
      }
    }

    if (quien_pidio === 'familiar' && (!familiar || familiar.trim() === '')) {
      return NextResponse.json(
        { error: 'El nombre del familiar es requerido' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Operación atómica: valida tope e inserta fiado+detalle+auditoría bajo un
    // lock de la fila del cliente. Cierra la race condition de double-spending.
    const { data, error } = await supabase.rpc('crear_fiado', {
      p_cliente_id: cliente_id,
      p_usuario_id: usuario.id,
      p_quien_pidio: quien_pidio || 'cliente',
      p_familiar: familiar ?? null,
      p_nota: nota ?? null,
      p_productos: productos,
    });

    if (error) {
      const msg = error.message || '';
      if (msg.includes('CLIENTE_NO_ENCONTRADO')) {
        return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      }
      if (msg.includes('CLIENTE_BLOQUEADO')) {
        return NextResponse.json({ error: 'Este cliente está bloqueado y no puede fiar' }, { status: 400 });
      }
      if (msg.includes('TOPE_EXCEDIDO')) {
        const m = msg.match(/TOPE_EXCEDIDO\|([^|]+)\|([^|]+)\|([^|\s]+)/);
        const saldoActual = Number(m?.[1] ?? 0);
        const tope = Number(m?.[2] ?? 0);
        const disponible = Number(m?.[3] ?? 0);
        return NextResponse.json({
          error: `Este fiado supera el tope de crédito. Saldo actual: $${saldoActual.toLocaleString('es-CO')}. Tope: $${tope.toLocaleString('es-CO')}. Disponible: $${disponible.toLocaleString('es-CO')}`,
        }, { status: 400 });
      }
      if (msg.includes('SIN_PRODUCTOS')) {
        return NextResponse.json({ error: 'Al menos un producto es requerido' }, { status: 400 });
      }
      if (msg.includes('FAMILIAR_REQUERIDO')) {
        return NextResponse.json({ error: 'El nombre del familiar es requerido' }, { status: 400 });
      }
      if (msg.includes('PRODUCTO_SIN_NOMBRE')) {
        return NextResponse.json({ error: 'Todos los productos deben tener nombre' }, { status: 400 });
      }
      if (msg.includes('CANTIDAD_INVALIDA')) {
        return NextResponse.json({ error: 'La cantidad debe ser mayor a 0' }, { status: 400 });
      }
      if (msg.includes('VALOR_INVALIDO')) {
        return NextResponse.json({ error: 'El valor unitario debe ser mayor a 0' }, { status: 400 });
      }
      console.error('Error RPC crear_fiado:', error);
      return NextResponse.json({ error: 'Error al crear fiado' }, { status: 500 });
    }

    const result = data as {
      fiado: { id: string; cliente_id: string; usuario_id: string; quien_pidio: string; familiar: string | null; nota: string | null; total: number; created_at: string };
      cliente_nombre: string;
      nuevo_saldo: number;
      tope: number;
      disponible: number;
    };

    const { data: detalles } = await supabase
      .from('fiado_detalle')
      .select('id, producto, cantidad, valor_unitario, subtotal')
      .eq('fiado_id', result.fiado.id);

    return NextResponse.json({
      fiado: {
        ...result.fiado,
        cliente_nombre: result.cliente_nombre,
        usuario_nombre: usuario.nombre,
        detalles: detalles || [],
      },
      nuevo_saldo: result.nuevo_saldo,
      tope: result.tope,
      disponible: result.disponible,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/fiados error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}