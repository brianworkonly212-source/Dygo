"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ExplorerData, NodeWithCategory, TourWithStops } from "@/lib/domain/types";
import { getNodesWithCategories, getToursWithStops } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/icons/category-icon";
import { MapLibreCanvas } from "@/components/map/maplibre-canvas";
import { PaperFilterDropdown } from "@/components/ui/paper-filter-dropdown";
import { PaperSearchInput } from "@/components/ui/paper-search-input";
import { usePaperPanelScale } from "@/components/layout/use-paper-panel-scale";
import {
  NODE_PROGRESS_FILTER_OPTIONS,
  nodeMatchesProgressFilter,
  useNodeInteractionState,
} from "@/lib/node-interactions";
import { titleStartsWithQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

export function TourPanel({
  data,
  selectedTourId,
  onOpenNodeDetail,
  onSelectTour,
}: {
  data: ExplorerData;
  selectedTourId: string | null;
  onOpenNodeDetail: (nodeId: string) => void;
  onSelectTour: (tourId: string) => void;
}) {
  const tours = useMemo(() => getToursWithStops(data), [data]);
  const nodes = useMemo(
    () =>
      getNodesWithCategories(data).filter(
        (node): node is NodeWithCategory & { lat: number; lng: number } =>
          typeof node.lat === "number" && typeof node.lng === "number",
      ),
    [data],
  );
  const [query, setQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const [activeTourId, setActiveTourId] = useState<string | null>(
    selectedTourId ?? tours[0]?.id ?? null,
  );
  const panelScale = usePaperPanelScale();
  const nodeInteractionState = useNodeInteractionState();
  const areaOptions = useMemo(
    () => uniqueValues(tours.flatMap((tour) => tour.stops.map((stop) => stop.node.area))),
    [tours],
  );
  const processOptions = NODE_PROGRESS_FILTER_OPTIONS;

  const filteredTours = useMemo(() => {
    return tours.filter((tour) => {
      const matchesSearch = !query.trim() || titleStartsWithQuery(tour.title, query);
      const matchesArea =
        !selectedArea || tour.stops.some((stop) => stop.node.area === selectedArea);
      const matchesProcess =
        !selectedProcess ||
        tour.stops.some((stop) =>
          nodeMatchesProgressFilter(stop.node.id, selectedProcess, nodeInteractionState),
        );

      return matchesSearch && matchesArea && matchesProcess;
    });
  }, [nodeInteractionState, query, selectedArea, selectedProcess, tours]);
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return tours.filter((tour) => titleStartsWithQuery(tour.title, query)).slice(0, 5);
  }, [query, tours]);

  const activeTour =
    filteredTours.find((tour) => tour.id === activeTourId) ?? filteredTours[0] ?? null;

  return (
    <section className="relative h-screen overflow-hidden bg-white" data-testid="tour-panel">
      <MapLibreCanvas
        nodes={nodes}
        selectedTour={activeTour}
        onSelectNode={onOpenNodeDetail}
        testId="tour-maplibre"
      />
      <aside
        className="absolute right-[18px] top-[42px] z-20 flex h-[1359px] w-[448px] origin-top-right flex-col gap-[22px] overflow-hidden"
        style={{ transform: `scale(${panelScale})` }}
      >
        <TourFilterPanel
          query={query}
          searchResults={searchResults}
          selectedArea={selectedArea}
          selectedProcess={selectedProcess}
          areaOptions={areaOptions}
          processOptions={processOptions}
          onQueryChange={setQuery}
          onSelectTour={(tourId) => {
            setActiveTourId(tourId);
            setQuery("");
          }}
          onAreaChange={setSelectedArea}
          onProcessChange={setSelectedProcess}
        />
        <div className="min-h-0 flex-1 overflow-y-auto pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex flex-col gap-[22px] pb-[22px]">
            {filteredTours.map((tour) => (
              <TourCard
                key={tour.id}
                tour={tour}
                active={tour.id === activeTour?.id}
                onSelect={() => setActiveTourId(tour.id)}
                onExplore={() => {
                  const nodeId = getTourNodeId(data, tour);
                  if (nodeId) onOpenNodeDetail(nodeId);
                  else onSelectTour(tour.id);
                }}
              />
            ))}
            {!filteredTours.length ? (
              <div className="grid h-[463px] w-[448px] place-items-center rounded-[8px] bg-white text-[#2f2c29]">
                Chưa có tour
              </div>
            ) : null}
            <div className="h-[495px] flex-shrink-0" aria-hidden="true" />
          </div>
        </div>
      </aside>
    </section>
  );
}

