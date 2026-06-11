-- ================================================
-- Fiados App - Base de datos Supabase
-- ================================================

-- ================================================
-- TABLA: usuarios
-- ================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    celular VARCHAR(15) NOT NULL UNIQUE,
    pin VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('dueño', 'tendero')),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE usuarios IS 'Usuarios que atienden la tienda (dueño o tendero)';
COMMENT ON COLUMN usuarios.pin IS 'Hash bcrypt del PIN de 4 dígitos';

-- ================================================
-- TABLA: clientes
-- ================================================
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    apodo VARCHAR(50),
    celular VARCHAR(15) NOT NULL,
    tope_credito DECIMAL(12,2) NOT NULL DEFAULT 50000,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'bloqueado')),
    familiares TEXT,
    created_by UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE clientes IS 'Clientes que fían en la tienda';

-- ================================================
-- TABLA: fiados
-- ================================================
CREATE TABLE IF NOT EXISTS fiados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    quien_pidio VARCHAR(20) NOT NULL DEFAULT 'cliente' CHECK (quien_pidio IN ('cliente', 'familiar')),
    familiar VARCHAR(100),
    nota TEXT,
    total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE fiados IS 'Cada compra fiada';

-- ================================================
-- TABLA: fiado_detalle
-- ================================================
CREATE TABLE IF NOT EXISTS fiado_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiado_id UUID NOT NULL REFERENCES fiados(id) ON DELETE CASCADE,
    producto VARCHAR(150) NOT NULL,
    cantidad DECIMAL(8,2) NOT NULL DEFAULT 1,
    valor_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL
);

COMMENT ON TABLE fiado_detalle IS 'Productos de cada fiado';

-- ================================================
-- TABLA: abonos
-- ================================================
CREATE TABLE IF NOT EXISTS abonos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    monto DECIMAL(12,2) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL CHECK (metodo_pago IN ('efectivo', 'nequi', 'daviplata', 'llaves', 'otro')),
    nota TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE abonos IS 'Pagos parciales o totales';

-- ================================================
-- TABLA: auditoria
-- ================================================
CREATE TABLE IF NOT EXISTS auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla VARCHAR(50) NOT NULL,
    registro_id UUID NOT NULL,
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('crear', 'editar', 'eliminar')),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    datos_antes JSONB,
    datos_despues JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE auditoria IS 'Registro de todo lo que pasa en el sistema';

-- ================================================
-- TABLA: configuracion
-- ================================================
CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(100) PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE configuracion IS 'Configuración general de la tienda (nombre, preferencias, etc.)';

INSERT INTO configuracion (clave, valor)
VALUES ('nombre_tienda', 'Mi Tienda')
ON CONFLICT (clave) DO NOTHING;

-- ================================================
-- ÍNDICES
-- ================================================

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_clientes_celular ON clientes(celular);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado);

