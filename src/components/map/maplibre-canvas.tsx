"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { NodeWithCategory, TourWithStops } from "@/lib/domain/types";
import { getCategoryIconUrl } from "@/components/icons/category-icon";

const hanoiCenter: [number, number] = [105.852, 21.0287];
const OPENFREEMAP_BRIGHT_STYLE = "https://tiles.openfreemap.org/styles/bright";
const HIDDEN_BASE_PLACE_LAYER_PATTERNS = [
  /poi/i,
  /airport/i,
  /aerodrome/i,
  /landuse-hospital/i,
  /landuse-school/i,
];
const INTRO_ZOOM_DELTA = 5;
const INTRO_ZOOM_DURATION_MS = 1400;
const SELECTED_NODE_ZOOM = 17;
const MARKER_BASE_ZOOM = 13;
const MARKER_BASE_SIZE = 13;
const MARKER_ZOOM_SIZE_STEP = 18;
const MARKER_MIN_SIZE = 15;
const MARKER_MAX_SIZE = 57;
const SELECTED_MARKER_SIZE = 65;

export function MapLibreCanvas({
  nodes,
  selectedNodeId,
  selectedTour,
  onSelectNode,
  zoom = 13,
  introZoom = false,
  interactive = true,
  testId = "map-canvas",
}: {
  nodes: Array<NodeWithCategory & { lat: number; lng: number }>;
  selectedNodeId?: string | null;
  selectedTour?: TourWithStops | null;
  onSelectNode?: (nodeId: string) => void;
  zoom?: number;
  introZoom?: boolean;
  interactive?: boolean;
  testId?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const labelMarkersRef = useRef<maplibregl.Marker[]>([]);
  const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const skippedInitialSelectedFlyToRef = useRef(!selectedNodeId);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [initialZoom] = useState(() => (selectedNodeId ? Math.max(zoom + 1, SELECTED_NODE_ZOOM) : zoom));
  const [mapStartZoom] = useState(() =>
    introZoom ? Math.max(3, initialZoom - INTRO_ZOOM_DELTA) : initialZoom,
  );
  const [initialCenter] = useState<[number, number]>(() => {
    const selected = nodes.find((node) => node.id === selectedNodeId);
    return selected
      ? [selected.lng, selected.lat]
      : selectedTour?.stops[0]?.node.lng && selectedTour.stops[0].node.lat
        ? [selectedTour.stops[0].node.lng, selectedTour.stops[0].node.lat]
        : hanoiCenter;
  });
  const displayedNodes = selectedTour ? getTourNodes(selectedTour) : nodes;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: maplibregl.Map | null = null;

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OPENFREEMAP_BRIGHT_STYLE,
        center: initialCenter,
        zoom: mapStartZoom,
        interactive,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initialize MapLibre";
      window.setTimeout(() => {
        setMapError(message);
        setStyleReady(false);
      }, 0);
      return;
    }

    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    }

    const canvas = map.getCanvas();
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setMapError("WebGL context lost");
      setStyleReady(false);
    };

    canvas.addEventListener("webglcontextlost", handleContextLost, false);
    map.on("error", (event) => {
      const message =
        event.error instanceof Error ? event.error.message : "MapLibre rendering error";
      setMapError(message);
    });
    map.on("load", () => {
      map.resize();
      hideBasePlaceLayers(map);
      setMapError(null);
      setStyleReady(true);

      if (introZoom) {
        map.easeTo({
          center: initialCenter,
          zoom: initialZoom,
          duration: INTRO_ZOOM_DURATION_MS,
          easing: easeInOutSmoothstep,
          essential: true,
        });
      }
    });
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      labelMarkersRef.current.forEach((marker) => marker.remove());
      labelMarkersRef.current = [];
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      map?.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, [initialCenter, initialZoom, interactive, introZoom, mapStartZoom]);

  useEffect(() => {
    if (!interactive || typeof navigator === "undefined" || !navigator.geolocation) return;

    let active = true;
    const handlePosition = (position: GeolocationPosition) => {
      if (!active) return;
      setUserLocation([position.coords.longitude, position.coords.latitude]);
    };

    const handleError = () => {
      if (!active) return;
      setUserLocation(null);
    };

    const watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000,
    });

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = displayedNodes.map((node) => {
      const element = document.createElement("button");
      element.type = "button";
      element.setAttribute("aria-label", node.title);
      element.style.background = "transparent";
      element.style.display = "grid";
      element.style.placeItems = "center";
      element.style.border = "0";
      element.style.padding = "0";
      element.style.cursor = "pointer";
      element.className =
        node.id === selectedNodeId
          ? "group grid h-14 w-14 cursor-pointer place-items-center border-0 bg-transparent p-0"
          : "group grid h-12 w-12 cursor-pointer place-items-center border-0 bg-transparent p-0";
      element.dataset.testid = `map-marker-${node.slug}`;
      element.dataset.nodeId = node.id;
      element.appendChild(createCategoryMarkerIcon(node));

      const selectNode = (event: MouseEvent | PointerEvent | KeyboardEvent) => {
        event.stopPropagation();
        onSelectNode?.(node.id);
      };
      element.addEventListener("click", selectNode);
      element.addEventListener("pointerup", selectNode);
      element.addEventListener("pointerenter", () => setHoveredNodeId(node.id));
      element.addEventListener("pointerleave", () => setHoveredNodeId((current) => current === node.id ? null : current));
      element.addEventListener("focus", () => setHoveredNodeId(node.id));
      element.addEventListener("blur", () => setHoveredNodeId((current) => current === node.id ? null : current));
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") selectNode(event);
      });

      return new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([node.lng, node.lat])
        .addTo(map);
    });
    updateMapMarkerZoomState(markersRef.current, map.getZoom(), selectedNodeId);
  }, [displayedNodes, onSelectNode, selectedNodeId, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const updateMarkers = () =>
      updateMapMarkerZoomState(markersRef.current, map.getZoom(), selectedNodeId);
    updateMarkers();
    map.on("zoom", updateMarkers);
    return () => {
      map.off("zoom", updateMarkers);
    };
  }, [selectedNodeId, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    userLocationMarkerRef.current?.remove();
    userLocationMarkerRef.current = null;
    if (!userLocation) return;

    userLocationMarkerRef.current = new maplibregl.Marker({
      element: createUserLocationMarkerElement(),
      anchor: "center",
    })
      .setLngLat(userLocation)
      .addTo(map);
  }, [styleReady, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    labelMarkersRef.current.forEach((marker) => marker.remove());
    labelMarkersRef.current = [];

    const tourLabelNodeIds = new Set(
      selectedTour?.stops
        .filter((stop) => typeof stop.node.lng === "number" && typeof stop.node.lat === "number")
        .map((stop) => stop.node.id) ?? [],
    );
    const labelNodeIds = new Set(tourLabelNodeIds);
    if (hoveredNodeId) labelNodeIds.add(hoveredNodeId);

    const tourBoundaryLabelByNodeId = getTourBoundaryLabelByNodeId(selectedTour);
    const labelNodes = displayedNodes.filter((node) => labelNodeIds.has(node.id));
    labelMarkersRef.current = labelNodes.map((node) => {
      const element = document.createElement("div");
      element.className =
        "pointer-events-none flex flex-col items-start font-display font-semibold text-[#2f2c29] shadow-sm";
      element.dataset.testid = `map-node-label-${node.slug}`;

      const titleElement = document.createElement("div");
      titleElement.className =
        "w-fit rounded-t-[4px] border border-[#2f2c29] bg-white px-2 py-1 text-[18px] leading-[24px]";
      titleElement.textContent = node.title;
      element.appendChild(titleElement);

      const boundaryLabel = tourBoundaryLabelByNodeId.get(node.id);
      if (boundaryLabel) {
        const boundaryElement = document.createElement("div");
        boundaryElement.className =
          "-mt-px w-fit rounded-b-[4px] border border-[#2f2c29] bg-white px-2 py-1 text-[16px] font-medium leading-[20px]";
        boundaryElement.dataset.testid = `map-tour-boundary-label-${node.slug}`;
        boundaryElement.textContent = boundaryLabel;
        element.appendChild(boundaryElement);
      } else {
        titleElement.className =
          "w-fit rounded-[4px] border border-[#2f2c29] bg-white px-2 py-1 text-[18px] leading-[24px]";
      }

      return new maplibregl.Marker({
        element,
        anchor: "left",
        offset: [20, 0],
      })
        .setLngLat([node.lng, node.lat])
        .addTo(map);
    });
  }, [displayedNodes, hoveredNodeId, selectedTour, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const sourceId = "tour-route";
    const layerId = "tour-route-layer";
    const coordinates =
      selectedTour?.stops
        .filter((stop) => stop.node.lng && stop.node.lat)
        .map((stop) => [stop.node.lng!, stop.node.lat!]) ?? [];

    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    if (coordinates.length < 2) return;

    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates },
      },
    });
    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#3923C3",
        "line-width": 5,
        "line-opacity": 0.85,
      },
    });

    const bounds = coordinates.reduce(
      (nextBounds, coordinate) => nextBounds.extend(coordinate as [number, number]),
      new maplibregl.LngLatBounds(
        coordinates[0] as [number, number],
        coordinates[0] as [number, number],
      ),
    );
    map.fitBounds(bounds, {
      padding: 110,
      duration: 500,
      bearing: getBearingFromCenterToFirstStop(
        bounds.getCenter(),
        coordinates[0] as [number, number],
      ),
    });
  }, [selectedTour, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = displayedNodes.find((node) => node.id === selectedNodeId);
    if (!map || !styleReady || !selected) return;

    if (!skippedInitialSelectedFlyToRef.current) {
      skippedInitialSelectedFlyToRef.current = true;
      return;
    }

    map.flyTo({
      center: [selected.lng, selected.lat],
      zoom: Math.max(zoom + 1, SELECTED_NODE_ZOOM),
      essential: true,
    });
  }, [displayedNodes, selectedNodeId, styleReady, zoom]);

  const fallbackRoute =
    selectedTour?.stops
      .filter((stop) => stop.node.lng && stop.node.lat)
      .map((stop) => projectFallbackPoint(stop.node.lng!, stop.node.lat!)) ?? [];

  return (
    <div className="absolute inset-0" data-testid={`${testId}-stage`}>
      <div
        ref={containerRef}
        className="h-full w-full"
        data-testid={testId}
        data-maplibre-ready={styleReady || mapError ? "true" : "false"}
        data-maplibre-error={mapError ?? undefined}
      />
      {mapError ? (
        <div
          className="absolute inset-0 overflow-hidden bg-[#dfe8f6]"
          aria-label="Map fallback"
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.8)_10%,transparent_10%,transparent_20%,rgba(255,255,255,.8)_20%,rgba(255,255,255,.8)_24%,transparent_24%),linear-gradient(rgba(113,141,108,.24)_1px,transparent_1px),linear-gradient(90deg,rgba(113,141,108,.2)_1px,transparent_1px)] bg-[size:220px_220px,48px_48px,48px_48px] opacity-80" />
          <div className="absolute left-[52%] top-[-10%] h-[120%] w-[18%] rotate-[8deg] bg-[#a7d8e2]/75" />
          <div className="absolute left-[34%] top-[6%] h-[72%] w-[10%] rounded-full bg-[#a6cfd2]/55" />
          {fallbackRoute.length > 1 ? (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <polyline
                points={fallbackRoute.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="#3923C3"
                strokeOpacity="0.85"
                strokeWidth="5"
              />
            </svg>
          ) : null}
          {displayedNodes.map((node) => {
            const point = projectFallbackPoint(node.lng, node.lat);
            return (
              <button
                key={node.id}
                type="button"
                aria-label={node.title}
                data-testid={`fallback-map-marker-${node.slug}`}
                onClick={() => onSelectNode?.(node.id)}
                className={
                  node.id === selectedNodeId
                    ? "paper-focus absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center bg-transparent"
                    : "paper-focus absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center bg-transparent hover:scale-125"
                }
                style={{
                  left: point.x,
                  top: point.y,
                }}
              >
                {getCategoryIconUrl(node.category.icon_name) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getCategoryIconUrl(node.category.icon_name)} alt="" className="h-full w-full" />
                ) : (
                  <span className="h-7 w-7 rounded-full" style={{ backgroundColor: node.category.color }} />
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function createCategoryMarkerIcon(node: NodeWithCategory & { lat: number; lng: number }) {
  const iconWrapper = document.createElement("span");
  iconWrapper.dataset.markerInner = "true";
  iconWrapper.dataset.categoryColor = node.category.color;
  iconWrapper.className =
    "grid place-items-center rounded-full bg-white shadow-[0_6px_14px_rgba(47,44,41,0.16)] transition-[height,width,transform,border-width,background-color,box-shadow] duration-200 group-hover:scale-110";

  const iconUrl = getCategoryIconUrl(node.category.icon_name);
  if (iconUrl) {
    const icon = document.createElement("img");
    icon.src = iconUrl;
    icon.alt = "";
    icon.draggable = false;
    icon.dataset.markerIcon = "true";
    icon.className = "transition-opacity duration-200";
    iconWrapper.appendChild(icon);
  }

  const dot = document.createElement("span");
  dot.dataset.markerDot = "true";
  dot.className = "rounded-full transition-[height,width,opacity] duration-200";
  dot.style.background = node.category.color;
  iconWrapper.appendChild(dot);

  return iconWrapper;
}

function updateMapMarkerZoomState(
  markers: maplibregl.Marker[],
  zoom: number,
  selectedNodeId?: string | null,
) {
  const normalSize = getMarkerSizeForZoom(zoom);

  markers.forEach((marker) => {
    const element = marker.getElement();
    const inner = element.querySelector<HTMLElement>("[data-marker-inner='true']");
    const icon = element.querySelector<HTMLElement>("[data-marker-icon='true']");
    const dot = element.querySelector<HTMLElement>("[data-marker-dot='true']");
    if (!inner || !dot) return;

    const markerNodeId = element.dataset.nodeId;
    const selected = Boolean(markerNodeId && markerNodeId === selectedNodeId);
    const color = inner.dataset.categoryColor ?? "#FFDD42";
    const rootSize = selected ? SELECTED_MARKER_SIZE : normalSize;
    const innerSize = selected ? SELECTED_MARKER_SIZE - 8 : Math.max(12, normalSize - 3);
    const iconSize = selected ? 42 : Math.max(10, Math.round(innerSize * 0.66));
    const dotSize = selected ? 42 : Math.max(10, Math.round(innerSize * 0.66));

    element.style.width = `${rootSize}px`;
    element.style.height = `${rootSize}px`;
    element.style.display = "grid";
    element.style.placeItems = "center";
    element.style.border = "0";
    element.style.padding = "0";
    element.style.background = "transparent";
    element.style.cursor = "pointer";
    inner.className = selected
      ? "grid place-items-center rounded-full border-[4px] border-[#2d20f6] bg-white shadow-[0_8px_18px_rgba(47,44,41,0.18)] transition-[height,width,transform,border-width,background-color,box-shadow] duration-200 group-hover:scale-110"
      : "grid place-items-center rounded-full border border-white bg-white shadow-[0_3px_8px_rgba(47,44,41,0.12)] transition-[height,width,transform,border-width,background-color,box-shadow] duration-200 group-hover:scale-110";
    inner.style.width = `${innerSize}px`;
    inner.style.height = `${innerSize}px`;
    if (icon) {
      icon.style.display = "";
      icon.style.opacity = "1";
      icon.className = "transition-opacity duration-200";
      icon.style.width = `${iconSize}px`;
      icon.style.height = `${iconSize}px`;
      dot.style.display = "none";
      return;
    }

    dot.style.display = "";
    dot.className = "rounded-full transition-[height,width,opacity] duration-200";
    dot.style.width = `${dotSize}px`;
    dot.style.height = `${dotSize}px`;
    dot.style.background = color;
  });
}

function getMarkerSizeForZoom(zoom: number) {
  const size = MARKER_BASE_SIZE + (zoom - MARKER_BASE_ZOOM) * MARKER_ZOOM_SIZE_STEP;
  return Math.round(Math.min(MARKER_MAX_SIZE, Math.max(MARKER_MIN_SIZE, size)));
}

function easeInOutSmoothstep(progress: number) {
  return progress * progress * (3 - 2 * progress);
}

function createUserLocationMarkerElement() {
  const element = document.createElement("div");
  element.className = "relative grid h-10 w-10 place-items-center";
  element.dataset.testid = "map-user-location-marker";
  element.setAttribute("aria-label", "Vị trí hiện tại của bạn");

  const pulse = document.createElement("span");
  pulse.className =
    "absolute h-10 w-10 animate-ping rounded-full bg-[#2d20f6]/25";

  const dot = document.createElement("span");
  dot.className =
    "relative h-5 w-5 rounded-full border-4 border-white bg-[#2d20f6] shadow-[0_0_0_3px_rgba(45,32,246,0.22),0_8px_18px_rgba(47,44,41,0.2)]";

  element.appendChild(pulse);
  element.appendChild(dot);
  return element;
}

function getTourNodes(selectedTour: TourWithStops) {
  return selectedTour.stops
    .map((stop) => stop.node)
    .filter(
      (node): node is NodeWithCategory & { lat: number; lng: number } =>
        typeof node.lat === "number" && typeof node.lng === "number",
    );
}

function getTourBoundaryLabelByNodeId(selectedTour?: TourWithStops | null) {
  const labelByNodeId = new Map<string, string>();
  const stops =
    selectedTour?.stops.filter(
      (stop) => typeof stop.node.lng === "number" && typeof stop.node.lat === "number",
    ) ?? [];

  const firstStop = stops[0];
  const lastStop = stops.length > 1 ? stops[stops.length - 1] : null;
  if (firstStop) labelByNodeId.set(firstStop.node.id, "Khởi đầu");
  if (lastStop) labelByNodeId.set(lastStop.node.id, "Kết thúc");

  return labelByNodeId;
}

function getBearingFromCenterToFirstStop(
  center: maplibregl.LngLat,
  firstStop: [number, number],
) {
  const startLng = toRadians(center.lng);
  const startLat = toRadians(center.lat);
  const endLng = toRadians(firstStop[0]);
  const endLat = toRadians(firstStop[1]);
  const deltaLng = endLng - startLng;
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function projectFallbackPoint(lng: number, lat: number) {
  const lngRange = 0.035;
  const latRange = 0.026;
  const x = `${Math.min(94, Math.max(6, 50 + ((lng - hanoiCenter[0]) / lngRange) * 100))}%`;
  const y = `${Math.min(94, Math.max(6, 50 - ((lat - hanoiCenter[1]) / latRange) * 100))}%`;

  return { x, y };
}

function hideBasePlaceLayers(map: maplibregl.Map) {
  const layers = map.getStyle().layers ?? [];

  layers.forEach((layer) => {
    if (!shouldHideBasePlaceLayer(layer)) return;

    try {
      map.setLayoutProperty(layer.id, "visibility", "none");
    } catch {
      // Some third-party styles can expose generated layers that are not mutable yet.
    }
  });
}

function shouldHideBasePlaceLayer(layer: maplibregl.LayerSpecification) {
  const sourceLayer = "source-layer" in layer ? layer["source-layer"] : "";
  const searchableName = `${layer.id} ${sourceLayer ?? ""}`;

  return HIDDEN_BASE_PLACE_LAYER_PATTERNS.some((pattern) => pattern.test(searchableName));
}
