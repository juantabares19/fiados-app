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
    token_version INTEGER NOT NULL DEFAULT 0,
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE usuarios IS 'Usuarios que atienden la tienda (dueño o tendero)';
COMMENT ON COLUMN usuarios.pin IS 'Hash bcrypt del PIN de 4 dígitos';
COMMENT ON COLUMN usuarios.token_version IS
  'Se incrementa al hacer logout o desactivar cuenta. Los JWT con versión anterior son rechazados.';

-- ================================================
-- TABLA: clientes
-- ================================================
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    apodo VARCHAR(50),
    celular VARCHAR(15) NOT NULL,
    tope_credito DECIMAL(12,2) NOT NULL DEFAULT 50000 CHECK (tope_credito >= 0),
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
    total DECIMAL(12,2) NOT NULL CHECK (total > 0),
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
    cantidad DECIMAL(8,2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    valor_unitario DECIMAL(12,2) NOT NULL CHECK (valor_unitario >= 0),
    subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0)
);

COMMENT ON TABLE fiado_detalle IS 'Productos de cada fiado';

-- ================================================
-- TABLA: abonos
-- ================================================
CREATE TABLE IF NOT EXISTS abonos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    monto DECIMAL(12,2) NOT NULL CHECK (monto > 0),
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
-- IMPORTANTE: pre-agregar fiados y abonos por separado ANTES de unir.
-- Un LEFT JOIN directo a ambas tablas genera un producto cartesiano (M*N filas)
-- que multiplica los SUM y produce saldos incorrectos.
CREATE OR REPLACE VIEW saldos_clientes AS
SELECT
    c.id,
    c.nombre,
    c.apodo,
    c.celular,
    c.estado,
    c.tope_credito,
    COALESCE(f.total_fiados, 0) AS total_fiados,
    COALESCE(a.total_abonos, 0) AS total_abonos,
    COALESCE(f.total_fiados, 0) - COALESCE(a.total_abonos, 0) AS saldo
FROM clientes c
LEFT JOIN (
    SELECT cliente_id, SUM(total) AS total_fiados
    FROM fiados
    GROUP BY cliente_id
) f ON f.cliente_id = c.id
LEFT JOIN (
    SELECT cliente_id, SUM(monto) AS total_abonos
    FROM abonos
    GROUP BY cliente_id
) a ON a.cliente_id = c.id;

COMMENT ON VIEW saldos_clientes IS 'Saldo por cliente (fiados - abonos). Pre-agrega para evitar fan-out.';

-- ================================================
-- VISTA: vista_estado_mora
-- ================================================
CREATE OR REPLACE VIEW vista_estado_mora AS
WITH ultimo_movimiento AS (
  SELECT cliente_id, MAX(created_at) AS ultima_fecha
  FROM (SELECT cliente_id, created_at FROM fiados
        UNION ALL SELECT cliente_id, created_at FROM abonos) m
  GROUP BY cliente_id
)
SELECT
  sc.id,
  sc.nombre,
  sc.saldo,
  COALESCE(EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER, 9999) AS dias_sin_movimiento,
  CASE
    WHEN sc.saldo <= 0 THEN 'al_dia'
    WHEN COALESCE(EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER, 9999) >= 30 THEN 'critico'
    WHEN COALESCE(EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER, 9999) >= 15 THEN 'moroso'
    ELSE 'al_dia'
  END AS estado_mora
FROM saldos_clientes sc
LEFT JOIN ultimo_movimiento um ON sc.id = um.cliente_id;

COMMENT ON VIEW vista_estado_mora IS 'Estado de mora de cada cliente basado en días sin movimiento';

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

-- NOTA: la auditoría se hace en la capa de aplicación (rutas API y RPCs
-- crear_fiado/crear_abono insertan en `auditoria` con el usuario real).
-- Por eso NO se adjuntan triggers a las tablas: hacerlo duplicaría cada
-- registro de auditoría. La función registrar_auditoria() se conserva por si
-- en el futuro se migra a auditoría por trigger (requeriría setear
-- app.current_user_id por request y quitar los inserts manuales).

