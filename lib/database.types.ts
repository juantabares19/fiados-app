// Tipos para resultados de Supabase con relaciones anidadas.
// Usados en API routes para reemplazar dobles assertions (as unknown as).

export interface UsuarioRelacion {
  id: string;
  nombre: string;
}

export interface ClienteRelacion {
  nombre: string;
}

export interface FiadoConRelaciones {
  id: string;
  cliente_id: string;
  quien_pidio: string;
  familiar: string | null;
  nota: string | null;
  total: number;
  created_at: string;
  usuario_id: string;
  clientes: ClienteRelacion | null;
  usuarios: UsuarioRelacion | null;
}

export interface AbonoConRelaciones {
  id: string;
  cliente_id: string;
  monto: number;
  metodo_pago: string;
  nota: string | null;
  created_at: string;
  usuario_id: string;
  clientes: ClienteRelacion | null;
  usuarios: UsuarioRelacion | null;
}

export interface FiadoConUsuario {
  id: string;
  total: number;
  quien_pidio: string;
  familiar: string | null;
  nota: string | null;
  created_at: string;
  usuario_id: string;
  usuarios: UsuarioRelacion | null;
}

export interface AbonoConUsuario {
  id: string;
  monto: number;
  metodo_pago: string;
  nota: string | null;
  created_at: string;
  usuarios: UsuarioRelacion | null;
}
