"use client";

import { useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { ExplorerData } from "@/lib/domain/types";
import { getToursWithStops } from "@/lib/data/repository";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { PaperMenu, type AppView } from "@/components/layout/paper-menu";
import { MapView } from "@/components/map/map-view";
import { GraphView } from "@/components/graph/graph-view";
import { EventPanel } from "@/components/event/event-panel";
import { TourPanel } from "@/components/tour/tour-panel";
import { AiChat } from "@/components/chat/ai-chat";
import { AdminPanel } from "@/components/admin/admin-panel";

export function HanoiExplorerApp({
  initialData,
}: {
  initialData: ExplorerData;
}) {
  const initialSharedNodeId = getInitialSharedNodeId(initialData);
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<AppView>(initialSharedNodeId ? "graph" : "home");
  const [menuOpen, setMenuOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialSharedNodeId);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [graphFocusRequest, setGraphFocusRequest] = useState<{
    nodeId: string;
    nonce: number;
  } | null>(
    initialSharedNodeId ? { nodeId: initialSharedNodeId, nonce: 1 } : null,
  );
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const tours = useMemo(() => getToursWithStops(data), [data]);

  useGSAP(
    () => {
      if (!pageRef.current) return;
      if (view === "graph" && graphFocusRequest) {
        gsap.set(pageRef.current, { opacity: 1 });
        return;
      }

      gsap.fromTo(
        pageRef.current,
        { opacity: 0.85 },
        { opacity: 1, duration: 0.28, ease: "power2.out" },
      );
    },
    { dependencies: [graphFocusRequest?.nonce, view], scope: pageRef },
  );

  function navigate(nextView: AppView) {
    setView(nextView);
    setMenuOpen(true);
    if (nextView === "map") setSelectedTourId(null);
    if (nextView === "graph") setGraphFocusRequest(null);
    if (nextView === "tours") setSelectedTourId(selectedTourId ?? tours[0]?.id ?? null);
  }

  function openNodeInGraph(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedTourId(null);
    setGraphFocusRequest({ nodeId, nonce: Date.now() });
    setView("graph");
    setMenuOpen(true);
  }

  function openTourInTourView(tourId: string) {
    setSelectedTourId(tourId);
    setGraphFocusRequest(null);
    setView("tours");
    setMenuOpen(true);
  }

  return (
    <div className="min-w-[1024px]">
      <PaperMenu
        activeView={view}
        open={menuOpen}
        onToggle={() => setMenuOpen((value) => !value)}
        onNavigate={navigate}
        onHoverReveal={setMenuOpen}
        compact={view !== "home"}
      />
      <div ref={pageRef}>
        {view === "home" ? (
          <HomeDashboard data={data} onNavigate={navigate} />
        ) : null}
        {view === "map" ? (
          <MapView
            data={data}
            selectedNodeId={selectedNodeId}
            selectedTourId={selectedTourId}
            onSelectNode={setSelectedNodeId}
            onOpenNodeDetail={openNodeInGraph}
          />
        ) : null}
        {view === "graph" ? (
          <GraphView
            data={data}
            selectedNodeId={selectedNodeId}
            graphFocusRequest={graphFocusRequest}
            highlightedNodeIds={highlightedNodeIds}
            onSelectNode={setSelectedNodeId}
            onOpenTour={openTourInTourView}
          />
        ) : null}
        {view === "events" ? (
          <EventPanel
            data={data}
            onSelectNode={openNodeInGraph}
          />
        ) : null}
        {view === "tours" ? (
          <TourPanel
            data={data}
            selectedTourId={selectedTourId}
            onOpenNodeDetail={openNodeInGraph}
            onSelectTour={(tourId) => {
              setSelectedTourId(tourId);
              setView("map");
            }}
          />
        ) : null}
        {view === "admin" ? (
          <AdminPanel data={data} onChange={setData} />
        ) : null}
      </div>
      {view !== "home" ? (
        <AiChat data={data} onHighlight={setHighlightedNodeIds} />
      ) : null}
    </div>
  );
}

function getInitialSharedNodeId(data: ExplorerData) {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");
  const requestedNodeId = params.get("node");
  if (requestedView !== "graph" || !requestedNodeId) return null;
  return data.nodes.some((node) => node.id === requestedNodeId) ? requestedNodeId : null;
}
