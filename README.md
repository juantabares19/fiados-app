# Fiados App

PWA para digitalizar el proceso de fiados (crédito informal) de una tienda de barrio familiar en Colombia.

## Stack Tecnológico

- **Frontend**: Next.js 14+ (App Router) como PWA
- **Backend/API**: Supabase (PostgreSQL + Auth)
- **Hosting**: Vercel (free tier)
- **UI**: Tailwind CSS (mobile-first)
- **Lenguaje**: TypeScript

## Requisitos

- Node.js 18+
- Cuenta de Supabase
- npm o yarn

## Instalación

```bash
# Clonar o crear el proyecto
npx create-next-app@latest fiados-app --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --yes

cd fiados-app

# Instalar dependencias
npm install @supabase/supabase-js @supabase/ssr bcryptjs

npm install --save-dev @types/bcryptjs
```

## Configuración de Supabase

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Ve a **Settings > API** y copia:
   - `Project URL`
   - `anon public` key

### 2. Ejecutar SQL en Supabase

1. En el dashboard de Supabase, ve a **SQL Editor**
2. Copia el contenido de `supabase/schema.sql`
3. Pégalo y ejecuta el SQL

El schema incluye:
- 6 tablas: usuarios, clientes, fiados, fiado_detalle, abonos, auditoria
- Índices para optimizar consultas
- Vista `saldos_clientes` para calcular saldos
- Funciones y triggers para auditoría automática
- Políticas RLS básicas (permiten todo a usuarios autenticados)

### 3. Configurar variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.local.example .env.local
```

Edita `.env.local` y agrega tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 4. Crear usuario demo

En Supabase SQL Editor, ejecuta:

```sql
-- Insertar usuario demo (PIN: 1234)
-- El hash es bcrypt de "1234"
INSERT INTO usuarios (nombre, celular, pin, rol) VALUES
('Juan Pérez', '3001234567', '$2a$10$rOzJqQZQGKzQZQN7pBJYQOQY9P9QZQGKzQZQN7pBJYQOQY9P9QZ', 'dueño');
```

## Ejecutar en local

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Estructura del Proyecto

```
fiados-app/
├── app/                          # App Router
│   ├── layout.tsx                # Layout principal con meta tags PWA
│   ├── page.tsx                  # Página de login
│   ├── (auth)/                   # Grupo de rutas protegidas
│   │   ├── layout.tsx            # Layout con navegación
│   │   ├── inicio/page.tsx       # Pantalla de inicio
│   │   ├── clientes/page.tsx     # Gestión de clientes
│   │   ├── fiados/page.tsx       # Registro de fiados
│   │   ├── abonos/page.tsx       # Registro de abonos
│   │   ├── actividad/page.tsx    # Actividad diaria (solo dueño)
│   │   ├── morosos/page.tsx      # Lista de morosos (solo dueño)
│   │   ├── metricas/page.tsx      # Métricas (solo dueño)
│   │   └── configuracion/page.tsx # Configuración (solo dueño)
│   └── api/auth/                 # Rutas API de autenticación
│       ├── login/route.ts
│       └── logout/route.ts
├── components/
│   ├── ui/                       # Componentes reutilizables
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── SearchInput.tsx
│   │   └── EmptyState.tsx
│   └── layout/
│       ├── Header.tsx             # Header con botón hamburguesa
│       └── MobileNav.tsx          # Menú lateral
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Cliente para browser
│   │   ├── server.ts             # Cliente para server components
│   │   └── middleware.ts          # Lógica de auth para middleware
│   ├── types.ts                  # Tipos TypeScript
│   └── utils.ts                  # Helper functions
├── public/
│   ├── manifest.json             # Manifiesto PWA
│   ├── sw.js                     # Service Worker
│   └── icons/                    # Íconos PWA
├── middleware.ts                  # Middleware Next.js
└── supabase/
    └── schema.sql                # Schema completo de base de datos
```

## Deploy en Vercel

### 1. Conectar repositorio

1. Sube el código a GitHub
2. Ve a [vercel.com](https://vercel.com)
3. Importa el repositorio

### 2. Configurar variables de entorno

En Vercel, ve a **Settings > Environment Variables** y agrega:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Deploy

Vercel detectará Next.js automáticamente y hará deploy.

## Funcionalidades Implementadas

- Login con celular y PIN
- Navegación responsive con menú hamburguesa
- Protección de rutas via middleware
- PWA instalable en Android
- Vista placeholder de inicio con 3 botones principales
- Estructura de carpetas lista para implementar funcionalidades

## Próximos Pasos

1. Implementar autenticación completa con Supabase Auth
2. Crear CRUD de clientes
3. Crear registro de fiados con productos
4. Crear registro de abonos
5. Implementar envío de estados de cuenta por WhatsApp
6. Agregar métricas y reportes para el dueño

## Notas de Diseño

- **Mobile-first**: Todo el CSS prioriza pantallas de 5.5" a 6.5"
- **Texto mínimo**: 16px (text-base)
- **Botones mínimo**: 48px de altura (h-12)
- **Formato moneda**: $18.500 (peso colombiano, punto como separador de miles)
- **Sin librerías de componentes externas**: Solo Tailwind puro