'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import InvestigationPanel, { type HotspotProperties } from './InvestigationPanel';

// ─── Fallback demo data ───────────────────────────────────────────────────────

const FALLBACK_FIRES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [73.00, 19.11] },
      properties: {
        id: 1,
        classification: 'Industrial Fire/Flare',
        subclass: 'Gas Flare',
        temperature: 1200.5,
        frp: 45.2,
        confidence: 'High',
        classification_confidence: 0.99,
        distance_to_industrial: 0,
        alert_status: 'new',
        satellite: 'DEMO',
        observed_at: '2024-01-15T06:30:00Z',
        explanation: 'Hotspot is persistent and located very close to an industrial facility, strongly indicating an industrial flare or fire.',
        evidence: [
          'Distance to industrial zone is 0m (<= 1000m).',
          'Hotspot is persistent (observed for 7 days, 12 times).',
          "Located within 1km of industrial zone of type 'Refinery'.",
        ],
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [73.06, 19.04] },
      properties: {
        id: 2,
        classification: 'Natural/Vegetation',
        subclass: 'Forest Fire',
        temperature: 600.0,
        frp: 12.5,
        confidence: 'Nominal',
        classification_confidence: 0.85,
        distance_to_industrial: 8000,
        alert_status: 'new',
        satellite: 'DEMO',
        observed_at: '2024-01-15T06:30:00Z',
        explanation: 'Hotspot is far from industrial areas and lacks long-term persistence, consistent with a natural vegetation fire.',
        evidence: [
          'Distance to industrial zone is 8000m (> 1000m).',
          'Not persistent and located far (>2km) from known industrial infrastructure.',
        ],
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [73.025, 19.09] },
      properties: {
        id: 3,
        classification: 'Unknown/Uncertain',
        subclass: 'Unknown',
        temperature: 400.0,
        frp: 5.0,
        confidence: 'Low',
        classification_confidence: 0.50,
        distance_to_industrial: 2000,
        alert_status: 'new',
        satellite: 'DEMO',
        observed_at: '2024-01-15T06:30:00Z',
        explanation: 'Evidence is conflicting, borderline, or insufficient to confidently classify as natural or industrial.',
        evidence: [
          'Distance to industrial zone is 2000m (> 1000m).',
          'Located in the buffer zone (1km - 2km) from industrial areas.',
        ],
      },
    },
  ],
};

const FALLBACK_ZONES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[72.99, 19.12], [73.01, 19.12], [73.01, 19.10], [72.99, 19.10], [72.99, 19.12]]],
      },
      properties: {
        id: 1,
        name: 'Thane-Belapur Petrochemical Plant (DEMO DATA)',
        facility_type: 'Refinery',
      },
    },
  ],
};

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

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedProps, setSelectedProps] = useState<HotspotProperties | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [currentDateIdx, setCurrentDateIdx] = useState<number>(0);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setSelectedProps(null);
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

      // CartoDB Dark Matter — free, no token
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        }
      ).addTo(map);

      let firesData = FALLBACK_FIRES;
      let zonesData = FALLBACK_ZONES;

      try {
        const [firesRes, zonesRes] = await Promise.all([
          fetch('http://localhost:8000/api/v1/fires').catch(() => null),
          fetch('http://localhost:8000/api/v1/industrial-zones').catch(() => null),
        ]);
        if (firesRes?.ok) firesData = await firesRes.json();
        if (zonesRes?.ok) zonesData = await zonesRes.json();
      } catch (err) {
        console.warn('Backend unavailable, using fallback data', err);
      }

      if (cancelled) return;

      // Industrial zone polygons
      zonesData.features.forEach((feature) => {
        if (feature.geometry.type === 'Polygon') {
          const coords = (feature.geometry as { type: string; coordinates: number[][][] }).coordinates[0];
          const latlngs: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);
          L.polygon(latlngs, {
            color: '#1e293b',
            fillColor: '#475569',
            fillOpacity: 0.5,
            weight: 2,
          })
            .addTo(map)
            .bindTooltip(feature.properties?.name || 'Industrial Zone');
        }
      });

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueDates = Array.from(new Set(firesData.features.map((f: any) => {
        const obs = f.properties?.observed_at;
        return obs ? obs.substring(0, 10) : new Date().toISOString().substring(0, 10);
      }))).sort();

      if (!cancelled) {
        setDates(uniqueDates);
        setCurrentDateIdx(uniqueDates.length - 1);
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
      
      // Date filter logic
      if (show && activeDateStr) {
        const obs = properties.observed_at ? properties.observed_at.substring(0, 10) : '';
        if (obs > activeDateStr) show = false;
      }
      
      if (show) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!mapRef.current.hasLayer(marker)) marker.addTo(mapRef.current as any);
      } else {
        marker.remove();
      }
    });
  }, [filter, currentDateIdx, dates]);

  // ── 1 km halo ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    haloRef.current?.remove();
    haloRef.current = null;

    if (selectedId !== null) {
      const entry = markersRef.current.find((m) => m.id === selectedId);
      if (entry) {
        (async () => {
          const L = await import('leaflet');
          haloRef.current = L.circle([entry.lat, entry.lng], {
            radius: 1000,
            color: '#ffffff',
            fillColor: '#ffffff',
            fillOpacity: 0.06,
            weight: 2,
            dashArray: '6 4',
          }).addTo(mapRef.current);
        })().catch(console.error);
      }
    }
  }, [selectedId]);

  return (
    <div className="absolute inset-0 bg-zinc-950">
      {/* Map loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 text-white backdrop-blur-sm">
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-500" />
          <p className="text-lg font-medium">Loading Map Data…</p>
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

          {/* Legend */}
          <div className="bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 shadow-lg backdrop-blur text-sm text-zinc-200 w-52">
            <h4 className="font-bold mb-2 text-white text-xs uppercase tracking-wide">Legend</h4>
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
      />
    </div>
  );
}
