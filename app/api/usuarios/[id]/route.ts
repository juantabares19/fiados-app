import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';

const PIN_RE = /^\d{4}$/;
const ROLES = ['dueño', 'tendero'] as const;

// Cuenta cuántos dueños activos quedan, para no dejar el sistema sin dueño.
async function contarDuenosActivos(): Promise<number> {
  const { count } = await supabaseAdmin
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('rol', 'dueño')
    .eq('activo', true);
  return count ?? 0;
}

// PATCH /api/usuarios/[id] — editar nombre/rol, activar/desactivar, resetear PIN (solo dueño).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser({ rol: 'dueño' });
    if ('error' in auth) return auth.error;
    const { usuario } = auth;

    const { id } = await params;
    const esYoMismo = id === usuario.id;

    const { data: target } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, activo, token_version')
      .eq('id', id)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    let revocarSesion = false;

    // Nombre
    if (body.nombre !== undefined) {
      const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
      if (!nombre || nombre.length > 100) {
        return NextResponse.json({ error: 'Nombre inválido (máx. 100 caracteres)' }, { status: 400 });
      }
      updates.nombre = nombre;
    }

    // Rol
    if (body.rol !== undefined && body.rol !== target.rol) {
      if (!ROLES.includes(body.rol)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
      }
      if (esYoMismo) {
        return NextResponse.json({ error: 'No puedes cambiar tu propio rol' }, { status: 400 });
      }
      // Degradar al último dueño activo dejaría el sistema sin administrador.
      if (target.rol === 'dueño' && target.activo && body.rol === 'tendero' && (await contarDuenosActivos()) <= 1) {
        return NextResponse.json({ error: 'Debe quedar al menos un dueño activo' }, { status: 400 });
      }
      updates.rol = body.rol;
      revocarSesion = true; // el rol viaja en el JWT: hay que forzar re-login
    }

    // Activo / desactivado
    if (body.activo !== undefined && body.activo !== target.activo) {
      if (typeof body.activo !== 'boolean') {
        return NextResponse.json({ error: 'Valor de activo inválido' }, { status: 400 });
      }
      if (body.activo === false) {
        if (esYoMismo) {
          return NextResponse.json({ error: 'No puedes desactivar tu propia cuenta' }, { status: 400 });
        }
        if (target.rol === 'dueño' && target.activo && (await contarDuenosActivos()) <= 1) {
          return NextResponse.json({ error: 'Debe quedar al menos un dueño activo' }, { status: 400 });
        }
        revocarSesion = true; // desactivar revoca la sesión al instante
      }
      updates.activo = body.activo;
    }

    // Reset de PIN
    if (body.pin !== undefined) {
      const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
      if (!PIN_RE.test(pin)) {
        return NextResponse.json({ error: 'El PIN debe tener 4 dígitos' }, { status: 400 });
      }
      updates.pin = await bcrypt.hash(pin, 10);
      revocarSesion = true; // invalida sesiones con el PIN anterior
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    if (revocarSesion) {
      updates.token_version = (target.token_version ?? 0) + 1;
    }

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .update(updates)
      .eq('id', id)
      .select('id, nombre, celular, rol, activo, created_at')
      .single();

    if (error) {
      console.error('Error updating usuario:', error);
      return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('PATCH /api/usuarios/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/usuarios/[id] — borrado físico (solo dueño). Bloqueado por FKs si hay actividad.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser({ rol: 'dueño' });
    if ('error' in auth) return auth.error;
    const { usuario } = auth;

    const { id } = await params;

    if (id === usuario.id) {
      return NextResponse.json({ error: 'No puedes borrar tu propia cuenta' }, { status: 400 });
    }

    const { data: target } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', id)
      .single();

    if (!target) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (target.rol === 'dueño' && target.activo && (await contarDuenosActivos()) <= 1) {
      return NextResponse.json({ error: 'Debe quedar al menos un dueño activo' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('usuarios').delete().eq('id', id);

    if (error) {
      // 23503 = foreign key violation: el usuario tiene fiados/abonos/auditoría (ON DELETE RESTRICT).
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'No se puede borrar: el usuario tiene movimientos o auditoría registrados. Desactívalo en su lugar.' },
          { status: 409 }
        );
      }
      console.error('Error deleting usuario:', error);
      return NextResponse.json({ error: 'Error al borrar usuario' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/usuarios/[id] error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
