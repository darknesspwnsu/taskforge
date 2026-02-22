# Supabase Setup

## 1. Create a project

Create a Supabase project and copy the project URL and anon key.

## 2. Apply migration

Run from this repo root:

```bash
supabase db push
```

If you are not using Supabase CLI locally yet:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## 3. Required environment variables

Set these in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=<https://your-project-ref.supabase.co>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

## 4. RPC contract summary

- `complete_occurrence(occurrence_id uuid, completed_at timestamptz, client_action_id text)`
- `skip_occurrence(occurrence_id uuid, skipped_at timestamptz, reason text, client_action_id text)`
- `generate_occurrences(user_id uuid, horizon_days int default 30)`
- `upsert_task(task_id uuid, title text, notes text, effort text, due_at timestamptz, manual_xp integer, recurrence_rule jsonb, active boolean)`
- `cancel_recurrence(task_id uuid)`
