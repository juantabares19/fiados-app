import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

function getPeriodDates(tipo: string, desde?: string, hasta?: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (tipo) {
    case 'mes_actual': {
      const desde = new Date(year, month, 1);
      const hasta = new Date(year, month + 1, 0);
      return { desde, hasta, label: now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) };
    }
    case 'mes_anterior': {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const desde = new Date(prevYear, prevMonth, 1);
      const hasta = new Date(prevYear, prevMonth + 1, 0);
      return { desde, hasta, label: new Date(prevYear, prevMonth, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) };
    }
    case 'ultimos_30': {
      const hasta = new Date(year, month + 1, 0);
      const desde = new Date(hasta);
      desde.setDate(desde.getDate() - 29);
      return { desde, hasta, label: 'Últimos 30 días' };
    }
    case 'ultimos_90': {
      const hasta = new Date(year, month + 1, 0);
      const desde = new Date(hasta);
      desde.setDate(desde.getDate() - 89);
      return { desde, hasta, label: 'Últimos 90 días' };
    }
    case 'personalizado': {
      if (!desde || !hasta) {
        throw new Error('Se requiere desde y hasta para periodo personalizado');
      }
      const desdeDate = new Date(desde);
      const hastaDate = new Date(hasta);
      return { desde: desdeDate, hasta: hastaDate, label: `${desde} al ${hasta}` };
    }
    default: {
      const desde = new Date(year, month, 1);
      const hasta = new Date(year, month + 1, 0);
      return { desde, hasta, label: now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) };
    }
  }
}

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

    if (usuario.rol !== 'dueño') {
      return NextResponse.json({ error: 'Solo el dueño puede ver métricas' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const periodoTipo = searchParams.get('periodo') || 'mes_actual';
    const desdeParam = searchParams.get('desde');
    const hastaParam = searchParams.get('hasta');

    let periodoInfo;
    try {
      periodoInfo = getPeriodDates(periodoTipo, desdeParam || undefined, hastaParam || undefined);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    const desdeStr = periodoInfo.desde.toISOString().split('T')[0];
    const hastaStr = periodoInfo.hasta.toISOString();

    const fiadosPromises = await Promise.all([
      supabase
        .from('fiados')
        .select('id, total, created_at, cliente_id')
        .gte('created_at', desdeStr)
        .lte('created_at', hastaStr),

      supabase
        .from('abonos')
        .select('id, monto, metodo_pago, created_at')
        .gte('created_at', desdeStr)
        .lte('created_at', hastaStr),

      supabase
        .from('saldos_clientes')
        .select('id, nombre, saldo')
        .order('saldo', { ascending: false }),

      supabase
        .from('vista_estado_mora')
        .select('id, estado_mora, saldo')
    ]);

    const [fiadosResult, abonosResult, saldosResult, estadoMoraResult] = fiadosPromises;

    const fiados = fiadosResult.data || [];
    const abonos = abonosResult.data || [];
    const saldos = saldosResult.data || [];
    const estadoMora = estadoMoraResult.data || [];

    const totalFiado = fiados.reduce((sum, f) => sum + (f.total || 0), 0);
    const totalAbonado = abonos.reduce((sum, a) => sum + (a.monto || 0), 0);
    const recuperacionPorcentaje = totalFiado > 0 ? (totalAbonado / totalFiado) * 100 : 0;
    const recuperacionDiferencia = totalAbonado - totalFiado;

    const carteraTotal = saldos.reduce((sum, s) => sum + (s.saldo || 0), 0);
    const clientesConDeuda = saldos.filter(s => (s.saldo || 0) > 0).length;
    const clientesAlDia = estadoMora.filter(e => e.estado_mora === 'al_dia').length;
    const deudaPromedio = clientesConDeuda > 0 ? Math.round(carteraTotal / clientesConDeuda) : 0;

    const morososCount = estadoMora.filter(e => e.estado_mora === 'moroso').length;
    const criticosCount = estadoMora.filter(e => e.estado_mora === 'critico').length;
    const carteraEnRiesgo = estadoMora
      .filter(e => e.estado_mora === 'moroso' || e.estado_mora === 'critico')
      .reduce((sum, e) => sum + (e.saldo || 0), 0);
    const porcentajeEnRiesgo = carteraTotal > 0 ? Math.round((carteraEnRiesgo / carteraTotal) * 1000) / 10 : 0;

    const metodosMap: Record<string, { cantidad: number; total: number }> = {};
    abonos.forEach(a => {
      const metodo = a.metodo_pago || 'otro';
      if (!metodosMap[metodo]) {
        metodosMap[metodo] = { cantidad: 0, total: 0 };
      }
      metodosMap[metodo].cantidad++;
      metodosMap[metodo].total += a.monto || 0;
    });

    const metodosPago = Object.entries(metodosMap)
      .map(([metodo, data]) => ({
        metodo,
        cantidad: data.cantidad,
        total: data.total,
        porcentaje: totalAbonado > 0 ? Math.round((data.total / totalAbonado) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.total - a.total);

    const topDeudores = saldos
      .filter(s => (s.saldo || 0) > 0)
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        nombre: s.nombre,
        saldo: s.saldo || 0
      }));

    const semanasSet: Record<string, { fiado: number; abonado: number }> = {};
    fiados.forEach(f => {
      const fecha = new Date(f.created_at);
      const dayOfWeek = fecha.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(fecha);
      monday.setDate(fecha.getDate() - diffToMonday);
      const weekKey = monday.toISOString().split('T')[0];
      if (!semanasSet[weekKey]) {
        semanasSet[weekKey] = { fiado: 0, abonado: 0 };
      }
      semanasSet[weekKey].fiado += f.total || 0;
    });

    abonos.forEach(a => {
      const fecha = new Date(a.created_at);
      const dayOfWeek = fecha.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(fecha);
      monday.setDate(fecha.getDate() - diffToMonday);
      const weekKey = monday.toISOString().split('T')[0];
      if (!semanasSet[weekKey]) {
        semanasSet[weekKey] = { fiado: 0, abonado: 0 };
      }
      semanasSet[weekKey].abonado += a.monto || 0;
    });

    const tendenciaSemanal = Object.entries(semanasSet)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3)
      .map(([weekStart, data]) => {
        const start = new Date(weekStart);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const formatDate = (d: Date) => d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
        return {
          semana: `${formatDate(start)} - ${formatDate(end)}`,
          fiado: data.fiado,
          abonado: data.abonado
        };
      });

    let tiempoPromedioPago = 0;
    const [primerFiadoResult, primerAbonoResult] = await Promise.all([
      supabase.from('fiados').select('cliente_id, created_at').order('created_at', { ascending: true }),
      supabase.from('abonos').select('cliente_id, created_at').order('created_at', { ascending: true }),
    ]);

    const primerFiadoPorCliente: Record<string, string> = {};
    (primerFiadoResult.data || []).forEach(f => {
      if (!primerFiadoPorCliente[f.cliente_id]) {
        primerFiadoPorCliente[f.cliente_id] = f.created_at;
      }
    });

    const primerAbonoPorCliente: Record<string, string> = {};
    (primerAbonoResult.data || []).forEach(a => {
      if (!primerAbonoPorCliente[a.cliente_id]) {
        primerAbonoPorCliente[a.cliente_id] = a.created_at;
      }
    });

    const tiempos: number[] = [];
    for (const clienteId of Object.keys(primerFiadoPorCliente)) {
      if (primerAbonoPorCliente[clienteId]) {
        const primerFiado = new Date(primerFiadoPorCliente[clienteId]);
        const primerAbono = new Date(primerAbonoPorCliente[clienteId]);
        const diffDays = Math.max(0, Math.round((primerAbono.getTime() - primerFiado.getTime()) / (1000 * 60 * 60 * 24)));
        tiempos.push(diffDays);
      }
    }
    if (tiempos.length > 0) {
      tiempoPromedioPago = Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length);
    }

    return NextResponse.json({
      periodo: {
        tipo: periodoTipo,
        desde: desdeStr,
        hasta: hastaStr.split('T')[0],
        label: periodoInfo.label
      },
      fiados: {
        cantidad: fiados.length,
        total: totalFiado
      },
      abonos: {
        cantidad: abonos.length,
        total: totalAbonado
      },
      recuperacion: {
        porcentaje: Math.round(recuperacionPorcentaje * 10) / 10,
        diferencia: recuperacionDiferencia
      },
      cartera: {
        total: carteraTotal,
        clientes_con_deuda: clientesConDeuda,
        clientes_al_dia: clientesAlDia,
        deuda_promedio: deudaPromedio
      },
      mora: {
        morosos: morososCount,
        criticos: criticosCount,
        cartera_en_riesgo: carteraEnRiesgo,
        porcentaje_en_riesgo: Math.round(porcentajeEnRiesgo * 10) / 10
      },
      metodos_pago: metodosPago,
      top_deudores: topDeudores,
      tendencia_semanal: tendenciaSemanal,
      tiempo_promedio_pago: tiempoPromedioPago
    });
  } catch (error) {
    console.error('GET /api/metricas error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}