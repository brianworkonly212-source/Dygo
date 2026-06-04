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

  if (data.categories.length > 0) {
    const { error } = await supabase.from("categories").upsert(data.categories, { onConflict: "id" });
    if (error) throw error;
  }
  if (data.nodes.length > 0) {
    const { error } = await supabase.from("content_nodes").upsert(data.nodes, { onConflict: "id" });
    if (error) throw error;
  }
  if (data.relations.length > 0) {
    const { error } = await supabase.from("node_relations").upsert(data.relations, { onConflict: "id" });
    if (error) throw error;
  }
  if (data.tours.length > 0) {
    const { error } = await supabase.from("tours").upsert(data.tours, { onConflict: "id" });
    if (error) throw error;
  }
  if (data.tourStops.length > 0) {
    const { error } = await supabase.from("tour_stops").upsert(data.tourStops, { onConflict: "id" });
    if (error) throw error;
  }
  if (data.eventDetails.length > 0) {
    const { error } = await supabase.from("event_details").upsert(data.eventDetails, { onConflict: "id" });
    if (error) throw error;
  }
  if (data.mediaAssets.length > 0) {
    const { error } = await supabase.from("media_assets").upsert(data.mediaAssets, { onConflict: "id" });
    if (error) throw error;
  }
}
