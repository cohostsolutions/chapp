# Canvas Capital

Canvas Capital is a Vite + React + TypeScript application backed by Supabase.

The repository currently contains both the live application code and a large number of historical audit and rollout documents at the repository root. Treat this README and the files under `docs/` as the canonical starting point for setup, verification, and current implementation notes.

## What Lives Here

- `src/`: React application code
- `supabase/`: database migrations, edge functions, and Supabase config
- `tests/`: Playwright smoke and end-to-end coverage
- `docs/`: current documentation index, backend audit, and focused feature docs

## Tech Stack

- Frontend: React 18, Vite, TypeScript, React Router, TanStack Query
- UI: Radix UI, Tailwind CSS, shadcn-style components
- Backend: Supabase Postgres, Supabase Edge Functions, Row Level Security
- Testing: Vitest, Testing Library, Playwright

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI 2.85+

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in the required values for Supabase first.
3. Add optional third-party integrations only if you are working on those features.

Minimum required values for app startup:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`

Common backend secrets used by edge functions:

- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_FUNCTION_SECRET` for internal or scheduled edge functions
- `VAULT_ENCRYPTION_KEY`
- `GOOGLE_API_KEY`
- `FACEBOOK_APP_SECRET`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `TWILIO_*` variables when working on Twilio-related features

## Install

```bash
npm install
```

## Run The App

Frontend only:

```bash
npm run dev
```

Production preview:

```bash
npm run build
npm run preview
```

## Supabase Workflow

Apply local schema changes to the linked Supabase project:

```bash
npm run db:push
```

Run pending migrations:

```bash
npm run db:migrate
```

If you are working locally with Supabase CLI instead of the remote project, use the CLI directly:

```bash
npx supabase start
npx supabase db reset
```

Serve an edge function locally when needed:

```bash
npx supabase functions serve <function-name>
```

## Verification Checklist

Use these commands before merging backend or frontend changes:

```bash
npm run lint
npm run type-check
npm run build
npm run test
npm run test:smoke
```

Useful combined checks:

```bash
npm run verify:build
npm run test:coverage
```

## Backend Notes

- Edge function settings are defined in `supabase/config.toml`.
- Migrations live in `supabase/migrations/` and include both feature work and security remediation.
- Shared function helpers live in `supabase/functions/_shared/` and should be reused instead of duplicating auth, CORS, vault, or sanitization logic.

The latest backend risk review is here:

- `docs/SUPABASE_BACKEND_AUDIT_2026-04-08.md`

## Documentation

Start here for current docs:

- `docs/DOCUMENTATION_INDEX.md`

Important current docs:

- `docs/PLACEHOLDER_FEATURE_ROADMAP.md`
- `docs/SUPABASE_BACKEND_AUDIT_2026-04-08.md`
- `docs/facebook-integration.md`
- `docs/ai-training.md`
- `docs/SECURITY_TESTING.md`

## Root Documentation Cleanup Note

Many markdown files in the repository root are historical phase reports, audits, and rollout notes. Keep them for reference if needed, but prefer `docs/` for current operational guidance and implementation planning.
