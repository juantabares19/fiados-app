import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';

const CELULAR_RE = /^\d{10}$/;
const PIN_RE = /^\d{4}$/;
const ROLES = ['dueño', 'tendero'] as const;

// GET /api/usuarios — lista de usuarios (solo dueño). Nunca expone el PIN.
export async function GET() {
  try {
    const auth = await requireUser({ rol: 'dueño' });
    if ('error' in auth) return auth.error;

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombre, celular, rol, activo, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching usuarios:', error);
      return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error('GET /api/usuarios error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/usuarios — crear usuario (solo dueño).
export async function POST(request: Request) {
  try {
    const auth = await requireUser({ rol: 'dueño' });
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const celular = typeof body.celular === 'string' ? body.celular.trim() : '';
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    const rol = body.rol;

    if (!nombre || nombre.length > 100) {
      return NextResponse.json({ error: 'El nombre es requerido (máx. 100 caracteres)' }, { status: 400 });
    }
    if (!CELULAR_RE.test(celular)) {
      return NextResponse.json({ error: 'El celular debe tener 10 dígitos' }, { status: 400 });
    }
    if (!PIN_RE.test(pin)) {
      return NextResponse.json({ error: 'El PIN debe tener 4 dígitos' }, { status: 400 });
    }
    if (!ROLES.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const pinHash = await bcrypt.hash(pin, 10);

    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .insert({ nombre, celular, pin: pinHash, rol, activo: true })
      .select('id, nombre, celular, rol, activo, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ese celular ya está registrado' }, { status: 409 });
      }
      console.error('Error creating usuario:', error);
      return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('POST /api/usuarios error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
