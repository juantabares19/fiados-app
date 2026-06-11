# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Next.js 16 + Turbopack) at localhost:3000
npm run build    # Production build — runs TypeScript type-check first; must pass before deploy
npm run lint     # ESLint check
```

**Tooling already available (authenticated):**
```bash
vercel ls                                          # View deployments
vercel deploy --prod                               # Deploy to production
supabase db query --linked --file <file.sql>       # Execute SQL against the live DB
supabase db query --linked "<SQL>"                 # Execute inline SQL
```

There are no automated tests. TypeScript (`npx tsc --noEmit`) is the only static check beyond lint.

## Architecture

### Auth flow
Custom JWT auth — no Supabase Auth. On login, the server creates a signed JWT (via `jose`) and sets it as an `HttpOnly; SameSite=Strict` cookie named `session_token`. The `middleware.ts` (currently warns as deprecated — should migrate to `proxy`) reads this cookie on every request, verifies it, and attaches encoded user data to a `x-user-data` response header.

Client-side auth state lives in `UsuarioProvider` (`hooks/useUsuario.tsx`), which hydrates by calling `GET /api/auth/me`. The `SoloDueño` component (`components/auth/SoloDueño.tsx`) gates any owner-only UI.

Two roles exist: `dueño` (full access) and `tendero` (limited). Most `/api/metricas`, `/api/morosos`, and `/api/configuracion` routes are `dueño`-only.

### Cookie parsing pattern
All API routes parse cookies manually (no Next.js `cookies()` helper):
```typescript
const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
  const [name, value] = cookie.trim().split('=');
  acc[name] = value;
  return acc;
}, {} as Record<string, string>);
```

### Supabase clients
- **Server** (`lib/supabase/server.ts`): `supabaseAdmin` — uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS, used in all API routes. Initialized at module level; throws on missing env vars.
- **Client** (`lib/supabase/client.ts`): browser client using `@supabase/ssr` + anon key; used sparingly in client components.

### Database views (critical)
Two views underpin most financial calculations:
- **`saldos_clientes`** — computes each client's running balance (`SUM(fiados) - SUM(abonos)`). Includes `id, nombre, apodo, celular, estado, tope_credito, total_fiados, total_abonos, saldo`.
- **`vista_estado_mora`** — joins `saldos_clientes` with last-movement date to classify clients as `al_dia / moroso / critico` (thresholds: `DIAS_MORA_ALERTA=15`, `DIAS_MORA_CRITICO=30` from `lib/constants.ts`).

When modifying these views: `DROP VIEW IF EXISTS vista_estado_mora` first, then `DROP VIEW IF EXISTS saldos_clientes`, recreate both. `CREATE OR REPLACE VIEW` will error if column positions change.

### Supabase relation casting pattern
Supabase's JS client infers joined relations as arrays, but they behave as single objects for FK relations. Always use `as unknown as Type | null` — not `as Type | null` directly — or TypeScript will fail the build:
```typescript
(row.usuarios as unknown as UsuarioRelacion | null)?.nombre
```
Types live in `lib/database.types.ts`.

### Page/layout structure
All authenticated pages live under `app/(auth)/`. The layout at `app/(auth)/layout.tsx` wraps everything in `UsuarioProvider` + `ConfigProvider` and renders `Header` + `MobileNav`.

Pages are `'use client'` components. Owner-only pages wrap their content in `<SoloDueño>`. There are no React Server Components in the auth area by design (context dependency).

### Shared state
- `useUsuario()` — current user + role, loaded once via `/api/auth/me`
- `useConfig()` — store config (e.g. `nombre_tienda`), loaded via `/api/configuracion`. Used to personalize WhatsApp messages.

### WhatsApp integration
`lib/whatsapp.ts` generates `wa.me` deep-link messages for debt reminders and transaction confirmations. Numbers must be Colombian format (`3XXXXXXXXX`); the formatter normalizes to `57XXXXXXXXX`. No external API — opens WhatsApp natively.

### Migrations
Migration files live in `supabase/migrations/`. The Supabase CLI requires the naming format `YYYYMMDDHHMMSS_name.sql` for `db push` to track them. Existing files use freeform names and are skipped by `db push`; apply them with `supabase db query --linked --file <file>`.
