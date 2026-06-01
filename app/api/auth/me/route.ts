import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

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
      return NextResponse.json(
        { error: 'No hay sesión activa' },
        { status: 401 }
      );
    }

    const usuario = await verifyToken(token);

    if (!usuario) {
      return NextResponse.json(
        { error: 'Sesión inválida' },
        { status: 401 }
      );
    }

    return NextResponse.json({ usuario });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuario' },
      { status: 500 }
    );
  }
}