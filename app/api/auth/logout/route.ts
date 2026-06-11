import { NextResponse } from 'next/server';
import { deleteSessionCookie, verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['session_token'];
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        await supabaseAdmin
          .from('usuarios')
          .update({ token_version: (payload.token_version ?? 0) + 1 })
          .eq('id', payload.id);
      }
    }

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', deleteSessionCookie());
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', deleteSessionCookie());
    return response;
  }
}
