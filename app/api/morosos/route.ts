import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth-guard';

export async function GET() {
  try {
    const auth = await requireUser({ rol: 'dueño' });
    if ('error' in auth) return auth.error;

    const supabase = supabaseAdmin;

    // Consultar la vista que ya calcula dias_sin_movimiento y estado_mora en SQL
    // para evitar divergencias con el cálculo en JavaScript.
    const { data, error } = await supabase
      .from('vista_estado_mora')
      .select('id, nombre, apodo, celular, estado, tope_credito, saldo, dias_sin_movimiento, ultimo_movimiento, estado_mora')
      .gt('saldo', 0)
      .order('saldo', { ascending: false });

    if (error) {
      console.error('Error fetching vista_estado_mora:', error);
      return NextResponse.json({ error: 'Error al obtener morosos' }, { status: 500 });
    }

    const todos = data || [];

    let totalMorosos = 0;
    let totalCriticos = 0;
    let deudaMorosos = 0;
    let deudaCriticos = 0;
    let carteraTotal = 0;

    for (const c of todos) {
      carteraTotal += c.saldo;
      if (c.estado_mora === 'moroso' || c.estado_mora === 'critico') {
        totalMorosos++;
        if (c.estado_mora === 'critico') {
          totalCriticos++;
          deudaCriticos += c.saldo;
        } else {
          deudaMorosos += c.saldo;
        }
      }
    }

    const porcentajeEnRiesgo = carteraTotal > 0
      ? Math.round(((deudaMorosos + deudaCriticos) / carteraTotal) * 1000) / 10
      : 0;

    const clientesConMora = todos
      .filter(c => c.estado_mora !== 'al_dia')
      .sort((a, b) => {
        const orden = { critico: 0, moroso: 1, al_dia: 2 } as Record<string, number>;
        const diff = orden[a.estado_mora] - orden[b.estado_mora];
        return diff !== 0 ? diff : b.saldo - a.saldo;
      })
      .map(c => ({
        id: c.id,
        nombre: c.nombre,
        apodo: c.apodo,
        celular: c.celular,
        saldo: c.saldo,
        tope_credito: c.tope_credito,
        dias_sin_movimiento: c.dias_sin_movimiento,
        ultimo_movimiento: c.ultimo_movimiento ?? null,
        estado_mora: c.estado_mora as 'moroso' | 'critico',
      }));

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
