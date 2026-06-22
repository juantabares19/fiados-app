import { jsPDF } from 'jspdf';
import { formatearMoneda, formatearFecha, formatearHora } from '@/lib/utils';

export interface DetallePDF {
  producto: string;
  cantidad: number;
  valor_unitario: number;
  subtotal: number;
}

export interface MovimientoPDF {
  tipo: 'fiado' | 'abono';
  id: string;
  created_at: string;
  total?: number;
  monto?: number;
  metodo_pago?: string;
  nota?: string | null;
  quien_pidio?: 'cliente' | 'familiar';
  familiar?: string | null;
  detalles?: DetallePDF[];
}

export interface ResumenPDF {
  total_fiado: number;
  total_abonado: number;
  saldo: number;
}

export interface ClientePDF {
  nombre: string;
  celular: string;
}

function nombreArchivo(nombre: string): string {
  const slug = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'cliente';
  const hoy = new Date().toISOString().slice(0, 10);
  return `estado-cuenta-${slug}-${hoy}.pdf`;
}

/**
 * Arma el estado de cuenta de un cliente como PDF.
 * IMPORTANTE: todos los importes provienen de la BD (subtotales y totales
 * guardados, y el saldo de la vista saldos_clientes). No se recalcula nada aquí,
 * para que el cliente vea exactamente lo registrado.
 */
export function generarEstadoCuentaPDF(opts: {
  cliente: ClientePDF;
  movimientos: MovimientoPDF[];
  resumen: ResumenPDF;
  nombreTienda: string;
}): { blob: Blob; filename: string } {
  const { cliente, movimientos, resumen, nombreTienda } = opts;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const rightX = pageW - margin;
  const lh = 5; // alto de línea
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const linea = () => {
    doc.setDrawColor(220);
    doc.line(margin, y, rightX, y);
    y += 3;
  };

  // --- Encabezado ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(nombreTienda || 'Mi Tienda', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Estado de cuenta', margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generado: ${formatearFecha(new Date().toISOString())} ${formatearHora(new Date().toISOString())}`, margin, y);
  y += 6;
  doc.setTextColor(0);

  // --- Datos del cliente ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Cliente: ${cliente.nombre}`, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const cel = cliente.celular?.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') ?? '';
  doc.text(`Celular: ${cel}`, margin, y);
  y += 5;
  linea();

  // --- Movimientos (orden cronológico ascendente, como un extracto) ---
  const ordenados = [...movimientos].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  ensure(lh);
  doc.text('Detalle de movimientos', margin, y);
  y += lh + 1;

  if (ordenados.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Sin movimientos registrados.', margin, y);
    y += lh;
  }

  doc.setFontSize(10);
  for (const m of ordenados) {
    const fechaStr = `${formatearFecha(m.created_at)} · ${formatearHora(m.created_at)}`;

    if (m.tipo === 'fiado') {
      ensure(lh * 2);
      doc.setFont('helvetica', 'bold');
      doc.text(`Fiado — ${fechaStr}`, margin, y);
      doc.text(formatearMoneda(m.total ?? 0), rightX, y, { align: 'right' });
      y += lh;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80);
      for (const d of m.detalles ?? []) {
        const izq = `   ${d.cantidad} x ${d.producto}  (${formatearMoneda(d.valor_unitario)} c/u)`;
        const wrapped = doc.splitTextToSize(izq, rightX - margin - 30);
        ensure(wrapped.length * lh);
        doc.text(wrapped, margin, y);
        doc.text(formatearMoneda(d.subtotal), rightX, y, { align: 'right' });
        y += wrapped.length * lh;
      }
      if (m.quien_pidio === 'familiar' && m.familiar) {
        ensure(lh);
        doc.text(`   Pidió: ${m.familiar}`, margin, y);
        y += lh;
      }
      if (m.nota) {
        ensure(lh);
        doc.text(`   Nota: ${m.nota}`, margin, y);
        y += lh;
      }
      doc.setTextColor(0);
      y += 1;
    } else {
      ensure(lh);
      doc.setFont('helvetica', 'bold');
      const metodo = m.metodo_pago ? ` (${m.metodo_pago})` : '';
      doc.text(`Abono${metodo} — ${fechaStr}`, margin, y);
      doc.text(`- ${formatearMoneda(m.monto ?? 0)}`, rightX, y, { align: 'right' });
      y += lh;
      doc.setFont('helvetica', 'normal');
      if (m.nota) {
        doc.setTextColor(80);
        ensure(lh);
        doc.text(`   Nota: ${m.nota}`, margin, y);
        doc.setTextColor(0);
        y += lh;
      }
      y += 1;
    }
  }

  // --- Resumen ---
  y += 2;
  ensure(lh * 4 + 4);
  linea();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Total fiado:', margin, y);
  doc.text(formatearMoneda(resumen.total_fiado), rightX, y, { align: 'right' });
  y += lh + 1;
  doc.text('Total abonado:', margin, y);
  doc.text(formatearMoneda(resumen.total_abonado), rightX, y, { align: 'right' });
  y += lh + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Saldo pendiente:', margin, y);
  doc.text(formatearMoneda(resumen.saldo), rightX, y, { align: 'right' });
  y += lh + 4;

  // --- Pie ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130);
  ensure(lh * 2);
  doc.text(
    'Este documento es un resumen informativo de sus compras a crédito y abonos.',
    margin,
    y
  );

  const blob = doc.output('blob');
  return { blob, filename: nombreArchivo(cliente.nombre) };
}

