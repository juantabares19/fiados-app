import { NextResponse } from 'next/server';
import { verifyToken, type UsuarioPayload } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

type AuthOk = { usuario: UsuarioPayload };
type AuthErr = { error: NextResponse };

function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  // Tolera valores con '=' (base64) y espacios; toma solo la cookie session_token.
  const match = cookieHeader.match(/(?:^|;\s*)session_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Verifica la sesión en CADA request de la API:
 *  1. Cookie + firma del JWT.
 *  2. Estado de la cuenta y revocación: compara `activo` y `token_version`
 *     contra la BD. Esto cierra C4 — sin esto, un JWT viejo seguía siendo
 *     válido hasta 7 días tras logout o desactivación de la cuenta.
 *  3. (Opcional) rol requerido.
 *
 * Uso:
 *   const auth = await requireUser(request);            // cualquier rol
 *   const auth = await requireUser(request, { rol: 'dueño' });
 *   if ('error' in auth) return auth.error;
 *   const { usuario } = auth;
 */
export async function requireUser(
  request: Request,
  opts?: { rol?: 'dueño' }
): Promise<AuthOk | AuthErr> {
  const token = getSessionToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const usuario = await verifyToken(token);
  if (!usuario) {
    return { error: NextResponse.json({ error: 'Sesión inválida' }, { status: 401 }) };
  }

  const { data: dbUser } = await supabaseAdmin
    .from('usuarios')
    .select('activo, token_version')
    .eq('id', usuario.id)
    .single();

  if (!dbUser || !dbUser.activo || dbUser.token_version !== (usuario.token_version ?? -1)) {
    return {
      error: NextResponse.json(
        { error: 'Sesión revocada o cuenta inactiva' },
        { status: 401 }
      ),
    };
  }

  if (opts?.rol === 'dueño' && usuario.rol !== 'dueño') {
    return {
      error: NextResponse.json(
        { error: 'No tienes permiso para esta acción' },
        { status: 403 }
      ),
    };
  }

  return { usuario };
}
