import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';
import type { ClienteRelacion, UsuarioRelacion } from '@/lib/database.types';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const supabase = supabaseAdmin;

    const { data: fiado, error } = await supabase
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
      .eq('id', id)
      .single();

    if (error || !fiado) {
      return NextResponse.json({ error: 'Fiado no encontrado' }, { status: 404 });
    }

    const { data: detalles } = await supabase
      .from('fiado_detalle')
      .select('id, producto, cantidad, valor_unitario, subtotal')
      .eq('fiado_id', id);

    const puedeCancelar = puedeCancelarFiado(fiado, usuario.id, usuario.rol === 'dueño');

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('GET /api/fiados/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const supabase = supabaseAdmin;

    const { data: fiado, error: fiadoError } = await supabase
      .from('fiados')
      .select('*, clientes!inner(id, nombre), usuarios!inner(id)')
      .eq('id', id)
      .single();

    if (fiadoError || !fiado) {
      return NextResponse.json({ error: 'Fiado no encontrado' }, { status: 404 });
    }

    const esDueño = usuario.rol === 'dueño';
    const puedeCancelar = puedeCancelarFiado(fiado, usuario.id, esDueño);

    if (!puedeCancelar) {
      return NextResponse.json(
        { error: 'No tienes permiso para cancelar este fiado. Solo puedes cancelar fiados que hayas creado en los últimos 5 minutos.' },
        { status: 403 }
      );
    }

    const clienteId = fiado.cliente_id;

    const { error: deleteError } = await supabase
      .from('fiados')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting fiado:', deleteError);
      return NextResponse.json({ error: 'Error al cancelar fiado' }, { status: 500 });
    }

    await supabase.from('auditoria').insert({
      tabla: 'fiados',
      registro_id: id,
      accion: 'eliminar',
      usuario_id: usuario.id,
      datos_antes: fiado,
    });

    const { data: saldos } = await supabase
      .from('saldos_clientes')
      .select('saldo')
      .eq('id', clienteId)
      .single();

    return NextResponse.json({
      success: true,
      mensaje: 'Fiado cancelado exitosamente',
      nuevo_saldo: saldos?.saldo || 0,
    });
  } catch (error) {
    console.error('DELETE /api/fiados/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}