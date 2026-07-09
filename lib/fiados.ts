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

// ============================================================
// Lógica del formulario de "Nuevo Fiado" (extraída del componente para testearla).
// ============================================================

/**
 * Item de producto del formulario. Cantidad y valor_unitario se guardan como
 * texto (input libre, el usuario puede borrar el campo mientras escribe) y se
 * convierten a número al validar/calcular.
 */
export interface ProductoFiado {
  producto: string;
  cantidad: string;
  valor_unitario: string;
}

/**
 * ¿El renglón califica como producto válido para enviar al servidor?
 * Mismo criterio que usa la API: nombre no vacío, cantidad > 0, valor > 0.
 */
export function esProductoValido(p: ProductoFiado): boolean {
  return p.producto.trim() !== '' && Number(p.cantidad) > 0 && Number(p.valor_unitario) > 0;
}

/** Renglones que se van a enviar al servidor. */
export function filtrarProductosValidos(productos: ProductoFiado[]): ProductoFiado[] {
  return productos.filter(esProductoValido);
}

/**
 * Renglones con algo escrito (nombre o valor) que NO califican como válidos.
 * Importante para no descartarlos en silencio: si se ignoraran, el total
 * mostrado no coincidiría con lo guardado. El formulario los bloquea antes
 * de confirmar.
 */
export function filtrarProductosIncompletos(productos: ProductoFiado[]): ProductoFiado[] {
  const validos = filtrarProductosValidos(productos);
  return productos.filter(
    p => !validos.includes(p) && (p.producto.trim() !== '' || p.valor_unitario.trim() !== '')
  );
}

/** Suma de subtotales de los productos válidos. */
export function calcularTotalFiado(productos: ProductoFiado[]): number {
  return filtrarProductosValidos(productos).reduce(
    (sum, p) => sum + Number(p.cantidad) * Number(p.valor_unitario),
    0
  );
}

/** Crédito disponible = tope − saldo actual. Puede ser 0 o negativo. */
export function calcularDisponible(saldo: number, tope: number): number {
  return tope - saldo;
}

/** Nuevo saldo si se confirma el fiado = saldo actual + total. */
export function calcularNuevoSaldo(saldo: number, total: number): number {
  return saldo + total;
}

/** ¿El fiado supera el tope de crédito? */
export function superaTopeCredito(nuevoSaldo: number, tope: number): boolean {
  return nuevoSaldo > tope;
}

