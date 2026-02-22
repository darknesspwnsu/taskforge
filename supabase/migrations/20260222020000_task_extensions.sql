alter table public.tasks
  add column if not exists task_kind text not null default 'standard',
  add column if not exists parent_task_id uuid references public.tasks (id) on delete set null,
  add column if not exists estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0);

alter table public.tasks
  drop constraint if exists tasks_task_kind_check;

alter table public.tasks
  add constraint tasks_task_kind_check check (task_kind in ('standard', 'complex_parent', 'subtask'));

create index if not exists idx_tasks_parent_task_id on public.tasks (parent_task_id);
create index if not exists idx_tasks_task_kind on public.tasks (task_kind);
