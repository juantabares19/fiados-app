-- Actualiza saldos_clientes para incluir apodo y tope_credito
-- Causa: la vista original fue creada sin estos campos, rompiendo /api/morosos y otras rutas
-- Nota: DROP + CREATE es necesario porque PostgreSQL no permite CREATE OR REPLACE
--       cuando cambia la posición de columnas en una vista existente.

-- vista_estado_mora depende de saldos_clientes, hay que bajar ambas en orden
DROP VIEW IF EXISTS vista_estado_mora;
DROP VIEW IF EXISTS saldos_clientes;

CREATE VIEW saldos_clientes AS
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

-- Recrear vista_estado_mora (fue eliminada por CASCADE implícito)
CREATE VIEW vista_estado_mora AS
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
