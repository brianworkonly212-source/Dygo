insert into public.categories (name, slug, description, icon_name, color, background_color, sort_order, is_active, is_system)
values
  ('Địa Điểm', 'dia-danh', 'Không gian văn hóa Hà Nội', 'DiaDiem', '#FFDD42', '#FFF0A6', 1, true, true),
  ('Hoạt Động', 'hoat-dong', 'Các hoạt động, lễ hội, trình diễn và mốc văn hóa', 'HoatDong', '#CDE055', '#EAF4A5', 2, true, true),
  ('Họa Tiết', 'tour', 'Hệ hoạ tiết, motif và dấu hiệu thị giác trong văn hóa Hà Nội', 'HoaTiet', '#FD88E7', '#FFD1F6', 3, true, true),
  ('Phục Dựng', 'thoi-ky', 'Các lớp tái dựng, bảo tồn và diễn giải di sản', 'PhucDung', '#F8A23A', '#FFD9AF', 4, true, true),
  ('Con Người', 'nhan-vat', 'Những nhân vật lịch sử và văn hóa kết nối với Hà Nội', 'ConNguoi', '#C1B7AE', '#E4DDD7', 5, true, true),
  ('Hidden', 'tin-nguong', 'Nhóm nội dung ẩn hoặc chưa phân loại công khai', 'Hidden', '#8266A1', '#D9CCE9', 6, true, true),
  ('Sự Kiện', 'su-kien', 'Các sự kiện văn hóa có lịch diễn và thông tin tham dự', 'SuKien', '#EB7B64', '#EAF4A5', 7, true, true),
  ('Hiện Vật', 'hien-vat', 'Đồ vật, hiện vật và dấu vết vật chất gắn với ký ức Hà Nội', 'HienVat', '#5BB0C7', '#EAF4A5', 8, true, true),
  ('Câu Chuyện', 'cau-chuyen', 'Các câu chuyện, ký ức và lớp diễn giải văn hóa', 'CauChuyen', '#D3B778', '#F0E3BF', 9, true, true),
  ('Chặng Đường', 'chang-duong', 'Các tuyến tour và hành trình khám phá', 'ChangDuong', '#523FCB', '#D8D1F7', 10, true, true)
on conflict (slug) do nothing;