-- ================================================
-- RPCs ATÓMICOS DE DINERO (crear_fiado / crear_abono)
-- ================================================
-- Encapsulan validación + inserción + auditoría con SELECT ... FOR UPDATE sobre
-- la fila del cliente. Serializan operaciones concurrentes del mismo cliente y
-- evitan double-spending (superar tope) y sobrepago (saldo negativo).
-- Las rutas POST /api/fiados y /api/abonos llaman estas funciones vía rpc().

CREATE OR REPLACE FUNCTION crear_fiado(
  p_cliente_id  UUID,
  p_usuario_id  UUID,
  p_quien_pidio TEXT,
  p_familiar    TEXT,
  p_nota        TEXT,
  p_productos   JSONB  -- [{producto, cantidad, valor_unitario}, ...]
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_cliente clientes%ROWTYPE;
  v_fiado   fiados%ROWTYPE;
  v_total   NUMERIC(12,2) := 0;
  v_saldo   NUMERIC(12,2);
  v_prod    JSONB;
  v_cant    NUMERIC;
  v_vu      NUMERIC;
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENTE_NO_ENCONTRADO'; END IF;
  IF v_cliente.estado = 'bloqueado' THEN RAISE EXCEPTION 'CLIENTE_BLOQUEADO'; END IF;

  IF p_productos IS NULL OR jsonb_typeof(p_productos) <> 'array' OR jsonb_array_length(p_productos) = 0 THEN
    RAISE EXCEPTION 'SIN_PRODUCTOS';
  END IF;

  IF COALESCE(NULLIF(p_quien_pidio, ''), 'cliente') = 'familiar'
     AND COALESCE(btrim(p_familiar), '') = '' THEN
    RAISE EXCEPTION 'FAMILIAR_REQUERIDO';
  END IF;

  FOR v_prod IN SELECT * FROM jsonb_array_elements(p_productos) LOOP
    v_cant := (v_prod->>'cantidad')::NUMERIC;
    v_vu   := (v_prod->>'valor_unitario')::NUMERIC;
    IF COALESCE(btrim(v_prod->>'producto'), '') = '' THEN RAISE EXCEPTION 'PRODUCTO_SIN_NOMBRE'; END IF;
    IF v_cant IS NULL OR v_cant <= 0 THEN RAISE EXCEPTION 'CANTIDAD_INVALIDA'; END IF;
    IF v_vu   IS NULL OR v_vu   <= 0 THEN RAISE EXCEPTION 'VALOR_INVALIDO'; END IF;
    v_total := v_total + (v_cant * v_vu);
  END LOOP;

  SELECT COALESCE(SUM(f.total), 0)
         - (SELECT COALESCE(SUM(a.monto), 0) FROM abonos a WHERE a.cliente_id = p_cliente_id)
  INTO v_saldo FROM fiados f WHERE f.cliente_id = p_cliente_id;

  IF v_saldo + v_total > v_cliente.tope_credito THEN
    RAISE EXCEPTION 'TOPE_EXCEDIDO|%|%|%', v_saldo, v_cliente.tope_credito, (v_cliente.tope_credito - v_saldo);
  END IF;

  INSERT INTO fiados (cliente_id, usuario_id, quien_pidio, familiar, nota, total)
  VALUES (
    p_cliente_id, p_usuario_id,
    COALESCE(NULLIF(p_quien_pidio, ''), 'cliente'),
    NULLIF(btrim(COALESCE(p_familiar, '')), ''),
    NULLIF(btrim(COALESCE(p_nota, '')), ''),
    v_total
  )
  RETURNING * INTO v_fiado;

  INSERT INTO fiado_detalle (fiado_id, producto, cantidad, valor_unitario, subtotal)
  SELECT v_fiado.id, btrim(p->>'producto'),
         (p->>'cantidad')::NUMERIC, (p->>'valor_unitario')::NUMERIC,
         (p->>'cantidad')::NUMERIC * (p->>'valor_unitario')::NUMERIC
  FROM jsonb_array_elements(p_productos) p;

  INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, datos_despues)
  VALUES ('fiados', v_fiado.id, 'crear', p_usuario_id, to_jsonb(v_fiado));

  RETURN jsonb_build_object(
    'fiado',          to_jsonb(v_fiado),
    'cliente_nombre', v_cliente.nombre,
    'nuevo_saldo',    v_saldo + v_total,
    'tope',           v_cliente.tope_credito,
    'disponible',     v_cliente.tope_credito - (v_saldo + v_total)
  );
