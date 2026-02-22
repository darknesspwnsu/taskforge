# TaskForge

TaskForge is a cross-platform, gamified task app built with Expo (React Native + Expo Router). It targets web first, with iPhone testing through Expo Go, and uses Supabase for auth/data when configured.

## Core MVP Features

- Magic-link auth (Supabase) with local demo fallback when env vars are missing.
- Task CRUD with optional deadlines and manual XP override.
- Retroactive completion logging for earned credit (for example: chores done yesterday).
- Complex parent tasks with structured subtasks.
- Recurring tasks (`interval_days` and `weekly`) with skip-per-occurrence.
- XP engine with early/on-time/late timing buckets and streak multipliers.
- Level progression, avatar stages, XP ledger history, and streak tracking.
- Weekly planner that suggests sub-90-minute slots based on work/sleep/free schedule.
- Optional AI-assisted planner suggestions using your own OpenAI API key.
- Optional AI XP assistant (with heuristic fallback) for task and retroactive completion forms.
- Voice dictation buttons for quick-add, task editor, retro logging, and complex task input.
- ICS calendar import support to seed availability from calendar events.
- Offline-first local persistence + queued sync actions for server RPC/table sync.
- In-app reminder feed + local scheduled reminders (native) + web push registration flow.

## Tech Stack

- Frontend: Expo, React Native, Expo Router, TypeScript.
- State/Data: TanStack Query + AsyncStorage snapshot persistence.
- Backend: Supabase Postgres + RLS + RPCs (`supabase/migrations`).
- Hosting: Vercel (static web export).

## Requirements

- Node `>=20.19.4` (see `.nvmrc`).
- npm `>=10` recommended.
- Expo CLI (via `npx expo ...` commands).

## Local Setup

```bash
npm install
cp .env.example .env
# fill env values
npm run typecheck
npm run test
npm run web
```

If `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are unset, the app runs in local demo mode.

## Supabase Setup

1. Create a Supabase project.
2. Link the project and apply migrations:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

3. Add env vars in `.env`.

Migration files:

- `supabase/migrations/20260222011000_core_schema.sql`
- `supabase/migrations/20260222012000_rpc_and_rls.sql`
- `supabase/migrations/20260222020000_task_extensions.sql`

## Testing

```bash
npm run test
npm run typecheck
```

Playwright smoke test (requires web app running):

```bash
npm run web
# in another terminal
npm run test:e2e
```

## Web Deploy (Vercel)

1. Import the repo in Vercel.
2. Build command: `npm run build:web`
3. Output directory: `dist`
4. Add env vars from `.env.example`.

## iPhone Testing

```bash
npm run start
# scan QR code from Expo Go on iPhone
```

## Project Structure

- `app/`: Expo Router routes/screens.
- `src/providers/`: auth and app-state providers.
- `src/lib/`: XP, recurrence, offline queue, notifications, scheduling.
- `src/types/`: shared domain/state types.
- `supabase/`: database schema, RLS, and RPC contracts.
- `tests/e2e/`: Playwright browser smoke coverage.
