"use client";

import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ExplorerData, NodeWithCategory } from "@/lib/domain/types";
import { getEvents, getNodesWithCategories } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import type { AppView } from "@/components/layout/paper-menu";
import { MapLibreCanvas } from "@/components/map/maplibre-canvas";

export function HomeDashboard({
  data,
  onNavigate,
}: {
  data: ExplorerData;
  onNavigate: (view: AppView) => void;
}) {
  const latestEvent = useMemo(() => getEvents(data)[0], [data]);
  const nodes = useMemo(
    () =>
      getNodesWithCategories(data).filter(
        (node): node is NodeWithCategory & { lat: number; lng: number } =>
          typeof node.lat === "number" && typeof node.lng === "number",
      ),
    [data],
  );

  return (
    <main className="relative h-screen overflow-hidden bg-white">
      <section className="absolute left-[423px] top-[44px] h-[calc(100vh-88px)] w-[calc(100vw-482px)] overflow-hidden rounded-[8px] border-2 border-[#2f2c29] bg-[#dfe8f6]">
        <MapLibreCanvas
          nodes={nodes}
          selectedNodeId={latestEvent?.id ?? null}
          interactive={false}
          zoom={14}
          testId="home-maplibre"
        />
        <Button
          size="lg"
          variant="ghost"
          onClick={() => onNavigate("map")}
          className="paper-home-cta absolute left-[49%] top-[49%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-display font-bold hover:bg-transparent"
          data-testid="home-map-cta"
        >
          Click Để Nhìn Hà Nội
        </Button>
        <div className="absolute bottom-[18px] right-[17px] w-[291px] rounded-[4px] bg-[var(--event)] p-[11px] shadow-xl">
          <button
            type="button"
            onClick={() => onNavigate("events")}
            className="paper-focus flex w-full items-center justify-between border-b border-[#2f2c29] pb-[7px] text-[15px] font-semibold leading-none"
          >
            Event Mới Nhất <ArrowUpRight className="h-4 w-4" />
          </button>
          <h2 className="paper-card-title font-display mx-auto mt-[15px] max-w-[240px] text-center font-bold">
            {latestEvent?.title ?? "Chưa có sự kiện"}
          </h2>
          {latestEvent?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={latestEvent.image_url}
              alt={latestEvent.title}
              className="mt-[15px] h-[165px] w-full rounded-[4px] object-cover grayscale"
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
