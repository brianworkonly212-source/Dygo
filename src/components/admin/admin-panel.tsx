"use client";

import { useMemo, useState } from "react";
import type React from "react";
import { Check, ChevronDown, Grid2X2, Plus, Search, Settings2 } from "lucide-react";
import type { ContentNode, ExplorerData, NodeRelation, Tour, TourStop } from "@/lib/domain/types";
import { normalizeFlexibleYearRange } from "@/lib/time/flexible-time";
import { slugify } from "@/lib/utils";

type AdminSheet = "nodes" | "tours";

type SheetColumn<T extends string> = {
  key: T;
  label: string;
  type?: "text" | "number" | "boolean" | "select" | "links";
  width: string;
};

const NODE_COLUMNS = [
  { key: "title", label: "Node Title", width: "240px" },
  { key: "category_id", label: "Category", type: "select", width: "180px" },
  { key: "featured_content", label: "Featured Content", width: "260px" },
  { key: "content", label: "Full Content", width: "300px" },
  { key: "time_start_text", label: "Bắt Đầu", width: "170px" },
  { key: "time_end_text", label: "Kết Thúc", width: "170px" },
  { key: "period", label: "Thời Kỳ", width: "170px" },
  { key: "area", label: "Khu Vực", width: "180px" },
  { key: "belief", label: "Tín Ngưỡng", width: "180px" },
  { key: "image_url", label: "Image URL", width: "280px" },
  { key: "google_map_url", label: "Google Map URL", width: "260px" },
  { key: "opening_time", label: "Opening Time", width: "170px" },
  { key: "lat", label: "Lat", type: "number", width: "130px" },
  { key: "lng", label: "Lng", type: "number", width: "130px" },
  { key: "linked_node_ids", label: "One-way Links", type: "links", width: "300px" },
  { key: "is_published", label: "Published", type: "boolean", width: "130px" },
] satisfies Array<SheetColumn<NodeColumnKey>>;

const TOUR_COLUMNS = [
  { key: "title", label: "Tour Title", width: "240px" },
  { key: "featured_content", label: "Featured Content", width: "280px" },
  { key: "description", label: "Full Content", width: "320px" },
  { key: "image_url", label: "Image URL", width: "280px" },
  { key: "duration_text", label: "Thời Gian", width: "180px" },
  { key: "stop_count", label: "Địa Điểm", type: "number", width: "130px" },
  { key: "stop_node_ids", label: "One-way Links", type: "links", width: "360px" },
  { key: "is_published", label: "Published", type: "boolean", width: "130px" },
] satisfies Array<SheetColumn<TourColumnKey>>;

type NodeColumnKey =
  | "title"
  | "category_id"
  | "featured_content"
  | "content"
  | "time_start_text"
  | "time_end_text"
  | "period"
  | "area"
  | "belief"
  | "image_url"
  | "google_map_url"
  | "opening_time"
  | "lat"
  | "lng"
  | "linked_node_ids"
  | "is_published";

type TourColumnKey =
  | "title"
  | "featured_content"
  | "description"
  | "image_url"
  | "duration_text"
  | "stop_count"
  | "stop_node_ids"
  | "is_published";

