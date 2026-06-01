import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    const supabase = await createClient();

    const { data: clientes, error } = await supabase
      .from('saldos_clientes')
      .select('id, nombre, apodo, celular, estado, saldo, tope_credito')
      .gt('saldo', 0)
      .order('saldo', { ascending: false });

    if (error) {
      console.error('Error fetching saldos:', error);
      return NextResponse.json({ error: 'Error al obtener morosos' }, { status: 500 });
    }

    const clienteIds = (clientes || []).map(c => c.id);

    const { data: ultimosFiados } = await supabase
      .from('fiados')
      .select('cliente_id, created_at')
      .in('cliente_id', clienteIds)
      .order('created_at', { ascending: false });

    const { data: ultimosAbonos } = await supabase
      .from('abonos')
      .select('cliente_id, created_at')
      .in('cliente_id', clienteIds)
      .order('created_at', { ascending: false });

    const ultimoMovimientoPorCliente: Record<string, string> = {};

    (ultimosFiados || []).forEach(f => {
      const actual = ultimoMovimientoPorCliente[f.cliente_id];
      if (!actual || f.created_at > actual) {
        ultimoMovimientoPorCliente[f.cliente_id] = f.created_at;
      }
    });

    (ultimosAbonos || []).forEach(a => {
      const actual = ultimoMovimientoPorCliente[a.cliente_id];
      if (!actual || a.created_at > actual) {
        ultimoMovimientoPorCliente[a.cliente_id] = a.created_at;
      }
    });

    const hoy = new Date();
    let totalMorosos = 0;
    let totalCriticos = 0;
    let deudaMorosos = 0;
    let deudaCriticos = 0;
    let carteraTotal = 0;

    const clientesConMora = (clientes || []).map(cliente => {
      const ultimoMovimiento = ultimoMovimientoPorCliente[cliente.id];
      let diasSinMovimiento = 0;

      if (ultimoMovimiento) {
        const fechaMov = new Date(ultimoMovimiento);
        const diffTime = hoy.getTime() - fechaMov.getTime();
        diasSinMovimiento = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      let estadoMora: 'al_dia' | 'moroso' | 'critico' = 'al_dia';
      if (cliente.saldo > 0) {
        if (diasSinMovimiento >= 30) estadoMora = 'critico';
        else if (diasSinMovimiento >= 15) estadoMora = 'moroso';
      }

      carteraTotal += cliente.saldo;

      if (estadoMora === 'moroso' || estadoMora === 'critico') {
        totalMorosos++;
        if (estadoMora === 'critico') totalCriticos++;
      }

      if (estadoMora === 'moroso') deudaMorosos += cliente.saldo;
      if (estadoMora === 'critico') deudaCriticos += cliente.saldo;

      return {
        id: cliente.id,
        nombre: cliente.nombre,
        apodo: cliente.apodo,
        celular: cliente.celular,
        saldo: cliente.saldo,
        tope_credito: cliente.tope_credito,
        dias_sin_movimiento: diasSinMovimiento,
        ultimo_movimiento: ultimoMovimiento || null,
        estado_mora: estadoMora,
      };
    });

    clientesConMora.sort((a, b) => {
      const estadoOrden = { critico: 0, moroso: 1, al_dia: 2 };
      const diffEstado = estadoOrden[a.estado_mora] - estadoOrden[b.estado_mora];
      if (diffEstado !== 0) return diffEstado;
      return b.saldo - a.saldo;
    });

    const porcentajeEnRiesgo = carteraTotal > 0
      ? Math.round(((deudaMorosos + deudaCriticos) / carteraTotal) * 1000) / 10
      : 0;

    return NextResponse.json({
      resumen: {
        total_morosos: totalMorosos,
        total_criticos: totalCriticos,
        deuda_morosos: deudaMorosos,
        deuda_criticos: deudaCriticos,
        cartera_total: carteraTotal,
        porcentaje_en_riesgo: porcentajeEnRiesgo,
      },
      clientes: clientesConMora,
    });
  } catch (error) {
    console.error('GET /api/morosos error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}