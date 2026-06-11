export function formatearCelularWhatsApp(celular: string): string {
  if (!celular) return '';

  let numero = celular.replace(/\D/g, '');

  if (numero.startsWith('57') && numero.length === 12) {
    numero = numero.substring(2);
  } else if (numero.startsWith('+57') && numero.length === 13) {
    numero = numero.substring(3);
  } else if (numero.startsWith('3') && numero.length === 10) {
  } else if (numero.length === 10 && numero.startsWith('3')) {
  } else {
    return '';
  }

  return `57${numero}`;
}

export function generarLinkWhatsApp(celular: string, mensaje: string): string {
  const numeroFormateado = formatearCelularWhatsApp(celular);
  if (!numeroFormateado) return '';
  const mensajeEncoded = encodeURIComponent(mensaje);
  return `https://wa.me/${numeroFormateado}?text=${mensajeEncoded}`;
}

export function abrirWhatsApp(celular: string, mensaje: string): boolean {
  const link = generarLinkWhatsApp(celular, mensaje);
  if (!link) return false;

  if (typeof window !== 'undefined') {
    window.open(link, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}

export function generarMensajeEstadoCuenta(cliente: { nombre: string; saldo: number }, nombreTienda: string): string {
  const lineas: string[] = [];

  lineas.push(`Hola ${cliente.nombre}, aquí está tu estado de cuenta en *${nombreTienda}*:`);
  lineas.push('');
  lineas.push(`💰 *Saldo pendiente: ${formatearMonedaLocal(cliente.saldo)}*`);
  lineas.push('');
  lineas.push('Gracias por tu preferencia. ¡Te esperamos!');

  return lineas.join('\n');
}

export function generarMensajeRecordatorio(cliente: { nombre: string; saldo: number }, nombreTienda: string): string {
  const lineas: string[] = [];

  lineas.push(`Hola ${cliente.nombre}, te saludamos de *${nombreTienda}*.`);
  lineas.push('');
  lineas.push(`Te recordamos que tienes un saldo pendiente de *${formatearMonedaLocal(cliente.saldo)}*.`);
  lineas.push('');
  lineas.push('Puedes acercarte a la tienda cuando te sea posible. ¡Gracias!');

  return lineas.join('\n');
}

export function generarMensajeConfirmacionFiado(
  cliente: { nombre: string },
  nombreTienda: string,
  fiado: { productos: Array<{ producto: string; cantidad: number; subtotal: number }>; total: number },
  nuevoSaldo: number
): string {
  const lineas: string[] = [];

  lineas.push(`Hola ${cliente.nombre}, se registró un fiado en *${nombreTienda}*:`);
  lineas.push('');
  lineas.push('🛒 *Detalle:*');

  fiado.productos.forEach(prod => {
    lineas.push(`• ${prod.producto} x${prod.cantidad} — ${formatearMonedaLocal(prod.subtotal)}`);
  });

  lineas.push('');
  lineas.push(`*Total: ${formatearMonedaLocal(fiado.total)}*`);
  lineas.push('');
  lineas.push(`💰 *Tu saldo pendiente es: ${formatearMonedaLocal(nuevoSaldo)}*`);
  lineas.push('');
  lineas.push('¡Gracias por tu compra!');

  return lineas.join('\n');
}

export function generarMensajeConfirmacionAbono(
  cliente: { nombre: string },
  nombreTienda: string,
  abono: { monto: number; metodo_pago: string },
  nuevoSaldo: number
): string {
  const lineas: string[] = [];

  lineas.push(`Hola ${cliente.nombre}, recibimos tu abono en *${nombreTienda}*:`);
  lineas.push('');
  lineas.push(`✅ *Abono: ${formatearMonedaLocal(abono.monto)}*`);
  lineas.push(`Método: ${abono.metodo_pago.charAt(0).toUpperCase() + abono.metodo_pago.slice(1)}`);
  lineas.push('');

  if (nuevoSaldo === 0) {
    lineas.push('🎉 *¡Estás al día! Saldo: $0*');
  } else {
    lineas.push(`💰 *Tu saldo pendiente es: ${formatearMonedaLocal(nuevoSaldo)}*`);
  }

  lineas.push('');
  lineas.push('¡Gracias por tu pago!');

  return lineas.join('\n');
}

export class BotonWhatsApp {
  static enviar(celular: string, mensaje: string): boolean {
    return abrirWhatsApp(celular, mensaje);
  }
}

function formatearMonedaLocal(valor: number): string {
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
  return formatted.replace('CO$', '$').trim();
}