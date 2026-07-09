import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatearCelularWhatsApp,
  generarLinkWhatsApp,
  abrirWhatsApp,
  generarMensajeEstadoCuenta,
  generarMensajeRecordatorio,
  generarMensajeConfirmacionFiado,
  generarMensajeConfirmacionAbono,
  BotonWhatsApp,
} from '@/lib/whatsapp';

describe('formatearCelularWhatsApp', () => {
  it('acepta celular colombiano de 10 digitos empezando por 3', () => {
    expect(formatearCelularWhatsApp('3001234567')).toBe('573001234567');
  });

  it('acepta celular con prefijo 57 (12 digitos) y lo normaliza', () => {
    expect(formatearCelularWhatsApp('573001234567')).toBe('573001234567');
  });

  it('acepta celular con +57 (13 digitos) y lo normaliza', () => {
    expect(formatearCelularWhatsApp('+573001234567')).toBe('573001234567');
  });

  it('limpia caracteres no numericos (espacios, guiones) antes de validar', () => {
    expect(formatearCelularWhatsApp('300 123 4567')).toBe('573001234567');
    expect(formatearCelularWhatsApp('300-123-4567')).toBe('573001234567');
  });

  it('rechaza numeros que no empiezan por 3 (fijos, etc.)', () => {
    expect(formatearCelularWhatsApp('6011234567')).toBe(''); // 10 digitos pero empieza en 6
  });

  it('rechaza longitudes invalidas', () => {
    expect(formatearCelularWhatsApp('12345')).toBe('');
    expect(formatearCelularWhatsApp('300123456')).toBe(''); // 9 digitos
    expect(formatearCelularWhatsApp('30012345678')).toBe(''); // 11 digitos
  });

  it('rechaza entradas vacias o no numericas', () => {
    expect(formatearCelularWhatsApp('')).toBe('');
    expect(formatearCelularWhatsApp('abcdefghij')).toBe('');
  });
});

describe('generarLinkWhatsApp', () => {
  it('genera un deep link wa.me con el mensaje encoded', () => {
    expect(generarLinkWhatsApp('3001234567', 'Hola')).toBe(
      'https://wa.me/573001234567?text=Hola'
    );
  });

  it('encodea espacios y caracteres especiales del mensaje', () => {
    expect(generarLinkWhatsApp('3001234567', 'Hola mundo')).toBe(
      'https://wa.me/573001234567?text=Hola%20mundo'
    );
    expect(generarLinkWhatsApp('3001234567', 'Hola & adiós ¿qué tal?')).toContain(
      'text=Hola%20%26%20adi%C3%B3s%20%C2%BFqu%C3%A9%20tal%3F'
    );
  });

  it('devuelve string vacio si el celular es invalido', () => {
    expect(generarLinkWhatsApp('12345', 'Hola')).toBe('');
    expect(generarLinkWhatsApp('', 'Hola')).toBe('');
  });
});

describe('abrirWhatsApp', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { open: vi.fn(() => null) });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('abre una ventana con el link generado y retorna true', () => {
    const spy = vi.mocked(window.open);
    const ok = abrirWhatsApp('3001234567', 'Hola');
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      'https://wa.me/573001234567?text=Hola',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('retorna false y no abre nada si el celular es invalido', () => {
    const spy = vi.mocked(window.open);
    const ok = abrirWhatsApp('12345', 'Hola');
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  // Nota: el caso "sin window" (SSR) no se testea aqui porque jsdom siempre
  // provee window. La guarda `typeof window === 'undefined'` en abrirWhatsApp
  // esta cubierta estaticamente y se ejercita en el server runtime real.
});

describe('BotonWhatsApp.enviar', () => {
  it('delega en abrirWhatsApp', () => {
    vi.stubGlobal('window', { open: vi.fn(() => null) });
    expect(BotonWhatsApp.enviar('3001234567', 'Hola')).toBe(true);
    expect(BotonWhatsApp.enviar('invalido', 'Hola')).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('generadores de mensajes', () => {
  // Los montos se formatean con Intl.NumberFormat('es-CO'); en Node 22 (ICU full)
  // queda "$ 18.500" (espacio U+00A0 entre $ y el numero). Validamos con regex
  // de espacio opcional para no acoplarnos al detalle del locale. Ver nota en
  // utils.test.ts > formatearMoneda.
  const monto = (n: string) => expect.stringMatching(new RegExp(`\\$\\s?${n.replace(/\./g, '\\.')}`));

  const cliente = { nombre: 'Juan', saldo: 18500 };
  const tienda = 'La Esquina';

  describe('generarMensajeEstadoCuenta', () => {
    it('incluye saludo, nombre del cliente, tienda y saldo', () => {
      const msg = generarMensajeEstadoCuenta(cliente, tienda);
      expect(msg).toContain('Juan');
      expect(msg).toContain('La Esquina');
      expect(msg).toEqual(monto('18.500'));
      expect(msg).toContain('Saldo pendiente');
    });
  });

  describe('generarMensajeRecordatorio', () => {
    it('menciona el saldo pendiente', () => {
      const msg = generarMensajeRecordatorio(cliente, tienda);
      expect(msg).toContain('Juan');
      expect(msg).toContain('saldo pendiente');
      expect(msg).toEqual(monto('18.500'));
    });
  });

  describe('generarMensajeConfirmacionFiado', () => {
    it('lista cada producto con cantidad y subtotal, y el total', () => {
      const msg = generarMensajeConfirmacionFiado(
        cliente,
        tienda,
        {
          productos: [
            { producto: 'Huevos', cantidad: 2, subtotal: 6000 },
            { producto: 'Leche', cantidad: 1, subtotal: 3500 },
          ],
          total: 9500,
        },
        9500
      );
      expect(msg).toContain('Huevos x2');
      expect(msg).toContain('Leche x1');
      // el total y el nuevo saldo aparecen; ambos son 9.500
      const matches = msg.match(/\$\s?9\.500/g);
      expect(matches?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generarMensajeConfirmacionAbono', () => {
    it('incluye monto, metodo capitalizado y saldo restante', () => {
      const msg = generarMensajeConfirmacionAbono(
        cliente,
        tienda,
        { monto: 5000, metodo_pago: 'efectivo' },
        13500
      );
      expect(msg).toEqual(monto('5.000'));
      expect(msg).toContain('Efectivo'); // primera letra en mayuscula
      expect(msg).toEqual(monto('13.500'));
    });

    it('si el saldo queda en 0 muestra mensaje de estar al dia', () => {
      const msg = generarMensajeConfirmacionAbono(
        cliente,
        tienda,
        { monto: 18500, metodo_pago: 'nequi' },
        0
      );
      expect(msg).toContain('al día');
      expect(msg).toMatch(/\$\s?0/);
    });
  });
});
