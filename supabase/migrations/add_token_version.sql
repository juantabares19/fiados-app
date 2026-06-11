ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN usuarios.token_version IS
  'Se incrementa al hacer logout o desactivar cuenta. Los JWT con versión anterior son rechazados.';
