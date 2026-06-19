-- H1: Rate-limit / lockout de login.
-- El PIN es de 4 dígitos (10.000 combinaciones) y no había ningún freno a la
-- fuerza bruta. Se agregan contadores por usuario para bloquear temporalmente
-- tras N intentos fallidos.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

COMMENT ON COLUMN usuarios.intentos_fallidos IS 'Intentos de login fallidos consecutivos; se resetea al entrar bien.';
COMMENT ON COLUMN usuarios.bloqueado_hasta IS 'Si está en el futuro, el login está bloqueado temporalmente por fuerza bruta.';