END $$;

CREATE OR REPLACE FUNCTION crear_abono(
  p_cliente_id  UUID,
  p_usuario_id  UUID,
  p_monto       NUMERIC,
  p_metodo_pago TEXT,
  p_nota        TEXT
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
  v_cliente clientes%ROWTYPE;
  v_abono   abonos%ROWTYPE;
  v_saldo   NUMERIC(12,2);
BEGIN
  SELECT * INTO v_cliente FROM clientes WHERE id = p_cliente_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENTE_NO_ENCONTRADO'; END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'MONTO_INVALIDO'; END IF;
  IF p_metodo_pago NOT IN ('efectivo','nequi','daviplata','llaves','otro') THEN
    RAISE EXCEPTION 'METODO_INVALIDO';
  END IF;

  SELECT (SELECT COALESCE(SUM(f.total), 0) FROM fiados f WHERE f.cliente_id = p_cliente_id)
         - COALESCE(SUM(a.monto), 0)
  INTO v_saldo FROM abonos a WHERE a.cliente_id = p_cliente_id;

  IF v_saldo <= 0 THEN RAISE EXCEPTION 'SIN_SALDO'; END IF;
  IF p_monto > v_saldo THEN RAISE EXCEPTION 'ABONO_EXCEDE_SALDO|%', v_saldo; END IF;

  INSERT INTO abonos (cliente_id, usuario_id, monto, metodo_pago, nota)
  VALUES (p_cliente_id, p_usuario_id, p_monto, p_metodo_pago, NULLIF(btrim(COALESCE(p_nota, '')), ''))
  RETURNING * INTO v_abono;

  INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, datos_despues)
  VALUES ('abonos', v_abono.id, 'crear', p_usuario_id, to_jsonb(v_abono));

  RETURN jsonb_build_object(
    'abono',          to_jsonb(v_abono),
    'cliente_nombre', v_cliente.nombre,
    'saldo_anterior', v_saldo,
    'nuevo_saldo',    v_saldo - p_monto,
    'cliente_al_dia', (v_saldo - p_monto) = 0
  );
END $$;

REVOKE ALL ON FUNCTION crear_fiado(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION crear_abono(UUID, UUID, NUMERIC, TEXT, TEXT)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION crear_fiado(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION crear_abono(UUID, UUID, NUMERIC, TEXT, TEXT)     TO service_role;

-- ================================================
-- SEGURIDAD A NIVEL DE BASE DE DATOS (RLS + grants)
-- ================================================
-- Esta app NO usa Supabase Auth: TODO el backend opera con SERVICE_ROLE_KEY,
-- que ignora RLS y conserva sus grants. El anon key es público (viaja al
-- navegador), así que los roles anon/authenticated deben quedar SIN acceso.
-- Postura: RLS habilitado + cero políticas + grants revocados = deny-all
-- para los roles públicos. El backend (service_role) no se ve afectado.
--
-- NO crear políticas permisivas "USING (true)": eso deja la BD abierta a
-- cualquiera con el anon key, saltándose el JWT y la lógica de negocio.

ALTER TABLE usuarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiado_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria     ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- Revocar todo acceso a los roles públicos.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM anon, authenticated;

-- Las vistas exponen datos aunque las tablas estén cerradas: revocarlas también.
REVOKE ALL ON saldos_clientes, vista_estado_mora FROM anon, authenticated;

-- Que futuras tablas/funciones nazcan cerradas para los roles públicos.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

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