alter table public.content_nodes
  add column if not exists featured_content text;

alter table public.tours
  add column if not exists featured_content text;
