alter table public.tours
  add column if not exists category_id uuid references public.categories(id) on delete set null;

insert into public.categories (name, slug, description, icon_name, color, background_color, sort_order, is_active, is_system)
values
  ('Câu Chuyện', 'cau-chuyen', 'Các câu chuyện, ký ức và lớp diễn giải văn hóa', 'CauChuyen', '#D3B778', '#F0E3BF', 9, true, true),
  ('Chặng Đường', 'chang-duong', 'Các tuyến tour và hành trình khám phá', 'ChangDuong', '#523FCB', '#D8D1F7', 10, true, true)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon_name = excluded.icon_name,
  color = excluded.color,
  background_color = excluded.background_color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  is_system = excluded.is_system,
  updated_at = now();

update public.tours
set category_id = (select id from public.categories where slug = 'chang-duong')
where category_id is null;
