import { MapPin } from "lucide-react";

const categoryIconUrls: Record<string, string> = {
  DiaDiem: "/category-icons/dia-diem.svg",
  DiaDanh: "/category-icons/dia-diem.svg",
  Landmark: "/category-icons/dia-diem.svg",
  PhucDung: "/category-icons/phuc-dung.svg",
  Hourglass: "/category-icons/phuc-dung.svg",
  HoaTiet: "/category-icons/hoa-tiet.svg",
  Route: "/category-icons/hoa-tiet.svg",
  Hidden: "/category-icons/hidden.svg",
  Sparkles: "/category-icons/hidden.svg",
  HoatDong: "/category-icons/hoat-dong.svg",
  CalendarDays: "/category-icons/hoat-dong.svg",
  ConNguoi: "/category-icons/con-nguoi.svg",
  UserRound: "/category-icons/con-nguoi.svg",
  HienVat: "/category-icons/hien-vat.svg",
  Artifact: "/category-icons/hien-vat.svg",
  SuKien: "/category-icons/su-kien.svg",
  CauChuyen: "/category-icons/cau-chuyen.svg",
  ChangDuong: "/category-icons/chang-duong.svg",
};

export function getCategoryIconUrl(name?: string | null) {
  return name ? categoryIconUrls[name] : undefined;
}

export function CategoryIcon({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const iconUrl = getCategoryIconUrl(name);

  if (!iconUrl) return <MapPin className={className} aria-hidden="true" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl}
      alt=""
      className={className}
      aria-hidden="true"
      draggable={false}
      decoding="async"
      loading="lazy"
    />
  );
}
