// Lógica de negocio de fiados compartida entre API routes y componentes cliente.
// Antes estaba duplicada en 4 archivos; centralizarla aquí permite testearla.

/** Ventana de tiempo en que un tendero puede cancelar su propio fiado (ms). */
export const VENTANA_CANCELACION_MS = 5 * 60 * 1000;

/**
 * ¿Puede el usuario cancelar este fiado?
 * - El dueño siempre puede.
 * - El tendero solo dentro de los {@link VENTANA_CANCELACION_MS} ms posteriores
 *   a la creación, y solo si fue él quien lo creó.
 */
export function puedeCancelarFiado(
  fiado: { created_at: string; usuario_id: string },
  usuarioId: string,
  esDueño: boolean,
  ahora: () => number = Date.now
): boolean {
  if (esDueño) return true;

  const hace5Min = new Date(ahora() - VENTANA_CANCELACION_MS);
  const creado = new Date(fiado.created_at);

  return creado > hace5Min && fiado.usuario_id === usuarioId;
}
