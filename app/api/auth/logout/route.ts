import { NextResponse } from 'next/server';
import { deleteSessionCookie } from '@/lib/auth';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', deleteSessionCookie());
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    );
  }
}