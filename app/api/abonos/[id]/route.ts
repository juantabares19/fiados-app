import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

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

    if (usuario.rol !== 'dueño') {
      return NextResponse.json(
        { error: 'Solo el dueño puede eliminar abonos' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supabase = supabaseAdmin;

    const { data: abono, error: abonoError } = await supabase
      .from('abonos')
      .select('*, clientes!inner(id)')
      .eq('id', id)
      .single();

    if (abonoError || !abono) {
      return NextResponse.json({ error: 'Abono no encontrado' }, { status: 404 });
    }

    const clienteId = abono.cliente_id;

    const { error: deleteError } = await supabase
      .from('abonos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting abono:', deleteError);
      return NextResponse.json({ error: 'Error al eliminar abono' }, { status: 500 });
    }

    await supabase.from('auditoria').insert({
      tabla: 'abonos',
      registro_id: id,
      accion: 'eliminar',
      usuario_id: usuario.id,
      datos_antes: abono,
    });

    const { data: saldos } = await supabase
      .from('saldos_clientes')
      .select('saldo')
      .eq('id', clienteId)
      .single();

    return NextResponse.json({
      success: true,
      mensaje: 'Abono eliminado exitosamente',
      nuevo_saldo: saldos?.saldo || 0,
    });
  } catch (error) {
    console.error('DELETE /api/abonos/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}