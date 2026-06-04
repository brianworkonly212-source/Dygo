"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ExplorerData, NodeWithCategory } from "@/lib/domain/types";
import {
  getNodesWithCategories,
  getRelatedNodes,
  getToursWithStops,
} from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { MapLibreCanvas } from "@/components/map/maplibre-canvas";
import { PaperFilterDropdown } from "@/components/ui/paper-filter-dropdown";
import { PaperSearchInput } from "@/components/ui/paper-search-input";
import { CategoryIcon } from "@/components/icons/category-icon";
import { NodeActionOverlay } from "@/components/node/node-action-overlay";
import { usePaperPanelScale } from "@/components/layout/use-paper-panel-scale";
import {
  NODE_PROGRESS_FILTER_OPTIONS,
  nodeMatchesProgressFilter,
  useNodeInteractionState,
} from "@/lib/node-interactions";
import { titleStartsWithQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

const MAP_CATEGORY_NAMES = new Set(["Địa Điểm", "Hoạt Động", "Phục Dựng", "Hidden"]);

export function MapView({
  data,
  selectedNodeId,
  selectedTourId,
  onOpenNodeDetail,
  onSelectNode,
}: {
  data: ExplorerData;
  selectedNodeId: string | null;
  selectedTourId: string | null;
  onOpenNodeDetail: (nodeId: string) => void;
  onSelectNode: (nodeId: string | null) => void;
}) {
  const nodes = useMemo(
    () =>
      getNodesWithCategories(data).filter(
        (node): node is NodeWithCategory & { lat: number; lng: number } =>
          typeof node.lat === "number" &&
          typeof node.lng === "number" &&
          MAP_CATEGORY_NAMES.has(node.category.name),
      ),
    [data],
  );
  const tours = useMemo(() => getToursWithStops(data), [data]);
  const [query, setQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(() => new Set());
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const nodeInteractionState = useNodeInteractionState();
  const categories = useMemo(
    () =>
      data.categories
        .filter((category) => category.is_active && MAP_CATEGORY_NAMES.has(category.name))
        .sort((a, b) => a.sort_order - b.sort_order),
    [data.categories],
  );
  const visibleNodes = useMemo(
    () =>
      nodes.filter((node) => {
        const matchesCategory =
          selectedCategoryIds.size === 0 || selectedCategoryIds.has(node.category.id);
        return (
          matchesCategory &&
          (!selectedArea || node.area === selectedArea) &&
          nodeMatchesProgressFilter(node.id, selectedProcess, nodeInteractionState)
        );
      }),
    [nodeInteractionState, nodes, selectedArea, selectedCategoryIds, selectedProcess],
  );
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return visibleNodes.filter((node) => titleStartsWithQuery(node.title, query)).slice(0, 5);
  }, [query, visibleNodes]);
  const selectedTour = tours.find((tour) => tour.id === selectedTourId) ?? null;
  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#e7eef4]">
      <MapLibreCanvas
        nodes={visibleNodes}
        selectedNodeId={selectedNodeId}
        selectedTour={selectedTour}
        onSelectNode={onSelectNode}
        introZoom
        testId="map-canvas"
      />
      <MapRightPanel
        categories={categories}
        data={data}
        nodes={visibleNodes}
        onQueryChange={setQuery}
        onSelectNode={onSelectNode}
        onToggleCategory={(categoryId) => {
          setSelectedCategoryIds((current) => {
            const next = new Set(current);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
          });
        }}
        query={query}
        searchResults={searchResults}
        selectedCategoryIds={selectedCategoryIds}
        selectedArea={selectedArea}
        selectedProcess={selectedProcess}
        onAreaChange={setSelectedArea}
        onProcessChange={setSelectedProcess}
        onOpenNodeDetail={onOpenNodeDetail}
        selectedNodeId={selectedNodeId}
      />
    </section>
  );
}

