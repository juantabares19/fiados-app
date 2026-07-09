import { describe, it, expect } from 'vitest';
import {
  esProductoValido,
  filtrarProductosValidos,
  filtrarProductosIncompletos,
  calcularTotalFiado,
  calcularDisponible,
  calcularNuevoSaldo,
  superaTopeCredito,
  type ProductoFiado,
} from '@/lib/fiados';

const p = (producto: string, cantidad: string, valor_unitario: string): ProductoFiado => ({
  producto,
  cantidad,
  valor_unitario,
});

describe('esProductoValido', () => {
  it('es valido cuando tiene nombre, cantidad > 0 y valor > 0', () => {
    expect(esProductoValido(p('Huevos', '2', '3000'))).toBe(true);
    expect(esProductoValido(p('Leche', '1', '3500'))).toBe(true);
  });

  it('requiere nombre no vacio', () => {
    expect(esProductoValido(p('', '2', '3000'))).toBe(false);
    expect(esProductoValido(p('   ', '2', '3000'))).toBe(false);
  });

  it('rechaza cantidad 0 o vacia', () => {
    expect(esProductoValido(p('Huevos', '0', '3000'))).toBe(false);
    expect(esProductoValido(p('Huevos', '', '3000'))).toBe(false);
  });

  it('rechaza valor 0 o vacio', () => {
    expect(esProductoValido(p('Huevos', '2', '0'))).toBe(false);
    expect(esProductoValido(p('Huevos', '2', ''))).toBe(false);
  });

  it('rechaza valores negativos', () => {
    expect(esProductoValido(p('Huevos', '-2', '3000'))).toBe(false);
    expect(esProductoValido(p('Huevos', '2', '-3000'))).toBe(false);
  });
});

describe('filtrarProductosValidos', () => {
  it('mantiene solo los renglones completos', () => {
    const productos = [
      p('Huevos', '2', '3000'), // valido
      p('Leche', '1', '3500'), // valido
      p('', '1', '1000'), // sin nombre
      p('Pan', '0', '1000'), // cantidad 0
    ];
    const validos = filtrarProductosValidos(productos);
    expect(validos).toHaveLength(2);
    expect(validos[0].producto).toBe('Huevos');
    expect(validos[1].producto).toBe('Leche');
  });

  it('acepta lista vacia', () => {
    expect(filtrarProductosValidos([])).toEqual([]);
  });
});

describe('filtrarProductosIncompletos', () => {
  it('marca renglones a medio llenar (tienen algo pero no califican)', () => {
    const productos = [
      p('Huevos', '2', '3000'), // valido -> no incompleto
      p('Pan', '', '1000'), // sin cantidad -> incompleto
      p('', '2', '3000'), // sin nombre pero con valor -> incompleto
      p('', '', ''), // totalmente vacio -> NO incompleto (se ignora en silencio)
    ];
    const incompletos = filtrarProductosIncompletos(productos);
    expect(incompletos).toHaveLength(2);
    expect(incompletos.map(i => i.producto)).toEqual(['Pan', '']);
  });

  it('devuelve vacio si todos son validos o todos estan vacios', () => {
    expect(filtrarProductosIncompletos([p('A', '1', '1'), p('B', '2', '2')])).toEqual([]);
    expect(filtrarProductosIncompletos([p('', '', ''), p('', '', '')])).toEqual([]);
  });
});

describe('calcularTotalFiado', () => {
  it('suma los subtotales de los productos validos', () => {
    const productos = [
      p('Huevos', '2', '3000'), // 6000
      p('Leche', '1', '3500'), // 3500
      p('Pan', '0', '1000'), // ignorado (cantidad 0)
    ];
    expect(calcularTotalFiado(productos)).toBe(9500);
  });

  it('devuelve 0 si no hay productos validos', () => {
    expect(calcularTotalFiado([])).toBe(0);
    expect(calcularTotalFiado([p('', '', '')])).toBe(0);
    expect(calcularTotalFiado([p('A', '0', '0')])).toBe(0);
  });

  it('acepta valores grandes (hasta topes COP)', () => {
    expect(calcularTotalFiado([p('X', '100', '500000')])).toBe(50_000_000);
  });
});

describe('calcularDisponible', () => {
  it('resta el saldo del tope', () => {
    expect(calcularDisponible(0, 50000)).toBe(50000);
    expect(calcularDisponible(20000, 50000)).toBe(30000);
    expect(calcularDisponible(50000, 50000)).toBe(0);
  });

  it('permite saldo mayor al tope (deuda sobrepassada)', () => {
    expect(calcularDisponible(60000, 50000)).toBe(-10000);
  });
});

describe('calcularNuevoSaldo', () => {
  it('suma el total al saldo actual', () => {
    expect(calcularNuevoSaldo(0, 9500)).toBe(9500);
    expect(calcularNuevoSaldo(20000, 9500)).toBe(29500);
  });
});

describe('superaTopeCredito', () => {
  it('true cuando el nuevo saldo supera el tope', () => {
    expect(superaTopeCredito(60000, 50000)).toBe(true);
    expect(superaTopeCredito(1, 0)).toBe(true);
  });

  it('false cuando el nuevo saldo iguala el tope (limite inclusivo)', () => {
    expect(superaTopeCredito(50000, 50000)).toBe(false);
  });

  it('false cuando el nuevo saldo esta por debajo del tope', () => {
    expect(superaTopeCredito(49999, 50000)).toBe(false);
    expect(superaTopeCredito(0, 50000)).toBe(false);
  });
});

describe('escenario integrado: carrito mixto', () => {
  it('calcula correctamente con productos validos, incompletos y vacios juntos', () => {
    const productos = [
      p('Huevos', '2', '3000'), // 6000
      p('Leche', '1', '3500'), // 3500
      p('Queso', '', '5000'), // incompleto (falta cantidad)
      p('', '', ''), // vacio
    ];
    const saldoActual = 20000;
    const tope = 50000;

    expect(filtrarProductosValidos(productos)).toHaveLength(2);
    expect(filtrarProductosIncompletos(productos)).toHaveLength(1);
    const total = calcularTotalFiado(productos);
    expect(total).toBe(9500);
    const nuevoSaldo = calcularNuevoSaldo(saldoActual, total);
    expect(nuevoSaldo).toBe(29500);
    expect(calcularDisponible(saldoActual, tope)).toBe(30000);
    expect(superaTopeCredito(nuevoSaldo, tope)).toBe(false);
  });
});
