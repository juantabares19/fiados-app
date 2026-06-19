// M2/M3: manejo de fechas en hora de Colombia (UTC-5 fijo, sin horario de verano).
//
// El servidor (Vercel) corre en UTC. Construir límites de día como
// `${fecha}T00:00:00` (sin offset) o derivar "hoy" de new Date() en UTC
// desplazaba los rangos 5 horas, metiendo movimientos en el día equivocado.
// Aquí se centraliza el cálculo con el offset de Colombia.

export const OFFSET_COLOMBIA = '-05:00';

/** Instante actual desplazado para que sus componentes UTC reflejen la hora de pared en Colombia. */
function ahoraColombia(): Date {
  return new Date(Date.now() - 5 * 60 * 60 * 1000);
}

/** Fecha de hoy en Colombia como 'YYYY-MM-DD'. */
export function fechaHoyColombia(): string {
  return ahoraColombia().toISOString().slice(0, 10);
}

/** Año y mes (0-based) actuales en Colombia. */
export function anioMesColombia(): { anio: number; mes: number } {
  const n = ahoraColombia();
  return { anio: n.getUTCFullYear(), mes: n.getUTCMonth() };
}

/** Formatea componentes de calendario como 'YYYY-MM-DD' (mes 0-based). */
export function fechaYMD(anio: number, mes: number, dia: number): string {
  return new Date(Date.UTC(anio, mes, dia)).toISOString().slice(0, 10);
}

/** Inicio del día en Colombia como timestamptz para filtrar created_at. */
export function inicioDia(fecha: string): string {
  return `${fecha}T00:00:00${OFFSET_COLOMBIA}`;
}

/** Fin del día en Colombia (inclusivo) como timestamptz para filtrar created_at. */
export function finDia(fecha: string): string {
  return `${fecha}T23:59:59.999${OFFSET_COLOMBIA}`;
}