function MapRightPanel({
  categories,
  data,
  nodes,
  onQueryChange,
  onSelectNode,
  onToggleCategory,
  query,
  searchResults,
  selectedCategoryIds,
  selectedArea,
  selectedProcess,
  onAreaChange,
  onProcessChange,
  onOpenNodeDetail,
  selectedNodeId,
}: {
  categories: NodeWithCategory["category"][];
  data: ExplorerData;
  nodes: Array<NodeWithCategory & { lat: number; lng: number }>;
  onQueryChange: (value: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onToggleCategory: (categoryId: string) => void;
  query: string;
  searchResults: NodeWithCategory[];
  selectedCategoryIds: Set<string>;
  selectedArea: string | null;
  selectedProcess: string | null;
  onAreaChange: (value: string | null) => void;
  onProcessChange: (value: string | null) => void;
  onOpenNodeDetail: (nodeId: string) => void;
  selectedNodeId: string | null;
}) {
  const panelScale = usePaperPanelScale();
  const panelRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollFrameRef = useRef<number | null>(null);
  const wheelLockRef = useRef(false);
  const initialSelectedScrollRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | null>(null);

  const getCardTop = useCallback((nodeId: string) => {
    const scroller = scrollerRef.current;
    const card = cardRefs.current.get(nodeId);
    const firstCard = nodes[0] ? cardRefs.current.get(nodes[0].id) : null;
    if (!scroller || !card || !firstCard) return 0;

    return card.offsetTop - firstCard.offsetTop;
  }, [nodes]);

  const scrollToNode = useCallback((nodeId: string, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    programmaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current !== null) {
      window.clearTimeout(programmaticScrollTimerRef.current);
    }
    panelRef.current?.scrollTo({ top: 0, left: 0 });
    scroller.scrollTo({
      top: getCardTop(nodeId),
      behavior,
    });
    programmaticScrollTimerRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
      programmaticScrollTimerRef.current = null;
    }, behavior === "smooth" ? 460 : 0);
  }, [getCardTop]);

  const getClosestNodeId = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || nodes.length === 0) return null;

    let closestNodeId = nodes[0]?.id ?? null;
    let closestDistance = Number.POSITIVE_INFINITY;

    nodes.forEach((node) => {
      const distance = Math.abs(getCardTop(node.id) - scroller.scrollTop);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestNodeId = node.id;
      }
    });

    return closestNodeId;
  }, [getCardTop, nodes]);

  useLayoutEffect(() => {
    if (!selectedNodeId || !cardRefs.current.has(selectedNodeId)) return;
    const behavior: ScrollBehavior = initialSelectedScrollRef.current ? "smooth" : "auto";
    initialSelectedScrollRef.current = true;
    scrollToNode(selectedNodeId, behavior);
  }, [scrollToNode, selectedNodeId, nodes]);

  function selectClosestCard() {
    if (programmaticScrollRef.current) return;
    const closestNodeId = getClosestNodeId();

    if (closestNodeId && closestNodeId !== selectedNodeId) {
      onSelectNode(closestNodeId);
    }
  }

  const handleWheel = useCallback((event: WheelEvent) => {
    if (Math.abs(event.deltaY) < 4 || nodes.length <= 1) return;

    event.preventDefault();
    if (wheelLockRef.current) return;

    const currentNodeId = selectedNodeId && cardRefs.current.has(selectedNodeId)
      ? selectedNodeId
      : getClosestNodeId();
    const currentIndex = Math.max(
      0,
      nodes.findIndex((node) => node.id === currentNodeId),
    );
    const nextIndex = Math.min(
      nodes.length - 1,
      Math.max(0, currentIndex + (event.deltaY > 0 ? 1 : -1)),
    );
    const nextNode = nodes[nextIndex];
    if (!nextNode || nextNode.id === currentNodeId) return;

    wheelLockRef.current = true;
    scrollToNode(nextNode.id);
    onSelectNode(nextNode.id);
    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 360);
  }, [getClosestNodeId, nodes, onSelectNode, scrollToNode, selectedNodeId]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    scroller.addEventListener("wheel", handleWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  return (
    <aside
      ref={panelRef}
      aria-label="map-right-panel"
      className="absolute right-[18px] top-[42px] z-20 flex h-[1359px] w-[448px] origin-top-right flex-col gap-[22px] overflow-hidden"
      style={{ transform: `scale(${panelScale})` }}
    >
      <MapFilterPanel
        categories={categories}
        nodes={nodes}
        query={query}
        searchResults={searchResults}
        selectedCategoryIds={selectedCategoryIds}
        selectedArea={selectedArea}
        selectedProcess={selectedProcess}
        onQueryChange={onQueryChange}
        onSelectNode={onSelectNode}
        onAreaChange={onAreaChange}
        onProcessChange={onProcessChange}
        onToggleCategory={onToggleCategory}
      />
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={() => {
          if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
          scrollFrameRef.current = window.requestAnimationFrame(() => {
            scrollFrameRef.current = null;
            selectClosestCard();
          });
        }}
        aria-label="Danh sách địa điểm dạng carousel"
      >
        <div className="flex flex-col gap-[22px] pb-[22px]">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              relatedNodes={getRelatedNodes(data, node.id)}
              active={node.id === selectedNodeId}
              onOpenDetail={() => onOpenNodeDetail(node.id)}
              onSelect={() => onSelectNode(node.id)}
              refCallback={(element) => {
                if (element) cardRefs.current.set(node.id, element);
                else cardRefs.current.delete(node.id);
              }}
            />
          ))}
          <div className="h-[495px] flex-shrink-0" aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}

