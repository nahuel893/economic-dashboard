"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { ExpressionSpecification, FilterSpecification, GeoJSONSourceSpecification } from "maplibre-gl";
import { use, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Layer, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { AREAS, MAP_BOUNDS } from "@/lib/indicators/geography";
import { areaColors, NO_DATA_COLOR, type MapView } from "@/lib/indicators/maps";
import { firstSymbolLayer } from "./basemap";
import { loadBasemap, MAP_BORDER, MAP_INK, MAP_LOCALE } from "./maplibre-setup";
import { PlaceTooltip } from "./place-tooltip";

const INK = MAP_INK;
const BORDER = MAP_BORDER;

const polygons: FilterSpecification = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
const points: FilterSpecification = ["==", ["geometry-type"], "Point"];

type Tip = { placeId: string; areaId?: string; x: number; y: number; flipX: boolean; flipY: boolean; narrow: boolean };

/** Below this map width a tooltip next to the finger would leave the map, so it is pinned to a corner. */
const NARROW_MAP = 520;

export function MapCanvas({ view }: { view: MapView }) {
  const style = use(loadBasemap());
  const beforeId = typeof style === "string" ? undefined : firstSymbolLayer(style);
  const mapRef = useRef<MapRef>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const isPoints = view.geometry === "aglomerados";
  const isDepartments = view.geometry === "departments";
  // Places drawn as their own shape or point: the tooltip's place is the hovered feature itself.
  const ownShape = isPoints || isDepartments;

  const fillColor = useMemo((): ExpressionSpecification | string => {
    const [first, ...rest] = Object.entries(areaColors(view));
    return first ? ["match", ["get", "id"], first[0], first[1], ...rest.flat(), NO_DATA_COLOR] : NO_DATA_COLOR;
  }, [view]);

  const departmentFill = useMemo((): ExpressionSpecification | string => {
    if (!isDepartments) return NO_DATA_COLOR;
    const [first, ...rest] = view.places;
    return first ? ["match", ["get", "id"], first.id, first.color, ...rest.flatMap((p) => [p.id, p.color]), NO_DATA_COLOR] : NO_DATA_COLOR;
  }, [view, isDepartments]);

  const pointData = useMemo(
    (): GeoJSONSourceSpecification["data"] => ({
      type: "FeatureCollection",
      features: view.places.flatMap((place) =>
        place.lon === undefined || place.lat === undefined
          ? []
          : [
              {
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: [place.lon, place.lat] },
                properties: { id: place.id, color: place.color, highCv: place.highCv },
              },
            ],
      ),
    }),
    [view],
  );

  // One label per place with data: next to each point, or inside each area or region.
  const labelData = useMemo(
    (): GeoJSONSourceSpecification["data"] => ({
      type: "FeatureCollection",
      features: view.places.flatMap((place) =>
        place.label === null
          ? []
          : [
              {
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: place.labelAt },
                properties: { id: place.id, label: place.label },
              },
            ],
      ),
    }),
    [view],
  );

  // The areas that share the hovered value: one area, or every area of the hovered region.
  const highlighted = useMemo(
    () =>
      tip && !ownShape ? Object.keys(view.areaPlace).filter((area) => view.areaPlace[area] === tip.placeId) : [],
    [tip, ownShape, view],
  );

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
    const id = String(feature.properties?.id);
    const placeId = ownShape ? id : view.areaPlace[id];
    if (!placeId) return setTip(null);
    const { x, y } = event.point;
    setTip({
      placeId,
      areaId: ownShape ? undefined : id,
      x,
      y,
      flipX: x > container.clientWidth / 2,
      flipY: y > container.clientHeight / 2,
      narrow: container.clientWidth < NARROW_MAP,
    });
  };

  const place = tip ? view.places.find((p) => p.id === tip.placeId) : undefined;
  const areaName = view.geometry === "regions" && tip?.areaId ? AREAS.find((a) => a.id === tip.areaId)?.name : undefined;

  return (
    <div className="relative size-full">
      <MapGL
        ref={mapRef}
        mapStyle={style}
        initialViewState={{ bounds: MAP_BOUNDS, fitBoundsOptions: { padding: 12 } }}
        locale={MAP_LOCALE}
        cooperativeGestures
        attributionControl={{ compact: true }}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        maxPitch={0}
        interactiveLayerIds={[isPoints ? "points" : isDepartments ? "department-fill" : "area-fill"]}
        cursor={tip ? "pointer" : undefined}
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

        {/* The department shapes load only for the census, under the province borders. */}
        {isDepartments ? (
          <Source id="departments" type="geojson" data="/geo/departments.json">
            <Layer id="department-fill" type="fill" beforeId={beforeId} paint={{ "fill-color": departmentFill, "fill-opacity": 0.88 }} />
            <Layer id="department-border" type="line" beforeId={beforeId} paint={{ "line-color": BORDER, "line-width": 0.25 }} />
            <Layer
              id="department-hover"
              type="line"
              beforeId={beforeId}
              filter={["==", ["get", "id"], tip?.placeId ?? ""]}
              paint={{ "line-color": INK, "line-width": 2 }}
            />
          </Source>
        ) : null}

        <Source id="areas" type="geojson" data="/geo/areas.json">
          <Layer
            id="area-fill"
            type="fill"
            beforeId={beforeId}
            paint={{ "fill-color": fillColor, "fill-opacity": ownShape ? 0 : 0.88 }}
          />
          <Layer id="area-border" type="line" beforeId={beforeId} paint={{ "line-color": BORDER, "line-width": 0.6 }} />
          <Layer
            id="area-hover"
            type="line"
            beforeId={beforeId}
            filter={["in", ["get", "id"], ["literal", highlighted]]}
            paint={{ "line-color": INK, "line-width": 2 }}
          />
        </Source>

        <Source id="outlines" type="geojson" data="/geo/outlines.json">
          <Layer id="outline" type="line" filter={polygons} paint={{ "line-color": BORDER, "line-width": 0.8 }} />
          <Layer
            id="outline-label"
            type="symbol"
            filter={points}
            layout={{ "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 12 }}
            paint={{ "text-color": "#52514e", "text-halo-color": "#fcfcfb", "text-halo-width": 1.2 }}
          />
        </Source>

        <Source id="points" type="geojson" data={pointData}>
          {/* A dark ring around estimates to use with care, under the point so the ring shows as a halo. */}
          <Layer
            id="point-flag"
            type="circle"
            filter={["==", ["get", "highCv"], true]}
            paint={{ "circle-radius": 11, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": INK, "circle-stroke-width": 2 }}
          />
          <Layer
            id="points"
            type="circle"
            paint={{
              "circle-radius": 7,
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
            }}
          />
        </Source>

        {/* Value labels on top of everything. Labels that would overlap are hidden and show up when zooming in. */}
        <Source id="labels" type="geojson" data={labelData}>
          <Layer
            id="value-label"
            type="symbol"
            layout={{
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Bold"],
              "text-size": isDepartments ? 11 : 12,
              ...(isPoints
                ? { "text-variable-anchor": ["left", "right", "top", "bottom"], "text-radial-offset": 0.9 }
                : { "text-anchor": "center" }),
            }}
            paint={{ "text-color": INK, "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
          />
        </Source>
      </MapGL>

      {tip && place ? (
        <div
          className={
            tip.narrow
              ? "pointer-events-none absolute top-2 left-2 z-10 max-w-[calc(100%-3.5rem)]"
              : "pointer-events-none absolute z-10 w-max max-w-64"
          }
          style={
            tip.narrow
              ? undefined
              : {
                  left: tip.x,
                  top: tip.y,
                  transform: `translate(${tip.flipX ? "calc(-100% - 12px)" : "12px"}, ${tip.flipY ? "calc(-100% - 12px)" : "12px"})`,
                }
          }
        >
          <PlaceTooltip view={view} place={place} areaName={areaName} />
        </div>
      ) : null}
    </div>
  );
}
