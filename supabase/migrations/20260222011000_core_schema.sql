create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  timezone text not null default 'UTC',
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  notes text,
  effort text not null default 'normal' check (effort in ('quick', 'normal', 'deep')),
  due_at timestamptz,
  manual_xp integer check (manual_xp >= 0),
  recurrence_rule jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_user_id on public.tasks (user_id);
create index if not exists idx_tasks_due_at on public.tasks (due_at);

create table if not exists public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped', 'canceled')),
  scheduled_for timestamptz,
  completed_at timestamptz,
  skipped_at timestamptz,
  skip_reason text,
  occurrence_index integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, occurrence_index)
);

create index if not exists idx_task_occurrences_user_id on public.task_occurrences (user_id);
create index if not exists idx_task_occurrences_status_due on public.task_occurrences (status, due_at);
create unique index if not exists idx_task_occurrences_task_due_unique on public.task_occurrences (task_id, due_at) where due_at is not null;

create table if not exists public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  occurrence_id uuid references public.task_occurrences (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  client_action_id text not null unique,
  awarded_xp integer not null,
  base_xp integer,
  timing_factor numeric(5, 2),
  streak_multiplier numeric(5, 2),
  event_type text not null check (event_type in ('task_completed', 'task_skipped', 'manual_adjustment', 'streak_bonus')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_ledger_user_id_created on public.xp_ledger (user_id, created_at desc);

create table if not exists public.user_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  total_xp integer not null default 0,
  level integer not null default 1,
  current_streak_days integer not null default 0,
  longest_streak_days integer not null default 0,
  last_completed_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.avatar_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  seed text not null,
  stage integer not null default 1 check (stage between 1 and 4),
  updated_at timestamptz not null default now()
);

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_web_push_subscriptions_user_id on public.web_push_subscriptions (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_task_occurrences_updated_at on public.task_occurrences;
create trigger trg_task_occurrences_updated_at
before update on public.task_occurrences
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_progress_updated_at on public.user_progress;
create trigger trg_user_progress_updated_at
before update on public.user_progress
for each row execute function public.set_updated_at();

drop trigger if exists trg_avatar_state_updated_at on public.avatar_state;
create trigger trg_avatar_state_updated_at
before update on public.avatar_state
for each row execute function public.set_updated_at();

create or replace function public.taskforge_streak_multiplier(streak_days integer)
returns numeric
language sql
immutable
as $$
  select case
    when streak_days >= 14 then 1.15
    when streak_days >= 7 then 1.10
    when streak_days >= 3 then 1.05
    else 1.00
  end;
$$;

create or replace function public.taskforge_timing_factor(due_at timestamptz, completed_at timestamptz)
returns numeric
language sql
immutable
as $$
  select case
    when due_at is null then 1.00
    when completed_at < due_at - interval '24 hours' then 1.25
    when completed_at <= due_at then 1.00
    when completed_at <= due_at + interval '24 hours' then 0.50
    else 0.00
  end;
$$;

create or replace function public.taskforge_compute_base_xp(
  task_effort text,
  manual_xp integer,
  due_at timestamptz,
  now_at timestamptz default now()
)
returns integer
language sql
immutable
as $$
  select greatest(
    10,
    least(
      120,
      coalesce(
        manual_xp,
        case task_effort
          when 'quick' then 20
          when 'deep' then 70
          else 40
        end +
        case
          when due_at is not null and due_at >= now_at and due_at <= now_at + interval '24 hours' then 10
          else 0
        end
      )
    )
  );
$$;

create or replace function public.taskforge_xp_threshold(level integer)
returns integer
language sql
immutable
as $$
  select case
    when level <= 1 then 0
    else 25 * (level - 1) * (level + 2)
  end;
$$;

create or replace function public.taskforge_level_from_total_xp(total_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  v_level integer := 1;
begin
  if total_xp <= 0 then
    return 1;
  end if;

  while public.taskforge_xp_threshold(v_level + 1) <= total_xp loop
    v_level := v_level + 1;
  end loop;

  return v_level;
end;
$$;

create or replace function public.taskforge_avatar_stage(level integer)
returns integer
language sql
immutable
as $$
  select case
    when level >= 20 then 4
    when level >= 10 then 3
    when level >= 5 then 2
    else 1
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.user_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.avatar_state (user_id, seed, stage)
  values (new.id, encode(gen_random_bytes(8), 'hex'), 1)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

