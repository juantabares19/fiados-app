# Plan de Migración: JWT Propio → Supabase Auth

## Problema Actual

### ¿Por qué RLS no protege los datos?

Row Level Security (RLS) está habilitado en todas las tablas de Supabase, pero las políticas usan `USING (true)`, lo que equivale a no tener RLS:

```sql
-- Estado actual: acceso sin restricción
CREATE POLICY "clientes_select" ON clientes FOR SELECT USING (true);
```

La causa raíz es arquitectónica: la aplicación implementó autenticación JWT propia usando `jose` y `bcryptjs` en lugar de Supabase Auth. Supabase no tiene conocimiento de quién es el usuario autenticado, por lo que `auth.uid()` retorna `NULL` en todas las políticas RLS.

### ¿Por qué no se puede corregir simplemente cambiando las políticas?

Si se cambia `USING (true)` por `USING (auth.uid() IS NOT NULL)` sin migrar primero a Supabase Auth, **todas las queries fallan** porque `auth.uid()` siempre es NULL cuando el cliente usa el `anon key` sin pasar por Supabase Auth.

### Mitigación actual (Fase 0)

Mientras se ejecuta la migración completa, la aplicación usa el cliente con `service_role key` en todos los API routes del servidor. Este cliente bypasa RLS intencionalmente y garantiza que solo el código del servidor (validado con JWT propio) accede a la base de datos. El `anon key` queda expuesto en el bundle del cliente pero sin RLS efectivo por ahora.

**El riesgo residual**: si alguien usa el `anon key` directamente contra Supabase, puede leer/escribir datos. Este riesgo se elimina completamente al completar la Fase D de esta migración.

---

## Plan de Migración por Fases

### Fase A: Preparar usuarios en Supabase Auth

**Objetivo**: Crear registros en `auth.users` de Supabase para cada usuario existente en la tabla `usuarios`.

**Estrategia**: Email ficticio con formato `celular@fiados.local`.

```typescript
// Script de migración: scripts/migrar-usuarios-auth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, serviceRoleKey);

// Para cada usuario en la tabla 'usuarios':
const { data: usuarios } = await supabase.from('usuarios').select('*');

for (const u of usuarios) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: `${u.celular}@fiados.local`,
    password: u.pin, // ya es hash de bcrypt, Supabase lo reemplaza
    user_metadata: { nombre: u.nombre, rol: u.rol, usuario_id: u.id },
    email_confirm: true,
  });
  
  // Guardar el auth.uid() en la tabla usuarios para enlazar registros
  await supabase.from('usuarios').update({ auth_uid: data.user.id }).eq('id', u.id);
}
```

**Cambio de schema requerido**:
```sql
ALTER TABLE usuarios ADD COLUMN auth_uid UUID REFERENCES auth.users(id);
```

---

### Fase B: Modificar el flujo de login

**Objetivo**: Usar `supabase.auth.signInWithPassword()` en lugar del JWT propio.

**Cambio en `app/api/auth/login/route.ts`**:

```typescript
// Antes: verificación manual con bcrypt
const isValidPin = await bcrypt.compare(pin, usuario.pin);
const token = await createToken({ ... });

// Después: Supabase Auth maneja la sesión
const { data, error } = await supabase.auth.signInWithPassword({
  email: `${celular}@fiados.local`,
  password: pin,
});

// Supabase retorna access_token y refresh_token
// Configurar cookies con estos tokens
```

**Consideraciones**:
- Supabase hashea las contraseñas con bcrypt internamente, igual que el sistema actual
- Los PINs de 4 dígitos son compatibles con `signInWithPassword`
- Supabase maneja refresh automático de tokens

---

### Fase C: Reemplazar JWT propio por sesión de Supabase

**Objetivo**: Eliminar `lib/auth.ts` y usar la sesión de Supabase en `middleware.ts` y API routes.

