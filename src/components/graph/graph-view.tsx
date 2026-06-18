"use client";

import cytoscape, {
  type Core,
  type EdgeSingular,
  type ElementDefinition,
  type Layouts,
  type NodeSingular,
  type StylesheetJson,
} from "cytoscape";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { ExplorerData, NodeWithCategory, TourWithStops } from "@/lib/domain/types";
import { getNodesWithCategories, getRelatedNodes, getToursWithStops } from "@/lib/data/repository";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/icons/category-icon";
import { NodeActionOverlay } from "@/components/node/node-action-overlay";
import { PaperFilterDropdown } from "@/components/ui/paper-filter-dropdown";
import { PaperSearchInput } from "@/components/ui/paper-search-input";
import { usePaperPanelScale } from "@/components/layout/use-paper-panel-scale";
import {
  NODE_PROGRESS_FILTER_OPTIONS,
  nodeMatchesProgressFilter,
  useNodeInteractionState,
} from "@/lib/node-interactions";
import { normalizeFlexibleYearRange } from "@/lib/time/flexible-time";
import { titleStartsWithQuery } from "@/lib/search";
import { cn } from "@/lib/utils";

const inspectorBackIconUrl =
  "https://app.paper.design/file-assets/01KSM5T9Y43029NT8BEGHCV4SA/4DNHFZCPE8ZDH5B527ZTGV1GYA.svg";

const NODE_COLLISION_RADIUS = 132;
const NORMAL_NODE_WIDTH = 70;
const NORMAL_NODE_HEIGHT = 58;
const HOVERED_NODE_WIDTH = NORMAL_NODE_WIDTH + 4;
const HOVERED_NODE_HEIGHT = NORMAL_NODE_HEIGHT + 4;
const NEIGHBOR_NODE_WIDTH = NORMAL_NODE_WIDTH + 2;
const NEIGHBOR_NODE_HEIGHT = NORMAL_NODE_HEIGHT + 2;
const DRAG_NODE_WIDTH = NORMAL_NODE_WIDTH + 6;
const DRAG_NODE_HEIGHT = NORMAL_NODE_HEIGHT + 6;
const BASE_LINK_WIDTH = 2;
const ACTIVE_LINK_WIDTH = 3;
const MIN_LINK_LENGTH = 90;
const MAX_LINK_LENGTH = 220;
const DRAG_LINK_ELASTIC_OVERSHOOT = 36;
const MIN_NODE_EDGE_GAP = 50;
const GRAPH_WALL_BASE_RADIUS = 520;
const GRAPH_WALL_MAX_RADIUS = 920;
const GRAPH_WALL_NODE_RADIUS_STEP = 28;
const EXTERNAL_GRAPH_START_ZOOM = 0.35;
const EXTERNAL_GRAPH_FOCUS_ZOOM = 3;
const EXTERNAL_GRAPH_FOCUS_DURATION_MS = 1400;
const GRAPH_INTRO_DURATION_MS = 650;
const SELECT_FOCUS_DURATION_MS = 220;
const SELECTED_NEIGHBOR_ARRANGE_DURATION_MS = 420;
const SELECTED_NEIGHBOR_INNER_RADIUS = 148;
const SELECTED_NEIGHBOR_RING_GAP = 112;
const DETAIL_IMAGE_ZOOM = 0.85;
const NODE_IMAGE_VIEWPORT_OVERSCAN = 180;
const SMOOTH_WHEEL_ZOOM_SENSITIVITY = 1.5;
const SMOOTH_WHEEL_ZOOM_EASING = 0.22;
const GRAPH_CATEGORY_BADGE_ORDER = [
  "Địa Điểm",
  "Hoạt Động",
  "Họa Tiết",
  "Con Người",
  "Phục Dựng",
  "Hidden",
  "Sự Kiện",
  "Hiện Vật",
  "Câu Chuyện",
  "Chặng Đường",
];
const PAPER_NODE_POLYGON =
  "-0.062 -0.979 0.100 -0.997 0.285 -0.994 0.479 -0.943 0.838 -0.617 0.947 -0.366 0.997 -0.089 0.984 0.199 0.983 0.204 0.982 0.209 0.897 0.481 0.755 0.703 0.565 0.868 0.200 0.990 0.044 1.000 -0.125 0.987 -0.444 0.893 -0.600 0.815 -0.753 0.692 -0.973 0.268 -1.000 0.012 -0.972 -0.242 -0.706 -0.727 -0.480 -0.874 -0.253 -0.948";

type DragLinkConstraint = {
  sourceNodeId: string;
  targetNodeId: string;
  minLength: number;
  maxLength: number;
};

type GraphHoverLabel = {
  category: string;
  nodeId: string;
  title: string;
  x: number;
  y: number;
};

type GraphNodeLabel = GraphHoverLabel & {
  badge?: string;
  tone: "hover" | "start" | "current";
};

type PendingSelectionFocus = {
  mode: "center" | "preserve";
  nodeId: string;
};

function normalizeColor(color: string) {
  return color.startsWith("#") ? color : `#${color}`;
}

