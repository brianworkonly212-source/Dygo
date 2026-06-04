export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_name: string | null;
  icon_url: string | null;
  color: string;
  background_color: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type ContentNode = {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  summary: string;
  featured_content: string | null;
  content: string;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  time_start_text: string | null;
  time_end_text: string | null;
  year_start: number | null;
  year_end: number | null;
  area: string | null;
  period: string | null;
  belief: string | null;
  process: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  google_map_url: string | null;
  opening_time: string | null;
  is_event: boolean;
  is_published: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type NodeRelation = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type: string;
  label: string;
  description: string | null;
  weight: number;
  created_at: string;
};

export type Tour = {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  featured_content: string | null;
  description: string;
  image_url: string | null;
  duration_text: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type TourStop = {
  id: string;
  tour_id: string;
  node_id: string;
  stop_order: number;
  note: string | null;
  created_at: string;
};

export type EventDetail = {
  id: string;
  node_id: string;
  venue_name: string;
  venue_address: string;
  lat: number;
  lng: number;
  event_date: string;
  event_start_text: string | null;
  event_end_text: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  start_time: string;
  end_time: string;
  weekday: string;
  display_time: string;
  event_time_text: string | null;
  created_at: string;
  updated_at: string;
};

export type MediaAsset = {
  id: string;
  node_id: string;
  type: "image" | "video" | "audio";
  url: string;
  alt: string | null;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

export type UserNodeInteraction = {
  id: string;
  user_id: string;
  node_id: string;
  is_loved: boolean;
  is_explored: boolean;
  loved_at: string | null;
  explored_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExplorerData = {
  categories: Category[];
  nodes: ContentNode[];
  relations: NodeRelation[];
  tours: Tour[];
  tourStops: TourStop[];
  eventDetails: EventDetail[];
  mediaAssets: MediaAsset[];
};

export type NodeWithCategory = ContentNode & {
  category: Category;
};

export type EventNode = NodeWithCategory & {
  eventDetail: EventDetail;
};

export type TourWithStops = Tour & {
  category: Category | null;
  stops: Array<TourStop & { node: NodeWithCategory }>;
};
