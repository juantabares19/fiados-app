-- Vista que calcula el estado de mora de cada cliente
-- Usada por /api/metricas para contar morosos y críticos

CREATE OR REPLACE VIEW vista_estado_mora AS
WITH ultimo_movimiento AS (
  SELECT
    cliente_id,
    MAX(created_at) AS ultima_fecha
  FROM (
    SELECT cliente_id, created_at FROM fiados
    UNION ALL
    SELECT cliente_id, created_at FROM abonos
  ) movimientos
  GROUP BY cliente_id
)
SELECT
  sc.id,
  sc.nombre,
  sc.saldo,
  COALESCE(
    EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER,
    9999
  ) AS dias_sin_movimiento,
  CASE
    WHEN sc.saldo <= 0 THEN 'al_dia'
    WHEN COALESCE(EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER, 9999) >= 30 THEN 'critico'
    WHEN COALESCE(EXTRACT(DAY FROM NOW() - um.ultima_fecha)::INTEGER, 9999) >= 15 THEN 'moroso'
    ELSE 'al_dia'
  END AS estado_mora
FROM saldos_clientes sc
LEFT JOIN ultimo_movimiento um ON sc.id = um.cliente_id;

COMMENT ON VIEW vista_estado_mora IS 'Estado de mora de cada cliente basado en días sin movimiento';
