CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(100) PRIMARY KEY,
  valor TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE configuracion IS 'Configuración general de la tienda (nombre, preferencias, etc.)';

INSERT INTO configuracion (clave, valor)
VALUES ('nombre_tienda', 'Mi Tienda')
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracion_select" ON configuracion FOR SELECT USING (true);
CREATE POLICY "configuracion_insert" ON configuracion FOR INSERT WITH CHECK (true);
CREATE POLICY "configuracion_update" ON configuracion FOR UPDATE USING (true);
CREATE POLICY "configuracion_delete" ON configuracion FOR DELETE USING (true);
