import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createToken, createSessionCookie } from '@/lib/auth';
import { LOGIN_MAX_INTENTOS, LOGIN_LOCKOUT_MINUTOS } from '@/lib/constants';
import bcrypt from 'bcryptjs';

// Hash de relleno (costo real) para comparar incluso cuando el usuario no
// existe: equilibra el tiempo de respuesta y evita un timing oracle (H2) que
// permitiría enumerar celulares válidos.
const DUMMY_HASH = bcrypt.hashSync('fiados-dummy-pin', 10);

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

    const supabase = supabaseAdmin;
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nombre, celular, pin, rol, activo, token_version, intentos_fallidos, bloqueado_hasta')
      .eq('celular', celular)
      .single();

    // H1: bloqueo temporal por fuerza bruta.
    if (usuario?.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
      return NextResponse.json(
        { error: 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.' },
        { status: 429 }
      );
    }

    // Siempre se compara (contra el hash real o el de relleno) para no filtrar
    // por tiempo si el celular existe o no.
    const isValidPin = await bcrypt.compare(pin, usuario?.pin ?? DUMMY_HASH);

    if (!usuario || !isValidPin) {
      // Solo se cuenta el intento si el usuario existe (no se crea estado para
      // celulares inexistentes). Mensaje genérico para no revelar existencia.
      if (usuario) {
        const intentos = (usuario.intentos_fallidos ?? 0) + 1;
        const update: { intentos_fallidos: number; bloqueado_hasta?: string } = {
          intentos_fallidos: intentos,
        };
        if (intentos >= LOGIN_MAX_INTENTOS) {
          update.bloqueado_hasta = new Date(Date.now() + LOGIN_LOCKOUT_MINUTOS * 60_000).toISOString();
          update.intentos_fallidos = 0;
        }
        await supabase.from('usuarios').update(update).eq('id', usuario.id);
      }
      return NextResponse.json(
        { error: 'Celular o clave incorrectos' },
        { status: 401 }
      );
    }

    // El PIN es correcto: solo aquí se revela el estado de la cuenta. Quien no
    // conoce el PIN no puede distinguir "desactivada" de "credenciales malas".
    if (!usuario.activo) {
      return NextResponse.json(
        { error: 'Tu cuenta está desactivada. Habla con el dueño.' },
        { status: 403 }
      );
    }

    // Login exitoso: resetear el throttle.
    await supabase
      .from('usuarios')
      .update({ intentos_fallidos: 0, bloqueado_hasta: null })
      .eq('id', usuario.id);

    const token = await createToken({
      id: usuario.id,
      nombre: usuario.nombre,
      celular: usuario.celular,
      rol: usuario.rol as 'dueño' | 'tendero',
      token_version: usuario.token_version ?? 0,
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