**Cambio en `middleware.ts`**:
```typescript
// Antes: verificación JWT manual
const token = cookies['session_token'];
const usuario = await verifyToken(token);

// Después: usar @supabase/ssr para manejar sesión
import { updateSession } from '@/lib/supabase/middleware';
// Supabase verifica el token automáticamente
```

**Cambio en API routes**:
```typescript
// Antes: cookie propia
const usuario = await verifyToken(cookies['session_token']);

// Después: sesión de Supabase
const { data: { user } } = await supabase.auth.getUser();
const rol = user?.user_metadata?.rol;
```

---

### Fase D: Implementar políticas RLS reales

**Objetivo**: Una vez que `auth.uid()` identifica al usuario correctamente, reemplazar todas las políticas `USING (true)`.

```sql
-- Eliminar políticas actuales
DROP POLICY IF EXISTS "clientes_select" ON clientes;
DROP POLICY IF EXISTS "fiados_select" ON fiados;
-- ... (todas las políticas actuales)

-- Crear políticas basadas en auth.uid()
-- Cualquier empleado activo puede ver/crear clientes
CREATE POLICY "clientes_empleados_activos" ON clientes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_uid = auth.uid()
      AND activo = true
    )
  );

CREATE POLICY "clientes_insertar" ON clientes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_uid = auth.uid()
      AND activo = true
    )
  );

-- Solo dueño puede editar/bloquear clientes
CREATE POLICY "clientes_editar_dueno" ON clientes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_uid = auth.uid()
      AND rol = 'dueño'
      AND activo = true
    )
  );

-- Misma lógica para fiados, abonos, auditoria
-- Métricas y configuración: solo dueño
CREATE POLICY "configuracion_dueno_only" ON configuracion
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_uid = auth.uid()
      AND rol = 'dueño'
    )
  );
```

---

### Fase E: Limpieza final

Una vez que Fases A-D están completas y verificadas en producción:

1. Eliminar `lib/auth.ts` (ya no se usa JWT propio)
2. Eliminar dependencia `jose` de `package.json`
3. Reemplazar cliente con `service_role key` por cliente con `anon key` en server.ts (RLS ahora protege correctamente)
4. Eliminar variable de entorno `JWT_SECRET`
5. Eliminar `SUPABASE_SERVICE_ROLE_KEY` del servidor (ya no necesaria)

---

## Riesgos de la Migración

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Usuarios existentes no migrados correctamente | Alto | Script de migración con validación + rollback |
| Cambio en formato de cookies genera cierre de sesión masivo | Bajo | Avisar al usuario antes del deploy |
| RLS mal configurado bloquea acceso total | Alto | Probar en ambiente staging con datos reales |
| PINs de 4 dígitos podrían tener restricciones en Supabase Auth | Medio | Verificar longitud mínima de password en proyecto Supabase |
| Downtime durante migración | Bajo | Deploy atómico: nueva versión con Supabase Auth, rollback si falla |

---

## Estimación de Esfuerzo

| Fase | Complejidad | Tiempo estimado |
|------|-------------|-----------------|
| A: Migrar usuarios a Supabase Auth | Media | 2-3 horas |
| B: Modificar flujo de login | Alta | 3-4 horas |
| C: Reemplazar JWT en middleware y routes | Alta | 4-6 horas |
| D: Implementar políticas RLS reales | Media | 2-3 horas |
| E: Limpieza final | Baja | 1 hora |
| **Total** | | **12-17 horas** |

---

## Estado Actual

- [x] **Fase 0**: Mitigación P0 — `service_role key` en API routes, `JWT_SECRET` fail-fast
- [ ] **Fase A**: Migrar usuarios a Supabase Auth
- [ ] **Fase B**: Modificar flujo de login
- [ ] **Fase C**: Reemplazar JWT propio
- [ ] **Fase D**: Implementar RLS real
- [ ] **Fase E**: Limpieza final
