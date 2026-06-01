import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const cookieStore = await import('next/headers').then(m => m.cookies());
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet) {
          const cookieStore = await import('next/headers').then(m => m.cookies());
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === '/';
  const isProtectedRoute = pathname.startsWith('/inicio') ||
    pathname.startsWith('/clientes') ||
    pathname.startsWith('/fiados') ||
    pathname.startsWith('/abonos') ||
    pathname.startsWith('/actividad') ||
    pathname.startsWith('/morosos') ||
    pathname.startsWith('/metricas') ||
    pathname.startsWith('/configuracion');

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/inicio', request.url));
  }

  return response;
}