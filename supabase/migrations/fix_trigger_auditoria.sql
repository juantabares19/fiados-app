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
