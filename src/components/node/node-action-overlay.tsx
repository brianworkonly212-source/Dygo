"use client";

import { useState } from "react";
import { Heart, Share2 } from "lucide-react";
import {
  getNodeGraphShareUrl,
  readNodeInteractionState,
  writeNodeInteractionState,
  type NodeInteractionState,
} from "@/lib/node-interactions";
import { cn } from "@/lib/utils";

export function NodeActionOverlay({
  nodeId,
  title,
}: {
  nodeId: string;
  title: string;
}) {
  const [state, setState] = useState<NodeInteractionState>(readNodeInteractionState);

  const explored = state.exploredNodeIds.includes(nodeId);
  const loved = state.lovedNodeIds.includes(nodeId);

  function updateNodeInteraction(kind: keyof NodeInteractionState) {
    const exists = state[kind].includes(nodeId);
    const next = {
      ...state,
      [kind]: exists ? state[kind].filter((id) => id !== nodeId) : [...state[kind], nodeId],
    };

    writeNodeInteractionState(next);
    setState(next);
  }

  async function shareNode() {
    const url = getNodeGraphShareUrl(nodeId);

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard?.writeText(url);
    } catch {
      // Sharing can be cancelled by the user; no UI state needs to change.
    }
  }

  const exploredLabel = explored ? "Đã Khám Phá" : "Chưa Khám Phá";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <button
        type="button"
        className={cn(
          "paper-focus pointer-events-auto absolute left-3 top-3 h-8 cursor-pointer rounded-[4px] px-3 font-sans text-[14px] font-medium leading-5 text-[#2f2c29] shadow-sm",
          explored ? "bg-[#FDDD51]" : "bg-white",
        )}
        aria-pressed={explored}
        onClick={(event) => {
          event.stopPropagation();
          updateNodeInteraction("exploredNodeIds");
        }}
      >
        {exploredLabel}
      </button>

      <button
        type="button"
        className={cn(
          "paper-focus pointer-events-auto absolute right-3 top-3 grid h-8 w-8 cursor-pointer place-items-center rounded-[4px] text-[#2f2c29] shadow-sm",
          loved ? "bg-[#FDDD51]" : "bg-white",
        )}
        aria-label={loved ? "Bỏ thích" : "Thích"}
        aria-pressed={loved}
        onClick={(event) => {
          event.stopPropagation();
          updateNodeInteraction("lovedNodeIds");
        }}
      >
        <Heart className="h-5 w-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="paper-focus pointer-events-auto absolute bottom-3 right-3 grid h-8 w-8 cursor-pointer place-items-center rounded-[4px] bg-white text-[#2f2c29] shadow-sm"
        aria-label="Chia sẻ"
        onClick={(event) => {
          event.stopPropagation();
          void shareNode();
        }}
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