function graphPositions(total: number): Array<{ x: number; y: number }> {
  if (total > 24) {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const spacing = 205;
    return Array.from({ length: total }, (_, index) => {
      const radius = spacing * Math.sqrt(index + 1);
      const angle = index * goldenAngle;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  }

  const preset: Array<{ x: number; y: number }> = [
    { x: -260, y: -70 },
    { x: -40, y: -350 },
    { x: 360, y: -170 },
    { x: 300, y: 170 },
    { x: -80, y: 310 },
    { x: -500, y: 190 },
    { x: -520, y: -150 },
  ];
  if (total <= preset.length) return preset.slice(0, total);

  return Array.from({ length: total }, (_, index) => {
    if (index < preset.length) return preset[index];
    const angle =
      ((index - preset.length) / Math.max(total - preset.length, 1)) * Math.PI * 2 -
      Math.PI / 7;
    const radius = 620 + (index % 2) * 180;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

const graphStyles = [
  {
    selector: "node",
    style: {
      width: NORMAL_NODE_WIDTH,
      height: NORMAL_NODE_HEIGHT,
      shape: "polygon",
      "shape-polygon-points": PAPER_NODE_POLYGON,
      "background-color": "data(color)",
      "background-opacity": 0.95,
      "border-color": "data(color)",
      "border-opacity": 0.95,
      "border-width": 3,
      label: "",
      color: "#2f2c29",
      "font-family": "Labrada, Georgia, Cambria, Times New Roman, serif",
      "font-size": 24,
      "font-weight": 600,
      "line-height": 1.05,
      "text-halign": "right",
      "text-valign": "center",
      "text-wrap": "wrap",
      "text-max-width": 280,
      "text-background-color": "#ffffff",
      "text-background-opacity": 0,
      "text-background-padding": 8,
      "text-border-color": "#2f2c29",
      "text-border-opacity": 0,
      "text-border-width": 1,
      "text-margin-x": 16,
      "overlay-opacity": 0,
      "transition-property":
        "width, height, border-color, border-opacity, opacity, background-image-opacity, background-opacity",
      "transition-duration": 180,
      "transition-timing-function": "ease-out",
      "z-index": 2,
    },
  },
  {
    selector: "node[image]",
    style: {
      "background-image": "data(image)",
      "background-fit": "cover",
      "background-clip": "node",
      "background-image-opacity": 0,
    },
  },
  {
    selector: "node.imageVisible",
    style: {
      "background-image-opacity": 1,
    },
  },
  {
    selector: "node.imageHidden",
    style: {
      "background-image-opacity": 0,
      "background-color": "data(color)",
      "background-opacity": 0.95,
    },
  },
  {
    selector: "node.dimmed",
    style: {
      opacity: 0.14,
    },
  },
  {
    selector: "node.contextHidden",
    style: {
      display: "none",
    },
  },
  {
    selector: "node.selectedContext",
    style: {
      opacity: 0.72,
      "z-index": 7,
    },
  },
  {
    selector: "node.filteredOut",
    style: {
      display: "none",
    },
  },
  {
    selector: "node.neighbor",
    style: {
      width: NEIGHBOR_NODE_WIDTH,
      height: NEIGHBOR_NODE_HEIGHT,
      opacity: 1,
      "z-index": 8,
    },
  },
  {
    selector: "node.hovered",
    style: {
      width: HOVERED_NODE_WIDTH,
      height: HOVERED_NODE_HEIGHT,
      "background-opacity": 1,
      "border-color": "data(color)",
      "border-opacity": 0.5,
      "border-width": 4,
      label: "",
      "text-background-opacity": 0,
      "text-border-opacity": 0,
      opacity: 1,
      "z-index": 10,
    },
  },
  {
    selector: "node.selected",
    style: {
      width: HOVERED_NODE_WIDTH,
      height: HOVERED_NODE_HEIGHT,
      "background-opacity": 1,
      "border-color": "data(color)",
      "border-opacity": 0.5,
      "border-width": 4,
      label: "",
      "text-background-opacity": 0,
      "text-border-opacity": 0,
      opacity: 1,
      "z-index": 11,
    },
  },
  {
    selector: "node.aiHighlighted",
    style: {
      width: HOVERED_NODE_WIDTH,
      height: HOVERED_NODE_HEIGHT,
      "background-opacity": 1,
      "border-color": "data(color)",
      "border-opacity": 0.5,
      "border-width": 4,
      opacity: 1,
      "z-index": 11,
    },
  },
  {
    selector: "node.dragTarget",
    style: {
      width: DRAG_NODE_WIDTH,
      height: DRAG_NODE_HEIGHT,
      "background-opacity": 1,
      "border-color": "data(color)",
      "border-opacity": 0.5,
      "border-width": 4,
      opacity: 1,
      "z-index": 12,
    },
  },
  {
    selector: "edge",
    style: {
      width: BASE_LINK_WIDTH,
      "line-color": "data(color)",
      "target-arrow-color": "data(color)",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.55,
      "curve-style": "bezier",
      "source-endpoint": "outside-to-node",
      "target-endpoint": "outside-to-node",
      "source-distance-from-node": 6,
      "target-distance-from-node": 6,
      opacity: 0.7,
      "overlay-opacity": 0,
      "transition-property": "line-color, opacity, width",
      "transition-duration": 120,
      "transition-timing-function": "ease-out",
      "z-index": 1,
    },
  },
  {
    selector: "edge.dimmed",
    style: {
      opacity: 0.08,
    },
  },
  {
    selector: "edge.contextHidden",
    style: {
      display: "none",
    },
  },
  {
    selector: "edge.selectedContext",
    style: {
      opacity: 0.22,
      "z-index": 6,
    },
  },
  {
    selector: "edge.filteredOut",
    style: {
      display: "none",
    },
  },
  {
    selector: "edge.neighbor",
    style: {
      width: ACTIVE_LINK_WIDTH,
      opacity: 0.95,
      "z-index": 9,
    },
  },
] as unknown as StylesheetJson;

export function GraphView({
  data,
  selectedNodeId,
  graphFocusRequest,
  highlightedNodeIds,
  onSelectNode,
  onOpenTour,
}: {
  data: ExplorerData;
  selectedNodeId: string | null;
  graphFocusRequest: { nodeId: string; nonce: number } | null;
  highlightedNodeIds: string[];
  onSelectNode: (nodeId: string | null) => void;
  onOpenTour: (tourId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRef = useRef<Layouts | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const graphFocusRequestRef = useRef(graphFocusRequest);
  const lastExternalFocusNonceRef = useRef<number | null>(null);
  const highlightedNodeIdsRef = useRef(highlightedNodeIds);
  const graphElementsSignatureRef = useRef<string | null>(null);
  const pendingSelectionFocusRef = useRef<PendingSelectionFocus | null>(null);
  const dragLinkConstraintsRef = useRef<DragLinkConstraint[]>([]);
  const externalFocusFrameRef = useRef<number | null>(null);
  const selectedClusterFrameRef = useRef<number | null>(null);
  const selectedNeighborhoodArrangeRef = useRef<((node: NodeSingular) => void) | null>(null);
  const smoothZoomFrameRef = useRef<number | null>(null);
  const smoothZoomTargetRef = useRef<number | null>(null);
  const smoothZoomAnchorModelRef = useRef<{ x: number; y: number } | null>(null);
  const smoothZoomAnchorRenderedRef = useRef<{ x: number; y: number } | null>(null);
  const hoverLabelNodeIdRef = useRef<string | null>(null);
  const selectionTrailRef = useRef<string[]>([]);
  const [query, setQuery] = useState("");
  const [hoverLabel, setHoverLabel] = useState<GraphHoverLabel | null>(null);
  const [graphNodeLabels, setGraphNodeLabels] = useState<GraphNodeLabel[]>([]);
  const [selectionTrail, setSelectionTrail] = useState<string[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] =
    useState<OverviewFilters>(emptyOverviewFilters);
  const nodeInteractionState = useNodeInteractionState();
  const nodes = useMemo(() => getNodesWithCategories(data), [data]);
  const tours = useMemo(() => getToursWithStops(data), [data]);
  const selectedCategorySet = useMemo(
    () => new Set(selectedCategoryIds),
    [selectedCategoryIds],
  );
  const filteredGraphNodes = useMemo(
    () =>
      nodes.filter((node) => {
        if (selectedCategorySet.size > 0 && !selectedCategorySet.has(node.category_id)) {
          return false;
        }

        return (
          (!selectedFilters.area || node.area === selectedFilters.area) &&
          (!selectedFilters.period || node.period === selectedFilters.period) &&
          nodeMatchesYearRange(node, selectedFilters.yearStart, selectedFilters.yearEnd) &&
          (!selectedFilters.belief || node.belief === selectedFilters.belief) &&
          nodeMatchesProgressFilter(node.id, selectedFilters.process, nodeInteractionState)
        );
      }),
    [nodeInteractionState, nodes, selectedCategorySet, selectedFilters],
  );
  const visibleNodeIds = useMemo(
    () => new Set(filteredGraphNodes.map((node) => node.id)),
    [filteredGraphNodes],
  );
  const filteredRelations = useMemo(
    () =>
      data.relations.filter(
        (relation) =>
          visibleNodeIds.has(relation.source_node_id) &&
          visibleNodeIds.has(relation.target_node_id),
      ),
    [data.relations, visibleNodeIds],
  );
  const filteredNodes = useMemo(
    () =>
      query.trim()
        ? filteredGraphNodes.filter((node) => titleStartsWithQuery(node.title, query))
        : filteredGraphNodes,
    [filteredGraphNodes, query],
  );
  const indexById = useMemo(
    () => new Map(nodes.map((node, index) => [node.id, index])),
    [nodes],
  );
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedNodeTour = selectedNode ? findTourForNode(tours, selectedNode) : null;
  const selectedNodeVariants = useMemo(
    () => (selectedNode ? getNodeVariants(nodes, selectedNode) : []),
    [nodes, selectedNode],
  );
  const searchResults = query && selectedCategoryIds.length === 0 ? filteredNodes.slice(0, 5) : [];
  const positions = useMemo(
    () => graphPositions(nodes.length),
    [nodes.length],
  );
  const elements = useMemo<ElementDefinition[]>(() => {
    const nodeElements = nodes.map((node, index) => {
      const nodeData: Record<string, string> = {
        id: node.id,
        label: node.title,
        color: normalizeColor(node.category.color),
        category: node.category.name,
      };

      if (node.image_url) {
        nodeData.image = getGraphImageUrl(node.image_url);
      }

      return {
        group: "nodes" as const,
        data: nodeData,
        position: positions[index] ?? { x: 0, y: 0 },
      };
    });
    const edgeElements = data.relations
      .filter(
        (relation) =>
          indexById.has(relation.source_node_id) && indexById.has(relation.target_node_id),
      )
      .map((relation) => {
        const source = nodes[indexById.get(relation.source_node_id) ?? 0];
        return {
          group: "edges" as const,
          data: {
            id: relation.id,
            source: relation.source_node_id,
            target: relation.target_node_id,
            label: relation.label,
            color: normalizeColor(source?.category.color ?? "#8db8ff"),
          },
        };
      });

    return [...nodeElements, ...edgeElements];
  }, [data.relations, indexById, nodes, positions]);
  const graphElementsSignature = useMemo(() => {
    const nodeSignature = nodes
      .map((node) =>
        [
          node.id,
          node.title,
          node.category_id,
          node.category.color,
          node.image_url ?? "",
        ].join(":"),
      )
      .join("|");
    const edgeSignature = data.relations
      .map((relation) =>
        [
          relation.id,
          relation.source_node_id,
          relation.target_node_id,
          relation.label,
        ].join(":"),
      )
      .join("|");

    return `${nodeSignature}::${edgeSignature}`;
  }, [data.relations, nodes]);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    graphFocusRequestRef.current = graphFocusRequest;
  }, [graphFocusRequest]);

  useEffect(() => {
    highlightedNodeIdsRef.current = highlightedNodeIds;
  }, [highlightedNodeIds]);

  useEffect(() => {
    selectionTrailRef.current = selectionTrail;
  }, [selectionTrail]);

  const applyStoredHighlights = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass(
        "contextHidden selectedContext dimmed neighbor hovered selected aiHighlighted",
      );
      const selectedId = selectedNodeIdRef.current;
      if (selectedId) {
        const selectedNode = cy.getElementById(selectedId) as NodeSingular;
        if (!selectedNode.empty()) {
          const connectedEdges = selectedNode.connectedEdges();
          const relatedNodes = connectedEdges.connectedNodes().union(selectedNode);
          const trail = selectionTrailRef.current;
          let trailNodes = cy.collection();
          let trailEdges = cy.collection();
          trail.forEach((nodeId, index) => {
            const trailNode = cy.getElementById(nodeId);
            if (!trailNode.empty()) trailNodes = trailNodes.union(trailNode);

            const previousNodeId = trail[index - 1];
            if (!previousNodeId) return;

            const pathEdges = cy.edges().filter((edge) => {
              const sourceId = String(edge.data("source"));
              const targetId = String(edge.data("target"));
              return (
                (sourceId === previousNodeId && targetId === nodeId) ||
                (sourceId === nodeId && targetId === previousNodeId)
              );
            });
            trailEdges = trailEdges.union(pathEdges);
          });
          const hasJourney = trail.length > 1;
          const visibleNeighborhood = hasJourney
            ? trailNodes.union(trailEdges)
            : connectedEdges.union(relatedNodes);

          cy.elements().not(visibleNeighborhood).addClass("contextHidden");
          trailEdges.addClass("neighbor");
          trailNodes.not(selectedNode).addClass("selectedContext");
          if (!hasJourney) {
            connectedEdges.addClass("neighbor");
            relatedNodes.not(selectedNode).addClass("neighbor");
          }
          selectedNode.addClass("selected");
        }
      }
      highlightedNodeIdsRef.current.forEach((nodeId) => {
        cy.getElementById(nodeId).addClass("aiHighlighted");
      });
    });
  }, []);

  const applyNodeHover = useCallback((node: NodeSingular) => {
    const cy = cyRef.current;
    if (!cy || node.empty()) return;

    const connectedEdges = node.connectedEdges();
    const relatedNodes = connectedEdges.connectedNodes().union(node);
    const visibleNeighborhood = connectedEdges.union(relatedNodes);

    cy.batch(() => {
      cy.elements().removeClass(
        "contextHidden selectedContext dimmed neighbor hovered selected aiHighlighted",
      );
      cy.elements().not(visibleNeighborhood).addClass("dimmed");
      connectedEdges.addClass("neighbor");
      relatedNodes.not(node).addClass("neighbor");
      node.addClass("hovered");
    });
  }, []);

  const applySelectedContextHover = useCallback((hoveredNode: NodeSingular) => {
    const cy = cyRef.current;
    const selectedId = selectedNodeIdRef.current;
    if (!cy || !selectedId || hoveredNode.empty()) return false;

    const selectedNode = cy.getElementById(selectedId) as NodeSingular;
    if (selectedNode.empty()) return false;

    const selectedEdges = selectedNode.connectedEdges();
    const selectedRelatedNodes = selectedEdges.connectedNodes().union(selectedNode);
    const trail = selectionTrailRef.current;
    let trailNodes = cy.collection();
    let trailEdges = cy.collection();
    trail.forEach((nodeId, index) => {
      const trailNode = cy.getElementById(nodeId);
      if (!trailNode.empty()) trailNodes = trailNodes.union(trailNode);

      const previousNodeId = trail[index - 1];
      if (!previousNodeId) return;

      const pathEdges = cy.edges().filter((edge) => {
        const sourceId = String(edge.data("source"));
        const targetId = String(edge.data("target"));
        return (
          (sourceId === previousNodeId && targetId === nodeId) ||
          (sourceId === nodeId && targetId === previousNodeId)
        );
      });
      trailEdges = trailEdges.union(pathEdges);
    });
    const hasJourney = trail.length > 1;
    const selectedNeighborhood = hasJourney
      ? trailNodes.union(trailEdges)
      : selectedEdges.union(selectedRelatedNodes);
    const isInsideSelectedContext = hoveredNode.same(selectedNode) || selectedRelatedNodes.has(hoveredNode);
    if (!isInsideSelectedContext) return false;

    const directEdges = selectedEdges.filter((edge) => {
      const source = edge.source();
      const target = edge.target();
      return source.same(hoveredNode) || target.same(hoveredNode);
    });

    cy.batch(() => {
      cy.elements().removeClass(
        "contextHidden selectedContext dimmed neighbor hovered selected aiHighlighted",
      );
      cy.elements().not(selectedNeighborhood).addClass("contextHidden");
      trailNodes.not(selectedNode).addClass("selectedContext");
      trailEdges.addClass("neighbor");
      if (!hasJourney) {
        selectedRelatedNodes.not(selectedNode).addClass("selectedContext");
        selectedEdges.addClass("selectedContext");
      }
      selectedNode.addClass("selected");

      if (hoveredNode.same(selectedNode)) {
        if (!hasJourney) {
          selectedEdges.addClass("neighbor");
          selectedRelatedNodes.not(selectedNode).addClass("neighbor");
        }
      } else {
        directEdges.addClass("neighbor");
        hoveredNode.addClass("hovered");
      }
    });

    return true;
  }, []);

  const applyContextAwareNodeHover = useCallback(
    (node: NodeSingular) => {
      if (applySelectedContextHover(node)) return;
      applyNodeHover(node);
    },
    [applyNodeHover, applySelectedContextHover],
  );

  const updateHoverLabelForNode = useCallback((node: NodeSingular) => {
    if (node.empty()) return;

    const renderedPosition = node.renderedPosition();
    setHoverLabel({
      category: String(node.data("category") ?? ""),
      nodeId: node.id(),
      title: String(node.data("label") ?? ""),
      x: renderedPosition.x + node.renderedWidth() / 2 + 16,
      y: renderedPosition.y,
    });
  }, []);

  const showHoverLabelForNode = useCallback(
    (node: NodeSingular) => {
      hoverLabelNodeIdRef.current = node.id();
      updateHoverLabelForNode(node);
    },
    [updateHoverLabelForNode],
  );

  const clearHoverLabel = useCallback(() => {
    hoverLabelNodeIdRef.current = null;
    setHoverLabel(null);
  }, []);

  const getLabelForNode = useCallback(
    (node: NodeSingular, tone: GraphNodeLabel["tone"], badge?: string): GraphNodeLabel | null => {
      if (node.empty()) return null;

      const renderedPosition = node.renderedPosition();
      return {
        badge,
        category: String(node.data("category") ?? ""),
        nodeId: node.id(),
        title: String(node.data("label") ?? ""),
        tone,
        x: renderedPosition.x + node.renderedWidth() / 2 + 16,
        y: renderedPosition.y,
      };
    },
    [],
  );

  const syncGraphNodeLabels = useCallback(() => {
    const cy = cyRef.current;
    const selectedId = selectedNodeIdRef.current;
    if (!cy || !selectedId) {
      setGraphNodeLabels((currentLabels) => (currentLabels.length ? [] : currentLabels));
      return;
    }

    const labels: GraphNodeLabel[] = [];
    const trail = selectionTrailRef.current;
    const startId = trail.length > 1 ? trail[0] : null;

    if (startId && startId !== selectedId) {
      const startNode = cy.getElementById(startId) as NodeSingular;
      const startLabel = getLabelForNode(startNode, "start", "Khởi đầu");
      if (startLabel) labels.push(startLabel);
    }

    const selectedNode = cy.getElementById(selectedId) as NodeSingular;
    const selectedLabel = getLabelForNode(
      selectedNode,
      trail.length > 1 ? "current" : "hover",
      trail.length > 1 ? "Hiện tại" : undefined,
    );
    if (selectedLabel) labels.push(selectedLabel);

    setGraphNodeLabels((currentLabels) => {
      if (currentLabels.length !== labels.length) return labels;
      const hasChanged = labels.some((label, index) => {
        const currentLabel = currentLabels[index];
        if (!currentLabel) return true;

        return (
          currentLabel.badge !== label.badge ||
          currentLabel.category !== label.category ||
          currentLabel.nodeId !== label.nodeId ||
          currentLabel.title !== label.title ||
          currentLabel.tone !== label.tone ||
          Math.abs(currentLabel.x - label.x) > 0.5 ||
          Math.abs(currentLabel.y - label.y) > 0.5
        );
      });

      return hasChanged ? labels : currentLabels;
    });
  }, [getLabelForNode]);

  const commitSelectionTrail = useCallback((nextTrail: string[]) => {
    selectionTrailRef.current = nextTrail;
    setSelectionTrail(nextTrail);
  }, []);

  const getNextSelectionTrail = useCallback(
    (nodeId: string | null, mode: PendingSelectionFocus["mode"]) => {
      if (!nodeId) return [];
      if (mode !== "preserve") return [nodeId];

      const currentTrail = selectionTrailRef.current;
      if (currentTrail[currentTrail.length - 1] === nodeId) return currentTrail;

      if (currentTrail.length) return [...currentTrail, nodeId];

      const selectedId = selectedNodeIdRef.current;
      return selectedId && selectedId !== nodeId ? [selectedId, nodeId] : [nodeId];
    },
    [],
  );

  const selectNodeWithFocus = useCallback(
    (nodeId: string | null, mode: PendingSelectionFocus["mode"] = "center") => {
      pendingSelectionFocusRef.current = nodeId ? { nodeId, mode } : null;
      commitSelectionTrail(getNextSelectionTrail(nodeId, mode));
      onSelectNode(nodeId);
    },
    [commitSelectionTrail, getNextSelectionTrail, onSelectNode],
  );

  const selectNodeFromCurrentContext = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) {
        selectNodeWithFocus(null);
        return;
      }

      const cy = cyRef.current;
      const shouldPreservePosition =
        Boolean(selectedNodeIdRef.current) &&
        Boolean(cy && !cy.getElementById(nodeId).empty());

      selectNodeWithFocus(nodeId, shouldPreservePosition ? "preserve" : "center");
    },
    [selectNodeWithFocus],
  );

  const syncHoverLabelPosition = useCallback(() => {
    const cy = cyRef.current;
    const nodeId = hoverLabelNodeIdRef.current;
    if (!cy || !nodeId) return;

    const node = cy.getElementById(nodeId) as NodeSingular;
    if (node.empty()) {
      clearHoverLabel();
      return;
    }

    updateHoverLabelForNode(node);
  }, [clearHoverLabel, updateHoverLabelForNode]);

  const applyEdgeHover = useCallback((edgeId: string) => {
    const cy = cyRef.current;
    if (!cy) return;

    const edge = cy.getElementById(edgeId);
    if (edge.empty()) return;

    const visibleNeighborhood = edge.union(edge.connectedNodes());
    cy.batch(() => {
      cy.elements().removeClass(
        "contextHidden selectedContext dimmed neighbor hovered selected aiHighlighted",
      );
      cy.elements().not(visibleNeighborhood).addClass("dimmed");
      edge.addClass("neighbor");
      edge.connectedNodes().addClass("neighbor");
    });
  }, []);

  const applySelectedContextEdgeHover = useCallback((edgeId: string) => {
    const cy = cyRef.current;
    const selectedId = selectedNodeIdRef.current;
    if (!cy || !selectedId) return false;

    const selectedNode = cy.getElementById(selectedId) as NodeSingular;
    const edge = cy.getElementById(edgeId);
    if (selectedNode.empty() || edge.empty()) return false;

    const selectedEdges = selectedNode.connectedEdges();
    if (!selectedEdges.has(edge)) return false;

    const selectedRelatedNodes = selectedEdges.connectedNodes().union(selectedNode);
    const selectedNeighborhood = selectedEdges.union(selectedRelatedNodes);

    cy.batch(() => {
      cy.elements().removeClass(
        "contextHidden selectedContext dimmed neighbor hovered selected aiHighlighted",
      );
      cy.elements().not(selectedNeighborhood).addClass("contextHidden");
      selectedRelatedNodes.not(selectedNode).addClass("selectedContext");
      selectedEdges.addClass("selectedContext");
      selectedNode.addClass("selected");
      edge.addClass("neighbor");
      edge.connectedNodes().not(selectedNode).addClass("hovered");
    });

    return true;
  }, []);

  const applyContextAwareEdgeHover = useCallback(
    (edgeId: string) => {
      if (applySelectedContextEdgeHover(edgeId)) return;
      applyEdgeHover(edgeId);
    },
    [applyEdgeHover, applySelectedContextEdgeHover],
  );

  const applyGraphVisibility = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const shouldShow = visibleNodeIds.has(node.id());
        node.toggleClass("filteredOut", !shouldShow);
      });

      cy.edges().forEach((edge) => {
        const sourceId = String(edge.data("source"));
        const targetId = String(edge.data("target"));
        const endpointsVisible = visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
        edge.toggleClass("filteredOut", !endpointsVisible);
      });
    });
  }, [visibleNodeIds]);

  const syncNodeImageLOD = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const shouldShowImages = cy.zoom() >= DETAIL_IMAGE_ZOOM;

    cy.batch(() => {
      cy.nodes("[image]").forEach((node) => {
        const visible =
          shouldShowImages &&
          !node.hasClass("filteredOut") &&
          isNodeInRenderedViewport(node as NodeSingular, cy, NODE_IMAGE_VIEWPORT_OVERSCAN);

        node.toggleClass("imageVisible", visible);
        node.toggleClass("imageHidden", !visible);
      });
    });
  }, []);

  const cancelSmoothZoom = useCallback(() => {
    if (smoothZoomFrameRef.current !== null) {
      window.cancelAnimationFrame(smoothZoomFrameRef.current);
      smoothZoomFrameRef.current = null;
    }
    smoothZoomTargetRef.current = null;
    smoothZoomAnchorModelRef.current = null;
    smoothZoomAnchorRenderedRef.current = null;
  }, []);

  const cancelExternalFocusAnimation = useCallback(() => {
    if (externalFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(externalFocusFrameRef.current);
      externalFocusFrameRef.current = null;
    }
  }, []);

  const cancelSelectedClusterAnimation = useCallback(() => {
    if (selectedClusterFrameRef.current !== null) {
      window.cancelAnimationFrame(selectedClusterFrameRef.current);
      selectedClusterFrameRef.current = null;
    }
  }, []);

  const runSmoothZoom = useCallback(function tickSmoothZoom() {
    const cy = cyRef.current;
    const targetZoom = smoothZoomTargetRef.current;
    const anchorModel = smoothZoomAnchorModelRef.current;
    const anchorRendered = smoothZoomAnchorRenderedRef.current;
    if (!cy || targetZoom === null || !anchorModel || !anchorRendered) {
      smoothZoomFrameRef.current = null;
      return;
    }

    const currentZoom = cy.zoom();
    const nextZoom = currentZoom + (targetZoom - currentZoom) * SMOOTH_WHEEL_ZOOM_EASING;
    const settled = Math.abs(nextZoom - targetZoom) < 0.002;
    const zoom = settled ? targetZoom : nextZoom;

    cy.viewport({
      zoom,
      pan: {
        x: anchorRendered.x - anchorModel.x * zoom,
        y: anchorRendered.y - anchorModel.y * zoom,
      },
    });

    if (settled) {
      smoothZoomFrameRef.current = null;
      smoothZoomTargetRef.current = null;
      return;
    }

    smoothZoomFrameRef.current = window.requestAnimationFrame(tickSmoothZoom);
  }, []);

  const handleSmoothWheelZoom = useCallback(
    (event: WheelEvent) => {
      const cy = cyRef.current;
      const container = containerRef.current;
      if (!cy || !container) return;

      event.preventDefault();
      event.stopPropagation();
      cancelExternalFocusAnimation();
      cy.stop();

      const rect = container.getBoundingClientRect();
      const rendered = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const currentZoom = cy.zoom();
      const pan = cy.pan();
      const anchorModel = {
        x: (rendered.x - pan.x) / currentZoom,
        y: (rendered.y - pan.y) / currentZoom,
      };
      const deltaMultiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1;
      const normalizedDelta = event.deltaY * deltaMultiplier;
      const isZoomingOut = normalizedDelta > 0;
      const baseZoom = smoothZoomTargetRef.current ?? currentZoom;
      const targetZoom = Math.min(
        cy.maxZoom(),
        Math.max(
          cy.minZoom(),
          baseZoom * Math.exp(-normalizedDelta * 0.0012 * SMOOTH_WHEEL_ZOOM_SENSITIVITY),
        ),
      );

      smoothZoomTargetRef.current = targetZoom;
      smoothZoomAnchorModelRef.current = anchorModel;
      smoothZoomAnchorRenderedRef.current = rendered;
      if (selectedNodeIdRef.current && isZoomingOut) {
        cy.elements().removeClass("contextHidden selectedContext dimmed neighbor hovered selected");
        onSelectNodeRef.current(null);
      }

      if (smoothZoomFrameRef.current === null) {
        smoothZoomFrameRef.current = window.requestAnimationFrame(runSmoothZoom);
      }
    },
    [cancelExternalFocusAnimation, runSmoothZoom],
  );

  const focusSelectedNode = useCallback(
    (node: NodeSingular, options: { mode?: PendingSelectionFocus["mode"] } = {}) => {
      const cy = cyRef.current;
      if (!cy || node.empty()) return;

      cancelSmoothZoom();
      cancelExternalFocusAnimation();
      cancelSelectedClusterAnimation();
      cy.stop();
      applyGraphVisibility();
      applyStoredHighlights();
      selectedNeighborhoodArrangeRef.current?.(node);

      if (options.mode !== "preserve") {
        const targetZoom = Math.max(cy.zoom(), DETAIL_IMAGE_ZOOM);
        cy.animate(
          {
            center: { eles: node },
            zoom: targetZoom,
          },
          {
            duration: SELECT_FOCUS_DURATION_MS,
            complete: syncNodeImageLOD,
          },
        );
        return;
      }

      syncNodeImageLOD();
    },
    [
      applyGraphVisibility,
      applyStoredHighlights,
      cancelExternalFocusAnimation,
      cancelSelectedClusterAnimation,
      cancelSmoothZoom,
      syncNodeImageLOD,
    ],
  );

  const clearRelatedHoverRestore = useCallback(() => {
    applyStoredHighlights();
  }, [applyStoredHighlights]);

  const resolveNodeCollisions = useCallback(
    (iterations = 8, options: { includeGrabbed?: boolean } = {}) => {
      const cy = cyRef.current;
      if (!cy || cy.nodes().length < 2) return;

      const graphNodes = cy.nodes().toArray() as NodeSingular[];
      const graphEdges = cy.edges().toArray() as EdgeSingular[];
      const zoom = cy.zoom() || 1;
      const collisionRadius = options.includeGrabbed
        ? NODE_COLLISION_RADIUS * 0.78
        : NODE_COLLISION_RADIUS;
      const collisionStrength = options.includeGrabbed ? 0.08 : 0.32;

      cy.batch(() => {
        for (let iteration = 0; iteration < iterations; iteration += 1) {
          for (let index = 0; index < graphNodes.length; index += 1) {
            for (let nextIndex = index + 1; nextIndex < graphNodes.length; nextIndex += 1) {
              const first = graphNodes[index];
              const second = graphNodes[nextIndex];
              if (!first || !second) continue;
              if (options.includeGrabbed && !first.grabbed() && !second.grabbed()) continue;
              if (!options.includeGrabbed && (first.grabbed() || second.grabbed())) continue;

              const firstPosition = first.position();
              const secondPosition = second.position();
              let dx = secondPosition.x - firstPosition.x;
              let dy = secondPosition.y - firstPosition.y;
              let distance = Math.hypot(dx, dy);

              if (distance >= collisionRadius) continue;

              if (distance < 0.001) {
                const angle = ((index + 1) * Math.PI * 2) / graphNodes.length;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
                distance = 1;
              }

              const pushDistance = (collisionRadius - distance) * collisionStrength;
              const pushX = (dx / distance) * pushDistance;
              const pushY = (dy / distance) * pushDistance;

              if (first.grabbed()) {
                second.position({
                  x: secondPosition.x + pushX * 0.55,
                  y: secondPosition.y + pushY * 0.55,
                });
              } else if (second.grabbed()) {
                first.position({
                  x: firstPosition.x - pushX * 0.55,
                  y: firstPosition.y - pushY * 0.55,
                });
              } else {
                first.position({ x: firstPosition.x - pushX, y: firstPosition.y - pushY });
                second.position({ x: secondPosition.x + pushX, y: secondPosition.y + pushY });
              }
            }
          }

          if (options.includeGrabbed) continue;

          graphEdges.forEach((edge) => {
            const source = edge.source();
            const target = edge.target();
            if (source.empty() || target.empty()) return;

            const sourceRendered = source.renderedPosition();
            const targetRendered = target.renderedPosition();
            const edgeDx = targetRendered.x - sourceRendered.x;
            const edgeDy = targetRendered.y - sourceRendered.y;
            const edgeLengthSq = edgeDx * edgeDx + edgeDy * edgeDy;
            if (edgeLengthSq < 1) return;

            graphNodes.forEach((node) => {
              if (node.same(source) || node.same(target)) return;
              if (!options.includeGrabbed && node.grabbed()) return;

              const nodeRendered = node.renderedPosition();
              const rawT =
                ((nodeRendered.x - sourceRendered.x) * edgeDx +
                  (nodeRendered.y - sourceRendered.y) * edgeDy) /
                edgeLengthSq;
              const t = Math.max(0.08, Math.min(0.92, rawT));
              if (rawT < 0 || rawT > 1) return;

              const closestX = sourceRendered.x + edgeDx * t;
              const closestY = sourceRendered.y + edgeDy * t;
              let dx = nodeRendered.x - closestX;
              let dy = nodeRendered.y - closestY;
              let distance = Math.hypot(dx, dy);

              const nodeRadius = Math.max(node.renderedWidth(), node.renderedHeight()) / 2;
              const minDistanceFromCenter = nodeRadius + MIN_NODE_EDGE_GAP;

              if (distance >= minDistanceFromCenter) return;

              if (distance < 0.001) {
                dx = -edgeDy;
                dy = edgeDx;
                distance = Math.hypot(dx, dy) || 1;
              }

              const pushDistance = ((minDistanceFromCenter - distance) / zoom) * 0.82;
              const pushX = (dx / distance) * pushDistance;
              const pushY = (dy / distance) * pushDistance;
              const nodePosition = node.position();

              if (node.grabbed()) {
                const sourcePosition = source.position();
                const targetPosition = target.position();
                const endpointPushX = pushX * 0.45;
                const endpointPushY = pushY * 0.45;

                if (!source.grabbed()) {
                  source.position({
                    x: sourcePosition.x - endpointPushX,
                    y: sourcePosition.y - endpointPushY,
                  });
                }
                if (!target.grabbed()) {
                  target.position({
                    x: targetPosition.x - endpointPushX,
                    y: targetPosition.y - endpointPushY,
                  });
                }
                return;
              }

              node.position({
                x: nodePosition.x + pushX,
                y: nodePosition.y + pushY,
              });
            });
          });
        }
      });
    },
    [],
  );

  const captureDragLinkConstraints = useCallback((sourceNodeId?: string) => {
    const cy = cyRef.current;
    if (!cy) {
      dragLinkConstraintsRef.current = [];
      return;
    }

    const edges = sourceNodeId
      ? (cy.getElementById(sourceNodeId) as NodeSingular).connectedEdges()
      : cy.edges();

    dragLinkConstraintsRef.current = edges
      .toArray()
      .map((edge) => ({
        sourceNodeId: String(edge.data("source")),
        targetNodeId: String(edge.data("target")),
        minLength: MIN_LINK_LENGTH,
        maxLength: MAX_LINK_LENGTH,
      }));
  }, []);

  const applyDragLinkConstraints = useCallback((iterations = 2, options: { elastic?: boolean; stiffness?: number } = {}) => {
    const cy = cyRef.current;
    if (!cy || dragLinkConstraintsRef.current.length === 0) return;
    const stiffness = options.stiffness ?? 1;

    cy.batch(() => {
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        dragLinkConstraintsRef.current.forEach((constraint, index) => {
          const sourceNode = cy.getElementById(constraint.sourceNodeId) as NodeSingular;
          const targetNode = cy.getElementById(constraint.targetNodeId) as NodeSingular;
          if (sourceNode.empty() || targetNode.empty()) return;

          const sourcePosition = sourceNode.position();
          const targetPosition = targetNode.position();
          let dx = targetPosition.x - sourcePosition.x;
          let dy = targetPosition.y - sourcePosition.y;
          let distance = Math.hypot(dx, dy);

          const elasticMaxLength = options.elastic
            ? constraint.maxLength + DRAG_LINK_ELASTIC_OVERSHOOT
            : constraint.maxLength;
          if (distance >= constraint.minLength && distance <= elasticMaxLength) return;

          if (distance < 0.001) {
            const angle =
              ((index + 1) * Math.PI * 2) /
              Math.max(dragLinkConstraintsRef.current.length, 1);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }

          const targetLength =
            distance > elasticMaxLength ? elasticMaxLength : constraint.minLength;
          const correctionLength = (distance - targetLength) * stiffness;
          const correctionX = (dx / distance) * correctionLength;
          const correctionY = (dy / distance) * correctionLength;
          const sourceGrabbed = sourceNode.grabbed();
          const targetGrabbed = targetNode.grabbed();

          if (sourceGrabbed && targetGrabbed) return;

          if (sourceGrabbed) {
            targetNode.position({
              x: targetPosition.x - correctionX,
              y: targetPosition.y - correctionY,
            });
            return;
          }

          if (targetGrabbed) {
            sourceNode.position({
              x: sourcePosition.x + correctionX,
              y: sourcePosition.y + correctionY,
            });
            return;
          }

          sourceNode.position({
            x: sourcePosition.x + correctionX / 2,
            y: sourcePosition.y + correctionY / 2,
          });
          targetNode.position({
            x: targetPosition.x - correctionX / 2,
            y: targetPosition.y - correctionY / 2,
          });
        });
      }
    });
  }, []);

  const arrangeSelectedNeighborhood = useCallback(
    (selectedNode: NodeSingular) => {
      const cy = cyRef.current;
      if (!cy || selectedNode.empty()) return;

      const connectedNodes = selectedNode.connectedEdges().connectedNodes().not(selectedNode);
      const neighbors = connectedNodes.toArray() as NodeSingular[];
      if (neighbors.length === 0) return;

      const center = selectedNode.position();
      const anchorId = selectedNode.id();
      const sortedNeighbors = neighbors.sort(
        (left, right) => right.connectedEdges().length - left.connectedEdges().length,
      );
      const targetById = new Map<string, { x: number; y: number }>();
      const startById = new Map<string, { x: number; y: number }>();
      const resolveSelectedClusterCollisions = (iterations: number) => {
        const clusterNodes = [selectedNode, ...sortedNeighbors];
        const collisionRadius = NODE_COLLISION_RADIUS * 0.78;
        const collisionStrength = 0.28;

        for (let iteration = 0; iteration < iterations; iteration += 1) {
          for (let index = 0; index < clusterNodes.length; index += 1) {
            for (let nextIndex = index + 1; nextIndex < clusterNodes.length; nextIndex += 1) {
              const first = clusterNodes[index];
              const second = clusterNodes[nextIndex];
              if (!first || !second || first.empty() || second.empty()) continue;

              const firstPosition = first.position();
              const secondPosition = second.position();
              let dx = secondPosition.x - firstPosition.x;
              let dy = secondPosition.y - firstPosition.y;
              let distance = Math.hypot(dx, dy);
              if (distance >= collisionRadius) continue;

              if (distance < 0.001) {
                const angle = ((index + 1) * Math.PI * 2) / clusterNodes.length;
                dx = Math.cos(angle);
                dy = Math.sin(angle);
                distance = 1;
              }

              const pushDistance = (collisionRadius - distance) * collisionStrength;
              const pushX = (dx / distance) * pushDistance;
              const pushY = (dy / distance) * pushDistance;
              const firstIsAnchor = first.id() === anchorId;
              const secondIsAnchor = second.id() === anchorId;

              if (firstIsAnchor) {
                second.position({
                  x: secondPosition.x + pushX * 2,
                  y: secondPosition.y + pushY * 2,
                });
              } else if (secondIsAnchor) {
                first.position({
                  x: firstPosition.x - pushX * 2,
                  y: firstPosition.y - pushY * 2,
                });
              } else {
                first.position({ x: firstPosition.x - pushX, y: firstPosition.y - pushY });
                second.position({ x: secondPosition.x + pushX, y: secondPosition.y + pushY });
              }
            }
          }
        }
      };

      sortedNeighbors.forEach((neighbor, index) => {
        const ring = Math.floor(index / 8);
        const indexInRing = index % 8;
        const nodesInRing = Math.min(8, sortedNeighbors.length - ring * 8);
        const angle = (indexInRing / Math.max(nodesInRing, 1)) * Math.PI * 2 - Math.PI / 2;
        const radius = SELECTED_NEIGHBOR_INNER_RADIUS + ring * SELECTED_NEIGHBOR_RING_GAP;
        targetById.set(neighbor.id(), {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        });
        startById.set(neighbor.id(), neighbor.position());
      });

      cancelSelectedClusterAnimation();
      const startedAt = performance.now();

      const tick = (now: number) => {
        const currentCy = cyRef.current;
        if (!currentCy || selectedNode.empty()) {
          selectedClusterFrameRef.current = null;
          return;
        }

        const progress = Math.min(1, (now - startedAt) / SELECTED_NEIGHBOR_ARRANGE_DURATION_MS);
        const eased = 1 - Math.pow(1 - progress, 3);

        currentCy.batch(() => {
          sortedNeighbors.forEach((neighbor) => {
            if (neighbor.empty()) return;
            const start = startById.get(neighbor.id());
            const target = targetById.get(neighbor.id());
            if (!start || !target) return;

            neighbor.position({
              x: start.x + (target.x - start.x) * eased,
              y: start.y + (target.y - start.y) * eased,
            });
          });
        });

        resolveSelectedClusterCollisions(2);
        const anchorNode = currentCy.getElementById(anchorId) as NodeSingular;
        if (!anchorNode.empty()) anchorNode.position(center);

        if (progress < 1) {
          selectedClusterFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        resolveSelectedClusterCollisions(8);
        if (!anchorNode.empty()) anchorNode.position(center);
        selectedClusterFrameRef.current = null;
        applyStoredHighlights();
      };

      selectedClusterFrameRef.current = window.requestAnimationFrame(tick);
    },
    [applyStoredHighlights, cancelSelectedClusterAnimation],
  );

  selectedNeighborhoodArrangeRef.current = arrangeSelectedNeighborhood;

  const clampGraphToCenterWall = useCallback((options: { includeGrabbed?: boolean } = {}) => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;

    const graphNodes = cy.nodes().toArray() as NodeSingular[];
    const radius = Math.min(
      GRAPH_WALL_MAX_RADIUS,
      GRAPH_WALL_BASE_RADIUS + Math.max(0, graphNodes.length - 7) * GRAPH_WALL_NODE_RADIUS_STEP,
    );
    const centroid = graphNodes.reduce(
      (center, node) => {
        const position = node.position();
        return {
          x: center.x + position.x / graphNodes.length,
          y: center.y + position.y / graphNodes.length,
        };
      },
      { x: 0, y: 0 },
    );

    cy.batch(() => {
      graphNodes.forEach((node) => {
        if (!options.includeGrabbed && node.grabbed()) return;

        const position = node.position();
        const centeredX = position.x - centroid.x;
        const centeredY = position.y - centroid.y;
        const distance = Math.hypot(centeredX, centeredY);
        if (distance <= radius) {
          node.position({ x: centeredX, y: centeredY });
          return;
        }

        const scale = radius / Math.max(distance, 1);
        node.position({
          x: centeredX * scale,
          y: centeredY * scale,
        });
      });
    });
  }, []);

  const fitGraphToViewport = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;

    const padding = Math.max(72, Math.min(160, window.innerWidth * 0.08));
    cy.stop();
    cy.fit(cy.nodes(), padding);
    if (cy.zoom() > 1.15) cy.zoom(1.15);
    cy.center(cy.nodes());
  }, []);

  const animateGraphIntroToOverview = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;

    cancelSmoothZoom();
    cancelExternalFocusAnimation();
    cy.stop();
    fitGraphToViewport();

    const endZoom = cy.zoom();
    const endPan = cy.pan();
    const viewportCenter = { x: cy.width() / 2, y: cy.height() / 2 };
    const viewportCenterModel = {
      x: (viewportCenter.x - endPan.x) / endZoom,
      y: (viewportCenter.y - endPan.y) / endZoom,
    };
    const startZoom = Math.max(cy.minZoom(), Math.min(endZoom * 0.68, cy.maxZoom()));
    const startPan = {
      x: viewportCenter.x - viewportCenterModel.x * startZoom,
      y: viewportCenter.y - viewportCenterModel.y * startZoom,
    };

    cy.viewport({ zoom: startZoom, pan: startPan });
    setLayoutReady(true);

    const startedAt = performance.now();
    const tick = (now: number) => {
      const currentCy = cyRef.current;
      if (!currentCy) {
        externalFocusFrameRef.current = null;
        return;
      }

      const progress = Math.min(1, (now - startedAt) / GRAPH_INTRO_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const zoom = startZoom + (endZoom - startZoom) * eased;
      currentCy.viewport({
        zoom,
        pan: {
          x: startPan.x + (endPan.x - startPan.x) * eased,
          y: startPan.y + (endPan.y - startPan.y) * eased,
        },
      });

      if (progress < 1) {
        externalFocusFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      externalFocusFrameRef.current = null;
      syncNodeImageLOD();
    };

    externalFocusFrameRef.current = window.requestAnimationFrame(tick);
  }, [cancelExternalFocusAnimation, cancelSmoothZoom, fitGraphToViewport, syncNodeImageLOD]);

  const animateGraphZoomOutToOverview = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;

    cancelSmoothZoom();
    cancelExternalFocusAnimation();
    cy.stop();

    const startZoom = cy.zoom();
    const startPan = cy.pan();
    fitGraphToViewport();
    const endZoom = cy.zoom();
    const endPan = cy.pan();
    cy.viewport({ zoom: startZoom, pan: startPan });
    setLayoutReady(true);

    const startedAt = performance.now();
    const tick = (now: number) => {
      const currentCy = cyRef.current;
      if (!currentCy) {
        externalFocusFrameRef.current = null;
        return;
      }

      const progress = Math.min(1, (now - startedAt) / GRAPH_INTRO_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const zoom = startZoom + (endZoom - startZoom) * eased;
      currentCy.viewport({
        zoom,
        pan: {
          x: startPan.x + (endPan.x - startPan.x) * eased,
          y: startPan.y + (endPan.y - startPan.y) * eased,
        },
      });

      if (progress < 1) {
        externalFocusFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      externalFocusFrameRef.current = null;
      syncNodeImageLOD();
    };

    externalFocusFrameRef.current = window.requestAnimationFrame(tick);
  }, [cancelExternalFocusAnimation, cancelSmoothZoom, fitGraphToViewport, syncNodeImageLOD]);

  const animateGraphFromOverviewToNode = useCallback(
    (node: NodeSingular) => {
      const cy = cyRef.current;
      if (!cy || node.empty()) return;

      cancelSmoothZoom();
      cancelExternalFocusAnimation();
      cy.stop();
      fitGraphToViewport();

      const fitZoom = cy.zoom();
      const fitPan = cy.pan();
      const viewportCenter = { x: cy.width() / 2, y: cy.height() / 2 };
      const viewportCenterModel = {
        x: (viewportCenter.x - fitPan.x) / fitZoom,
        y: (viewportCenter.y - fitPan.y) / fitZoom,
      };
      const startZoom = Math.max(cy.minZoom(), Math.min(EXTERNAL_GRAPH_START_ZOOM, cy.maxZoom()));
      const startPan = {
        x: viewportCenter.x - viewportCenterModel.x * startZoom,
        y: viewportCenter.y - viewportCenterModel.y * startZoom,
      };
      const nodePosition = node.position();
      const endZoom = Math.max(cy.minZoom(), Math.min(EXTERNAL_GRAPH_FOCUS_ZOOM, cy.maxZoom()));
      const endPan = {
        x: viewportCenter.x - nodePosition.x * endZoom,
        y: viewportCenter.y - nodePosition.y * endZoom,
      };

      cy.viewport({ zoom: startZoom, pan: startPan });
      setLayoutReady(true);

      const startedAt = performance.now();
      const tick = (now: number) => {
        const currentCy = cyRef.current;
        if (!currentCy || node.empty()) {
          externalFocusFrameRef.current = null;
          return;
        }

        const progress = Math.min(1, (now - startedAt) / EXTERNAL_GRAPH_FOCUS_DURATION_MS);
        const eased = progress * progress * (3 - 2 * progress);
        const zoom = startZoom + (endZoom - startZoom) * eased;
        currentCy.viewport({
          zoom,
          pan: {
            x: startPan.x + (endPan.x - startPan.x) * eased,
            y: startPan.y + (endPan.y - startPan.y) * eased,
          },
        });

        if (progress < 1) {
          externalFocusFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        externalFocusFrameRef.current = null;
      };

      externalFocusFrameRef.current = window.requestAnimationFrame(tick);
    },
    [cancelExternalFocusAnimation, cancelSmoothZoom, fitGraphToViewport],
  );

  const finalizeGraphLayout = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) {
      setLayoutReady(true);
      return;
    }

    captureDragLinkConstraints();
    for (let pass = 0; pass < 10; pass += 1) {
      applyDragLinkConstraints(4, { stiffness: 0.72 });
      resolveNodeCollisions(3);
    }
    applyDragLinkConstraints(12, { stiffness: 0.9 });
    resolveNodeCollisions(6);
    applyDragLinkConstraints(6, { stiffness: 0.62 });
    resolveNodeCollisions(4);
    clampGraphToCenterWall();
    applyDragLinkConstraints(4, { stiffness: 0.42 });
    resolveNodeCollisions(4);
    dragLinkConstraintsRef.current = [];
    applyStoredHighlights();
    const selectedId = selectedNodeIdRef.current;
    const focusRequest = graphFocusRequestRef.current;
    const isExternalFocus =
      Boolean(selectedId) &&
      focusRequest?.nodeId === selectedId &&
      lastExternalFocusNonceRef.current !== focusRequest.nonce;

    if (selectedId) {
      const selectedNode = cy.getElementById(selectedId) as NodeSingular;
      if (selectedNode.empty()) {
        fitGraphToViewport();
        setLayoutReady(true);
        return;
      }

      if (isExternalFocus && focusRequest) {
        animateGraphFromOverviewToNode(selectedNode);
        lastExternalFocusNonceRef.current = focusRequest.nonce;
        return;
      }

      const pendingFocus =
        pendingSelectionFocusRef.current?.nodeId === selectedId
          ? pendingSelectionFocusRef.current
          : null;
      pendingSelectionFocusRef.current = null;
      setLayoutReady(true);
      focusSelectedNode(selectedNode, { mode: pendingFocus?.mode ?? "center" });
      return;
    }

    animateGraphIntroToOverview();
  }, [
    animateGraphFromOverviewToNode,
    animateGraphIntroToOverview,
    applyDragLinkConstraints,
    applyStoredHighlights,
    captureDragLinkConstraints,
    clampGraphToCenterWall,
    fitGraphToViewport,
    focusSelectedNode,
    resolveNodeCollisions,
  ]);

  const runLayout = useCallback(() => {
    const cy = cyRef.current;
    if (!cy || cy.nodes().length === 0) return;

    layoutRef.current?.stop();
    const layout = cy.layout({
      name: "cose",
      animate: false,
      animationDuration: 0,
      fit: false,
      padding: 80,
      avoidOverlap: true,
      nodeDimensionsIncludeLabels: true,
      nodeOverlap: 4,
      componentSpacing: 260,
      nodeRepulsion: 90000,
      idealEdgeLength: 170,
      edgeElasticity: 170,
      nestingFactor: 0.8,
      gravity: 0.32,
      numIter: 2200,
      randomize: false,
    });

    layoutRef.current = layout;
    layout.on("layoutstop", () => {
      if (layoutRef.current === layout) {
        layoutRef.current = null;
      }
      finalizeGraphLayout();
    });
    layout.run();
  }, [finalizeGraphLayout]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || cyRef.current) return;

    const cy = cytoscape({
      container,
      elements: [],
      minZoom: 0.18,
      maxZoom: 4,
      autoungrabify: true,
      userZoomingEnabled: false,
      layout: { name: "preset" },
      style: graphStyles,
    });

    cyRef.current = cy;
    container.dataset.cytoscapeReady = "true";

    cy.on("mouseover", "node", (event) => {
      const node = event.target as NodeSingular;
      container.style.cursor = "pointer";
      applyContextAwareNodeHover(node);
      showHoverLabelForNode(node);
    });

    cy.on("mouseout", "node", () => {
      container.style.cursor = "";
      clearHoverLabel();
      applyStoredHighlights();
    });

    cy.on("mouseover", "edge", (event) => {
      const edgeId = String(event.target.id());
      container.style.cursor = "pointer";
      clearHoverLabel();
      applyContextAwareEdgeHover(edgeId);
    });

    cy.on("mouseout", "edge", () => {
      container.style.cursor = "";
      applyStoredHighlights();
    });

    cy.on("tap", "node", (event) => {
      const node = event.target as NodeSingular;
      const mode = selectedNodeIdRef.current ? "preserve" : "center";
      pendingSelectionFocusRef.current = {
        nodeId: node.id(),
        mode,
      };
      commitSelectionTrail(getNextSelectionTrail(node.id(), mode));
      onSelectNodeRef.current(node.id());
    });

    cy.on("tap", (event) => {
      if (event.target === cy) {
        commitSelectionTrail([]);
        onSelectNodeRef.current(null);
      }
    });

    cy.on("render pan zoom", syncHoverLabelPosition);
    cy.on("render pan zoom", syncGraphNodeLabels);
    cy.on("pan zoom", syncNodeImageLOD);
    container.addEventListener("wheel", handleSmoothWheelZoom, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleSmoothWheelZoom);
      container.dataset.cytoscapeReady = "false";
      container.style.cursor = "";
      cancelExternalFocusAnimation();
      cancelSelectedClusterAnimation();
      cancelSmoothZoom();
      clearHoverLabel();
      clearRelatedHoverRestore();
      cy.removeListener("render pan zoom", syncHoverLabelPosition);
      cy.removeListener("render pan zoom", syncGraphNodeLabels);
      cy.removeListener("pan zoom", syncNodeImageLOD);
      layoutRef.current?.stop();
      layoutRef.current = null;
      cy.destroy();
      cyRef.current = null;
    };
  }, [
    applyContextAwareEdgeHover,
    applyContextAwareNodeHover,
    applyStoredHighlights,
    cancelExternalFocusAnimation,
    cancelSelectedClusterAnimation,
    cancelSmoothZoom,
    clearHoverLabel,
    clearRelatedHoverRestore,
    commitSelectionTrail,
    getNextSelectionTrail,
    handleSmoothWheelZoom,
    showHoverLabelForNode,
    syncGraphNodeLabels,
    syncNodeImageLOD,
    syncHoverLabelPosition,
  ]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const hasGraphElements = cy.elements().length > 0;
    if (graphElementsSignatureRef.current === graphElementsSignature && hasGraphElements) {
      applyGraphVisibility();
      applyStoredHighlights();
      syncNodeImageLOD();
      if (!layoutReady) setLayoutReady(true);
      return;
    }

    graphElementsSignatureRef.current = graphElementsSignature;
    setLayoutReady(false);
    layoutRef.current?.stop();
    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });
    syncNodeImageLOD();
    if (elements.length === 0) {
      window.requestAnimationFrame(() => setLayoutReady(true));
      return;
    }
    runLayout();
  }, [
    applyGraphVisibility,
    applyStoredHighlights,
    elements,
    graphElementsSignature,
    layoutReady,
    runLayout,
    syncNodeImageLOD,
  ]);

  useEffect(() => {
    if (!layoutReady) return;
    applyGraphVisibility();
    applyStoredHighlights();
    syncNodeImageLOD();
  }, [applyGraphVisibility, applyStoredHighlights, layoutReady, syncNodeImageLOD]);

  useEffect(() => {
    if (!layoutReady) return;
    syncGraphNodeLabels();
  }, [layoutReady, selectedNodeId, selectionTrail, syncGraphNodeLabels]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !layoutReady) return;

    applyGraphVisibility();
    applyStoredHighlights();
    if (!selectedNodeId) return;

    const node = cy.getElementById(selectedNodeId);
    if (node.empty()) return;

    if (graphFocusRequest?.nodeId === selectedNodeId) {
      if (lastExternalFocusNonceRef.current !== graphFocusRequest.nonce) {
        animateGraphFromOverviewToNode(node as NodeSingular);
        lastExternalFocusNonceRef.current = graphFocusRequest.nonce;
      }
      return;
    }

    const pendingFocus =
      pendingSelectionFocusRef.current?.nodeId === selectedNodeId
        ? pendingSelectionFocusRef.current
        : null;
    pendingSelectionFocusRef.current = null;
    focusSelectedNode(node as NodeSingular, { mode: pendingFocus?.mode ?? "center" });
  }, [
    animateGraphFromOverviewToNode,
    applyGraphVisibility,
    applyStoredHighlights,
    focusSelectedNode,
    graphFocusRequest,
    layoutReady,
    selectedNodeId,
  ]);

  const handleInspectorBack = useCallback(() => {
    const trail = selectionTrailRef.current;
    if (trail.length > 1) {
      const previousNodeId = trail[trail.length - 2];
      pendingSelectionFocusRef.current = { nodeId: previousNodeId, mode: "preserve" };
      commitSelectionTrail(trail.slice(0, -1));
      onSelectNode(previousNodeId);
      return;
    }

    pendingSelectionFocusRef.current = null;
    commitSelectionTrail([]);
    setGraphNodeLabels([]);
    clearHoverLabel();
    onSelectNode(null);
    animateGraphZoomOutToOverview();
  }, [animateGraphZoomOutToOverview, clearHoverLabel, commitSelectionTrail, onSelectNode]);

  return (
    <section className="relative h-screen overflow-hidden bg-white text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(184,172,162,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(184,172,162,.2)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div
        ref={containerRef}
        className={cn(
          "relative z-10 h-full w-full transition-opacity duration-150",
          layoutReady ? "opacity-100" : "opacity-0",
        )}
        data-testid="cytoscape-graph"
        data-cytoscape-ready="false"
        data-external-focus={graphFocusRequest?.nodeId === selectedNodeId ? "true" : "false"}
      />
      {graphNodeLabels
        .filter((label) => label.nodeId !== hoverLabel?.nodeId)
        .map((label) => (
          <div
            key={`${label.nodeId}-${label.tone}`}
            className="pointer-events-none absolute z-30 flex flex-col items-start font-display font-semibold text-[#2f2c29] shadow-sm"
            style={{
              left: label.x,
              top: label.y,
              transform: "translateY(-50%)",
            }}
          >
            {label.badge ? (
              <div
                className={cn(
                  "mb-1 w-fit rounded-[4px] border px-2 py-0.5 text-[13px] font-semibold leading-[16px]",
                  label.tone === "start"
                    ? "border-[#d1b76c] bg-[#fff5bf] text-[#75601a]"
                    : "border-[#7aa7c7] bg-[#dff2ff] text-[#285a78]",
                )}
              >
                {label.badge}
              </div>
            ) : null}
            <div className="w-fit rounded-t-[4px] border border-[#2f2c29] bg-white px-2 py-1 text-[24px] leading-[30px]">
              {label.title}
            </div>
            <div className="-mt-px w-fit rounded-b-[4px] border border-[#2f2c29] bg-white px-2 py-1 text-[16px] font-medium leading-[20px]">
              {label.category}
            </div>
          </div>
        ))}
      {hoverLabel ? (
        <div
          className="pointer-events-none absolute z-30 flex flex-col items-start font-display font-semibold text-[#2f2c29] shadow-sm"
          style={{
            left: hoverLabel.x,
            top: hoverLabel.y,
            transform: "translateY(-50%)",
          }}
        >
          <div className="w-fit rounded-t-[4px] border border-[#2f2c29] bg-white px-2 py-1 text-[24px] leading-[30px]">
            {hoverLabel.title}
          </div>
          <div className="-mt-px w-fit rounded-b-[4px] border border-[#2f2c29] bg-white px-2 py-1 text-[16px] font-medium leading-[20px]">
            {hoverLabel.category}
          </div>
        </div>
      ) : null}
      {selectedNode ? (
        <Inspector
          node={selectedNode}
          routeTourId={selectedNodeTour?.id ?? null}
          relatedNodes={getRelatedNodes(data, selectedNode.id)}
          variantNodes={selectedNodeVariants}
          query={query}
          searchResults={searchResults}
          onQueryChange={setQuery}
          onSearchSelect={(nodeId) => {
            selectNodeWithFocus(nodeId, "center");
            setQuery("");
          }}
          onRelatedHover={(nodeId) => {
            const node = cyRef.current?.getElementById(nodeId) as NodeSingular | undefined;
            if (node) {
              const trail = selectionTrailRef.current;
              if (trail.length > 1 && !trail.includes(nodeId)) {
                applyStoredHighlights();
                return;
              }

              clearRelatedHoverRestore();
              applyContextAwareNodeHover(node);
              showHoverLabelForNode(node);
            }
          }}
          onRelatedLeave={() => {
            clearHoverLabel();
            applyStoredHighlights();
          }}
          onBack={handleInspectorBack}
          onSelectNode={selectNodeFromCurrentContext}
          onOpenTour={onOpenTour}
        />
      ) : (
        <OverviewPanel
          data={data}
          nodes={nodes}
          filteredNodes={filteredGraphNodes}
          filteredRelations={filteredRelations}
          query={query}
          searchResults={searchResults}
          onQueryChange={setQuery}
          selectedCategoryIds={selectedCategoryIds}
          selectedFilters={selectedFilters}
          onFilterChange={setSelectedFilters}
          onSelectNode={(nodeId) => {
            selectNodeWithFocus(nodeId, "center");
            setQuery("");
          }}
          onSelectCategory={(categoryId) => {
            setSelectedCategoryIds((current) =>
              current.includes(categoryId)
                ? current.filter((id) => id !== categoryId)
                : [...current, categoryId],
            );
            setQuery("");
          }}
        />
      )}
    </section>
  );
}

