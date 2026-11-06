"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { FilterSpecification, GeoJSONSourceSpecification, LngLatBoundsLike } from "maplibre-gl";
import { use, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Layer, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { formatArs } from "@/lib/format";
import { MAP_BOUNDS } from "@/lib/indicators/geography";
import type { PricePoint, PriceView } from "@/lib/indicators/prices";
import { loadBasemap, MAP_BORDER, MAP_INK, MAP_LOCALE } from "../maps/maplibre-setup";

const polygons: FilterSpecification = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
const outlineLabels: FilterSpecification = ["==", ["geometry-type"], "Point"];

/** Below this map width a tooltip next to the finger would leave the map, so it is pinned to a corner. */
const NARROW_MAP = 520;

/** Closest zoom when fitting a product sold in one town. */
const FIT_MAX_ZOOM = 11;

/** The hovered branch; `ean` ties it to the product it was shown for. */
type Tip = { ean: string; index: number; x: number; y: number; flipX: boolean; flipY: boolean; narrow: boolean };

/** The area covering every branch, or the whole country when there is nothing to fit. */
function pointBounds(points: PricePoint[]): LngLatBoundsLike {
  if (points.length === 0) return MAP_BOUNDS;
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/** Each branch selling the product as a point colored by its price, cheapest labels first. */
export function PriceMap({ view }: { view: PriceView }) {
  const style = use(loadBasemap());
  const mapRef = useRef<MapRef>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const bounds = useMemo(() => pointBounds(view.points), [view]);

  const data = useMemo(
    (): GeoJSONSourceSpecification["data"] => ({
      type: "FeatureCollection",
      features: view.points.map((point, index) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [point.lon, point.lat] },
        properties: { index, id: point.id, color: point.color, price: point.price, label: formatArs(point.price) },
      })),
    }),
    [view],
  );

  // A new product keeps the map but moves it to where that product is sold.
  useEffect(() => {
    mapRef.current?.fitBounds(bounds, { padding: 40, maxZoom: FIT_MAX_ZOOM, duration: 600 });
  }, [bounds]);

  // A tap anywhere outside the map closes the tooltip; taps on the map are handled by `show`.
  useEffect(() => {
    if (!tip) return;
    const close = (event: PointerEvent) => {
      const container = mapRef.current?.getContainer();
      if (container && event.target instanceof Node && !container.contains(event.target)) setTip(null);
    };
    document.addEventListener("pointerdown", close, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", close, { capture: true });
  }, [tip]);

  const show = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const container = mapRef.current?.getContainer();
    if (!feature || !container) return setTip(null);
    const { x, y } = event.point;
    setTip({
      ean: view.ean,
      index: Number(feature.properties?.index),
      x,
      y,
      flipX: x > container.clientWidth / 2,
      flipY: y > container.clientHeight / 2,
      narrow: container.clientWidth < NARROW_MAP,
    });
  };

  // A tooltip left over from the previous product is not shown.
  const current = tip?.ean === view.ean ? tip : null;
  const point = current ? view.points[current.index] : undefined;

  return (
    <div className="relative size-full">
      <MapGL
        ref={mapRef}
        mapStyle={style}
        initialViewState={{ bounds, fitBoundsOptions: { padding: 40, maxZoom: FIT_MAX_ZOOM } }}
        locale={MAP_LOCALE}
        cooperativeGestures
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        maxPitch={0}
        interactiveLayerIds={["branch"]}
        cursor={current ? "pointer" : undefined}
        onMouseMove={show}
        onMouseOut={() => setTip(null)}
        onClick={show}
        onLoad={(event) => {
          event.target.touchZoomRotate.disableRotation();
          event.target.keyboard.disableRotation();
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl showCompass={false} position="top-right" />

        <Source id="outlines" type="geojson" data="/geo/outlines.json">
          <Layer id="outline" type="line" filter={polygons} paint={{ "line-color": MAP_BORDER, "line-width": 0.8 }} />
          <Layer
            id="outline-label"
            type="symbol"
            filter={outlineLabels}
            layout={{ "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 12 }}
            paint={{ "text-color": "#52514e", "text-halo-color": "#fcfcfb", "text-halo-width": 1.2 }}
          />
        </Source>

        <Source id="branches" type="geojson" data={data}>
          {/* A dark ring marks the cheapest price, under the point so it shows as a halo. */}
          <Layer
            id="cheapest"
            type="circle"
            filter={["==", ["get", "price"], view.summary.min]}
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 8, 12, 12],
              "circle-color": "rgba(0,0,0,0)",
              "circle-stroke-color": MAP_INK,
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id="branch"
            type="circle"
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4.5, 12, 8],
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.2,
            }}
          />
          <Layer
            id="branch-hover"
            type="circle"
            filter={["==", ["get", "index"], current?.index ?? -1]}
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 6, 12, 10],
              "circle-color": "rgba(0,0,0,0)",
              "circle-stroke-color": MAP_INK,
              "circle-stroke-width": 2,
            }}
          />
          {/* Prices next to the points; when they would overlap, the cheaper one stays. */}
          <Layer
            id="branch-label"
            type="symbol"
            layout={{
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 11,
              "symbol-sort-key": ["get", "price"],
              "text-variable-anchor": ["left", "right", "top", "bottom"],
              "text-radial-offset": 0.8,
            }}
            paint={{ "text-color": MAP_INK, "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
          />
        </Source>
      </MapGL>

      {current && point ? (
        <div
          className={
            current.narrow
              ? "pointer-events-none absolute top-2 left-2 z-10 max-w-[calc(100%-3.5rem)]"
              : "pointer-events-none absolute z-10 w-max max-w-72"
          }
          style={
            current.narrow
              ? undefined
              : {
                  left: current.x,
                  top: current.y,
                  transform: `translate(${current.flipX ? "calc(-100% - 12px)" : "12px"}, ${current.flipY ? "calc(-100% - 12px)" : "12px"})`,
                }
          }
        >
          <BranchTooltip point={point} cheapest={point.price === view.summary.min} />
        </div>
      ) : null}
    </div>
  );
}

function BranchTooltip({ point, cheapest }: { point: PricePoint; cheapest: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-[#fcfcfb] px-3 py-2 text-xs text-[#52514e] shadow-lg ring-1 ring-black/10">
      <p className="text-sm font-semibold text-[#0b0b0b]">{point.chain}</p>
      <p>{point.name}</p>
      <p>
        {point.address}, {point.locality}, {point.province}
      </p>
      <p className="text-base font-semibold text-[#0b0b0b] tabular-nums">
        {formatArs(point.price, 2)}
        {cheapest ? <span className="ml-2 text-xs font-medium">El más barato</span> : null}
      </p>
    </div>
  );
}
