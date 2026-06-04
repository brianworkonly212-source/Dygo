alter table public.content_nodes
  add column if not exists time_start_text text,
  add column if not exists time_end_text text,
  add column if not exists year_start int,
  add column if not exists year_end int;

alter table public.event_details
  add column if not exists event_start_text text,
  add column if not exists event_end_text text,
  add column if not exists event_start_date date,
  add column if not exists event_end_date date;

update public.event_details
set
  event_start_date = coalesce(event_start_date, event_date),
  event_end_date = coalesce(event_end_date, event_date)
where event_date is not null;

alter table public.tours
  drop column if exists estimated_minutes;

alter table public.tour_stops
  drop column if exists estimated_minutes;
