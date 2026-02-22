create or replace function public.complete_occurrence(
  occurrence_id uuid,
  completed_at timestamptz,
  client_action_id text
)
returns table (
  awarded_xp integer,
  base_xp integer,
  timing_factor numeric,
  streak_multiplier numeric,
  total_xp integer,
  level integer,
  leveled_up boolean,
  current_streak_days integer,
  avatar_stage integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_occurrence public.task_occurrences%rowtype;
  v_task public.tasks%rowtype;
  v_progress public.user_progress%rowtype;
  v_existing public.xp_ledger%rowtype;
  v_previous_level integer;
  v_completed_date date;
  v_new_streak integer;
  v_base integer;
  v_timing numeric;
  v_streak_mult numeric;
  v_awarded integer;
  v_total integer;
  v_level integer;
  v_avatar_stage integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_existing
  from public.xp_ledger
  where xp_ledger.client_action_id = complete_occurrence.client_action_id
  limit 1;

  if found then
    select * into v_progress from public.user_progress where user_progress.user_id = v_user_id;

    return query
    select
      v_existing.awarded_xp,
      coalesce(v_existing.base_xp, 0),
      coalesce(v_existing.timing_factor, 1),
      coalesce(v_existing.streak_multiplier, 1),
      coalesce(v_progress.total_xp, 0),
      coalesce(v_progress.level, 1),
      false,
      coalesce(v_progress.current_streak_days, 0),
      coalesce((select stage from public.avatar_state where avatar_state.user_id = v_user_id), 1);
    return;
  end if;

  select *
  into v_occurrence
  from public.task_occurrences
  where task_occurrences.id = complete_occurrence.occurrence_id
    and task_occurrences.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Occurrence not found';
  end if;

  if v_occurrence.status <> 'pending' then
    raise exception 'Occurrence is already processed';
  end if;

  select *
  into v_task
  from public.tasks
  where tasks.id = v_occurrence.task_id
    and tasks.user_id = v_user_id;

  if not found then
    raise exception 'Task not found';
  end if;

  insert into public.user_progress (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_progress
  from public.user_progress
  where user_progress.user_id = v_user_id
  for update;

  v_previous_level := v_progress.level;
  v_completed_date := timezone(coalesce((select timezone from public.profiles where id = v_user_id), 'UTC'), completed_at)::date;

  if v_progress.last_completed_date is null then
    v_new_streak := 1;
  elsif v_progress.last_completed_date = v_completed_date then
    v_new_streak := v_progress.current_streak_days;
  elsif v_progress.last_completed_date = v_completed_date - 1 then
    v_new_streak := v_progress.current_streak_days + 1;
  else
    v_new_streak := 1;
  end if;

  v_base := public.taskforge_compute_base_xp(v_task.effort, v_task.manual_xp, coalesce(v_occurrence.due_at, v_task.due_at), completed_at);
  v_timing := public.taskforge_timing_factor(coalesce(v_occurrence.due_at, v_task.due_at), completed_at);
  v_streak_mult := public.taskforge_streak_multiplier(v_new_streak);
  v_awarded := greatest(0, round(v_base * v_timing * v_streak_mult)::integer);
  v_total := v_progress.total_xp + v_awarded;
  v_level := public.taskforge_level_from_total_xp(v_total);
  v_avatar_stage := public.taskforge_avatar_stage(v_level);

  update public.task_occurrences
  set status = 'completed',
      completed_at = complete_occurrence.completed_at
  where id = v_occurrence.id;

  insert into public.xp_ledger (
    user_id,
    occurrence_id,
    task_id,
    client_action_id,
    awarded_xp,
    base_xp,
    timing_factor,
    streak_multiplier,
    event_type
  ) values (
    v_user_id,
    v_occurrence.id,
    v_occurrence.task_id,
    complete_occurrence.client_action_id,
    v_awarded,
    v_base,
    v_timing,
    v_streak_mult,
    'task_completed'
  );

  update public.user_progress
  set total_xp = v_total,
      level = v_level,
      current_streak_days = v_new_streak,
      longest_streak_days = greatest(v_progress.longest_streak_days, v_new_streak),
      last_completed_date = greatest(coalesce(v_progress.last_completed_date, v_completed_date), v_completed_date)
  where user_id = v_user_id;

  insert into public.avatar_state (user_id, seed, stage)
  values (v_user_id, encode(gen_random_bytes(8), 'hex'), v_avatar_stage)
  on conflict (user_id) do update
  set stage = excluded.stage;

  return query
  select
    v_awarded,
    v_base,
    v_timing,
    v_streak_mult,
    v_total,
    v_level,
    v_level > v_previous_level,
    v_new_streak,
    v_avatar_stage;
end;
$$;

create or replace function public.skip_occurrence(
  occurrence_id uuid,
  skipped_at timestamptz,
  reason text,
  client_action_id text
)
returns table (
  awarded_xp integer,
  total_xp integer,
  level integer,
  current_streak_days integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_occurrence public.task_occurrences%rowtype;
  v_progress public.user_progress%rowtype;
  v_existing public.xp_ledger%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_existing
  from public.xp_ledger
  where xp_ledger.client_action_id = skip_occurrence.client_action_id
  limit 1;

  if found then
    select * into v_progress from public.user_progress where user_progress.user_id = v_user_id;

    return query
    select
      v_existing.awarded_xp,
      coalesce(v_progress.total_xp, 0),
      coalesce(v_progress.level, 1),
      coalesce(v_progress.current_streak_days, 0);
    return;
  end if;

  select *
  into v_occurrence
  from public.task_occurrences
  where task_occurrences.id = skip_occurrence.occurrence_id
    and task_occurrences.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Occurrence not found';
  end if;

  if v_occurrence.status <> 'pending' then
    raise exception 'Occurrence is already processed';
  end if;

  insert into public.user_progress (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select * into v_progress from public.user_progress where user_progress.user_id = v_user_id;

  update public.task_occurrences
  set status = 'skipped',
      skipped_at = skip_occurrence.skipped_at,
      skip_reason = skip_occurrence.reason
  where id = v_occurrence.id;

  insert into public.xp_ledger (
    user_id,
    occurrence_id,
    task_id,
    client_action_id,
    awarded_xp,
    event_type,
    note
  ) values (
    v_user_id,
    v_occurrence.id,
    v_occurrence.task_id,
    skip_occurrence.client_action_id,
    0,
    'task_skipped',
    coalesce(skip_occurrence.reason, 'skipped')
  );

  return query
  select
    0,
    coalesce(v_progress.total_xp, 0),
    coalesce(v_progress.level, 1),
    coalesce(v_progress.current_streak_days, 0);
end;
$$;

create or replace function public.generate_occurrences(
  user_id uuid,
  horizon_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user uuid := auth.uid();
  v_task record;
  v_base_date date;
  v_cursor date;
  v_end_date date := current_date + greatest(horizon_days, 1);
  v_interval integer;
  v_weekly_start date;
  v_day_code text;
  v_day_num integer;
  v_new_count integer := 0;
  v_due_time time;
  v_next_index integer;
begin
  if v_auth_user is null or v_auth_user <> generate_occurrences.user_id then
    raise exception 'Unauthorized';
  end if;

  for v_task in
    select *
    from public.tasks
    where tasks.user_id = generate_occurrences.user_id
      and tasks.active = true
      and tasks.recurrence_rule is not null
  loop
    v_base_date := coalesce(v_task.due_at::date, v_task.created_at::date);
    v_due_time := coalesce(v_task.due_at::time, time '09:00');

    if v_task.recurrence_rule ->> 'kind' = 'interval_days' then
      v_interval := greatest(coalesce((v_task.recurrence_rule ->> 'every')::integer, 1), 1);
      v_cursor := v_base_date;

      while v_cursor <= v_end_date loop
        if v_cursor >= current_date then
          if not exists (
            select 1
            from public.task_occurrences
            where task_occurrences.task_id = v_task.id
              and task_occurrences.due_at::date = v_cursor
          ) then
            select coalesce(max(occurrence_index), 0) + 1
            into v_next_index
            from public.task_occurrences
            where task_occurrences.task_id = v_task.id;

            insert into public.task_occurrences (
              task_id,
              user_id,
              due_at,
              status,
              occurrence_index
            ) values (
              v_task.id,
              generate_occurrences.user_id,
              (v_cursor::timestamp + v_due_time),
              'pending',
              v_next_index
            );
            v_new_count := v_new_count + 1;
          end if;
        end if;

        v_cursor := v_cursor + v_interval;
      end loop;
    elsif v_task.recurrence_rule ->> 'kind' = 'weekly' then
      v_interval := greatest(coalesce((v_task.recurrence_rule ->> 'every')::integer, 1), 1);
      v_weekly_start := date_trunc('week', v_base_date)::date;
      v_cursor := greatest(v_base_date, current_date);

      while v_cursor <= v_end_date loop
        if ((v_cursor - v_weekly_start) / 7)::integer % v_interval = 0 then
          for v_day_code in select jsonb_array_elements_text(v_task.recurrence_rule -> 'days')
          loop
            v_day_num := case v_day_code
              when 'MO' then 1
              when 'TU' then 2
              when 'WE' then 3
              when 'TH' then 4
              when 'FR' then 5
              when 'SA' then 6
              else 7
            end;

            if extract(isodow from v_cursor) = v_day_num and v_cursor >= v_base_date then
              if not exists (
                select 1
                from public.task_occurrences
                where task_occurrences.task_id = v_task.id
                  and task_occurrences.due_at::date = v_cursor
              ) then
                select coalesce(max(occurrence_index), 0) + 1
                into v_next_index
                from public.task_occurrences
                where task_occurrences.task_id = v_task.id;

                insert into public.task_occurrences (
                  task_id,
                  user_id,
                  due_at,
                  status,
                  occurrence_index
                ) values (
                  v_task.id,
                  generate_occurrences.user_id,
                  (v_cursor::timestamp + v_due_time),
                  'pending',
                  v_next_index
                );
                v_new_count := v_new_count + 1;
              end if;
            end if;
          end loop;
        end if;

        v_cursor := v_cursor + 1;
      end loop;
    end if;
  end loop;

  return v_new_count;
end;
$$;

create or replace function public.upsert_task(
  task_id uuid,
  title text,
  notes text,
  effort text,
  due_at timestamptz,
  manual_xp integer,
  recurrence_rule jsonb,
  active boolean
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.tasks%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if upsert_task.task_id is null then
    insert into public.tasks (
      user_id,
      title,
      notes,
      effort,
      due_at,
      manual_xp,
      recurrence_rule,
      active
    ) values (
      v_user_id,
      upsert_task.title,
      upsert_task.notes,
      coalesce(upsert_task.effort, 'normal'),
      upsert_task.due_at,
      upsert_task.manual_xp,
      upsert_task.recurrence_rule,
      coalesce(upsert_task.active, true)
    )
    returning * into v_task;
  else
    update public.tasks
    set title = upsert_task.title,
        notes = upsert_task.notes,
        effort = coalesce(upsert_task.effort, 'normal'),
        due_at = upsert_task.due_at,
        manual_xp = upsert_task.manual_xp,
        recurrence_rule = upsert_task.recurrence_rule,
        active = coalesce(upsert_task.active, true)
    where tasks.id = upsert_task.task_id
      and tasks.user_id = v_user_id
    returning * into v_task;
  end if;

  return v_task;
end;
$$;

create or replace function public.cancel_recurrence(task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.tasks
  set recurrence_rule = null,
      active = false
  where tasks.id = cancel_recurrence.task_id
    and tasks.user_id = v_user_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_occurrences enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.user_progress enable row level security;
alter table public.avatar_state enable row level security;
alter table public.web_push_subscriptions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists tasks_all_own on public.tasks;
create policy tasks_all_own on public.tasks for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists task_occurrences_all_own on public.task_occurrences;
create policy task_occurrences_all_own on public.task_occurrences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists xp_ledger_select_own on public.xp_ledger;
create policy xp_ledger_select_own on public.xp_ledger for select to authenticated using (auth.uid() = user_id);

drop policy if exists user_progress_all_own on public.user_progress;
create policy user_progress_all_own on public.user_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists avatar_state_all_own on public.avatar_state;
create policy avatar_state_all_own on public.avatar_state for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists web_push_subscriptions_all_own on public.web_push_subscriptions;
create policy web_push_subscriptions_all_own on public.web_push_subscriptions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant execute on function public.complete_occurrence(uuid, timestamptz, text) to authenticated;
grant execute on function public.skip_occurrence(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.generate_occurrences(uuid, integer) to authenticated;
grant execute on function public.upsert_task(uuid, text, text, text, timestamptz, integer, jsonb, boolean) to authenticated;
grant execute on function public.cancel_recurrence(uuid) to authenticated;
