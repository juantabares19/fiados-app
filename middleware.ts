import { type NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get('session_token')?.value;
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};