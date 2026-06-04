"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export type NodeInteractionState = {
  exploredNodeIds: string[];
  lovedNodeIds: string[];
};

export type NodeProgressFilter = "Đã Khám Phá" | "Chưa Khám Phá" | "Đã Thích";

export const NODE_INTERACTION_STORAGE_KEY = "hanoi-explorer-node-interactions";
export const NODE_INTERACTION_EVENT = "hanoi-explorer-node-interactions-change";
export const NODE_PROGRESS_FILTER_OPTIONS: NodeProgressFilter[] = [
  "Đã Khám Phá",
  "Chưa Khám Phá",
  "Đã Thích",
];

const EMPTY_NODE_INTERACTIONS: NodeInteractionState = {
  exploredNodeIds: [],
  lovedNodeIds: [],
};

export function readNodeInteractionState(): NodeInteractionState {
  if (typeof window === "undefined") return EMPTY_NODE_INTERACTIONS;

  const saved = window.localStorage.getItem(NODE_INTERACTION_STORAGE_KEY);
  if (!saved) return EMPTY_NODE_INTERACTIONS;

  try {
    const parsed = JSON.parse(saved) as Partial<NodeInteractionState>;
    return {
      exploredNodeIds: Array.isArray(parsed.exploredNodeIds) ? parsed.exploredNodeIds : [],
      lovedNodeIds: Array.isArray(parsed.lovedNodeIds) ? parsed.lovedNodeIds : [],
    };
  } catch {
    window.localStorage.removeItem(NODE_INTERACTION_STORAGE_KEY);
    return EMPTY_NODE_INTERACTIONS;
  }
}

export function writeNodeInteractionState(state: NodeInteractionState) {
  window.localStorage.setItem(NODE_INTERACTION_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(NODE_INTERACTION_EVENT, { detail: state }));
  void writeRemoteNodeInteractionState(state);
}

export function useNodeInteractionState() {
  const [state, setState] = useState<NodeInteractionState>(readNodeInteractionState);

  useEffect(() => {
    function syncState() {
      setState(readNodeInteractionState());
    }

    window.addEventListener(NODE_INTERACTION_EVENT, syncState);
    window.addEventListener("storage", syncState);
    return () => {
      window.removeEventListener(NODE_INTERACTION_EVENT, syncState);
      window.removeEventListener("storage", syncState);
    };
  }, []);

  useEffect(() => {
    let active = true;

    readRemoteNodeInteractionState().then((remoteState) => {
      if (!active || !remoteState) return;
      window.localStorage.setItem(NODE_INTERACTION_STORAGE_KEY, JSON.stringify(remoteState));
      setState(remoteState);
    });

    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function nodeMatchesProgressFilter(
  nodeId: string,
  filter: string | null,
  state: NodeInteractionState,
) {
  if (!filter) return true;
  if (filter === "Đã Khám Phá") return state.exploredNodeIds.includes(nodeId);
  if (filter === "Chưa Khám Phá") return !state.exploredNodeIds.includes(nodeId);
  if (filter === "Đã Thích") return state.lovedNodeIds.includes(nodeId);
  return true;
}

export function getNodeGraphShareUrl(nodeId: string) {
  if (typeof window === "undefined") return `/?view=graph&node=${encodeURIComponent(nodeId)}`;
  const url = new URL(window.location.origin);
  url.searchParams.set("view", "graph");
  url.searchParams.set("node", nodeId);
  return url.toString();
}

async function readRemoteNodeInteractionState() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_node_interactions")
    .select("node_id,is_loved,is_explored")
    .eq("user_id", userId);

  if (error || !data) return null;

  return {
    lovedNodeIds: data
      .filter((row) => Boolean(row.is_loved))
      .map((row) => String(row.node_id)),
    exploredNodeIds: data
      .filter((row) => Boolean(row.is_explored))
      .map((row) => String(row.node_id)),
  } satisfies NodeInteractionState;
}

async function writeRemoteNodeInteractionState(state: NodeInteractionState) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const { data: existing } = await supabase
    .from("user_node_interactions")
    .select("node_id")
    .eq("user_id", userId);
  const nodeIds = [
    ...new Set([
      ...state.lovedNodeIds,
      ...state.exploredNodeIds,
      ...((existing ?? []).map((row) => String(row.node_id))),
    ]),
  ];
  if (nodeIds.length === 0) return;

  const now = new Date().toISOString();
  await supabase.from("user_node_interactions").upsert(
    nodeIds.map((nodeId) => ({
      user_id: userId,
      node_id: nodeId,
      is_loved: state.lovedNodeIds.includes(nodeId),
      is_explored: state.exploredNodeIds.includes(nodeId),
      loved_at: state.lovedNodeIds.includes(nodeId) ? now : null,
      explored_at: state.exploredNodeIds.includes(nodeId) ? now : null,
      updated_at: now,
    })),
    { onConflict: "user_id,node_id" },
  );
}
