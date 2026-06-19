# Fiados App

PWA para digitalizar el proceso de fiados (crédito informal) de una tienda de barrio familiar en Colombia.

## Stack Tecnológico

- **Framework**: Next.js 16 (App Router, Turbopack) + React 19 como PWA
- **Base de datos**: Supabase (PostgreSQL). Se usa **solo como base de datos**, no Supabase Auth.
- **Auth**: JWT propio firmado con `jose` + PIN hasheado con `bcryptjs`, en cookie `HttpOnly`.
- **Hosting**: Vercel
- **UI**: Tailwind CSS (mobile-first), sin librerías de componentes externas
- **Lenguaje**: TypeScript

> Para el detalle de arquitectura (flujo de auth, vistas de saldos, RPCs atómicos, etc.) ver **`CLAUDE.md`** y **`AGENTS.md`**.

## Requisitos

- Node.js 20+ (requerido por Next.js 16)
- Cuenta de Supabase
- npm

## Instalación

```bash
git clone <repo>
cd fiados-app
npm install
```

## Configuración

### 1. Variables de entorno

Copia el archivo de ejemplo y complétalo:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
# Solo en el servidor — nunca exponer al cliente. Las API routes la usan para
# saltarse RLS (los roles anon/authenticated tienen deny-all).
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
# Secreto para firmar los JWT de sesión. Mínimo 32 caracteres.
JWT_SECRET=tu-secreto-de-al-menos-32-caracteres
```

`SUPABASE_SERVICE_ROLE_KEY` y `JWT_SECRET` se leen al inicializar el cliente server (`lib/supabase/server.ts`) y el guard de auth; la app falla al arrancar si faltan.

### 2. Base de datos

1. En el dashboard de Supabase, ve a **SQL Editor** y ejecuta `supabase/schema.sql` (tablas, índices, vistas, triggers de auditoría).
2. Aplica las migraciones de `supabase/migrations/` con la CLI:

   ```bash
   supabase db query --linked --file supabase/migrations/<archivo>.sql
   ```

   Estas añaden, entre otras cosas: RLS deny-all para roles públicos, los RPCs atómicos `crear_fiado` / `crear_abono`, throttling de login y `vista_estado_mora`. Ver la sección *Migrations* de `CLAUDE.md`: los nombres freeform se omiten con `db push`, por eso se aplican con `db query`.

Vistas clave:
- **`saldos_clientes`** — saldo de cada cliente (`SUM(fiados) - SUM(abonos)`).
- **`vista_estado_mora`** — clasifica clientes en `al_dia / moroso / critico`.

### 3. Crear el primer usuario

No hay registro público. Inserta un usuario directamente (PIN hasheado con bcrypt). El rol es `dueño` o `tendero`:

```sql
INSERT INTO usuarios (nombre, celular, pin, rol) VALUES
('Juan Pérez', '3001234567', '<hash-bcrypt-del-pin>', 'dueño');
```

Existe `scripts/crear-usuario.ts` como ayuda para generar el hash y crear usuarios de forma interactiva.

## Ejecutar en local

```bash
npm run dev     # localhost:3000 (Turbopack)
npm run build   # build de producción — corre type-check primero
npm run lint    # ESLint
```

No hay tests automatizados; `npx tsc --noEmit` es el único chequeo estático adicional al lint.

## Estructura del Proyecto

```
fiados-app/
├── app/
│   ├── layout.tsx                # Layout raíz + meta tags PWA
│   ├── page.tsx                  # Login (celular + PIN)
│   ├── (auth)/                   # Rutas protegidas (UsuarioProvider + ConfigProvider)
│   │   ├── layout.tsx            # Header + MobileNav
│   │   ├── inicio/               # Pantalla de inicio
│   │   ├── clientes/             # CRUD de clientes, saldos, historial
│   │   ├── fiados/               # Registro de fiados con productos
│   │   ├── abonos/               # Registro de abonos
│   │   ├── actividad/            # Actividad diaria
│   │   ├── morosos/              # Lista de morosos (solo dueño)
│   │   ├── metricas/             # Métricas (solo dueño)
│   │   └── configuracion/        # Configuración (solo dueño)
│   └── api/                      # API routes (auth via requireUser())
│       ├── auth/ {login,logout,me}
│       ├── clientes/  fiados/  abonos/  morosos/  metricas/
│       ├── actividad/  configuracion/  resumen/
├── components/ {ui, layout, auth, clientes, whatsapp}
├── contexts/ConfigContext.tsx    # useConfig() — config de la tienda
├── hooks/useUsuario.tsx          # useUsuario() — usuario + rol actual
├── lib/
│   ├── supabase/server.ts        # supabaseAdmin (service_role, sin RLS)
│   ├── auth.ts  auth-guard.ts    # JWT + requireUser()
│   ├── fechas.ts                 # fechas en hora de Colombia (UTC-5 fijo)
│   ├── constants.ts validation.ts queries.ts whatsapp.ts
│   └── database.types.ts types.ts utils.ts
├── public/ {manifest.json, sw.js, icons/}
├── middleware.ts                 # Gate de páginas (lee cookie session_token)
└── supabase/ {schema.sql, migrations/}
```

## Características

- Login con celular y PIN (JWT propio, sesiones revocables vía `token_version`).
- Dos roles: **dueño** (acceso total) y **tendero** (limitado).
- CRUD de clientes con tope de crédito, saldos e historial.
- Registro de fiados (con detalle de productos) y abonos mediante **RPCs atómicos** que bloquean la fila del cliente, evitando sobregiros por concurrencia.
- Detección de morosos y estado de mora (`al_dia / moroso / critico`).
- Métricas y reportes para el dueño, calculados en hora de Colombia.
- Estados de cuenta y recordatorios por **WhatsApp** vía deep-links `wa.me` (sin API externa).
- PWA instalable en Android.

## Deploy en Vercel

1. Sube el código a GitHub e importa el repo en [vercel.com](https://vercel.com).
2. En **Settings > Environment Variables** agrega `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `JWT_SECRET`.
3. Vercel detecta Next.js y hace deploy automáticamente.

## Notas de Diseño

- **Mobile-first**: CSS pensado para pantallas de 5.5" a 6.5".
- **Texto mínimo**: 16px (text-base). **Botones**: mínimo 48px de alto (h-12).
- **Formato moneda**: $18.500 (peso colombiano, punto como separador de miles).
- **Fechas**: siempre en hora de Colombia (UTC-5 fijo, sin horario de verano) vía `lib/fechas.ts`.
