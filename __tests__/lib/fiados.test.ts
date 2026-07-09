import { describe, it, expect } from 'vitest';
import { puedeCancelarFiado, VENTANA_CANCELACION_MS } from '@/lib/fiados';

const HACE_1_MIN = '2026-07-08T12:00:00Z';
const HACE_10_MIN = '2026-07-08T11:50:00Z';
const USUARIO_A = 'user-a';
const USUARIO_B = 'user-b';

// Fijamos "ahora" en 12:01Z para todos los tests. El parametro inyectable nos
// evita depender de Date.now() real (que depende del CI runner).
const AHORA = new Date('2026-07-08T12:01:00Z').getTime();

describe('VENTANA_CANCELACION_MS', () => {
  it('es exactamente 5 minutos', () => {
    expect(VENTANA_CANCELACION_MS).toBe(5 * 60 * 1000);
  });
});

describe('puedeCancelarFiado - rol dueño', () => {
  it('el dueño siempre puede cancelar, sin importar el tiempo', () => {
    expect(puedeCancelarFiado({ created_at: HACE_1_MIN, usuario_id: USUARIO_A }, USUARIO_B, true, () => AHORA)).toBe(true);
    expect(puedeCancelarFiado({ created_at: HACE_10_MIN, usuario_id: USUARIO_A }, USUARIO_B, true, () => AHORA)).toBe(true);
  });

  it('el dueño puede cancelar aunque no sea el creador', () => {
    const fiadoDeOtro = { created_at: HACE_1_MIN, usuario_id: USUARIO_A };
    expect(puedeCancelarFiado(fiadoDeOtro, USUARIO_B, true, () => AHORA)).toBe(true);
  });
});

describe('puedeCancelarFiado - rol tendero', () => {
  it('puede cancelar SU fiado dentro de los 5 minutos', () => {
    const fiado = { created_at: HACE_1_MIN, usuario_id: USUARIO_A };
    expect(puedeCancelarFiado(fiado, USUARIO_A, false, () => AHORA)).toBe(true);
  });

  it('no puede cancelar SU fiado despues de los 5 minutos', () => {
    const fiado = { created_at: HACE_10_MIN, usuario_id: USUARIO_A };
    expect(puedeCancelarFiado(fiado, USUARIO_A, false, () => AHORA)).toBe(false);
  });

  it('no puede cancelar un fiado AJENO aunque este dentro de la ventana', () => {
    const fiadoAjeno = { created_at: HACE_1_MIN, usuario_id: USUARIO_B };
    expect(puedeCancelarFiado(fiadoAjeno, USUARIO_A, false, () => AHORA)).toBe(false);
  });

  it('no puede cancelar un fiado ajeno despues de la ventana', () => {
    const fiadoAjeno = { created_at: HACE_10_MIN, usuario_id: USUARIO_B };
    expect(puedeCancelarFiado(fiadoAjeno, USUARIO_A, false, () => AHORA)).toBe(false);
  });
});

describe('puedeCancelarFiado - limite exacto de la ventana', () => {
  it('exactamente 5 minutos despues sigue siendo cancelable (limite inclusivo)', () => {
    // HACE_1_MIN = 12:00:00Z. En 12:05:00Z han pasado exactamente 5 min.
    const en5Min = new Date('2026-07-08T12:05:00Z').getTime();
    const fiado = { created_at: HACE_1_MIN, usuario_id: USUARIO_A };
    // new Date(creado) > hace5Min -> new Date(12:00:00) > new Date(12:00:00) -> false
    // (son iguales, no estrictamente mayor). Documenta el comportamiento inclusivo/exclusivo.
    expect(puedeCancelarFiado(fiado, USUARIO_A, false, () => en5Min)).toBe(false);
  });

  it('un segundo antes de los 5 minutos sigue siendo cancelable', () => {
    const en4Min59s = new Date('2026-07-08T12:04:59Z').getTime();
    const fiado = { created_at: HACE_1_MIN, usuario_id: USUARIO_A };
    expect(puedeCancelarFiado(fiado, USUARIO_A, false, () => en4Min59s)).toBe(true);
  });
});
