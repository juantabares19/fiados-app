import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSessionCookie, verifyToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST() {
  try {
    const token = (await cookies()).get('session_token')?.value;
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