export function AdminPanel({
  data,
  onChange,
  onPersist,
}: {
  data: ExplorerData;
  onChange?: (data: ExplorerData) => void;
  onPersist?: (data: ExplorerData) => Promise<void>;
}) {
  const [activeSheet, setActiveSheet] = useState<AdminSheet>("nodes");
  const [query, setQuery] = useState("");
  const [localData, setLocalData] = useState(data);
  const sheetData = onChange ? data : localData;
  const filteredNodes = useMemo(
    () =>
      sheetData.nodes.filter((node) =>
        node.title.toLocaleLowerCase("vi-VN").includes(query.toLocaleLowerCase("vi-VN")),
      ),
    [sheetData.nodes, query],
  );
  const filteredTours = useMemo(
    () =>
      sheetData.tours.filter((tour) =>
        tour.title.toLocaleLowerCase("vi-VN").includes(query.toLocaleLowerCase("vi-VN")),
      ),
    [sheetData.tours, query],
  );

  function updateData(updater: (current: ExplorerData) => ExplorerData) {
    const nextData = updater(sheetData);
    if (onChange) onChange(nextData);
    else setLocalData(nextData);
    void onPersist?.(nextData);
  }

  function updateNode(nodeId: string, key: NodeColumnKey, value: string | boolean) {
    updateData((current) => {
      const now = new Date().toISOString();

      if (key === "linked_node_ids") {
        const targetIds = parseNodeLinks(String(value), current.nodes, nodeId);
        const otherRelations = current.relations.filter(
          (relation) =>
            relation.source_node_id !== nodeId || relation.relation_type !== "admin_link",
        );
        const nextRelations = targetIds.map((targetId) =>
          createRelation(nodeId, targetId, now),
        );

        return {
          ...current,
          relations: [...otherRelations, ...nextRelations],
          nodes: current.nodes.map((node) =>
            node.id === nodeId ? { ...node, updated_at: now } : node,
          ),
        };
      }

      return {
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === nodeId ? updateNodeValue(node, key, value, now) : node,
        ),
      };
    });
  }

  function addNode() {
    updateData((current) => {
      const now = new Date().toISOString();
      const id = `node-${crypto.randomUUID()}`;
      const nextNode: ContentNode = {
        id,
        category_id: current.categories[0]?.id ?? "",
        title: "Node mới",
        slug: `node-moi-${current.nodes.length + 1}`,
        summary: "",
        featured_content: null,
        content: "",
        image_url: null,
        video_url: null,
        audio_url: null,
        time_start_text: null,
        time_end_text: null,
        year_start: null,
        year_end: null,
        area: null,
        period: null,
        belief: null,
        process: null,
        lat: null,
        lng: null,
        address: null,
        google_map_url: null,
        opening_time: null,
        is_event: false,
        is_published: true,
        metadata: {},
        created_at: now,
        updated_at: now,
      };

      return { ...current, nodes: [...current.nodes, nextNode] };
    });
  }

  function updateTour(tourId: string, key: TourColumnKey, value: string | boolean) {
    updateData((current) => {
      const now = new Date().toISOString();

      if (key === "stop_node_ids") {
        const nodeIds = parseNodeLinks(String(value), current.nodes);
        const otherStops = current.tourStops.filter((stop) => stop.tour_id !== tourId);
        const nextStops = nodeIds.map((nodeId, index) =>
          createTourStop(tourId, nodeId, index, now),
        );

        return {
          ...current,
          tourStops: [...otherStops, ...nextStops],
          tours: current.tours.map((tour) =>
            tour.id === tourId ? { ...tour, updated_at: now } : tour,
          ),
        };
      }

      return {
        ...current,
        tours: current.tours.map((tour) =>
          tour.id === tourId ? updateTourValue(tour, key, value, now) : tour,
        ),
      };
    });
  }

  function addTour() {
    updateData((current) => {
      const now = new Date().toISOString();
      const id = `tour-${crypto.randomUUID()}`;
      const nextTour: Tour = {
        id,
        category_id: current.categories.find((category) => category.name === "Chặng Đường")?.id ?? null,
        title: "Tour mới",
        slug: `tour-moi-${current.tours.length + 1}`,
        featured_content: null,
        description: "",
        image_url: null,
        duration_text: "",
        is_published: true,
        created_at: now,
        updated_at: now,
      };

      return { ...current, tours: [...current.tours, nextTour] };
    });
  }

  return (
    <main
      className="flex h-screen min-h-[720px] bg-[#f8f9fb] pt-[6px] text-[#2f2c29]"
      data-testid="admin-sheet"
    >
      <aside className="flex w-[168px] shrink-0 flex-col border-r border-[#d7dce3] bg-[#fbfcfe] pt-3">
        <div className="flex h-8 items-center gap-2 px-3 text-sm text-[#6f7b8a]">
          <Search className="h-4 w-4" />
          <span className="truncate">Search...</span>
          <Plus className="ml-auto h-4 w-4" />
        </div>
        <nav className="mt-3 space-y-1 px-2">
          <SheetNavButton
            label="Node"
            active={activeSheet === "nodes"}
            onClick={() => setActiveSheet("nodes")}
          />
          <SheetNavButton
            label="Tour"
            active={activeSheet === "tours"}
            onClick={() => setActiveSheet("tours")}
          />
        </nav>
      </aside>

      <section className="min-w-0 flex-1 overflow-hidden bg-white">
        <div className="flex h-12 items-center border-b border-[#d7dce3] bg-white">
          <div className="flex h-full w-[104px] items-center gap-2 rounded-br-[8px] bg-white px-6 text-sm font-medium">
            <Grid2X2 className="h-4 w-4 text-[#3d73ff]" />
            Grid
          </div>
          <button
            type="button"
            className="paper-focus flex h-full cursor-pointer items-center gap-2 border-l border-[#edf0f4] px-5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add View
          </button>
        </div>

        <div className="flex h-10 items-center gap-4 border-b border-[#d7dce3] bg-white px-7 text-[#5c6675]">
          <button
            type="button"
            className="paper-focus flex cursor-pointer items-center gap-1 text-[#3d73ff]"
            onClick={activeSheet === "nodes" ? addNode : addTour}
            data-testid="admin-add-row"
          >
            <Plus className="h-5 w-5" />
            <ChevronDown className="h-4 w-4" />
          </button>
          <Settings2 className="h-4 w-4" />
          <div className="relative h-7 w-[260px]">
            <Search className="pointer-events-none absolute left-2 top-1.5 h-4 w-4 text-[#9aa3af]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="paper-focus h-7 w-full rounded-[4px] border border-[#d7dce3] pl-8 pr-2 text-sm"
              placeholder={`Tìm ${activeSheet === "nodes" ? "node" : "tour"}`}
            />
          </div>
        </div>

        {activeSheet === "nodes" ? (
          <NodeSheet
            data={sheetData}
            nodes={filteredNodes}
            onUpdate={updateNode}
          />
        ) : (
          <TourSheet
            data={sheetData}
            tours={filteredTours}
            onUpdate={updateTour}
          />
        )}
      </section>
    </main>
  );
}

function SheetNavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`paper-focus flex h-9 w-full cursor-pointer items-center gap-2 rounded-[4px] px-2 text-left text-sm ${
        active ? "bg-[#edf2ff] text-[#1f4fe0]" : "text-[#2f2c29] hover:bg-[#f0f3f7]"
      }`}
    >
      <Grid2X2 className="h-4 w-4" />
      {label}
    </button>
  );
}

function NodeSheet({
  data,
  nodes,
  onUpdate,
}: {
  data: ExplorerData;
  nodes: ContentNode[];
  onUpdate: (nodeId: string, key: NodeColumnKey, value: string | boolean) => void;
}) {
  return (
    <SheetTable
      testId="admin-node-sheet"
      columns={NODE_COLUMNS}
      rows={nodes}
      rowId={(node) => node.id}
      renderCell={(node, column) => (
        <NodeCell
          data={data}
          node={node}
          column={column}
          onUpdate={onUpdate}
        />
      )}
    />
  );
}

function TourSheet({
  data,
  tours,
  onUpdate,
}: {
  data: ExplorerData;
  tours: Tour[];
  onUpdate: (tourId: string, key: TourColumnKey, value: string | boolean) => void;
}) {
  return (
    <SheetTable
      testId="admin-tour-sheet"
      columns={TOUR_COLUMNS}
      rows={tours}
      rowId={(tour) => tour.id}
      renderCell={(tour, column) => (
        <TourCell
          data={data}
          tour={tour}
          column={column}
          onUpdate={onUpdate}
        />
      )}
    />
  );
}

