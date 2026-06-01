export function formatearMoneda(valor: number): string {
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
  return formatted.replace('CO$', '$').trim();
}

export function formatearFecha(fecha: string): string {
  const date = new Date(fecha);
  const dia = date.getDate();
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mes = meses[date.getMonth()];
  const año = date.getFullYear();
  return `${dia} de ${mes}, ${año}`;
}

export function formatearFechaCorta(fecha: string): string {
  const date = new Date(fecha);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[date.getMonth()]} ${date.getDate()}`;
}

export function formatearHora(fecha: string): string {
  const date = new Date(fecha);
  return date.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function calcularDiasMora(ultimaFecha: string): number {
  const fecha = new Date(ultimaFecha);
  const hoy = new Date();
  const diffTime = hoy.getTime() - fecha.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export interface EstadoMoraResult {
  estado: 'al_dia' | 'moroso' | 'critico';
  label: string;
  color: string;
  bgColor: string;
  emoji: string;
}

export function calcularEstadoMora(saldo: number, diasSinMovimiento: number): EstadoMoraResult {
  if (saldo === 0) {
    return { estado: 'al_dia', label: 'Al día', color: 'text-green-600', bgColor: 'bg-green-50', emoji: '🟢' };
  }
  if (diasSinMovimiento < 15) {
    return { estado: 'al_dia', label: 'Al día', color: 'text-green-600', bgColor: 'bg-green-50', emoji: '🟢' };
  }
  if (diasSinMovimiento < 30) {
    return { estado: 'moroso', label: 'Moroso', color: 'text-orange-600', bgColor: 'bg-orange-50', emoji: '🟠' };
  }
  return { estado: 'critico', label: 'Crítico', color: 'text-red-600', bgColor: 'bg-red-50', emoji: '🔴' };
}