function TourFilterPanel({
  query,
  searchResults,
  selectedArea,
  selectedProcess,
  areaOptions,
  processOptions,
  onQueryChange,
  onSelectTour,
  onAreaChange,
  onProcessChange,
}: {
  query: string;
  searchResults: TourWithStops[];
  selectedArea: string | null;
  selectedProcess: string | null;
  areaOptions: string[];
  processOptions: string[];
  onQueryChange: (value: string) => void;
  onSelectTour: (tourId: string) => void;
  onAreaChange: (value: string | null) => void;
  onProcessChange: (value: string | null) => void;
}) {
  return (
    <div className="relative z-30 flex h-[248px] w-[448px] flex-shrink-0 flex-col items-start gap-6 overflow-visible rounded-[8px] bg-white px-[30px] py-8 text-[#2f2c29]">
      <div className="relative w-full">
        <PaperSearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm kiếm địa điểm"
          aria-label="Tìm kiếm tour"
        />
        {searchResults.length ? (
          <TourSearchResults tours={searchResults} onSelectTour={onSelectTour} />
        ) : null}
      </div>
      <div className="w-full">
        <h2 className="font-display text-[36px] font-semibold leading-[44px]">
          Tour Trải Nghiệm
        </h2>
      </div>
      <div className="flex h-[66px] w-full flex-col gap-[10px] font-display text-[18px] font-medium leading-[22px]">
        <PaperFilterDropdown
          label="Khu Vực"
          value={selectedArea}
          placeholder="chọn khu vực"
          options={areaOptions}
          onChange={onAreaChange}
          zIndexClassName="z-50"
        />
        <PaperFilterDropdown
          label="Tiến Trình"
          value={selectedProcess}
          placeholder="chọn tiến trình"
          options={processOptions}
          onChange={onProcessChange}
          zIndexClassName="z-50"
        />
      </div>
    </div>
  );
}

function TourCard({
  tour,
  active,
  onSelect,
  onExplore,
}: {
  tour: TourWithStops;
  active: boolean;
  onSelect: () => void;
  onExplore: () => void;
}) {
  const category = tour.category ?? tour.stops[0]?.node.category;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") onSelect();
      }}
      className={cn(
        "paper-focus flex h-[501px] w-[448px] cursor-pointer flex-col items-start gap-6 overflow-hidden rounded-[8px] bg-white px-[30px] py-8 text-left text-[#2f2c29] transition",
        active && "shadow-[0_0_0_2px_rgba(45,32,246,0.18)]",
      )}
      data-testid="tour-row"
    >
      {tour.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tour.image_url}
          alt={tour.title}
          className="h-[197px] w-full flex-shrink-0 rounded-[4px] object-cover"
        />
      ) : (
        <div className="grid h-[197px] w-full flex-shrink-0 place-items-center rounded-[4px] bg-muted text-sm">
          Chưa có ảnh
        </div>
      )}
      <div className="flex w-full flex-col items-start gap-5">
        <div className="grid h-11 w-full grid-cols-[43px_minmax(0,1fr)] items-center gap-0">
          <span style={{ color: category?.color }}>
            <CategoryIcon name={category?.icon_name} className="h-[35px] w-[34px]" />
          </span>
          <button
            type="button"
            className="paper-focus min-w-0 text-left"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onExplore();
            }}
          >
            <h2 className="font-display truncate text-[24px] font-semibold leading-[30px]">
              {tour.title}
            </h2>
          </button>
        </div>
        <p className="line-clamp-2 w-full whitespace-pre-wrap font-sans text-[16px] font-medium leading-5">
          {getTourFeaturedContent(tour)}
        </p>
        <p className="w-full font-sans text-[16px] font-medium leading-5">
          {tour.stops.length} Địa Điểm · {tour.duration_text}
        </p>
      </div>
      <div className="flex w-full flex-wrap gap-2">
        <Button
          size="lg"
          className="h-14 w-[388px] justify-center rounded-[8px] bg-[#FDDD51] font-sans text-[18px] font-semibold leading-6 text-[#2f2c29] hover:bg-[#FDDD51]/90 [font-weight:600]"
          onClick={(clickEvent) => {
            clickEvent.stopPropagation();
            onExplore();
          }}
        >
          <span className="font-semibold [font-weight:600]">Xem Chi Tiết</span>
          <ArrowRight className="h-[22px] w-[22px]" />
        </Button>
      </div>
    </article>
  );
}

function TourSearchResults({
  tours,
  onSelectTour,
}: {
  tours: TourWithStops[];
  onSelectTour: (tourId: string) => void;
}) {
  return (
    <div className="absolute left-0 top-[39px] z-50 w-full overflow-hidden rounded-[4px] border border-[#2f2c29]/20 bg-white text-[#2f2c29] shadow-xl">
      {tours.map((tour) => (
        <button
          key={tour.id}
          type="button"
          onClick={() => onSelectTour(tour.id)}
          className="paper-focus flex w-full cursor-pointer items-center justify-between border-t border-[#d9d4ce] px-3 py-2 text-left text-sm first:border-t-0 hover:bg-[#f3f0eb]"
        >
          <span>{tour.title}</span>
          <span className="text-xs text-muted-foreground">{tour.duration_text}</span>
        </button>
      ))}
    </div>
  );
}

function getTourFeaturedContent(tour: TourWithStops) {
  return tour.featured_content?.trim() ?? "";
}

function getTourNodeId(data: ExplorerData, tour: TourWithStops) {
  return (
    data.nodes.find((node) => node.metadata?.tourId === tour.id)?.id ??
    data.nodes.find((node) => node.slug === tour.slug)?.id ??
    data.nodes.find((node) => node.title === tour.title)?.id ??
    null
  );
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}
