import type {
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
    .filter((node) => node.category.name === "Sự Kiện" && detailMap.has(node.id))
    .map((node) => ({
      ...node,
      eventDetail: detailMap.get(node.id)!,
    }));
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
