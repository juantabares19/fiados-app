import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';
import { esNumeroPositivo } from '@/lib/validation';
import { DIAS_MORA_ALERTA, DIAS_MORA_CRITICO } from '@/lib/constants';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const supabase = supabaseAdmin;

    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const { data: saldos } = await supabase
      .from('saldos_clientes')
      .select('saldo')
      .eq('id', id)
      .single();

    const { data: ultimoFiado } = await supabase
      .from('fiados')
      .select('created_at')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: ultimoAbono } = await supabase
      .from('abonos')
      .select('created_at')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let diasSinMovimiento = 0;
    let ultimoMovimiento: string | null = null;

    if (ultimoFiado && ultimoAbono) {
      ultimoMovimiento = new Date(ultimoFiado.created_at) > new Date(ultimoAbono.created_at)
        ? ultimoFiado.created_at
        : ultimoAbono.created_at;
    } else if (ultimoFiado) {
      ultimoMovimiento = ultimoFiado.created_at;
    } else if (ultimoAbono) {
      ultimoMovimiento = ultimoAbono.created_at;
    }

    if (ultimoMovimiento) {
      const fechaMov = new Date(ultimoMovimiento);
      const hoy = new Date();
      const diffTime = hoy.getTime() - fechaMov.getTime();
      diasSinMovimiento = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    const saldo = saldos?.saldo || 0;
    let estadoMora: 'al_dia' | 'moroso' | 'critico' = 'al_dia';
    if (saldo > 0) {
      if (diasSinMovimiento >= DIAS_MORA_CRITICO) estadoMora = 'critico';
      else if (diasSinMovimiento >= DIAS_MORA_ALERTA) estadoMora = 'moroso';
    }

    return NextResponse.json({
      ...cliente,
      saldo,
      dias_sin_movimiento: diasSinMovimiento,
      estado_mora: estadoMora,
    });
  } catch (error) {
    console.error('GET /api/clientes/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ('error' in auth) return auth.error;
    const { usuario } = auth;

    if (usuario.rol !== 'dueño') {
      return NextResponse.json(
        { error: 'No tienes permiso para editar clientes' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { nombre, apodo, celular, tope_credito, familiares, estado } = body;

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

    const { data: actual } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (!actual) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    if (celular !== actual.celular) {
      const { data: existente } = await supabase
        .from('clientes')
        .select('id')
        .eq('celular', celular)
        .neq('id', id)
        .single();

      if (existente) {
        return NextResponse.json(
          { error: 'Ya existe un cliente con este número' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      nombre: nombre.trim(),
      apodo: apodo?.trim() || null,
      celular,
      familiares: familiares?.trim() || null,
      estado: estado || 'activo',
    };

    if (esNumeroPositivo(tope_credito)) {
      updateData.tope_credito = tope_credito;
    }

    const { data: cliente, error } = await supabase
      .from('clientes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating cliente:', error);
      return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
    }

    await supabase.from('auditoria').insert({
      tabla: 'clientes',
      registro_id: id,
      accion: 'editar',
      usuario_id: usuario.id,
      datos_antes: actual,
      datos_despues: cliente,
    });

    return NextResponse.json(cliente);
  } catch (error) {
    console.error('PUT /api/clientes/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ('error' in auth) return auth.error;
    const { usuario } = auth;

    if (usuario.rol !== 'dueño') {
      return NextResponse.json(
        { error: 'No tienes permiso para bloquear clientes' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supabase = supabaseAdmin;

    const { data: actual } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (!actual) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const { data: saldos } = await supabase
      .from('saldos_clientes')
      .select('saldo')
      .eq('id', id)
      .single();

    const { data: cliente, error } = await supabase
      .from('clientes')
      .update({ estado: 'bloqueado' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error blocking cliente:', error);
      return NextResponse.json({ error: 'Error al bloquear cliente' }, { status: 500 });
    }

    await supabase.from('auditoria').insert({
      tabla: 'clientes',
      registro_id: id,
      accion: 'eliminar',
      usuario_id: usuario.id,
      datos_antes: actual,
      datos_despues: { ...cliente, motivo_bloqueo: 'Usuario solicitado' },
    });

    const saldoActual = saldos?.saldo || 0;
    const mensajeBloqueo = saldoActual > 0
      ? `Cliente bloqueado. Tenía un saldo pendiente de $${saldoActual.toLocaleString('es-CO')}`
      : 'Cliente bloqueado exitosamente';

    return NextResponse.json({
      ...cliente,
      saldo: saldoActual,
      mensaje: mensajeBloqueo,
    });
  } catch (error) {
    console.error('DELETE /api/clientes/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}