import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createToken, createSessionCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { celular, pin } = await request.json();

    if (!celular || !pin) {
      return NextResponse.json(
        { error: 'Celular y clave son requeridos' },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'La clave debe ser exactamente 4 dígitos' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, nombre, celular, pin, rol, activo')
      .eq('celular', celular)
      .single();

    if (error || !usuario) {
      return NextResponse.json(
        { error: 'Celular o clave incorrectos' },
        { status: 401 }
      );
    }

    if (!usuario.activo) {
      return NextResponse.json(
        { error: 'Tu cuenta está desactivada. Habla con el dueño.' },
        { status: 403 }
      );
    }

    const isValidPin = await bcrypt.compare(pin, usuario.pin);

    if (!isValidPin) {
      return NextResponse.json(
        { error: 'Celular o clave incorrectos' },
        { status: 401 }
      );
    }

    const token = await createToken({
      id: usuario.id,
      nombre: usuario.nombre,
      celular: usuario.celular,
      rol: usuario.rol as 'dueño' | 'tendero',
    });

    const cookie = createSessionCookie(token);

    const response = NextResponse.json({
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        celular: usuario.celular,
        rol: usuario.rol,
      },
    });

    response.headers.set('Set-Cookie', cookie);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}