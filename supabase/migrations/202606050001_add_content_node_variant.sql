alter table public.content_nodes
  add column if not exists variant int check (variant is null or variant >= 0);
