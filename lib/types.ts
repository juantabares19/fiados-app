export interface Usuario {
  id: string;
  nombre: string;
  celular: string;
  pin: string;
  rol: 'dueño' | 'tendero';
  activo: boolean;
  created_at: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  apodo: string | null;
  celular: string;
  tope_credito: number;
  estado: 'activo' | 'bloqueado';
  familiares: string | null;
  created_by: string;
  created_at: string;
}

export interface ClienteConSaldo extends Cliente {
  saldo: number;
}

export interface Fiado {
  id: string;
  cliente_id: string;
  usuario_id: string;
  quien_pidio: 'cliente' | 'familiar';
  familiar: string | null;
  nota: string | null;
  total: number;
  created_at: string;
  cliente?: Cliente;
  usuario?: Usuario;
  detalles?: FiadoDetalle[];
}

export interface FiadoDetalle {
  id: string;
  fiado_id: string;
  producto: string;
  cantidad: number;
  valor_unitario: number;
  subtotal: number;
}

export interface Abono {
  id: string;
  cliente_id: string;
  usuario_id: string;
  monto: number;
  metodo_pago: 'efectivo' | 'nequi' | 'daviplata' | 'llaves' | 'otro';
  nota: string | null;
  created_at: string;
  cliente?: Cliente;
  usuario?: Usuario;
}

export interface Auditoria {
  id: string;
  tabla: string;
  registro_id: string;
  accion: 'crear' | 'editar' | 'eliminar';
  usuario_id: string;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  created_at: string;
}

export interface SaldoCliente {
  id: string;
  nombre: string;
  celular: string;
  estado: string;
  total_fiados: number;
  total_abonos: number;
  saldo: number;
}

export interface Session {
  id: string;
  user: {
    id: string;
    email?: string;
    phone?: string;
  };
  access_token: string;
  refresh_token: string;
}