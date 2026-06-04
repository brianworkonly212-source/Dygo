import type {
  EventDetail,
  EventNode,
  ExplorerData,
  NodeWithCategory,
  TourWithStops,
} from "@/lib/domain/types";

export function getCategoryMap(data: ExplorerData) {
  return new Map(data.categories.map((category) => [category.id, category]));
}

export function getNodesWithCategories(data: ExplorerData): NodeWithCategory[] {
  const categoryMap = getCategoryMap(data);

  return data.nodes
    .filter((node) => node.is_published)
    .map((node) => {
      const category = categoryMap.get(node.category_id) ?? data.categories[0];
      return { ...node, category };
    });
}

export function getEvents(data: ExplorerData): EventNode[] {
  const detailMap = new Map(
    data.eventDetails.map((detail) => [detail.node_id, detail]),
  );

  return getNodesWithCategories(data)
    .filter((node) => node.category.name === "Sự Kiện")
    .map((node) => ({
      ...node,
      eventDetail: detailMap.get(node.id) ?? createEventDetailFallback(node),
    }));
}

function createEventDetailFallback(node: NodeWithCategory): EventDetail {
  const fallbackDate = normalizeEventDateFallback(node);
  const displayTime = [node.time_start_text, node.time_end_text]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" - ");

  return {
    id: `fallback-${node.id}`,
    node_id: node.id,
    venue_name: node.title,
    venue_address: node.address ?? node.area ?? "",
    lat: node.lat ?? 0,
    lng: node.lng ?? 0,
    event_date: fallbackDate,
    event_start_text: node.time_start_text,
    event_end_text: node.time_end_text,
    event_start_date: null,
    event_end_date: null,
    start_time: "",
    end_time: "",
    weekday: "",
    display_time: displayTime || fallbackDate,
    event_time_text: displayTime || fallbackDate,
    created_at: node.created_at,
    updated_at: node.updated_at,
  };
}

function normalizeEventDateFallback(node: NodeWithCategory) {
  if (node.time_start_text) {
    const date = new Date(`${node.time_start_text}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return node.time_start_text;
  }

  const year = node.year_start ?? new Date().getFullYear();
  return `${year}-01-01`;
}

export function getToursWithStops(data: ExplorerData): TourWithStops[] {
  const categoryMap = getCategoryMap(data);
  const nodeMap = new Map(getNodesWithCategories(data).map((node) => [node.id, node]));

  return data.tours
    .filter((tour) => tour.is_published)
    .map((tour) => ({
      ...tour,
      category:
        categoryMap.get(tour.category_id ?? "") ??
        data.categories.find((category) => category.name === "Chặng Đường") ??
        null,
      stops: data.tourStops
        .filter((stop) => stop.tour_id === tour.id)
        .sort((a, b) => a.stop_order - b.stop_order)
        .flatMap((stop) => {
          const node = nodeMap.get(stop.node_id);
          return node ? [{ ...stop, node }] : [];
        }),
    }));
}

export function getRelatedNodes(data: ExplorerData, nodeId: string): NodeWithCategory[] {
  const linkedIds = new Set<string>();

  for (const relation of data.relations) {
    if (relation.source_node_id === nodeId) linkedIds.add(relation.target_node_id);
    if (relation.target_node_id === nodeId) linkedIds.add(relation.source_node_id);
  }

  return getNodesWithCategories(data).filter((node) => linkedIds.has(node.id));
}
