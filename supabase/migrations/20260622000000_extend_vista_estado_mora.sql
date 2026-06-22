-- Amplía vista_estado_mora para incluir todos los campos que necesita /api/morosos,
-- eliminando la necesidad de recalcular días en JavaScript.
-- DROP primero porque CREATE OR REPLACE no permite cambiar posición de columnas existentes.
DROP VIEW IF EXISTS vista_estado_mora;

CREATE OR REPLACE VIEW vista_estado_mora AS
WITH ultimo_movimiento AS (
  SELECT
    cliente_id,
    MAX(created_at) AS ultima_fecha
  FROM (
    SELECT cliente_id, created_at FROM fiados
    UNION ALL
    SELECT cliente_id, created_at FROM abonos
  ) m
  GROUP BY cliente_id
)
SELECT
  sc.id,
  sc.nombre,
  sc.apodo,
  sc.celular,
  sc.estado,
  sc.tope_credito,
  sc.total_fiados,
  sc.total_abonos,
  sc.saldo,
  um.ultima_fecha                                                  AS ultimo_movimiento,
  COALESCE(
    EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER,
    9999
  )                                                                AS dias_sin_movimiento,
  CASE
    WHEN sc.saldo <= 0                                                            THEN 'al_dia'
    WHEN COALESCE(EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER, 9999) >= 30 THEN 'critico'
    WHEN COALESCE(EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER, 9999) >= 15 THEN 'moroso'
    ELSE 'al_dia'
  END                                                              AS estado_mora
FROM saldos_clientes sc
LEFT JOIN ultimo_movimiento um ON sc.id = um.cliente_id;

COMMENT ON VIEW vista_estado_mora IS 'Estado de mora de cada cliente basado en días sin movimiento. Incluye todos los campos necesarios para /api/morosos.';

REVOKE ALL ON vista_estado_mora FROM anon, authenticated;