function SheetTable<Row, Key extends string>({
  columns,
  rows,
  rowId,
  renderCell,
  testId,
}: {
  columns: Array<SheetColumn<Key>>;
  rows: Row[];
  rowId: (row: Row) => string;
  renderCell: (row: Row, column: SheetColumn<Key>) => React.ReactNode;
  testId: string;
}) {
  const emptyRows = Math.max(0, 5 - rows.length);

  return (
    <div className="h-[calc(100vh-96px)] overflow-auto bg-white" data-testid={testId}>
      <table className="min-w-max border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-white">
          <tr>
            <th className="h-9 w-[58px] border-b border-r border-[#d7dce3] bg-white text-center font-normal text-[#7b8794]">
              <input type="checkbox" aria-label="Select all rows" />
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                className="h-9 border-b border-r border-[#d7dce3] bg-white px-2 text-left font-normal text-[#3f4752]"
                style={{ width: column.width, minWidth: column.width }}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="text-[#7b8794]">A≡</span>
                  {column.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowId(row)}>
              <td className="h-8 border-b border-r border-[#d7dce3] text-center text-[#7b8794]">
                {index + 1}
              </td>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="h-8 border-b border-r border-[#d7dce3] p-0 align-top"
                  style={{ width: column.width, minWidth: column.width }}
                >
                  {renderCell(row, column)}
                </td>
              ))}
            </tr>
          ))}
          {Array.from({ length: emptyRows }).map((_, index) => (
            <tr key={`empty-${index}`}>
              <td className="h-8 border-b border-r border-[#d7dce3] text-center text-[#7b8794]">
                {rows.length + index + 1}
              </td>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="h-8 border-b border-r border-[#d7dce3]"
                  style={{ width: column.width, minWidth: column.width }}
                />
              ))}
            </tr>
          ))}
          <tr>
            <td className="h-8 border-b border-r border-[#d7dce3] text-center text-xl text-[#9aa3af]">
              +
            </td>
            <td className="h-8 border-b border-r border-[#d7dce3]" colSpan={columns.length} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NodeCell({
  data,
  node,
  column,
  onUpdate,
}: {
  data: ExplorerData;
  node: ContentNode;
  column: SheetColumn<NodeColumnKey>;
  onUpdate: (nodeId: string, key: NodeColumnKey, value: string | boolean) => void;
}) {
  if (column.key === "category_id") {
    return (
      <select
        value={node.category_id}
        onChange={(event) => onUpdate(node.id, column.key, event.target.value)}
        className="h-8 w-full bg-transparent px-2 outline-none"
      >
        {data.categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    );
  }

  if (column.key === "linked_node_ids") {
    const value = getOutgoingNodeTitles(data, node.id);
    return (
      <SheetInput
        value={value}
        placeholder="Hồ Gươm, Đền Bà Kiệu"
        onCommit={(nextValue) => onUpdate(node.id, column.key, nextValue)}
      />
    );
  }

  if (column.type === "boolean") {
    return (
      <button
        type="button"
        className="grid h-8 w-full place-items-center"
        onClick={() => onUpdate(node.id, column.key, !node.is_published)}
      >
        {node.is_published ? <Check className="h-4 w-4 text-[#1f4fe0]" /> : null}
      </button>
    );
  }

  const value = getNodeCellValue(node, column.key);

  return (
    <SheetInput
      value={value}
      inputMode={column.type === "number" ? "decimal" : undefined}
      onCommit={(nextValue) => onUpdate(node.id, column.key, nextValue)}
    />
  );
}

function TourCell({
  data,
  tour,
  column,
  onUpdate,
}: {
  data: ExplorerData;
  tour: Tour;
  column: SheetColumn<TourColumnKey>;
  onUpdate: (tourId: string, key: TourColumnKey, value: string | boolean) => void;
}) {
  if (column.key === "stop_node_ids") {
    return (
      <SheetInput
        value={getTourStopTitles(data, tour.id)}
        placeholder="Hồ Gươm, Đền Bà Kiệu"
        onCommit={(nextValue) => onUpdate(tour.id, column.key, nextValue)}
      />
    );
  }

  if (column.key === "stop_count") {
    const stopCount = data.tourStops.filter((stop) => stop.tour_id === tour.id).length;
    return (
      <div className="flex h-8 items-center px-2 text-sm text-[#5c6675]">
        {stopCount.toLocaleString("vi-VN")}
      </div>
    );
  }

  if (column.type === "boolean") {
    return (
      <button
        type="button"
        className="grid h-8 w-full place-items-center"
        onClick={() => onUpdate(tour.id, column.key, !tour.is_published)}
      >
        {tour.is_published ? <Check className="h-4 w-4 text-[#1f4fe0]" /> : null}
      </button>
    );
  }

  return (
    <SheetInput
      value={getTourCellValue(tour, column.key)}
      inputMode={column.type === "number" ? "numeric" : undefined}
      onCommit={(nextValue) => onUpdate(tour.id, column.key, nextValue)}
    />
  );
}

function SheetInput({
  value,
  placeholder,
  inputMode,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onCommit: (value: string) => void;
}) {
  return (
    <input
      key={value}
      defaultValue={value}
      placeholder={placeholder}
      inputMode={inputMode}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className="h-8 w-full bg-transparent px-2 text-sm outline-none focus:bg-[#eef4ff]"
    />
  );
}

function updateNodeValue(
  node: ContentNode,
  key: NodeColumnKey,
  value: string | boolean,
  updatedAt: string,
): ContentNode {
  if (key === "title") {
    const title = String(value);
    return { ...node, title, slug: node.slug || slugify(title), updated_at: updatedAt };
  }

  if (key === "lat" || key === "lng") {
    return { ...node, [key]: toNullableNumber(String(value)), updated_at: updatedAt };
  }

  if (key === "time_start_text" || key === "time_end_text") {
    const nextStartText = key === "time_start_text" ? nullable(String(value)) : node.time_start_text;
    const nextEndText = key === "time_end_text" ? nullable(String(value)) : node.time_end_text;
    const normalized = normalizeFlexibleYearRange(nextStartText, nextEndText);

    return {
      ...node,
      time_start_text: nextStartText,
      time_end_text: nextEndText,
      year_start: normalized.startYear,
      year_end: normalized.endYear,
      updated_at: updatedAt,
    };
  }

  if (key === "is_published") {
    return { ...node, [key]: Boolean(value), updated_at: updatedAt };
  }

  if (key === "featured_content") {
    return { ...node, featured_content: nullable(String(value)), updated_at: updatedAt };
  }

  if (
    key === "area" ||
    key === "period" ||
    key === "belief" ||
    key === "image_url" ||
    key === "google_map_url" ||
    key === "opening_time"
  ) {
    return { ...node, [key]: nullable(String(value)), updated_at: updatedAt };
  }

  if (key === "content" || key === "category_id") {
    return { ...node, [key]: String(value), updated_at: updatedAt };
  }

  return node;
}

function getNodeCellValue(node: ContentNode, key: NodeColumnKey) {
  if (key === "linked_node_ids") return "";
  if (key === "is_published") return String(node.is_published);

  return String(node[key] ?? "");
}

function updateTourValue(
  tour: Tour,
  key: TourColumnKey,
  value: string | boolean,
  updatedAt: string,
): Tour {
  if (key === "title") {
    const title = String(value);
    return { ...tour, title, slug: tour.slug || slugify(title), updated_at: updatedAt };
  }

  if (key === "featured_content" || key === "image_url") {
    return { ...tour, [key]: nullable(String(value)), updated_at: updatedAt };
  }

  if (key === "is_published") {
    return { ...tour, is_published: Boolean(value), updated_at: updatedAt };
  }

  if (key === "description" || key === "duration_text") {
    return { ...tour, [key]: String(value), updated_at: updatedAt };
  }

  return tour;
}

function getTourCellValue(tour: Tour, key: TourColumnKey) {
  if (key === "stop_node_ids") return "";
  if (key === "stop_count") return "";
  if (key === "is_published") return String(tour.is_published);

  return String(tour[key] ?? "");
}

function parseNodeLinks(value: string, nodes: ContentNode[], excludeNodeId?: string) {
  const byId = new Map(nodes.map((node) => [node.id.toLocaleLowerCase(), node]));
  const bySlug = new Map(nodes.map((node) => [node.slug.toLocaleLowerCase("vi-VN"), node]));
  const byTitle = new Map(nodes.map((node) => [node.title.toLocaleLowerCase("vi-VN"), node]));

  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const key = part.toLocaleLowerCase("vi-VN");
      return byId.get(key) ?? bySlug.get(key) ?? byTitle.get(key);
    })
    .filter((node): node is ContentNode => Boolean(node))
    .filter((node) => node.id !== excludeNodeId)
    .reduce<string[]>((ids, node) => (ids.includes(node.id) ? ids : [...ids, node.id]), []);
}

