"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { EventNode, ExplorerData } from "@/lib/domain/types";
import { getEvents } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/icons/category-icon";
import { MapLibreCanvas } from "@/components/map/maplibre-canvas";
import { PaperFilterDropdown } from "@/components/ui/paper-filter-dropdown";
import { PaperSearchInput } from "@/components/ui/paper-search-input";
import { NodeActionOverlay } from "@/components/node/node-action-overlay";
import { usePaperPanelScale } from "@/components/layout/use-paper-panel-scale";
import {
  NODE_PROGRESS_FILTER_OPTIONS,
  nodeMatchesProgressFilter,
  useNodeInteractionState,
} from "@/lib/node-interactions";
import { normalizeFlexibleDateRange } from "@/lib/time/flexible-time";
import { titleStartsWithQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

const EVENT_CATEGORY_NAME = "Sự Kiện";

export function EventPanel({
  data,
  onSelectNode,
}: {
  data: ExplorerData;
  onSelectNode: (nodeId: string) => void;
}) {
  const events = useMemo(
    () => getEvents(data).filter((event) => event.category.name === EVENT_CATEGORY_NAME),
    [data],
  );
  const [query, setQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedTimeStart, setSelectedTimeStart] = useState<string | null>(null);
  const [selectedTimeEnd, setSelectedTimeEnd] = useState<string | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(events[0]?.id ?? null);
  const panelScale = usePaperPanelScale();
  const nodeInteractionState = useNodeInteractionState();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const scrollFrameRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<number | null>(null);
  const areaOptions = useMemo(() => uniqueValues(events.map((event) => event.area)), [events]);
  const processOptions = NODE_PROGRESS_FILTER_OPTIONS;

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      return (
        (!selectedArea || event.area === selectedArea) &&
        eventMatchesDateRange(event, selectedTimeStart, selectedTimeEnd) &&
        nodeMatchesProgressFilter(event.id, selectedProcess, nodeInteractionState)
      );
    });
  }, [
    events,
    nodeInteractionState,
    selectedArea,
    selectedTimeStart,
    selectedTimeEnd,
    selectedProcess,
  ]);
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return filteredEvents.filter((event) => titleStartsWithQuery(event.title, query)).slice(0, 5);
  }, [filteredEvents, query]);

  const activeEvent =
    filteredEvents.find((event) => event.id === activeEventId) ?? filteredEvents[0] ?? null;

  const getCardTop = useCallback(
    (eventId: string) => {
      const scroller = scrollerRef.current;
      const card = cardRefs.current.get(eventId);
      const firstCard = filteredEvents[0] ? cardRefs.current.get(filteredEvents[0].id) : null;
      if (!scroller || !card || !firstCard) return 0;

      return card.offsetTop - firstCard.offsetTop;
    },
    [filteredEvents],
  );

  const scrollToEvent = useCallback(
    (eventId: string, behavior: ScrollBehavior = "smooth") => {
      const scroller = scrollerRef.current;
      if (!scroller || !cardRefs.current.has(eventId)) return;

      programmaticScrollRef.current = true;
      if (programmaticScrollTimerRef.current !== null) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
      scroller.scrollTo({ top: getCardTop(eventId), behavior });
      programmaticScrollTimerRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = false;
        programmaticScrollTimerRef.current = null;
      }, behavior === "smooth" ? 460 : 0);
    },
    [getCardTop],
  );

  const getClosestEventId = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || filteredEvents.length === 0) return null;

    let closestEventId = filteredEvents[0]?.id ?? null;
    let closestDistance = Number.POSITIVE_INFINITY;

    filteredEvents.forEach((event) => {
      const distance = Math.abs(getCardTop(event.id) - scroller.scrollTop);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEventId = event.id;
      }
    });

    return closestEventId;
  }, [filteredEvents, getCardTop]);

  useEffect(() => {
    if (!activeEventId || !cardRefs.current.has(activeEventId)) return;
    scrollToEvent(activeEventId);
  }, [activeEventId, scrollToEvent]);

  function selectClosestCard() {
    if (programmaticScrollRef.current) return;
    const closestEventId = getClosestEventId();
    if (closestEventId && closestEventId !== activeEventId) setActiveEventId(closestEventId);
  }

  const eventNodes = filteredEvents.filter(
    (event): event is EventNode & { lat: number; lng: number } =>
      typeof event.lat === "number" && typeof event.lng === "number",
  );
  return (
    <section className="relative h-screen overflow-hidden bg-white" data-testid="event-panel">
      <MapLibreCanvas
        nodes={eventNodes}
        selectedNodeId={activeEvent?.id ?? null}
        onSelectNode={(nodeId) => {
          if (filteredEvents.some((event) => event.id === nodeId)) setActiveEventId(nodeId);
        }}
        introZoom
        testId="event-maplibre"
      />
      <aside
        className="absolute right-[18px] top-[42px] z-20 flex h-[1359px] w-[448px] origin-top-right flex-col gap-[22px] overflow-hidden"
        style={{ transform: `scale(${panelScale})` }}
      >
        <EventFilterPanel
          query={query}
          searchResults={searchResults}
          selectedArea={selectedArea}
          selectedTimeStart={selectedTimeStart}
          selectedTimeEnd={selectedTimeEnd}
          selectedProcess={selectedProcess}
          areaOptions={areaOptions}
          processOptions={processOptions}
          onQueryChange={setQuery}
          onSelectEvent={(eventId) => {
            setActiveEventId(eventId);
            setQuery("");
          }}
          onAreaChange={setSelectedArea}
          onTimeStartChange={setSelectedTimeStart}
          onTimeEndChange={setSelectedTimeEnd}
          onProcessChange={setSelectedProcess}
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
        >
          <div className="flex flex-col gap-[22px] pb-[22px]">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                active={event.id === activeEvent?.id}
                onSelect={() => setActiveEventId(event.id)}
                onExplore={() => onSelectNode(event.id)}
                refCallback={(element) => {
                  if (element) cardRefs.current.set(event.id, element);
                  else cardRefs.current.delete(event.id);
                }}
              />
            ))}
            <div className="h-[495px] flex-shrink-0" aria-hidden="true" />
          </div>
        </div>
      </aside>
    </section>
  );
}