function getGraphImageUrl(url: string) {
  if (
    url.startsWith("/") ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("http://localhost") ||
    url.startsWith("http://127.0.0.1")
  ) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin === window.location.origin) return url;
  } catch {
    return url;
  }

  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

function Inspector({
  node,
  routeTourId,
  relatedNodes,
  variantNodes,
  query,
  searchResults,
  onQueryChange,
  onRelatedHover,
  onRelatedLeave,
  onBack,
  onSearchSelect,
  onSelectNode,
  onOpenTour,
}: {
  node: NodeWithCategory;
  routeTourId: string | null;
  relatedNodes: NodeWithCategory[];
  variantNodes: NodeWithCategory[];
  query: string;
  searchResults: NodeWithCategory[];
  onQueryChange: (query: string) => void;
  onRelatedHover: (nodeId: string) => void;
  onRelatedLeave: () => void;
  onBack: () => void;
  onSearchSelect: (nodeId: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onOpenTour: (tourId: string) => void;
}) {
  const panelScale = usePaperPanelScale();
  const searchRef = useRef<HTMLDivElement | null>(null);
  const hasVariants =
    variantNodes.length > 1 || variantNodes.some((variantNode) => getNodeVariantNumber(variantNode) >= 1);

  useEffect(() => {
    if (!query) return;

    function closeSearchOnOutsideClick(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) onQueryChange("");
    }

    document.addEventListener("pointerdown", closeSearchOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeSearchOnOutsideClick);
  }, [onQueryChange, query]);

  return (
    <aside
      className="absolute right-[18px] top-[42px] z-20 flex h-[941px] w-[448px] origin-top-right flex-col overflow-hidden rounded-[8px] bg-white p-[30px] text-[#2f2c29] shadow-2xl"
      style={{ transform: `scale(${panelScale})` }}
    >
      <div className="mb-8 flex h-[31px] w-full flex-shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="h-6 w-6 flex-shrink-0 cursor-pointer bg-cover bg-center"
          style={{ backgroundImage: `url(${inspectorBackIconUrl})` }}
          aria-label="Quay lại graph overview"
        />
        <div ref={searchRef} className="relative w-[352px]">
          <PaperSearchInput
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm kiếm địa điểm"
            aria-label="Tìm node"
            className="w-[352px]"
            textWidthClassName="w-[285px]"
          />
          {searchResults.length ? (
            <GraphSearchResults nodes={searchResults} onSelectNode={onSearchSelect} />
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto -mr-[24px] pr-[24px] [scrollbar-width:thin]">
      <div className="grid grid-cols-[43px_minmax(0,1fr)] items-start gap-[11px]">
        <CategoryIcon name={node.category.icon_name} className="h-11 w-11" />
        <h2 className="min-w-0 whitespace-normal break-words font-display text-[24px] font-semibold leading-[30px]">
          {node.title}
        </h2>
      </div>
      {!hasVariants ? (
        <div className="mt-7 flex justify-between font-display text-[18px] font-medium leading-[22px]">
          <span>{node.period ?? node.category.name}</span>
          <span>{getNodeYearLabel(node) ?? ""}</span>
        </div>
      ) : null}
      <VariantPicker
        currentNodeId={node.id}
        nodes={variantNodes}
        onSelectNode={onSelectNode}
      />
      <div className="relative mt-6 h-[281px] w-full overflow-hidden">
        {node.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.image_url} alt={node.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-muted text-sm">Chưa có ảnh</div>
        )}
        <NodeActionOverlay nodeId={node.id} title={node.title} />
      </div>
      <p className="mt-5 whitespace-pre-wrap font-sans text-[16px] font-medium leading-5">{node.content}</p>
      <div className="mt-6">
        {routeTourId ? (
          <Button
            size="lg"
            className="w-full text-lg font-semibold"
            data-testid="route-tour-cta"
            onClick={() => onOpenTour(routeTourId)}
          >
            <span className="font-semibold">Khám Phá Ngay</span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        ) : node.google_map_url ? (
          <a href={node.google_map_url} target="_blank" rel="noreferrer">
            <Button size="lg" className="w-full text-lg font-semibold" data-testid="tour-url-cta">
              <span className="font-semibold">Khám Phá Ngay</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
          </a>
        ) : node.audio_url ? (
          <Button size="lg" variant="outline" className="w-full" data-testid="audio-url-cta">
            Audio Player / paused
          </Button>
        ) : null}
      </div>
      <div className="mt-6 border-y border-[#d9d4ce]">
        {relatedNodes.map((related) => (
          <button
            key={related.id}
            type="button"
            onClick={() => onSelectNode(related.id)}
            onMouseEnter={() => onRelatedHover(related.id)}
            onMouseLeave={onRelatedLeave}
            onFocus={() => onRelatedHover(related.id)}
            onBlur={onRelatedLeave}
            className={cn(
              "paper-focus -my-px grid w-full cursor-pointer grid-cols-[43px_minmax(0,1fr)_24px] items-center gap-[3px] border-y border-transparent py-2 text-left not-first:border-t-[#d9d4ce] hover:border-[color:var(--related-color)] hover:bg-[color-mix(in_srgb,var(--related-color)_10%,white)] focus-visible:border-[color:var(--related-color)] focus-visible:bg-[color-mix(in_srgb,var(--related-color)_10%,white)]",
            )}
            style={{
              "--related-color": related.category.color,
            } as CSSProperties}
          >
            <span style={{ color: related.category.color }}>
              <CategoryIcon name={related.category.icon_name} className="h-[35px] w-[34px]" />
            </span>
            <span className="min-w-0 whitespace-normal break-words font-display text-2xl">
              {related.title}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ))}
      </div>
      </div>
    </aside>
  );
}

function VariantPicker({
  currentNodeId,
  nodes,
  onSelectNode,
}: {
  currentNodeId: string;
  nodes: NodeWithCategory[];
  onSelectNode: (nodeId: string | null) => void;
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const shouldShow = nodes.length > 1 || nodes.some((node) => getNodeVariantNumber(node) >= 1);
  if (!shouldShow) return null;

  const activeNode = nodes.find((node) => node.id === currentNodeId) ?? nodes[0];
  const visibleNodes = nodes.slice(0, 5);

  return (
    <div className="relative mt-5">
      <div className="mb-2 flex items-center justify-between font-display text-[18px] font-medium leading-[22px] text-[#2f2c29]">
        <span>{getVariantLabel(activeNode)}</span>
        <span>{getNodeYearLabel(activeNode) ?? ""}</span>
      </div>
      <div className="grid grid-cols-5 gap-[8px]">
        {visibleNodes.map((variantNode) => {
          const active = variantNode.id === currentNodeId;
          const hovered = variantNode.id === hoveredNodeId;
          return (
            <div
              key={variantNode.id}
              className={cn("relative overflow-visible", hovered ? "z-50" : "z-0")}
            >
              <button
                type="button"
                onClick={() => onSelectNode(variantNode.id)}
                onMouseEnter={() => setHoveredNodeId(variantNode.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onFocus={() => setHoveredNodeId(variantNode.id)}
                onBlur={() => setHoveredNodeId(null)}
                className={cn(
                  "paper-focus h-[54px] w-full cursor-pointer overflow-hidden rounded-[2px] border bg-white transition",
                  active
                    ? "border-[#2f2c29]"
                    : "border-[#2f2c29]/40 grayscale",
                )}
                aria-label={getVariantLabel(variantNode)}
                aria-pressed={active}
                title={getVariantLabel(variantNode)}
              >
                {variantNode.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={variantNode.image_url}
                    alt={variantNode.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="block h-full w-full"
                    style={{ backgroundColor: variantNode.category.color }}
                  />
                )}
              </button>
              {hovered ? (
                <div className="pointer-events-none absolute left-[calc(100%+8px)] top-0 z-50 whitespace-nowrap rounded-[4px] border border-[#2f2c29] bg-white px-2 py-1 font-display text-[18px] font-medium leading-[22px] text-[#2f2c29] shadow-sm">
                  {getVariantLabel(variantNode)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function findTourForNode(tours: TourWithStops[], node: NodeWithCategory) {
  const metadataTourId =
    typeof node.metadata?.tourId === "string" ? node.metadata.tourId : null;

  return (
    tours.find((tour) => tour.id === metadataTourId) ??
    tours.find((tour) => tour.slug === node.slug) ??
    tours.find((tour) => tour.title === node.title) ??
    null
  );
}

function isNodeInRenderedViewport(node: NodeSingular, cy: Core, overscan: number) {
  const position = node.renderedPosition();
  return (
    position.x >= -overscan &&
    position.y >= -overscan &&
    position.x <= cy.width() + overscan &&
    position.y <= cy.height() + overscan
  );
}

function getNodeVariants(nodes: NodeWithCategory[], selectedNode: NodeWithCategory) {
  return nodes
    .filter((node) => node.title === selectedNode.title)
    .sort((left, right) => getNodeVariantNumber(right) - getNodeVariantNumber(left));
}

function getNodeVariantNumber(node: NodeWithCategory) {
  return typeof node.variant === "number" && node.variant >= 1 ? node.variant : 0;
}

function getVariantLabel(node: NodeWithCategory) {
  const variantNumber = getNodeVariantNumber(node);
  return variantNumber >= 1 ? `Phục dựng lần ${variantNumber}` : "Nguyên Bản";
}

function GraphSearchResults({
  nodes,
  onSelectNode,
}: {
  nodes: NodeWithCategory[];
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <div className="absolute left-0 top-[39px] z-30 w-full overflow-hidden rounded-[4px] border border-[#2f2c29]/20 bg-white text-[#2f2c29] shadow-xl">
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

type OverviewFilterKey = "area" | "period" | "belief" | "process";
type OverviewFilters = Record<OverviewFilterKey, string | null> & {
  yearEnd: string | null;
  yearStart: string | null;
};

const emptyOverviewFilters: OverviewFilters = {
  area: null,
  period: null,
  belief: null,
  process: null,
  yearEnd: null,
  yearStart: null,
};

function uniqueNodeValues(
  nodes: NodeWithCategory[],
  key: Exclude<OverviewFilterKey, "yearRange">,
) {
  return Array.from(
    new Set(
      nodes
        .map((node) => node[key])
        .filter((value): value is string => Boolean(value?.trim())),
    ),
  );
}

function getNodeYearLabel(node: NodeWithCategory) {
  if (node.time_start_text?.trim() || node.time_end_text?.trim()) {
    const start = node.time_start_text?.trim() ?? "";
    const end = node.time_end_text?.trim() ?? "";
    return end ? `${start} - ${end}` : `${start} - nay`;
  }

  if (typeof node.year_start === "number" && typeof node.year_end === "number") {
    return node.year_start === node.year_end
      ? String(node.year_start)
      : `${node.year_start} - ${node.year_end}`;
  }
  if (typeof node.year_start === "number") return String(node.year_start);
  if (typeof node.year_end === "number") return String(node.year_end);
  return null;
}

function nodeMatchesYearRange(
  node: NodeWithCategory,
  selectedYearStart: string | null,
  selectedYearEnd: string | null,
) {
  if (!selectedYearStart && !selectedYearEnd) return true;
  const rawRange = normalizeFlexibleYearRange(node.time_start_text, node.time_end_text);
  const nodeRange =
    typeof node.year_start === "number" || typeof node.year_end === "number"
      ? {
          min: node.year_start ?? node.year_end ?? Number.NEGATIVE_INFINITY,
          max: node.year_end ?? rawRange.endYear ?? node.year_start ?? Number.POSITIVE_INFINITY,
        }
      : rawRange.startYear !== null || rawRange.endYear !== null
        ? {
            min: rawRange.startYear ?? rawRange.endYear ?? Number.NEGATIVE_INFINITY,
            max: rawRange.endYear ?? rawRange.startYear ?? Number.POSITIVE_INFINITY,
          }
        : null;
  if (!nodeRange) return false;

  const start = selectedYearStart ? Number(selectedYearStart) : Number.NEGATIVE_INFINITY;
  const end = selectedYearEnd ? Number(selectedYearEnd) : Number.POSITIVE_INFINITY;
  const normalizedStart = Math.min(start, end);
  const normalizedEnd = Math.max(start, end);

  return nodeRange.min <= normalizedEnd && nodeRange.max >= normalizedStart;
}

function uniqueYearOptions(nodes: NodeWithCategory[]) {
  const years = Array.from(
    new Set(
      nodes
        .flatMap((node) => getNodeYearLabel(node)?.match(/\d{3,4}/g) ?? [])
        .map(Number),
    ),
  ).sort((a, b) => a - b);

  return years.map(String);
}

function YearRangeControl({
  onChange,
  options,
  selectedFilters,
}: {
  onChange: (filters: OverviewFilters) => void;
  options: string[];
  selectedFilters: OverviewFilters;
}) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel =
    selectedFilters.yearStart || selectedFilters.yearEnd
      ? `${selectedFilters.yearStart ?? "..." } - ${selectedFilters.yearEnd ?? "..."}`
      : "chọn năm";

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={controlRef} className="relative col-span-2 flex min-w-0 justify-end">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="paper-focus grid h-[22px] w-full cursor-pointer grid-cols-[minmax(0,1fr)_18px] items-center text-left"
        aria-expanded={open}
        aria-label="Chọn khoảng năm"
      >
        <span
          className={cn(
            "font-display justify-self-end truncate text-[18px] font-medium leading-[22px]",
            selectedFilters.yearStart || selectedFilters.yearEnd ? "text-[#2F2C29]" : "text-[#B8ACA2]",
          )}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 justify-self-end transition-transform",
            selectedFilters.yearStart || selectedFilters.yearEnd ? "text-[#2F2C29]" : "text-[#b8aca2]",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="absolute right-0 top-[32px] z-40 flex w-[260px] flex-col gap-3 rounded-[4px] border border-[#b8aca2] bg-white p-3 text-[#2f2c29] shadow-xl">
          <label className="flex items-center justify-between gap-3 font-display text-[18px] font-medium leading-[22px]">
            <span>Từ năm</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={selectedFilters.yearStart ?? ""}
              onChange={(event) =>
                onChange({ ...selectedFilters, yearStart: event.target.value || null })
              }
              list="graph-year-options"
              className="paper-focus h-8 w-[116px] rounded-[4px] border border-[#B8ACA2] bg-white px-2 text-right font-display text-[18px] font-medium leading-[22px] text-[#2f2c29]"
            />
          </label>
          <label className="flex items-center justify-between gap-3 font-display text-[18px] font-medium leading-[22px]">
            <span>Đến năm</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={selectedFilters.yearEnd ?? ""}
              onChange={(event) =>
                onChange({ ...selectedFilters, yearEnd: event.target.value || null })
              }
              list="graph-year-options"
              className="paper-focus h-8 w-[116px] rounded-[4px] border border-[#B8ACA2] bg-white px-2 text-right font-display text-[18px] font-medium leading-[22px] text-[#2f2c29]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...selectedFilters, yearEnd: null, yearStart: null })}
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
          <datalist id="graph-year-options">
            {options.map((year) => (
              <option key={year} value={year} />
            ))}
          </datalist>
        </div>
      ) : null}
    </div>
  );
}

function OverviewPanel({
  data,
  nodes,
  filteredNodes,
  filteredRelations,
  query,
  searchResults,
  onQueryChange,
  selectedCategoryIds,
  selectedFilters,
  onFilterChange,
  onSelectNode,
  onSelectCategory,
}: {
  data: ExplorerData;
  nodes: NodeWithCategory[];
  filteredNodes: NodeWithCategory[];
  filteredRelations: ExplorerData["relations"];
  query: string;
  searchResults: NodeWithCategory[];
  onQueryChange: (query: string) => void;
  selectedCategoryIds: string[];
  selectedFilters: OverviewFilters;
  onFilterChange: (filters: OverviewFilters) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectCategory: (categoryId: string) => void;
}) {
  const panelScale = usePaperPanelScale();
  const searchRef = useRef<HTMLDivElement | null>(null);
  const nodeInteractionState = useNodeInteractionState();
  const activeCategories = data.categories.filter((category) => category.is_active);
  const categories = useMemo(() => {
    const categoriesByName = new Map(
      activeCategories.map((category) => [category.name, category]),
    );

    const orderedCategories = GRAPH_CATEGORY_BADGE_ORDER.map((name) =>
      categoriesByName.get(name),
    ).filter((category): category is (typeof activeCategories)[number] => Boolean(category));
    const orderedCategoryIds = new Set(orderedCategories.map((category) => category.id));
    const remainingCategories = activeCategories
      .filter((category) => !orderedCategoryIds.has(category.id))
      .sort((first, second) => first.sort_order - second.sort_order);

    return [...orderedCategories, ...remainingCategories].slice(0, 10);
  }, [activeCategories]);
  const selectedCategorySet = useMemo(
    () => new Set(selectedCategoryIds),
    [selectedCategoryIds],
  );
  const yearOptions = useMemo(() => uniqueYearOptions(nodes), [nodes]);
  const filterRows: Array<{
    key: OverviewFilterKey;
    label: string;
    placeholder: string;
    options: string[];
  }> = [
    {
      key: "area",
      label: "Khu Vực",
      placeholder: "chọn khu vực",
      options: uniqueNodeValues(nodes, "area"),
    },
    {
      key: "period",
      label: "Thời Kỳ",
      placeholder: "chọn thời kỳ",
      options: uniqueNodeValues(nodes, "period"),
    },
    {
      key: "belief",
      label: "Tín Ngưỡng",
      placeholder: "chọn tín ngưỡng",
      options: uniqueNodeValues(nodes, "belief"),
    },
    {
      key: "process",
      label: "Tiến Trình",
      placeholder: "chọn tiến trình",
      options: NODE_PROGRESS_FILTER_OPTIONS,
    },
  ];
  const exploredNodeCount = filteredNodes.filter((node) =>
    nodeInteractionState.exploredNodeIds.includes(node.id),
  ).length;
  const exploredPercent = Math.round(
    (exploredNodeCount / Math.max(filteredNodes.length, 1)) * 100,
  );
  const stats = [
    { label: "Điểm", value: filteredNodes.length.toLocaleString("vi-VN") },
    { label: "Liên Kết", value: filteredRelations.length.toLocaleString("vi-VN") },
    {
      label: "Khám Phá",
      value: `${exploredPercent}%`,
    },
  ];

  useEffect(() => {
    if (!query) return;

    function closeSearchOnOutsideClick(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) onQueryChange("");
    }

    document.addEventListener("pointerdown", closeSearchOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeSearchOnOutsideClick);
  }, [onQueryChange, query]);

  return (
    <aside
      className="absolute right-[18px] top-[42px] z-20 flex h-[941px] w-[448px] origin-top-right flex-col items-start gap-6 overflow-hidden rounded-[8px] bg-white px-[30px] py-8 text-[#2f2c29] shadow-2xl"
      data-testid="graph-overview-panel"
      style={{ transform: `scale(${panelScale})` }}
    >
      <div ref={searchRef} className="relative w-full">
        <PaperSearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm kiếm địa điểm"
          aria-label="Tìm node"
        />
        {searchResults.length ? (
          <GraphSearchResults nodes={searchResults} onSelectNode={onSelectNode} />
        ) : null}
      </div>
      <h2 className="font-display w-full text-[36px] font-semibold leading-[44px]">
        Mạng Lưới Văn Hóa
      </h2>
      <p className="w-full text-base font-medium leading-5">
        Đây là nơi giúp bạn khám phá Hà Nội không theo một đường thẳng, mà qua
        những kết nối giữa địa danh, con người, lịch sử, tín ngưỡng, kiến trúc và
        ký ức đời sống.
      </p>

      <div className="flex w-full flex-col gap-[10px]">
        {filterRows.map((filter) => (
          <div key={filter.key} className="contents">
            <PaperFilterDropdown
              label={filter.label}
              value={selectedFilters[filter.key]}
              placeholder={filter.placeholder}
              options={filter.options}
              onChange={(value) => onFilterChange({ ...selectedFilters, [filter.key]: value })}
            />
            {filter.key === "period" ? (
              <div className="grid h-7 w-full grid-cols-[155px_minmax(0,1fr)_18px] items-center gap-0">
                <span className="font-display text-[18px] font-medium leading-[22px]">Năm</span>
                <YearRangeControl
                  options={yearOptions}
                  selectedFilters={selectedFilters}
                  onChange={onFilterChange}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid w-full grid-cols-3 gap-[15px]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="grid h-[58px] place-items-center rounded-[6px] border border-[#b8aca2] text-center"
          >
            <div className="flex flex-col items-center justify-center gap-1">
              <p className="font-display text-center text-[18px] font-semibold leading-[22px]">
                {stat.value}
              </p>
              <p className="font-display text-center text-[14px] font-medium leading-4">
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid w-full grid-cols-2 gap-3" data-testid="graph-category-list">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id)}
            className={cn(
              "paper-focus grid h-12 w-[187px] cursor-pointer grid-cols-[48px_minmax(0,1fr)] items-center gap-[15px] overflow-hidden rounded-[4px] border text-left hover:border-[color:var(--category-color)] hover:bg-[color-mix(in_srgb,var(--category-color)_10%,white)]",
              selectedCategorySet.has(category.id)
                ? "border-[color:var(--category-color)] bg-[color-mix(in_srgb,var(--category-color)_10%,white)]"
                : "border-[#B8ACA2] bg-white",
            )}
            style={{
              "--category-color": category.color,
            } as CSSProperties}
            aria-pressed={selectedCategorySet.has(category.id)}
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-[4px]"
              style={{ color: category.color }}
            >
              <CategoryIcon name={category.icon_name} className="h-10 w-10" />
            </span>
            <span className="font-display min-w-0 truncate text-[18px] font-medium leading-[22px]">
              {category.name}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