function createRelation(sourceNodeId: string, targetNodeId: string, createdAt: string): NodeRelation {
  return {
    id: `rel-${sourceNodeId}-${targetNodeId}`,
    source_node_id: sourceNodeId,
    target_node_id: targetNodeId,
    relation_type: "admin_link",
    label: "liên quan",
    description: null,
    weight: 0.6,
    created_at: createdAt,
  };
}

function createTourStop(
  tourId: string,
  nodeId: string,
  index: number,
  createdAt: string,
): TourStop {
  return {
    id: `stop-${tourId}-${nodeId}`,
    tour_id: tourId,
    node_id: nodeId,
    stop_order: index + 1,
    note: null,
    created_at: createdAt,
  };
}

function getOutgoingNodeTitles(data: ExplorerData, sourceNodeId: string) {
  const nodeMap = new Map(data.nodes.map((node) => [node.id, node.title]));
  return data.relations
    .filter((relation) => relation.source_node_id === sourceNodeId)
    .map((relation) => nodeMap.get(relation.target_node_id))
    .filter((title): title is string => Boolean(title))
    .join(", ");
}

function getTourStopTitles(data: ExplorerData, tourId: string) {
  const nodeMap = new Map(data.nodes.map((node) => [node.id, node.title]));
  return data.tourStops
    .filter((stop) => stop.tour_id === tourId)
    .sort((first, second) => first.stop_order - second.stop_order)
    .map((stop) => nodeMap.get(stop.node_id))
    .filter((title): title is string => Boolean(title))
    .join(", ");
}

function nullable(value: string | undefined) {
  return value && value.trim().length > 0 ? value : null;
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
