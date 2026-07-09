import { describe, it, expect } from 'vitest';
import {
  MONTO_MAX,
  CANTIDAD_MAX,
  esNumeroPositivo,
  esEnteroPositivo,
  esNumeroNoNegativo,
  parseEntero,
} from '@/lib/validation';

describe('validation constants', () => {
  it('expone topes superiores razonables', () => {
    expect(MONTO_MAX).toBe(50_000_000);
    expect(CANTIDAD_MAX).toBe(100_000);
  });
});

describe('esNumeroPositivo', () => {
  it('acepta numeros reales finitos > 0 dentro del max', () => {
    expect(esNumeroPositivo(1)).toBe(true);
    expect(esNumeroPositivo(100)).toBe(true);
    expect(esNumeroPositivo(3.14)).toBe(true); // admite decimales
    expect(esNumeroPositivo(MONTO_MAX)).toBe(true); // limite inclusive
  });

  it('rechaza 0 y negativos', () => {
    expect(esNumeroPositivo(0)).toBe(false);
    expect(esNumeroPositivo(-1)).toBe(false);
    expect(esNumeroPositivo(-0.5)).toBe(false);
  });

  it('rechaza valores por encima del max', () => {
    expect(esNumeroPositivo(MONTO_MAX + 1)).toBe(false);
  });

  it('respeta un max personalizado', () => {
    expect(esNumeroPositivo(150, 100)).toBe(false);
    expect(esNumeroPositivo(100, 100)).toBe(true);
  });

  it('rechaza strings, NaN e Infinity (evita coercion)', () => {
    expect(esNumeroPositivo('100')).toBe(false);
    expect(esNumeroPositivo('abc')).toBe(false);
    expect(esNumeroPositivo(NaN)).toBe(false);
    expect(esNumeroPositivo(Infinity)).toBe(false);
    expect(esNumeroPositivo(-Infinity)).toBe(false);
  });

  it('rechaza null/undefined/boolean', () => {
    expect(esNumeroPositivo(null)).toBe(false);
    expect(esNumeroPositivo(undefined)).toBe(false);
    expect(esNumeroPositivo(true)).toBe(false);
  });

  it('afina el tipo a number (type guard)', () => {
    const v: unknown = 5;
    if (esNumeroPositivo(v)) {
      // TypeScript infiere number aqui
      expect(v + 1).toBe(6);
    }
  });
});

describe('esEnteroPositivo', () => {
  it('acepta enteros > 0 dentro del max', () => {
    expect(esEnteroPositivo(1)).toBe(true);
    expect(esEnteroPositivo(100)).toBe(true);
    expect(esEnteroPositivo(MONTO_MAX)).toBe(true);
  });

  it('rechaza decimales (COP no admite centavos)', () => {
    expect(esEnteroPositivo(3.14)).toBe(false);
    expect(esEnteroPositivo(0.5)).toBe(false);
  });

  it('rechaza 0, negativos, strings y no-finitos', () => {
    expect(esEnteroPositivo(0)).toBe(false);
    expect(esEnteroPositivo(-2)).toBe(false);
    expect(esEnteroPositivo('5')).toBe(false);
    expect(esEnteroPositivo(NaN)).toBe(false);
    expect(esEnteroPositivo(Infinity)).toBe(false);
  });

  it('respeta CANTIDAD_MAX cuando se pasa explicitamente', () => {
    expect(esEnteroPositivo(100_001, CANTIDAD_MAX)).toBe(false);
    expect(esEnteroPositivo(CANTIDAD_MAX, CANTIDAD_MAX)).toBe(true);
  });
});

describe('esNumeroNoNegativo', () => {
  it('acepta 0 y positivos', () => {
    expect(esNumeroNoNegativo(0)).toBe(true);
    expect(esNumeroNoNegativo(0.5)).toBe(true);
    expect(esNumeroNoNegativo(100)).toBe(true);
  });

  it('rechaza negativos', () => {
    expect(esNumeroNoNegativo(-0.01)).toBe(false);
    expect(esNumeroNoNegativo(-100)).toBe(false);
  });

  it('rechaza no-finitos y strings', () => {
    expect(esNumeroNoNegativo(Infinity)).toBe(false);
    expect(esNumeroNoNegativo(NaN)).toBe(false);
    expect(esNumeroNoNegativo('0')).toBe(false);
  });
});

describe('parseEntero', () => {
  it('parsea enteros en base 10', () => {
    expect(parseEntero('10', 1)).toBe(10);
    expect(parseEntero('0', 5)).toBe(0);
  });

  it('no interpreta como octal (08 = 8, no invalido)', () => {
    expect(parseEntero('08', 1)).toBe(8);
    expect(parseEntero('010', 1)).toBe(10);
  });

  it('trunca decimales del string (parseInt, no parseFloat)', () => {
    expect(parseEntero('12.9', 1)).toBe(12);
  });

  it('devuelve el default si el valor es invalido o ausente', () => {
    expect(parseEntero(null, 42)).toBe(42);
    expect(parseEntero(undefined, 42)).toBe(42);
    expect(parseEntero('', 42)).toBe(42);
    expect(parseEntero('abc', 42)).toBe(42);
  });

  it('acepta defaults negativos o cero (no asume > 0)', () => {
    expect(parseEntero(null, 0)).toBe(0);
    expect(parseEntero(null, -5)).toBe(-5);
  });
});
