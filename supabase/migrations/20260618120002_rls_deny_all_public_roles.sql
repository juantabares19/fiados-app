-- C2: Cierra el acceso directo de los roles públicos (anon, authenticated).
--
-- Problema: RLS estaba habilitado pero TODAS las políticas eran permisivas
-- (USING true / allow_all_*). El anon key de Supabase es público (viaja al
-- navegador), así que cualquiera podía pegarle a la API REST saltándose el JWT,
-- el middleware y la lógica de negocio: leer hashes de PIN y PII, crear un
-- usuario dueño, borrar/falsear deudas, etc.
--
-- Esta app NO usa Supabase Auth: todo el backend opera con SERVICE_ROLE_KEY,
-- que ignora RLS y conserva sus grants. Por tanto la postura correcta es
-- DENEGAR TODO a anon/authenticated. El backend (service_role) no se ve afectado.

-- 1) Eliminar dinámicamente TODAS las políticas existentes en las tablas públicas.
--    (En la BD viva los nombres divergieron del schema.sql: allow_all_*, configuracion_*, etc.)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('usuarios','clientes','fiados','fiado_detalle','abonos','auditoria','configuracion')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 2) Asegurar RLS habilitado en todas las tablas (default deny al no haber políticas).
ALTER TABLE usuarios      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiado_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE abonos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria     ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- 3) Revocar TODO grant a los roles públicos. Sin grants + sin políticas = denegado.
--    service_role NO está en esta lista: mantiene acceso y bypassa RLS.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA public FROM anon, authenticated;

-- 4) Las vistas exponen datos aunque las tablas estén cerradas: revocarlas también.
REVOKE ALL ON saldos_clientes, vista_estado_mora FROM anon, authenticated;

-- 5) Que futuras tablas/funciones nazcan cerradas para los roles públicos.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
