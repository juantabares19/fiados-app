-- C1: Corrige el producto cartesiano (fan-out) en saldos_clientes.
--
-- Problema: la vista hacía LEFT JOIN a fiados Y a abonos sobre el mismo cliente.
-- Con M fiados y N abonos se generan M*N filas, de modo que SUM(f.total) se
-- multiplica por N y SUM(ab.monto) por M. Resultado: saldos incorrectos para
-- cualquier cliente con varios fiados Y varios abonos.
--
-- Verificado en datos reales (2026-06-18): "Paula Muñoz" (2 fiados, 1 abono)
-- mostraba saldo $47.000 cuando el correcto es $55.000 (su abono se restaba 2 veces).
--
-- Solución: pre-agregar fiados y abonos por cliente ANTES de unir, así cada
-- subconsulta produce a lo sumo una fila por cliente y no hay multiplicación.
--
-- Nota: vista_estado_mora depende de saldos_clientes, hay que bajar ambas en orden.

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

-- Recrear vista_estado_mora tal cual (su lógica ya era correcta; depende de la vista anterior).
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
