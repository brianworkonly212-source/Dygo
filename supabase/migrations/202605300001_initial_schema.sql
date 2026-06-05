create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  icon_name text,
  icon_url text,
  color text not null default '#ffe05a',
  background_color text not null default '#fff4a8',
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_nodes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text unique not null,
  summary text,
  featured_content text,
  content text,
  image_url text,
  video_url text,
  audio_url text,
  variant int check (variant is null or variant >= 0),
  time_start_text text,
  time_end_text text,
  year_start int,
  year_end int,
  area text,
  period text,
  belief text,
  process text,
  lat double precision,
  lng double precision,
  address text,
  google_map_url text,
  opening_time text,
  is_event boolean not null default false,
  is_published boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.node_relations (
  id uuid primary key default gen_random_uuid(),
  source_node_id uuid not null references public.content_nodes(id) on delete cascade,
  target_node_id uuid not null references public.content_nodes(id) on delete cascade,
  relation_type text not null,
  label text,
  description text,
  weight double precision not null default 1,
  created_at timestamptz not null default now(),
  unique(source_node_id, target_node_id, relation_type)
);

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text unique not null,
  featured_content text,
  description text,
  image_url text,
  duration_text text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tour_stops (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  node_id uuid not null references public.content_nodes(id) on delete cascade,
  stop_order int not null,
  note text,
  created_at timestamptz not null default now(),
  unique(tour_id, node_id)
);

create table if not exists public.event_details (
  id uuid primary key default gen_random_uuid(),
  node_id uuid unique not null references public.content_nodes(id) on delete cascade,
  venue_name text,
  venue_address text,
  lat double precision,
  lng double precision,
  event_date date,
  event_start_text text,
  event_end_text text,
  event_start_date date,
  event_end_date date,
  start_time time,
  end_time time,
  weekday text,
  display_time text,
  event_time_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  node_id uuid references public.content_nodes(id) on delete cascade,
  type text not null check (type in ('image', 'video', 'audio')),
  url text not null,
  alt text,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id uuid not null references public.content_nodes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, node_id)
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.content_nodes enable row level security;
alter table public.node_relations enable row level security;
alter table public.tours enable row level security;
alter table public.tour_stops enable row level security;
alter table public.event_details enable row level security;
alter table public.media_assets enable row level security;
alter table public.favorites enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "published categories readable" on public.categories;
create policy "published categories readable" on public.categories
  for select using (is_active = true);
drop policy if exists "published nodes readable" on public.content_nodes;
create policy "published nodes readable" on public.content_nodes
  for select using (is_published = true);
drop policy if exists "relations readable" on public.node_relations;
create policy "relations readable" on public.node_relations
  for select using (true);
drop policy if exists "published tours readable" on public.tours;
create policy "published tours readable" on public.tours
  for select using (is_published = true);
drop policy if exists "tour stops readable" on public.tour_stops;
create policy "tour stops readable" on public.tour_stops
  for select using (true);
drop policy if exists "event details readable" on public.event_details;
create policy "event details readable" on public.event_details
  for select using (true);
drop policy if exists "media readable" on public.media_assets;
create policy "media readable" on public.media_assets
  for select using (true);

drop policy if exists "admin full access categories" on public.categories;
create policy "admin full access categories" on public.categories
  for all using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');
drop policy if exists "admin full access nodes" on public.content_nodes;
create policy "admin full access nodes" on public.content_nodes
  for all using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');
drop policy if exists "admin full access relations" on public.node_relations;
create policy "admin full access relations" on public.node_relations
  for all using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');
drop policy if exists "admin full access tours" on public.tours;
create policy "admin full access tours" on public.tours
  for all using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');
drop policy if exists "admin full access tour stops" on public.tour_stops;
create policy "admin full access tour stops" on public.tour_stops
  for all using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');
drop policy if exists "admin full access event details" on public.event_details;
create policy "admin full access event details" on public.event_details
  for all using ((auth.jwt() ->> 'role') = 'admin')
  with check ((auth.jwt() ->> 'role') = 'admin');

drop policy if exists "own favorites" on public.favorites;
create policy "own favorites" on public.favorites
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "own chat sessions" on public.chat_sessions;
create policy "own chat sessions" on public.chat_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "own chat messages via session" on public.chat_messages;
create policy "own chat messages via session" on public.chat_messages
  for all using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