/**
 * Genera el resumen de deuda activa de un cliente como PDF.
 * Solo incluye fiados (compras a crédito); el llamador ya pre-filtra movimientos a tipo === 'fiado'.
 */
export function generarDeudaActivaPDF(opts: {
  cliente: ClientePDF;
  movimientos: MovimientoPDF[];
  resumen: ResumenPDF;
  nombreTienda: string;
}): { blob: Blob; filename: string } {
  const { cliente, movimientos, resumen, nombreTienda } = opts;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const rightX = pageW - margin;
  const lh = 5;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const linea = () => {
    doc.setDrawColor(220);
    doc.line(margin, y, rightX, y);
    y += 3;
  };

  // --- Encabezado ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(nombreTienda || 'Mi Tienda', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Resumen de deuda activa', margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generado: ${formatearFecha(new Date().toISOString())} ${formatearHora(new Date().toISOString())}`, margin, y);
  y += 6;
  doc.setTextColor(0);

  // --- Datos del cliente ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Cliente: ${cliente.nombre}`, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const cel = cliente.celular?.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') ?? '';
  doc.text(`Celular: ${cel}`, margin, y);
  y += 5;
  linea();

  // --- Fiados (orden cronológico ascendente) ---
  const ordenados = [...movimientos].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  ensure(lh);
  doc.text('Compras a crédito', margin, y);
  y += lh + 1;

  if (ordenados.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Sin compras registradas.', margin, y);
    y += lh;
  }

  doc.setFontSize(10);
  for (const m of ordenados) {
    const fechaStr = `${formatearFecha(m.created_at)} · ${formatearHora(m.created_at)}`;
    ensure(lh * 2);
    doc.setFont('helvetica', 'bold');
    doc.text(`Fiado — ${fechaStr}`, margin, y);
    doc.text(formatearMoneda(m.total ?? 0), rightX, y, { align: 'right' });
    y += lh;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    for (const d of m.detalles ?? []) {
      const izq = `   ${d.cantidad} x ${d.producto}  (${formatearMoneda(d.valor_unitario)} c/u)`;
      const wrapped = doc.splitTextToSize(izq, rightX - margin - 30);
      ensure(wrapped.length * lh);
      doc.text(wrapped, margin, y);
      doc.text(formatearMoneda(d.subtotal), rightX, y, { align: 'right' });
      y += wrapped.length * lh;
    }
    if (m.quien_pidio === 'familiar' && m.familiar) {
      ensure(lh);
      doc.text(`   Pidió: ${m.familiar}`, margin, y);
      y += lh;
    }
    if (m.nota) {
      ensure(lh);
      doc.text(`   Nota: ${m.nota}`, margin, y);
      y += lh;
    }
    doc.setTextColor(0);
    y += 1;
  }

  // --- Resumen ---
  y += 2;
  ensure(lh * 4 + 4);
  linea();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Total compras a crédito:', margin, y);
  doc.text(formatearMoneda(resumen.total_fiado), rightX, y, { align: 'right' });
  y += lh + 1;
  doc.text('Total abonado:', margin, y);
  doc.text(formatearMoneda(resumen.total_abonado), rightX, y, { align: 'right' });
  y += lh + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Saldo pendiente:', margin, y);
  doc.text(formatearMoneda(resumen.saldo), rightX, y, { align: 'right' });
  y += lh + 4;

  // --- Pie ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(130);
  ensure(lh * 2);
  doc.text(
    'Este documento muestra las compras a crédito pendientes de pago.',
    margin,
    y
  );

  const slug = cliente.nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'cliente';
  const hoy = new Date().toISOString().slice(0, 10);
  const blob = doc.output('blob');
  return { blob, filename: `deuda-activa-${slug}-${hoy}.pdf` };
}

/**
 * Comparte el PDF con el menú nativo del dispositivo (WhatsApp/correo/etc.) si
 * está disponible; si no, lo descarga. Cliente-only.
 */
export async function compartirODescargarPDF(blob: Blob, filename: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (nav.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      // El usuario canceló el diálogo de compartir: no descargamos como respaldo.
      if (err instanceof Error && err.name === 'AbortError') return;
      // Cualquier otro error: caemos a descarga.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
