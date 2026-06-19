// H4: validación de inputs numéricos en el borde (antes de tocar la BD/RPC).
// Evita coerción de strings ("100"), NaN/Infinity, negativos y montos absurdos.

/** Tope superior razonable para montos en COP de una tienda de barrio. */
export const MONTO_MAX = 50_000_000;

/** Tope superior para cantidades (kg, unidades, etc.). */
export const CANTIDAD_MAX = 100_000;

/** Es un número real finito, > 0 y <= max. Rechaza strings, NaN e Infinity. */
export function esNumeroPositivo(v: unknown, max = MONTO_MAX): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max;
}

/**
 * Es un entero > 0 y <= max. Para dinero/cantidades en COP (sin centavos): exige
 * enteros para que no haya errores de coma flotante en los cálculos.
 */
export function esEnteroPositivo(v: unknown, max = MONTO_MAX): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max;
}

/** Es un número real finito, >= 0 y <= max. */
export function esNumeroNoNegativo(v: unknown, max = MONTO_MAX): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
}

/** Parsea un entero en base 10 desde un query param; devuelve el default si es inválido (NaN). */
export function parseEntero(valor: string | null | undefined, porDefecto: number): number {
  const n = parseInt(valor ?? '', 10);
  return Number.isFinite(n) ? n : porDefecto;
}
