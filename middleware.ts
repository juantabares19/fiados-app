import { type NextRequest, NextResponse } from 'next/server';
import { verifyToken, encodeUserData } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cookieHeader = request.headers.get('cookie') || '';

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=');
    acc[name] = value;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies['session_token'];
  const usuario = token ? await verifyToken(token) : null;

  const isAuthPage = pathname === '/';
  const isProtectedRoute =
    pathname.startsWith('/inicio') ||
    pathname.startsWith('/clientes') ||
    pathname.startsWith('/fiados') ||
    pathname.startsWith('/abonos') ||
    pathname.startsWith('/actividad') ||
    pathname.startsWith('/morosos') ||
    pathname.startsWith('/metricas') ||
    pathname.startsWith('/configuracion');

  if (!usuario && isProtectedRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (usuario && isAuthPage) {
    return NextResponse.redirect(new URL('/inicio', request.url));
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (usuario) {
    const userData = encodeUserData(usuario);
    response.headers.set('x-user-data', userData);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};