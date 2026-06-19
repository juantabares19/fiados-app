import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const token = (await cookies()).get('session_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No hay sesión activa' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Sesión inválida' },
        { status: 401 }
      );
    }

    const { data: dbUser } = await supabaseAdmin
      .from('usuarios')
      .select('id, activo, token_version')
      .eq('id', payload.id)
      .single();

    if (!dbUser || !dbUser.activo || dbUser.token_version !== (payload.token_version ?? -1)) {
      const response = NextResponse.json(
        { error: 'Usuario inactivo o sesión revocada' },
        { status: 401 }
      );
      response.cookies.set('session_token', '', { maxAge: 0, path: '/' });
      return response;
    }

    return NextResponse.json({ usuario: payload });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuario' },
      { status: 500 }
    );
  }
}
