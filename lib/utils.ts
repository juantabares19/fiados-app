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