function EventFilterPanel({
  query,
  searchResults,
  selectedArea,
  selectedTimeStart,
  selectedTimeEnd,
  selectedProcess,
  areaOptions,
  processOptions,
  onQueryChange,
  onSelectEvent,
  onAreaChange,
  onTimeStartChange,
  onTimeEndChange,
  onProcessChange,
}: {
  query: string;
  searchResults: EventNode[];
  selectedArea: string | null;
  selectedTimeStart: string | null;
  selectedTimeEnd: string | null;
  selectedProcess: string | null;
  areaOptions: string[];
  processOptions: string[];
  onQueryChange: (value: string) => void;
  onSelectEvent: (eventId: string) => void;
  onAreaChange: (value: string | null) => void;
  onTimeStartChange: (value: string | null) => void;
  onTimeEndChange: (value: string | null) => void;
  onProcessChange: (value: string | null) => void;
}) {
  return (
    <div className="relative z-30 flex h-[286px] w-[448px] flex-shrink-0 flex-col items-start gap-6 overflow-visible rounded-[8px] bg-white px-[30px] py-8 text-[#2f2c29]">
      <div className="relative w-full">
        <PaperSearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm kiếm địa điểm"
          aria-label="Tìm kiếm sự kiện"
        />
        {searchResults.length ? (
          <EventSearchResults nodes={searchResults} onSelectNode={onSelectEvent} />
        ) : null}
      </div>
      <div className="w-full">
        <h2 className="font-display text-[36px] font-semibold leading-[44px]">
          Sự Kiện Văn Hóa
        </h2>
      </div>
      <div className="flex h-[104px] w-full flex-col gap-[10px] font-display text-[18px] font-medium leading-[22px]">
        <PaperFilterDropdown
          label="Khu Vực"
          value={selectedArea}
          placeholder="chọn khu vực"
          options={areaOptions}
          onChange={onAreaChange}
          zIndexClassName="z-50"
        />
        <EventDateRangeControl
          selectedStart={selectedTimeStart}
          selectedEnd={selectedTimeEnd}
          onStartChange={onTimeStartChange}
          onEndChange={onTimeEndChange}
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

function EventSearchResults({
  nodes,
  onSelectNode,
}: {
  nodes: EventNode[];
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

function EventDateRangeControl({
  selectedStart,
  selectedEnd,
  onStartChange,
  onEndChange,
}: {
  selectedStart: string | null;
  selectedEnd: string | null;
  onStartChange: (value: string | null) => void;
  onEndChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel =
    selectedStart || selectedEnd
      ? `${formatDateInputLabel(selectedStart) ?? "..."} - ${formatDateInputLabel(selectedEnd) ?? "..."}`
      : "chọn thời gian";

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={controlRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="paper-focus grid h-7 w-full cursor-pointer grid-cols-[155px_minmax(0,1fr)_18px] items-center text-left"
        aria-expanded={open}
        aria-label="Chọn khoảng thời gian sự kiện"
      >
        <span className="font-display text-[18px] font-medium leading-[22px]">Thời Gian</span>
        <span
          className={cn(
            "font-display justify-self-end truncate text-[18px] font-medium leading-[22px]",
            selectedStart || selectedEnd ? "text-[#2F2C29]" : "text-[#b8aca2]",
          )}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 justify-self-end transition-transform",
            selectedStart || selectedEnd ? "text-[#2F2C29]" : "text-[#b8aca2]",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="absolute right-0 top-[32px] z-50 flex w-[260px] flex-col gap-3 rounded-[4px] border border-[#b8aca2] bg-white p-3 text-[#2f2c29] shadow-xl">
          <label className="flex items-center justify-between gap-3 font-display text-[18px] font-medium leading-[22px]">
            <span>Từ ngày</span>
            <input
              type="date"
              value={selectedStart ?? ""}
              onChange={(event) => onStartChange(event.target.value || null)}
              className="paper-focus h-8 w-[150px] rounded-[4px] border border-[#B8ACA2] bg-white px-2 text-right font-display text-[16px] font-medium leading-[22px] text-[#2f2c29]"
            />
          </label>
          <label className="flex items-center justify-between gap-3 font-display text-[18px] font-medium leading-[22px]">
            <span>Đến ngày</span>
            <input
              type="date"
              value={selectedEnd ?? ""}
              onChange={(event) => onEndChange(event.target.value || null)}
              className="paper-focus h-8 w-[150px] rounded-[4px] border border-[#B8ACA2] bg-white px-2 text-right font-display text-[16px] font-medium leading-[22px] text-[#2f2c29]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                onStartChange(null);
                onEndChange(null);
              }}
              className="paper-focus cursor-pointer rounded-[4px] px-2 py-1 font-display text-[16px] font-medium text-[#B8ACA2]"
            >
              Xoá
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="paper-focus cursor-pointer rounded-[4px] bg-[#FDDD51] px-3 py-1 font-display text-[16px] font-medium text-[#2f2c29]"
            >
              Áp dụng
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EventCard({
  event,
  active,
  onSelect,
  onExplore,
  refCallback,
}: {
  event: EventNode;
  active: boolean;
  onSelect: () => void;
  onExplore: () => void;
  refCallback: (element: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={refCallback}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") onSelect();
      }}
      className={cn(
        "paper-focus flex h-[502px] w-[448px] cursor-pointer snap-start flex-col items-start gap-6 overflow-hidden rounded-[8px] bg-white px-[30px] py-8 text-left text-[#2f2c29] transition",
        active && "shadow-[0_0_0_2px_rgba(45,32,246,0.18)]",
      )}
      data-testid="event-row"
    >
      <div className="relative h-[197px] w-full flex-shrink-0 overflow-hidden rounded-[4px]">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-muted text-sm">Chưa có ảnh</div>
        )}
        <NodeActionOverlay nodeId={event.id} title={event.title} />
      </div>
      <div className="flex h-[136px] w-full flex-col items-start gap-3">
        <div className="grid min-h-11 w-full grid-cols-[43px_minmax(0,1fr)] items-start gap-0">
          <span style={{ color: event.category.color }}>
            <CategoryIcon name={event.category.icon_name} className="h-[35px] w-[34px]" />
          </span>
          <button
            type="button"
            className="paper-focus min-w-0 text-left"
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onExplore();
            }}
          >
            <h2 className="min-w-0 whitespace-normal break-words font-display text-[24px] font-semibold leading-[30px]">
              {event.title}
            </h2>
          </button>
        </div>
        <p className="line-clamp-2 min-h-[44px] w-full whitespace-pre-wrap font-sans text-[16px] font-medium leading-[22px]">
          {getEventFeaturedContent(event)}
        </p>
        <div className="grid h-7 w-full grid-cols-[155px_minmax(0,1fr)] items-center font-sans text-[16px] font-medium leading-5">
          <span>Thời Gian</span>
          <span className="min-w-0 truncate text-right">{getEventTimeText(event)}</span>
        </div>
      </div>
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
    </article>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function getEventTimeText(event: EventNode) {
  return event.eventDetail.event_time_text?.trim() || formatDate(event.eventDetail.event_date);
}

function getEventFeaturedContent(event: EventNode) {
  return event.featured_content?.trim() ?? "";
}

function formatDateInputLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseEventDateRange(event: EventNode) {
  const rawRange = normalizeFlexibleDateRange(
    event.eventDetail.event_start_text,
    event.eventDetail.event_end_text,
  );
  const start =
    parseIsoDate(event.eventDetail.event_start_date) ??
    parseIsoDate(rawRange.startDate) ??
    parseIsoDate(event.eventDetail.event_date);
  const end =
    parseIsoDate(event.eventDetail.event_end_date) ??
    parseIsoDate(rawRange.endDate) ??
    parseIsoDate(event.eventDetail.event_date);
  if (start !== null || end !== null) {
    return {
      min: start ?? end ?? Number.NEGATIVE_INFINITY,
      max: end ?? start ?? Number.POSITIVE_INFINITY,
    };
  }

  return null;
}

function eventMatchesDateRange(
  event: EventNode,
  selectedDateStart: string | null,
  selectedDateEnd: string | null,
) {
  if (!selectedDateStart && !selectedDateEnd) return true;
  const eventRange = parseEventDateRange(event);
  if (!eventRange) return false;

  const start = parseIsoDate(selectedDateStart) ?? Number.NEGATIVE_INFINITY;
  const end = parseIsoDate(selectedDateEnd) ?? Number.POSITIVE_INFINITY;
  const normalizedStart = Math.min(start, end);
  const normalizedEnd = Math.max(start, end);

  return eventRange.min <= normalizedEnd && eventRange.max >= normalizedStart;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}
