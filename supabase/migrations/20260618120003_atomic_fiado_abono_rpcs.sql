-- C3 + H5: Atomicidad financiera.
--
-- Problema (C3): POST /api/fiados y /api/abonos hacían read-then-write sin
-- transacción ni bloqueo. Dos requests concurrentes leían el mismo saldo, ambas
-- pasaban la validación de tope (fiados) o de saldo (abonos) e insertaban →
-- se superaba el tope de crédito o el saldo quedaba negativo (sobrepago).
--
-- Solución: encapsular validación + inserción + auditoría en funciones que
-- bloquean la fila del cliente (SELECT ... FOR UPDATE). Dos operaciones sobre el
-- mismo cliente se serializan: la segunda espera el commit de la primera y
-- recalcula el saldo ya actualizado.
--
-- H5: CHECKs a nivel de BD como última línea de defensa (verificado: 0 filas
-- existentes los violan).

-- ================================================
-- CHECKS de integridad financiera (H5)
-- ================================================
ALTER TABLE fiados        ADD CONSTRAINT chk_fiados_total_pos CHECK (total > 0);
ALTER TABLE abonos        ADD CONSTRAINT chk_abonos_monto_pos CHECK (monto > 0);
ALTER TABLE fiado_detalle ADD CONSTRAINT chk_detalle_pos
  CHECK (cantidad > 0 AND valor_unitario >= 0 AND subtotal >= 0);
ALTER TABLE clientes      ADD CONSTRAINT chk_tope_no_neg CHECK (tope_credito >= 0);

-- ================================================
-- RPC: crear_fiado (atómico, con bloqueo de cliente)
-- ================================================
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
  -- Bloquea la fila del cliente: serializa fiados/abonos concurrentes del mismo cliente.
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

  -- Validar productos y calcular total en el servidor (no se confía en el cliente).
  FOR v_prod IN SELECT * FROM jsonb_array_elements(p_productos) LOOP
    v_cant := (v_prod->>'cantidad')::NUMERIC;
    v_vu   := (v_prod->>'valor_unitario')::NUMERIC;
    IF COALESCE(btrim(v_prod->>'producto'), '') = '' THEN RAISE EXCEPTION 'PRODUCTO_SIN_NOMBRE'; END IF;
    IF v_cant IS NULL OR v_cant <= 0 THEN RAISE EXCEPTION 'CANTIDAD_INVALIDA'; END IF;
    IF v_vu   IS NULL OR v_vu   <= 0 THEN RAISE EXCEPTION 'VALOR_INVALIDO'; END IF;
    v_total := v_total + (v_cant * v_vu);
  END LOOP;

  -- Saldo recalculado bajo el lock.
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

-- ================================================
-- RPC: crear_abono (atómico, con bloqueo de cliente)
-- ================================================
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

-- Solo el backend (service_role) puede ejecutar estas funciones.
REVOKE ALL ON FUNCTION crear_fiado(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION crear_abono(UUID, UUID, NUMERIC, TEXT, TEXT)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION crear_fiado(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION crear_abono(UUID, UUID, NUMERIC, TEXT, TEXT)     TO service_role;
