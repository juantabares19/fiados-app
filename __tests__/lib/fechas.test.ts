import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  OFFSET_COLOMBIA,
  fechaHoyColombia,
  anioMesColombia,
  fechaYMD,
  inicioDia,
  finDia,
} from '@/lib/fechas';

describe('OFFSET_COLOMBIA', () => {
  it('es UTC-5 fijo (sin DST)', () => {
    expect(OFFSET_COLOMBIA).toBe('-05:00');
  });
});

describe('fechaYMD', () => {
  it('formatea componentes (mes 0-based) como YYYY-MM-DD', () => {
    expect(fechaYMD(2026, 0, 5)).toBe('2026-01-05'); // enero = 0
    expect(fechaYMD(2026, 11, 31)).toBe('2026-12-31'); // diciembre = 11
    expect(fechaYMD(2026, 6, 8)).toBe('2026-07-08'); // con padding de cero
  });

  it('hace padding de ceros a 2 digitos para mes y dia', () => {
    expect(fechaYMD(2026, 1, 1)).toBe('2026-02-01'); // febrero dia 1
  });
});

describe('inicioDia / finDia', () => {
  it('construye el inicio del dia con offset Colombia', () => {
    expect(inicioDia('2026-07-08')).toBe('2026-07-08T00:00:00-05:00');
  });

  it('construye el fin del dia inclusivo con milisegundos', () => {
    expect(finDia('2026-07-08')).toBe('2026-07-08T23:59:59.999-05:00');
  });

  it('es estable respecto al huso del servidor (siempre -05:00)', () => {
    // Asegura que el rango no depende de process.env.TZ
    expect(inicioDia('2026-01-15')).toContain('-05:00');
    expect(finDia('2026-01-15')).toContain('-05:00');
  });
});

// Las funciones que dependen de "ahora" se prueban con fake timers para evitar
// depender de la hora real del servidor CI.
describe('fechaHoyColombia / anioMesColombia', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fechaHoyColombia: a las 23:30 UTC devuelve el mismo dia (18:30 Colombia)', () => {
    // 2026-07-08T23:30:00Z = 2026-07-08T18:30:00-05:00 -> hoy sigue siendo 08
    vi.setSystemTime(new Date('2026-07-08T23:30:00Z'));
    expect(fechaHoyColombia()).toBe('2026-07-08');
  });

  it('fechaHoyColombia: a las 04:00 UTC (23:00 del dia anterior en Colombia) devuelve el dia anterior', () => {
    // 2026-07-09T04:00:00Z = 2026-07-08T23:00:00-05:00 -> en Colombia sigue siendo 08
    vi.setSystemTime(new Date('2026-07-09T04:00:00Z'));
    expect(fechaHoyColombia()).toBe('2026-07-08');
  });

  it('fechaHoyColombia: limite justo del offset (05:00:00Z = 00:00:00 Colombia, dia nuevo)', () => {
    vi.setSystemTime(new Date('2026-07-09T05:00:00Z'));
    expect(fechaHoyColombia()).toBe('2026-07-09');
  });

  it('anioMesColombia devuelve anio y mes 0-based en hora Colombia', () => {
    // 2026-07-09T04:30:00Z = 2026-07-08T23:30:00-05:00 -> mes junio (5) en Colombia
    vi.setSystemTime(new Date('2026-07-09T04:30:00Z'));
    expect(anioMesColombia()).toEqual({ anio: 2026, mes: 6 }); // 08 de julio = mes 6 (0-based)

    // Caso limite: 23:30 UTC del 31 dic 2026 = 18:30 del 31 dic Colombia
    vi.setSystemTime(new Date('2026-12-31T23:30:00Z'));
    expect(anioMesColombia()).toEqual({ anio: 2026, mes: 11 });

    // 04:30 UTC del 1 ene 2027 = 23:30 del 31 dic 2026 Colombia (anio y mes del dia anterior)
    vi.setSystemTime(new Date('2027-01-01T04:30:00Z'));
    expect(anioMesColombia()).toEqual({ anio: 2026, mes: 11 });
  });

  it('fechaHoyColombia devuelve string YYYY-MM-DD valido (regex)', () => {
    vi.setSystemTime(new Date('2026-07-08T12:00:00Z'));
    expect(fechaHoyColombia()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
