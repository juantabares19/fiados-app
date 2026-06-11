import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
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
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usuario = await verifyToken(token);
    if (!usuario) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    }

    const supabase = supabaseAdmin;

    const { data: config, error } = await supabase
      .from('configuracion')
      .select('clave, valor')
      .order('clave', { ascending: true });

    if (error) {
      console.error('Error fetching configuracion:', error);
      return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
    }

    const configMap: Record<string, string> = {};
    (config || []).forEach(c => {
      configMap[c.clave] = c.valor;
    });

    return NextResponse.json(configMap);
  } catch (error) {
    console.error('GET /api/configuracion error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('=');
      acc[name] = value;
      return acc;
    }, {} as Record<string, string>);

    const token = cookies['session_token'];
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const usuario = await verifyToken(token);
    if (!usuario) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
    }

    if (usuario.rol !== 'dueño') {
      return NextResponse.json({ error: 'Solo el dueño puede editar la configuración' }, { status: 403 });
    }

    const body = await request.json();
    const { clave, valor } = body;

    if (!clave || valor === undefined) {
      return NextResponse.json({ error: 'Clave y valor son requeridos' }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    const { data, error } = await supabase
      .from('configuracion')
      .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
      .select()
      .single();

    if (error) {
      console.error('Error updating configuracion:', error);
      return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('PUT /api/configuracion error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}