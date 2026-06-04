create table if not exists public.user_node_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.content_nodes(id) on delete cascade,
  is_loved boolean not null default false,
  is_explored boolean not null default false,
  loved_at timestamptz,
  explored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, node_id)
);

alter table public.user_node_interactions enable row level security;

drop policy if exists "own node interactions" on public.user_node_interactions;
create policy "own node interactions" on public.user_node_interactions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
