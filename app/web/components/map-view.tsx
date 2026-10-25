"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { fmtBearing } from "@/lib/survey";
import { legsLatLon, type LatLon } from "@/lib/mapgeo";
import type { Call, Closure } from "@/lib/types";

const TILES = {
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Imagery © Esri, Maxar, Earthstar Geographics", max: 19 },
  street: { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap contributors", max: 19 },
} as const;
export type Basemap = keyof typeof TILES;

const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The parcel on a real map. Calls are drawn as polylines and arcs in true bearings; clicking one selects its clause. */
export function MapView({ calls, result, origin, basemap, selected, onSelect }: { calls: Call[]; result: Closure; origin: LatLon; basemap: Basemap; selected: number | null; onSelect: (id: number | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tile = useRef<L.TileLayer | null>(null);
  const legs = useRef<L.Polyline[]>([]);
  const layer = useRef<L.LayerGroup | null>(null);
  const sel = useRef(onSelect);
  sel.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, zoomSnap: 0.25 });
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    tile.current?.remove();
    const t = TILES[basemap];
    tile.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: t.max, maxNativeZoom: 19 }).addTo(m);
    tile.current.bringToBack();
  }, [basemap]);

  useEffect(() => {
    const m = map.current, g = layer.current; if (!m || !g) return;
    g.clearLayers();
    const geo = legsLatLon(calls, result, origin);
    const ok = result.closed;
    legs.current = geo.map((pts, i) => {
      const c = calls[i];
      const halo = L.polyline(pts, { color: "#00292c", weight: 8, opacity: 0.55, interactive: false }).addTo(g);
      void halo;
      const line = L.polyline(pts, { color: "#37d6e0", weight: 3.5, opacity: 1, lineCap: "round" }).addTo(g);
      line.bindTooltip(`${c.id}. ${fmtBearing(c)}  ${c.dist} ${c.unit}${c.type === "curve" ? `  R${c.radius}` : ""}`, { sticky: true, direction: "top", className: "map-tip" });
      line.on("click", (e) => { L.DomEvent.stopPropagation(e); sel.current(c.id); });
      return line;
    });
    const fillPts = geo.flatMap((p, i) => (i ? p.slice(1) : p));
    L.polygon(fillPts, { stroke: false, fillColor: ok ? "#0fa4af" : "#c0563a", fillOpacity: 0.2, interactive: false }).addTo(g);
    result.points.slice(0, ok ? -1 : undefined).forEach((p, i) => {
      const ll = geo[Math.min(i, geo.length - 1)][i < geo.length ? 0 : geo[geo.length - 1].length - 1];
      L.marker(ll, { interactive: false, icon: L.divIcon({ className: "", iconSize: i === 0 ? [34, 22] : [22, 22], iconAnchor: i === 0 ? [17, 11] : [11, 11], html: `<div class="map-pt${i === 0 ? " pob" : ""}">${i === 0 ? "POB" : LABELS[(i - 1) % 26]}</div>` }) }).addTo(g);
    });
    m.fitBounds(L.latLngBounds(fillPts), { padding: [48, 48], maxZoom: 18 });
  }, [calls, result, origin]);

  useEffect(() => {
    legs.current.forEach((l, i) => { const on = calls[i]?.id === selected; l.setStyle({ color: on ? "#ffb199" : "#37d6e0", weight: on ? 6 : 3.5 }); if (on) l.bringToFront(); });
  }, [selected, calls, result, origin]);

  return <div ref={el} className="h-[26rem] w-full rounded-lg sm:h-[32rem]" role="application" aria-label="Parcel on a map" />;
}