function NodeCard({
  node,
  relatedNodes,
  active,
  onOpenDetail,
  onSelect,
  refCallback,
}: {
  node: NodeWithCategory;
  relatedNodes: NodeWithCategory[];
  active: boolean;
  onOpenDetail: () => void;
  onSelect: () => void;
  refCallback: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={refCallback}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
      className={cn(
        "paper-focus flex h-[501px] w-[448px] cursor-pointer snap-start flex-col items-start gap-6 overflow-hidden rounded-[8px] bg-white px-[30px] py-8 text-left text-[#2f2c29] transition",
        active && "shadow-[0_0_0_2px_rgba(45,32,246,0.18)]",
      )}
      data-testid={active ? "map-node-panel" : undefined}
    >
      <div className="relative h-[197px] w-full flex-shrink-0 overflow-hidden rounded-[4px]">
        {node.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.image_url} alt={node.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-muted text-sm">Chưa có ảnh</div>
        )}
        <NodeActionOverlay nodeId={node.id} title={node.title} />
      </div>
      <div className="flex h-[136px] w-full flex-col items-start gap-3">
        <div className="grid min-h-11 w-full grid-cols-[43px_minmax(0,1fr)] items-start gap-0">
          <span style={{ color: node.category.color }}>
            <CategoryIcon name={node.category.icon_name} className="h-[35px] w-[34px]" />
          </span>
          <h2 className="min-w-0 whitespace-normal break-words font-display text-[24px] font-semibold leading-[30px]">
            {node.title}
          </h2>
        </div>
        <p className="line-clamp-2 w-full whitespace-pre-wrap font-sans text-[16px] font-medium leading-5">
          {getNodeFeaturedContent(node)}
        </p>
        {node.opening_time ? (
          <div className="grid h-7 w-full grid-cols-[155px_minmax(0,1fr)] items-center font-sans text-[16px] font-medium leading-5">
            <span>Mở Cửa</span>
            <span className="min-w-0 truncate text-right">{node.opening_time}</span>
          </div>
        ) : null}
      </div>
      <div className="flex w-full flex-wrap gap-2">
        <Button
          size="lg"
          className="h-14 w-[388px] justify-center rounded-[8px] bg-[#FDDD51] font-sans text-[18px] font-semibold leading-6 text-[#2f2c29] hover:bg-[#FDDD51]/90 [font-weight:600]"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetail();
          }}
        >
          <span className="font-semibold [font-weight:600]">Xem Chi Tiết</span>
          <ArrowRight className="h-[22px] w-[22px]" />
        </Button>
      </div>
      {relatedNodes.length ? (
        <div className="sr-only">
          Liên kết: {relatedNodes.map((related) => related.title).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

function MapFilterPanel({
  categories,
  nodes,
  query,
  searchResults,
  selectedCategoryIds,
  selectedArea,
  selectedProcess,
  onQueryChange,
  onSelectNode,
  onAreaChange,
  onProcessChange,
  onToggleCategory,
}: {
  categories: NodeWithCategory["category"][];
  nodes: NodeWithCategory[];
  query: string;
  searchResults: NodeWithCategory[];
  selectedCategoryIds: Set<string>;
  selectedArea: string | null;
  selectedProcess: string | null;
  onQueryChange: (value: string) => void;
  onSelectNode: (nodeId: string) => void;
  onAreaChange: (value: string | null) => void;
  onProcessChange: (value: string | null) => void;
  onToggleCategory: (categoryId: string) => void;
}) {
  const visibleCategories = categories.filter((category) => MAP_CATEGORY_NAMES.has(category.name));
  const areaOptions = uniqueMapValues(nodes.map((node) => node.area));
  const processOptions = NODE_PROGRESS_FILTER_OPTIONS;

  return (
    <div className="relative z-30 flex h-[359px] w-[448px] flex-shrink-0 flex-col items-start gap-[15px] overflow-visible rounded-[8px] bg-white px-[30px] py-8 text-[#2f2c29]">
      <div className="relative w-full">
        <PaperSearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm kiếm địa điểm"
          aria-label="Tìm kiếm địa điểm trên bản đồ"
        />
        {searchResults.length ? (
          <PanelSearchResults
            nodes={searchResults}
            onSelectNode={(nodeId) => {
              onSelectNode(nodeId);
              onQueryChange("");
            }}
          />
        ) : null}
      </div>
      <div className="w-full">
        <h2 className="font-display text-[36px] font-semibold leading-[44px]">
          Bản Đồ Khám Phá
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
      <div className="flex w-full flex-col gap-3">
        <div className="flex gap-3">
          {visibleCategories.slice(0, 2).map((category) => (
            <CategoryFilterButton
              key={category.id}
              category={category}
              active={selectedCategoryIds.has(category.id)}
              onClick={() => onToggleCategory(category.id)}
            />
          ))}
        </div>
        <div className="flex gap-3">
          {visibleCategories.slice(2, 4).map((category) => (
            <CategoryFilterButton
              key={category.id}
              category={category}
              active={selectedCategoryIds.has(category.id)}
              onClick={() => onToggleCategory(category.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryFilterButton({
  category,
  active,
  onClick,
}: {
  category: NodeWithCategory["category"];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "paper-focus grid h-12 w-[187px] cursor-pointer grid-cols-[48px_1fr_24px] items-center gap-[10px] overflow-hidden rounded-[4px] border text-left transition",
        active ? "bg-[color-mix(in_srgb,var(--category-color)_12%,white)]" : "bg-white",
      )}
      style={{
        borderColor: active ? category.color : "#B8ACA2",
        ["--category-color" as string]: category.color,
      }}
    >
      <span className="grid h-12 w-12 place-items-center">
        <span style={{ color: category.color }}>
          <CategoryIcon name={category.icon_name} className="h-9 w-9" />
        </span>
      </span>
      <span className="font-display min-w-0 truncate text-[18px] font-medium leading-[22px]">
        {category.name}
      </span>
    </button>
  );
}

function PanelSearchResults({
  nodes,
  onSelectNode,
}: {
  nodes: NodeWithCategory[];
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <div className="absolute left-0 top-[39px] z-50 w-full overflow-hidden rounded-[4px] border border-[#2f2c29]/20 bg-white text-[#2f2c29] shadow-xl">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => onSelectNode(node.id)}
          className="paper-focus flex w-full cursor-pointer items-center justify-between border-t border-[#d9d4ce] px-3 py-2 text-left text-sm first:border-t-0 hover:bg-[#f3f0eb]"
        >
          <span>{node.title}</span>
          <span className="text-xs text-muted-foreground">{node.category.name}</span>
        </button>
      ))}
    </div>
  );
}

function uniqueMapValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function getNodeFeaturedContent(node: NodeWithCategory) {
  return node.featured_content?.trim() ?? "";
}
