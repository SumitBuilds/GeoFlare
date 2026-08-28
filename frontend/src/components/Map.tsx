'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import InvestigationPanel, { type HotspotProperties, type GeographicAsset } from './InvestigationPanel';

// ─── Fallback demo data ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FALLBACK_FIRES: { type: string; features: any[] } = {
  type: 'FeatureCollection',
  features: [],
};

// Nearby industrial zones are fetched per-hotspot, not loaded globally.

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getClassColor = (cls: string) => {
  if (cls === 'Industrial Fire/Flare' || cls === 'industrial_fire_flare') return '#ef4444';
  if (cls === 'Gas Flare' || cls === 'gas_flare') return '#f97316';
  if (cls === 'Natural/Vegetation' || cls === 'natural_vegetation') return '#22c55e';
  return '#eab308';
};

const getLabel = (cls: string) => {
  if (cls === 'Industrial Fire/Flare' || cls === 'industrial_fire_flare') return 'IND';
  if (cls === 'Gas Flare' || cls === 'gas_flare') return 'FLR';
  if (cls === 'Natural/Vegetation' || cls === 'natural_vegetation') return 'NAT';
  return '?';
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkerEntry {
  id: number;
  lat: number;
  lng: number;
  classification: string;
  properties: HotspotProperties;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marker: any;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapComponent() {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const haloRef = useRef<any>(null);
  const markersRef = useRef<MarkerEntry[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assetsLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nearbyZonesLayerRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [filterCorroboration, setFilterCorroboration] = useState('All');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedProps, setSelectedProps] = useState<HotspotProperties | null>(null);
  const [showWind, setShowWind] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [showImpactRadius, setShowImpactRadius] = useState(true);
  const [showDownwindOnly, setShowDownwindOnly] = useState(false);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [impactData, setImpactData] = useState<any | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [currentDateIdx, setCurrentDateIdx] = useState<number>(0);
  const [hasNoData, setHasNoData] = useState(false);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setSelectedProps(null);
    setShowWind(false);
    setShowAssets(false);
    setShowImpactRadius(true);
    setShowDownwindOnly(false);
    setImpactData(null);
    setImpactError(null);
    setSelectedAssetId(null);
    // Clear nearby zones when panel closes
    nearbyZonesLayerRef.current?.remove();
    nearbyZonesLayerRef.current = null;
  }, []);

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return;
    let cancelled = false;

    const initMap = async () => {
      if (cancelled || !mapContainer.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mapContainer.current as any)._leaflet_id) return;

      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !mapContainer.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mapContainer.current as any)._leaflet_id) return;

      const map = L.map(mapContainer.current, { center: [19.1, 73.0], zoom: 10 });
      if (cancelled) { map.remove(); return; }
      mapRef.current = map;

      // Esri Dark Gray Base — free, no token needed for non-commercial
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution:
            'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 19,
        }
      ).addTo(map);

      let firesData = FALLBACK_FIRES;

      try {
        const firesRes = await fetch('http://localhost:8000/api/v1/fires').catch(() => null);
        if (firesRes?.ok) firesData = await firesRes.json();
      } catch (err) {
        console.warn('Backend unavailable, using fallback data', err);
      }

      if (cancelled) return;

      // Industrial zones are NOT loaded globally.
      // They are fetched per-hotspot when the user selects one (see nearbyZones useEffect below).

      // Hotspot markers
      firesData.features.forEach((feature) => {
        const [lng, lat] = (feature.geometry as { type: string; coordinates: number[] }).coordinates;
        const p = (feature.properties || {}) as HotspotProperties;
        const color = getClassColor(p.classification || '');
        const label = getLabel(p.classification || '');

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:30px; height:30px;
            background:${color};
            border:2px solid #000;
            border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            font-size:9px; font-weight:bold; color:#fff;
            font-family:sans-serif;
            box-shadow:0 0 6px rgba(0,0,0,0.9);
            cursor:pointer;
          ">${label}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedId(p.id ?? null);
          setSelectedProps(p);
        });

        markersRef.current.push({
          id: p.id ?? 0,
          lat,
          lng,
          classification: p.classification || '',
          properties: p,
          marker,
        });
      });

      let minDateStr = "9999-99-99";
      let maxDateStr = "0000-00-00";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      firesData.features.forEach((f: any) => {
        const start = f.properties?.first_observed_at?.substring(0, 10);
        const end = f.properties?.observed_at?.substring(0, 10);
        if (start && start < minDateStr) minDateStr = start;
        if (end && end > maxDateStr) maxDateStr = end;
      });
      const uniqueDates: string[] = [];
      if (minDateStr <= maxDateStr && maxDateStr !== "0000-00-00") {
        const curr = new Date(minDateStr);
        const last = new Date(maxDateStr);
        while (curr <= last) {
          uniqueDates.push(curr.toISOString().substring(0, 10));
          curr.setDate(curr.getDate() + 1);
        }
      }

      if (!cancelled) {
        if (uniqueDates.length > 0) {
          setDates(uniqueDates);
          setCurrentDateIdx(uniqueDates.length - 1);
          setHasNoData(false);
        } else {
          setHasNoData(true);
        }
        setLoading(false);
      }
    };

    initMap().catch(console.error);

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
      haloRef.current = null;
      nearbyZonesLayerRef.current = null;
    };

  }, []);

  // ── Filter markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const activeDateStr = dates[currentDateIdx] || '';
    
    markersRef.current.forEach(({ marker, classification, properties }) => {
      let show = filter === 'All';
      if (!show) {
        const n = classification;
        if (filter === 'Industrial' && (n === 'Industrial Fire/Flare' || n === 'industrial_fire_flare' || n === 'Gas Flare' || n === 'gas_flare')) show = true;
        if (filter === 'Natural' && (n === 'Natural/Vegetation' || n === 'natural_vegetation')) show = true;
        if (filter === 'Unknown' && (n === 'Unknown/Uncertain' || n === 'unknown_uncertain')) show = true;
      }
      
      if (show && filterCorroboration !== 'All') {
        const corr = properties.corroboration || 'Weak';
        if (filterCorroboration !== corr) show = false;
      }
      
      // Date filter logic (show if activeDateStr falls between first_observed_at and observed_at)
      if (show && activeDateStr) {
        const start = properties.first_observed_at ? String(properties.first_observed_at).substring(0, 10) : '';
        const end = properties.observed_at ? String(properties.observed_at).substring(0, 10) : '';
        if (start && activeDateStr < start) show = false;
        if (end && activeDateStr > end) show = false;
      }
      
      if (show) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!mapRef.current.hasLayer(marker)) marker.addTo(mapRef.current as any);
      } else {
        marker.remove();
      }
    });
  }, [filter, filterCorroboration, currentDateIdx, dates]);

  // ── Impact Radius Halo ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    haloRef.current?.remove();
    haloRef.current = null;

    if (selectedId !== null && showImpactRadius) {
      const entry = markersRef.current.find((m) => m.id === selectedId);
      if (entry) {
        (async () => {
          const L = await import('leaflet');
          const radius = impactData?.impact_radius_m || 1000;
          haloRef.current = L.circle([entry.lat, entry.lng], {
            radius: radius,
            color: '#ffffff',
            fillColor: '#ffffff',
            fillOpacity: 0.06,
            weight: 2,
            dashArray: '6 4',
          }).addTo(mapRef.current);
        })().catch(console.error);
      }
    }
  }, [selectedId, showImpactRadius, impactData]);

  // ── Nearby Industrial Zones (per selected hotspot) ────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    // Always clear previous zones first
    nearbyZonesLayerRef.current?.remove();
    nearbyZonesLayerRef.current = null;

    if (selectedId === null) return;

    const entry = markersRef.current.find((m) => m.id === selectedId);
    if (!entry) return;

    (async () => {
      try {
        const L = await import('leaflet');
        const res = await fetch(
          `http://localhost:8000/api/v1/industrial-zones/nearby?lat=${entry.lat}&lng=${entry.lng}&radius_m=5000`
        );
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: { type: string; features: any[] } = await res.json();
        if (!data.features.length) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layers: any[] = [];
        data.features.forEach((feature) => {
          if (feature.geometry?.type === 'Polygon') {
            const coords = (feature.geometry.coordinates as number[][][])[0];
            const latlngs: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);
            const poly = L.polygon(latlngs, {
              color: '#334155',       // slate-700
              fillColor: '#475569',   // slate-600
              fillOpacity: 0.45,
              weight: 2,
              dashArray: '4 3',
            });
            const distLabel = feature.properties?.distance_m != null
              ? ` — ${(feature.properties.distance_m / 1000).toFixed(1)} km away`
              : '';
            poly.bindTooltip(
              `<b>${feature.properties?.name || 'Industrial Zone'}</b><br/><span style="font-size:11px;color:#94a3b8">${feature.properties?.facility_type || ''}${distLabel}</span>`,
              { sticky: true }
            );
            layers.push(poly);
          }
        });

        if (layers.length && mapRef.current) {
          nearbyZonesLayerRef.current = L.layerGroup(layers).addTo(mapRef.current);
        }
      } catch (err) {
        console.warn('Could not load nearby industrial zones', err);
      }
    })();
  }, [selectedId]);

  // ── Wind & Corridor ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current) return;
    windLayerRef.current?.remove();
    windLayerRef.current = null;

    if (showWind && selectedProps?.weather && selectedId !== null) {
      const entry = markersRef.current.find((m) => m.id === selectedId);
      if (entry) {
        (async () => {
          const L = await import('leaflet');
          const weather = selectedProps.weather;
          if (!weather) return;

          const getDestination = (lat: number, lng: number, distanceKm: number, bearingDeg: number): [number, number] => {
            const R = 6371;
            const d = distanceKm;
            const lat1 = lat * Math.PI / 180;
            const lng1 = lng * Math.PI / 180;
            const brng = bearingDeg * Math.PI / 180;
            const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng));
            const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1), Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2));
            return [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI];
          };

          const downwind = (weather.wind_direction + 180) % 360;
          const lengthKm = Math.min(50, Math.max(5, weather.wind_speed * 3)); 
          
          // Polygon (Corridor)
          const pLeft = getDestination(entry.lat, entry.lng, lengthKm, downwind - 15);
          const pRight = getDestination(entry.lat, entry.lng, lengthKm, downwind + 15);
          const corridor = L.polygon([[entry.lat, entry.lng], pLeft, pRight], {
            color: '#a1a1aa', // zinc-400
            fillColor: '#71717a', // zinc-500
            fillOpacity: 0.3,
            weight: 1,
            dashArray: '4 4'
          });
          corridor.bindTooltip("Indicative smoke corridor — not a certified dispersion model.", { sticky: true });

          // Arrow shaft
          const shaftEnd = getDestination(entry.lat, entry.lng, lengthKm * 0.4, downwind);
          const arrowShaft = L.polyline([[entry.lat, entry.lng], shaftEnd], {
            color: '#3b82f6', // blue-500
            weight: 3
          });

          // Arrow head
          const headLeft = getDestination(shaftEnd[0], shaftEnd[1], lengthKm * 0.05, downwind - 135);
          const headRight = getDestination(shaftEnd[0], shaftEnd[1], lengthKm * 0.05, downwind + 135);
          const arrowHead = L.polygon([shaftEnd, headLeft, headRight], {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 1,
            weight: 1
          });
          
          arrowShaft.bindTooltip(`Wind blowing toward ${Math.round(downwind)}° at ${weather.wind_speed} ${weather.units}`, { permanent: false });
          
          windLayerRef.current = L.layerGroup([corridor, arrowShaft, arrowHead]).addTo(mapRef.current);
        })().catch(console.error);
      }
    }
  }, [showWind, selectedProps, selectedId]);

  // ── Impact Data Fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!showAssets || selectedId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImpactData(null);
      setImpactError(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      setImpactLoading(true);
      setImpactError(null);
      try {
        const res = await fetch(`http://localhost:8000/api/v1/fires/${selectedId}/impact`, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch impact data');
        const data = await res.json();
        setImpactData(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error(err);
          setImpactError('Unable to load nearby assets.');
        }
      } finally {
        setImpactLoading(false);
      }
    })();
    return () => controller.abort();
  }, [showAssets, selectedId]);

  // ── Render Nearby Assets ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    assetsLayerRef.current?.remove();
    assetsLayerRef.current = null;

    if (showAssets && impactData) {
      (async () => {
        const L = await import('leaflet');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layers: any[] = [];

        (impactData.assets as GeographicAsset[]).forEach((asset) => {
          if (showDownwindOnly && !asset.downwind) return;
          const isSelected = asset.id === selectedAssetId;
          
          let iconHtml = '';
          const type = asset.asset_type;
          const bg = asset.downwind ? '#ef4444' : '#6b7280'; // red if downwind, gray if not
          const border = isSelected ? 'border: 2px solid #a855f7;' : 'border: 2px solid #000;';
          
          // Emojis based on asset type
          let emoji = '🏢';
          if (type === 'school') emoji = '🏫';
          else if (type === 'hospital' || type === 'clinic') emoji = '🏥';
          else if (type === 'residential') emoji = '🏠';
          else if (type === 'road') emoji = '🛣️';
          else if (type === 'railway') emoji = '🛤️';
          else if (type === 'power') emoji = '⚡';
          else if (type === 'fuel') emoji = '⛽';
          else if (type === 'chemical') emoji = '🏭';
          else if (type === 'fire_station') emoji = '🚒';
          else if (type === 'police') emoji = '🚓';
          
          iconHtml = `<div style="
            width:24px; height:24px;
            background:${bg};
            ${border}
            border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            font-size:12px;
            box-shadow:${isSelected ? '0 0 10px #a855f7' : '0 0 4px rgba(0,0,0,0.8)'};
            ${asset.inside_impact_radius && !isSelected ? 'box-shadow: 0 0 8px #ef4444;' : ''}
          ">${emoji}</div>`;

          const icon = L.divIcon({
            className: '',
            html: iconHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const marker = L.marker([asset.latitude, asset.longitude], { icon });
          marker.bindPopup(`
            <div style="font-family:sans-serif;font-size:12px;color:#333;">
              <strong style="font-size:14px">${asset.name}</strong><br/>
              <span style="text-transform:uppercase;color:#666;font-size:10px">${asset.asset_type}</span><br/>
              Distance: <b>${asset.distance_m}m</b><br/>
              ${asset.inside_impact_radius ? '<span style="color:red;font-weight:bold">Inside Impact Radius</span><br/>' : ''}
              ${asset.downwind ? '<span style="color:red;font-weight:bold">Downwind</span><br/>' : ''}
              <i style="font-size:9px;color:#888">${asset.source} ${asset.is_demo ? '(Demo)' : ''}</i>
            </div>
          `);
          
          // Clicking marker on map selects it in panel
          marker.on('click', () => {
             setSelectedAssetId(String(asset.id));
          });
          
          layers.push(marker);
        });

        assetsLayerRef.current = L.layerGroup(layers).addTo(mapRef.current);
      })();
    }
  }, [showAssets, impactData, selectedAssetId, showDownwindOnly]);

  return (
    <div className="absolute inset-0 bg-zinc-950">
      {/* Map loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 text-white backdrop-blur-sm">
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-500" />
          <p className="text-lg font-medium">Loading Map Data…</p>
        </div>
      )}

      {/* No Data Overlay */}
      {!loading && hasNoData && (
        <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-zinc-900/90 border border-yellow-500/50 rounded-xl p-6 shadow-xl backdrop-blur flex flex-col items-center max-w-sm text-center">
            <span className="text-4xl mb-3">🛰️</span>
            <h3 className="text-lg font-semibold text-white mb-2">No Data Available</h3>
            <p className="text-sm text-zinc-400">
              No NASA FIRMS observations available for this selection. Try refreshing live data.
            </p>
          </div>
        </div>
      )}

      {/* Leaflet container */}
      <div ref={mapContainer} className="absolute inset-0" style={{ zIndex: 0 }} />

      {/* Controls (top-left) */}
      {!loading && (
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-4">
          {/* Filters */}
          <div className="bg-zinc-900/90 border border-zinc-700 rounded-lg p-2 shadow-lg backdrop-blur text-sm flex gap-2 flex-wrap">
            {['All', 'Industrial', 'Natural', 'Unknown'].map((f) => (
              <button
                key={f}
                id={`filter-btn-${f.toLowerCase()}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-3 py-1 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                  filter === f
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="bg-zinc-900/90 border border-zinc-700 rounded-lg p-2 shadow-lg backdrop-blur flex flex-col gap-2">
            <h4 className="font-bold text-white text-[10px] uppercase tracking-wide">Corroboration Level</h4>
            <div className="text-sm flex gap-2 flex-wrap">
              {['All', 'Strong', 'Partial', 'Weak'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterCorroboration(f)}
                  aria-pressed={filterCorroboration === f}
                  className={`px-3 py-1 text-xs rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                    filterCorroboration === f
                      ? (f === 'Strong' ? 'bg-green-600 text-white font-medium' : f === 'Partial' ? 'bg-orange-600 text-white font-medium' : f === 'Weak' ? 'bg-red-600 text-white font-medium' : 'bg-blue-600 text-white font-medium')
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Impact/Asset Filters (only shown if assets are active) */}
          {showAssets && (
             <div className="bg-zinc-900/90 border border-zinc-700 rounded-lg p-2 shadow-lg backdrop-blur text-sm flex flex-col gap-2">
                <h4 className="font-bold text-white text-[10px] uppercase tracking-wide">Impact Controls</h4>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 hover:text-white">
                  <input type="checkbox" checked={showImpactRadius} onChange={(e) => setShowImpactRadius(e.target.checked)} className="rounded bg-zinc-800 border-zinc-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-zinc-900" />
                  Show Impact Radius
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 hover:text-white">
                  <input type="checkbox" checked={showDownwindOnly} onChange={(e) => setShowDownwindOnly(e.target.checked)} className="rounded bg-zinc-800 border-zinc-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-zinc-900" />
                  Only Show Downwind Assets
                </label>
             </div>
          )}

          {/* Legend */}
          <div className="bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 shadow-lg backdrop-blur text-sm text-zinc-200 w-52 max-h-[40vh] overflow-y-auto custom-scrollbar">
            <h4 className="font-bold mb-2 text-white text-[10px] uppercase tracking-wide">Legend</h4>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-red-500 border border-black shrink-0 flex items-center justify-center text-[9px] font-bold text-white">IND</div><span className="text-xs">Industrial Fire/Flare</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-orange-500 border border-black shrink-0 flex items-center justify-center text-[9px] font-bold text-white">FLR</div><span className="text-xs">Gas Flare</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-green-500 border border-black shrink-0 flex items-center justify-center text-[9px] font-bold text-white">NAT</div><span className="text-xs">Natural/Vegetation</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-yellow-500 border border-black shrink-0 flex items-center justify-center text-[9px] font-bold text-white">?</div><span className="text-xs">Unknown/Uncertain</span></div>
              
              <div className="flex items-center gap-2 mt-1 pt-1 border-t border-zinc-700">
                <div className="w-5 h-4 bg-slate-600 opacity-50 border-2 border-slate-800 shrink-0"></div>
                <span className="text-xs">Industrial Zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-white border-dashed bg-white/10 shrink-0"></div>
                <span className="text-xs">1 km Halo (selected)</span>
              </div>

              {showAssets && (
                <>
                  <div className="flex items-center gap-2 mt-1 pt-1 border-t border-zinc-700">
                    <div className="w-5 h-5 rounded-full bg-gray-500 border-2 border-black shrink-0 flex items-center justify-center text-[10px]">🏢</div>
                    <span className="text-xs">Nearby Asset</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-black shrink-0 flex items-center justify-center text-[10px]">🏢</div>
                    <span className="text-xs">Downwind Asset</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border border-red-500 shrink-0 shadow-[0_0_8px_#ef4444]"></div>
                    <span className="text-xs">Inside Impact Radius</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Clear selection hint */}
          {selectedId !== null && (
            <button
              onClick={handleClose}
              id="clear-selection-btn"
              className="bg-zinc-800/90 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors backdrop-blur focus:outline-none focus:ring-2 focus:ring-zinc-500 text-left"
            >
              ✕ Clear selection (Esc)
            </button>
          )}
        </div>
      )}

      {/* Timeline Slider (bottom-center) */}
      {!loading && dates.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-lg px-4">
          <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl p-4 shadow-xl backdrop-blur flex flex-col gap-2 pointer-events-auto">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Timeline Playback</h4>
              <span className="text-sm font-bold text-white bg-zinc-800 px-2 py-0.5 rounded">{dates[currentDateIdx]}</span>
            </div>
            <input 
              type="range" 
              min={0} 
              max={dates.length - 1} 
              value={currentDateIdx}
              onChange={(e) => setCurrentDateIdx(Number(e.target.value))}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500 outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-medium px-1">
              <span>{dates[0]}</span>
              <span>{dates[dates.length - 1]}</span>
            </div>
          </div>
        </div>
      )}

      {/* Investigation Panel (right-side drawer) */}
      <InvestigationPanel
        selectedId={selectedId}
        fallbackProps={selectedProps}
        onClose={handleClose}
        showWind={showWind}
        onToggleWind={setShowWind}
        showAssets={showAssets}
        onToggleAssets={setShowAssets}
        impactData={impactData}
        impactLoading={impactLoading}
        impactError={impactError}
        selectedAssetId={selectedAssetId}
        onAssetClick={(asset: GeographicAsset) => setSelectedAssetId(String(asset.id))}
      />
    </div>
  );
}
