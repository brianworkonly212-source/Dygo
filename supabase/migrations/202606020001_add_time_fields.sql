alter table public.content_nodes
  add column if not exists opening_time text;

alter table public.event_details
  add column if not exists event_time_text text;