-- Índices para fiados
CREATE INDEX IF NOT EXISTS idx_fiados_cliente_id ON fiados(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fiados_created_at ON fiados(created_at);
CREATE INDEX IF NOT EXISTS idx_fiados_cliente_fecha ON fiados(cliente_id, created_at DESC);

-- Índices para abonos
CREATE INDEX IF NOT EXISTS idx_abonos_cliente_id ON abonos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_abonos_created_at ON abonos(created_at);
CREATE INDEX IF NOT EXISTS idx_abonos_cliente_fecha ON abonos(cliente_id, created_at DESC);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON auditoria(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON auditoria(created_at);

-- ================================================
-- VISTA: saldos_clientes
-- ================================================
CREATE OR REPLACE VIEW saldos_clientes AS
SELECT
    c.id,
    c.nombre,
    c.apodo,
    c.celular,
    c.estado,
    c.tope_credito,
    COALESCE(SUM(f.total), 0) AS total_fiados,
    COALESCE(SUM(ab.monto), 0) AS total_abonos,
    COALESCE(SUM(f.total), 0) - COALESCE(SUM(ab.monto), 0) AS saldo
FROM clientes c
LEFT JOIN fiados f ON f.cliente_id = c.id
LEFT JOIN abonos ab ON ab.cliente_id = c.id
GROUP BY c.id, c.nombre, c.apodo, c.celular, c.estado, c.tope_credito;

COMMENT ON VIEW saldos_clientes IS 'Calcula el saldo de cada cliente';

-- ================================================
-- FUNCIONES Y TRIGGERS PARA AUDITORÍA
-- ================================================

CREATE OR REPLACE FUNCTION registrar_auditoria()
RETURNS TRIGGER AS $$
DECLARE
  v_registro_id UUID;
  v_usuario_id  UUID;
  v_datos_antes JSONB;
  v_datos_despues JSONB;
  v_accion VARCHAR(20);
BEGIN
  -- Mapear TG_OP al CHECK constraint de auditoria ('crear'|'editar'|'eliminar')
  v_accion := CASE TG_OP
    WHEN 'INSERT' THEN 'crear'
    WHEN 'UPDATE' THEN 'editar'
    WHEN 'DELETE' THEN 'eliminar'
  END;

  -- Determinar registro_id y snapshots según la operación
  IF TG_OP = 'DELETE' THEN
    v_registro_id   := OLD.id;
    v_datos_antes   := to_jsonb(OLD);
    v_datos_despues := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id   := NEW.id;
    v_datos_antes   := to_jsonb(OLD);
    v_datos_despues := to_jsonb(NEW);
  ELSE -- INSERT
    v_registro_id   := NEW.id;
    v_datos_antes   := NULL;
    v_datos_despues := to_jsonb(NEW);
  END IF;

  -- Intentar obtener usuario de la sesión local (futuro: SET LOCAL app.current_user_id)
  BEGIN
    v_usuario_id := current_setting('app.current_user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_usuario_id := NULL;
  END;

  -- Fallback: campo de usuario según tabla (clientes usa created_by; fiados/abonos usan usuario_id)
  IF v_usuario_id IS NULL THEN
    IF TG_TABLE_NAME = 'clientes' THEN
      v_usuario_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END;
    ELSE
      v_usuario_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.usuario_id ELSE NEW.usuario_id END;
    END IF;
  END IF;

  INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
  VALUES (TG_TABLE_NAME, v_registro_id, v_accion, v_usuario_id, v_datos_antes, v_datos_despues);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para clientes
CREATE OR REPLACE TRIGGER tr_clientes_auditoria
AFTER INSERT OR UPDATE OR DELETE ON clientes
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Trigger para fiados
CREATE OR REPLACE TRIGGER tr_fiados_auditoria
AFTER INSERT OR UPDATE OR DELETE ON fiados
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Trigger para abonos
CREATE OR REPLACE TRIGGER tr_abonos_auditoria
AFTER INSERT OR UPDATE OR DELETE ON abonos
FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- ================================================
-- POLÍTICAS RLS (Row Level Security)
-- ================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiados ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiado_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "usuarios_select" ON usuarios FOR SELECT USING (true);
CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE USING (true);
CREATE POLICY "usuarios_delete" ON usuarios FOR DELETE USING (true);

-- Políticas para clientes
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (true);
CREATE POLICY "clientes_insert" ON clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "clientes_update" ON clientes FOR UPDATE USING (true);
CREATE POLICY "clientes_delete" ON clientes FOR DELETE USING (true);

-- Políticas para fiados
CREATE POLICY "fiados_select" ON fiados FOR SELECT USING (true);
CREATE POLICY "fiados_insert" ON fiados FOR INSERT WITH CHECK (true);
CREATE POLICY "fiados_update" ON fiados FOR UPDATE USING (true);
CREATE POLICY "fiados_delete" ON fiados FOR DELETE USING (true);

-- Políticas para fiado_detalle
CREATE POLICY "fiado_detalle_select" ON fiado_detalle FOR SELECT USING (true);
CREATE POLICY "fiado_detalle_insert" ON fiado_detalle FOR INSERT WITH CHECK (true);
CREATE POLICY "fiado_detalle_update" ON fiado_detalle FOR UPDATE USING (true);
CREATE POLICY "fiado_detalle_delete" ON fiado_detalle FOR DELETE USING (true);

-- Políticas para abonos
CREATE POLICY "abonos_select" ON abonos FOR SELECT USING (true);
CREATE POLICY "abonos_insert" ON abonos FOR INSERT WITH CHECK (true);
CREATE POLICY "abonos_update" ON abonos FOR UPDATE USING (true);
CREATE POLICY "abonos_delete" ON abonos FOR DELETE USING (true);

-- Políticas para auditoria
CREATE POLICY "auditoria_select" ON auditoria FOR SELECT USING (true);
CREATE POLICY "auditoria_insert" ON auditoria FOR INSERT WITH CHECK (true);
CREATE POLICY "auditoria_update" ON auditoria FOR UPDATE USING (true);
CREATE POLICY "auditoria_delete" ON auditoria FOR DELETE USING (true);

-- Políticas para configuracion
CREATE POLICY "configuracion_select" ON configuracion FOR SELECT USING (true);
CREATE POLICY "configuracion_insert" ON configuracion FOR INSERT WITH CHECK (true);
CREATE POLICY "configuracion_update" ON configuracion FOR UPDATE USING (true);
CREATE POLICY "configuracion_delete" ON configuracion FOR DELETE USING (true);

-- ================================================
-- USUARIO DEMO (para testing)
-- ================================================
-- Para crear tu propio usuario, ejecuta este SQL con un hash válido:
--
-- SELECT '$2a$10$YOUR_HASH_HERE' as pin_hash;
--
-- O mejor, usa el script de Node.js:
-- npx tsx scripts/crear-usuario.ts
--
-- El hash de abajo es solo un ejemplo - NO funciona con PIN "1234"
-- Para que funcione, genera tu propio hash con bcrypt.

-- INSERT INTO usuarios (nombre, celular, pin, rol) VALUES
-- ('Juan Pérez', '3001234567', '$2a$10$example_hash_needs_replace', 'dueño')
-- ON CONFLICT DO NOTHING;

-- ================================================
-- FIN DEL SCRIPT
-- ================================================