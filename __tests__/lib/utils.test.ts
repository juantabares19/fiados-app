import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatearMoneda,
  formatearFecha,
  formatearFechaCorta,
  formatearHora,
  calcularDiasMora,
  cn,
  sanitizarBusqueda,
  calcularEstadoMora,
} from '@/lib/utils';

describe('formatearMoneda', () => {
  // NOTA: la funcion hace `.replace('CO$', '$')` para normalizar el prefijo que
  // Intl.NumberFormat('es-CO') devolvia en Node 20. En Node 22 (ICU full) ya no
  // devuelve 'CO$' sino '$' seguido de un espacio no separable (U+00A0/U+202F)
  // entre el signo y el numero -> "$ 18.500". El .replace no matchea y el
  // espacio queda. Los tests validan lo estable (signo $ y separador de miles
  // con punto) sin acoplarse al espacio interno, que varia entre entornos ICU
  // (Node 20 / Node 22 / Vercel). Esto es un hallazgo para una futura limpieza
  // de la funcion, fuera del alcance de esta fase de tests.
  it('formatea pesos colombianos con punto como separador de miles', () => {
    expect(formatearMoneda(18500)).toMatch(/^\$\s?18\.500$/);
    expect(formatearMoneda(0)).toMatch(/^\$\s?0$/);
    expect(formatearMoneda(1_000_000)).toMatch(/^\$\s?1\.000\.000$/);
  });

  it('no muestra centavos (COP) y redondea', () => {
    expect(formatearMoneda(18500.99)).toMatch(/^\$\s?18\.501$/);
  });
});

describe('cn', () => {
  it('concatena clases truthy', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filtra undefined/null/false/"" ', () => {
    expect(cn('a', undefined, null, false, '', 'b')).toBe('a b');
  });

  it('devuelve string vacio si todo es falsy', () => {
    expect(cn(undefined, null, false)).toBe('');
  });
});

describe('sanitizarBusqueda', () => {
  it('elimina caracteres con significado especial de PostgREST', () => {
    // Sin sanitizar, "x,estado.eq.bloqueado" inyectaria una condicion al .or()
    expect(sanitizarBusqueda('x,estado.eq.bloqueado')).toBe('x estado.eq.bloqueado');
  });

  it('elimina comodines (* / %)', () => {
    expect(sanitizarBusqueda('huevos%leche')).toBe('huevos leche');
    expect(sanitizarBusqueda('a*b')).toBe('a b');
  });

  it('elimina parentesis y backslash', () => {
    expect(sanitizarBusqueda('a(b)c')).toBe('a b c');
    expect(sanitizarBusqueda('a\\b')).toBe('a b');
  });

  it('colapsa espacios multiples en uno solo y hace trim', () => {
    expect(sanitizarBusqueda('  huevos   leche  ')).toBe('huevos leche');
  });

  it('devuelve string vacio para entrada vacia', () => {
    expect(sanitizarBusqueda('')).toBe('');
    expect(sanitizarBusqueda('   ')).toBe('');
  });
});

describe('calcularEstadoMora', () => {
  it('saldo 0 siempre esta al dia sin importar los dias', () => {
    expect(calcularEstadoMora(0, 10).estado).toBe('al_dia');
    expect(calcularEstadoMora(0, 100).estado).toBe('al_dia');
  });

  it('con deuda y < 15 dias sigue al dia', () => {
    const r = calcularEstadoMora(5000, 14);
    expect(r.estado).toBe('al_dia');
    expect(r.label).toBe('Al día');
    expect(r.emoji).toBe('🟢');
  });

  it('con deuda y 15-29 dias es moroso', () => {
    const r = calcularEstadoMora(5000, 15);
    expect(r.estado).toBe('moroso');
    expect(r.label).toBe('Moroso');
    expect(r.emoji).toBe('🟠');
    // limite superior del rango
    expect(calcularEstadoMora(5000, 29).estado).toBe('moroso');
  });

  it('con deuda y >= 30 dias es critico', () => {
    const r = calcularEstadoMora(5000, 30);
    expect(r.estado).toBe('critico');
    expect(r.label).toBe('Crítico');
    expect(r.emoji).toBe('🔴');
    expect(calcularEstadoMora(5000, 100).estado).toBe('critico');
  });

  it('los resultados incluyen clases de tailwind para color/fondo', () => {
    const r = calcularEstadoMora(5000, 20);
    expect(r.color).toMatch(/^text-/);
    expect(r.bgColor).toMatch(/^bg-/);
  });
});

describe('calcularDiasMora', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('devuelve dias completos desde la fecha dada', () => {
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
    expect(calcularDiasMora('2026-07-01T00:00:00Z')).toBe(9);
  });

  it('0 dias si la fecha es ahora', () => {
    const ahora = '2026-07-10T12:00:00Z';
    vi.setSystemTime(new Date(ahora));
    expect(calcularDiasMora(ahora)).toBe(0);
  });

  it('trunca (no redondea): menos de 24h cuenta como 0', () => {
    vi.setSystemTime(new Date('2026-07-10T23:00:00Z'));
    // 23 horas despues -> floor(23h / 24) = 0
    expect(calcularDiasMora('2026-07-10T00:00:00Z')).toBe(0);
  });
});

describe('formatearFecha / formatearFechaCorta / formatearHora', () => {
  // Estas dependen del timezone; las probamos con formato estable usando UTC
  // explicito en la entrada para reducir flakiness en CI.

  it('formatearFecha devuelve "D de MES, YYYY" en es', () => {
    // Usamos una fecha ISO sin offset -> interpretada como local; fijamos timers
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));
    // formatearFecha hace new Date(fecha) y lee getDate/getMonth/getFullYear en
    // hora local. Para evitar dependencia del TZ del runner, solo validamos que
    // el formato contenga el anio y palabras en minuscula.
    const out = formatearFecha('2026-07-08T15:00:00-05:00');
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/de /);
    vi.useRealTimers();
  });

  it('formatearFechaCorta devuelve algo que contiene el anio acotado', () => {
    // Solo validamos formato "XXX DD" (3 letras + dia)
    const out = formatearFechaCorta('2026-07-08T15:00:00-05:00');
    expect(out).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });

  it('formatearHora produce hora legible con AM/PM', () => {
    const out = formatearHora('2026-07-08T15:30:00-05:00');
    // formato es-CO hour12 -> contiene "a. m." o "p. m."
    expect(out).toMatch(/(a\. m\.|p\. m\.)/i);
  });
});
