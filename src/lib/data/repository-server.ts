import "server-only";

import { seedData } from "@/lib/data/seed";
import type {
  Category,
  ContentNode,
  EventDetail,
  ExplorerData,
  MediaAsset,
  NodeRelation,
  Tour,
  TourStop,
} from "@/lib/domain/types";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

export async function getExplorerData(): Promise<ExplorerData> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return seedData;

  const [
    categories,
    nodes,
    relations,
    tours,
    tourStops,
    eventDetails,
    mediaAssets,
  ] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    supabase.from("content_nodes").select("*").order("created_at", { ascending: true }),
    supabase.from("node_relations").select("*").order("created_at", { ascending: true }),
    supabase.from("tours").select("*").order("created_at", { ascending: true }),
    supabase.from("tour_stops").select("*").order("stop_order", { ascending: true }),
    supabase.from("event_details").select("*").order("created_at", { ascending: true }),
    supabase.from("media_assets").select("*").order("sort_order", { ascending: true }),
  ]);

  const firstError = [
    categories.error,
    nodes.error,
    relations.error,
    tours.error,
    tourStops.error,
    eventDetails.error,
    mediaAssets.error,
  ].find(Boolean);

  if (firstError) {
    console.error("Supabase explorer data query failed", firstError);
    return seedData;
  }

  if (
    (categories.data?.length ?? 0) === 0 &&
    (nodes.data?.length ?? 0) === 0 &&
    (tours.data?.length ?? 0) === 0
  ) {
    return seedData;
  }

  return {
    categories: (categories.data ?? []) as Category[],
    nodes: (nodes.data ?? []) as ContentNode[],
    relations: (relations.data ?? []) as NodeRelation[],
    tours: (tours.data ?? []) as Tour[],
    tourStops: (tourStops.data ?? []) as TourStop[],
    eventDetails: (eventDetails.data ?? []) as EventDetail[],
    mediaAssets: (mediaAssets.data ?? []) as MediaAsset[],
  };
}

export async function persistExplorerData(data: ExplorerData) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Missing Supabase admin environment");
  }

  const relations = dedupeNodeRelations(data.relations);
  const tourStops = dedupeTourStops(data.tourStops);

  if (data.categories.length > 0) {
    const { error } = await supabase.from("categories").upsert(data.categories, { onConflict: "id" });
    if (error) throw error;
  }
  {
    const { error } = await deleteRowsMissingFromSnapshot(
      supabase,
      "content_nodes",
      data.nodes.map((node) => node.id),
    );
    if (error) throw error;
  }
  if (data.nodes.length > 0) {
    const { error } = await supabase.from("content_nodes").upsert(data.nodes, { onConflict: "id" });
    if (error) throw error;
  }
  {
    const { error } = await supabase.from("node_relations").delete().eq("relation_type", "admin_link");
    if (error) throw error;
  }
  if (relations.length > 0) {
    const { error } = await supabase.from("node_relations").upsert(relations, { onConflict: "id" });
    if (error) throw error;
  }
  {
    const { error } = await deleteRowsMissingFromSnapshot(
      supabase,
      "tours",
      data.tours.map((tour) => tour.id),
    );
    if (error) throw error;
  }
  if (data.tours.length > 0) {
    const { error } = await supabase.from("tours").upsert(data.tours, { onConflict: "id" });
    if (error) throw error;
  }
  {
    const { error } = await supabase.from("tour_stops").delete().not("id", "is", null);
    if (error) throw error;
  }
  if (tourStops.length > 0) {
    const { error } = await supabase.from("tour_stops").upsert(tourStops, { onConflict: "id" });
    if (error) throw error;
  }
  if (data.eventDetails.length > 0) {
    const { error } = await supabase.from("event_details").upsert(data.eventDetails, { onConflict: "id" });
    if (error) throw error;
  }
  {
    const { error } = await deleteRowsMissingFromSnapshot(
      supabase,
      "media_assets",
      data.mediaAssets.map((asset) => asset.id),
    );
    if (error) throw error;
  }
  if (data.mediaAssets.length > 0) {
    const { error } = await supabase.from("media_assets").upsert(data.mediaAssets, { onConflict: "id" });
    if (error) throw error;
  }
}

function deleteRowsMissingFromSnapshot(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  table: "content_nodes" | "tours" | "media_assets",
  ids: string[],
) {
  if (ids.length === 0) {
    return supabase.from(table).delete().not("id", "is", null);
  }

  const idList = ids.join(",");
  return supabase.from(table).delete().not("id", "in", `(${idList})`);
}

function dedupeNodeRelations(relations: NodeRelation[]) {
  const seen = new Set<string>();
  const nextRelations: NodeRelation[] = [];

  for (const relation of relations) {
    const key = `${relation.source_node_id}:${relation.target_node_id}:${relation.relation_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nextRelations.push(relation);
  }

  return nextRelations;
}

function dedupeTourStops(stops: TourStop[]) {
  const seen = new Set<string>();
  const nextStops: TourStop[] = [];

  for (const stop of stops) {
    const key = `${stop.tour_id}:${stop.node_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nextStops.push(stop);
  }

  return nextStops;
}
