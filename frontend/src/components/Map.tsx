'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

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

const getClassColor = (cls: string) => {
  if (cls === 'Industrial Fire/Flare') return '#ef4444';
  if (cls === 'Gas Flare') return '#f97316';
  if (cls === 'Natural/Vegetation') return '#22c55e';
  return '#eab308';
};

const getLabel = (cls: string) => {
  if (cls === 'Industrial Fire/Flare') return 'IND';
  if (cls === 'Gas Flare') return 'FLR';
  if (cls === 'Natural/Vegetation') return 'NAT';
  return '?';
};

interface MarkerEntry {
  id: number;
  lat: number;
  lng: number;
  classification: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marker: any;
}

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

  useEffect(() => {
    if (!mapContainer.current) return;

    let cancelled = false;

    const initMap = async () => {
      if (cancelled || !mapContainer.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mapContainer.current as any)._leaflet_id) return;

      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      // Re-check after every await — StrictMode may have unmounted in between
      if (cancelled || !mapContainer.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((mapContainer.current as any)._leaflet_id) return;

      const map = L.map(mapContainer.current, { center: [19.1, 73.0], zoom: 10 });
      if (cancelled) { map.remove(); return; }
      mapRef.current = map;

      // Dark CartoDB tiles — free, no token required
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
        const p = feature.properties || {};
        const color = getClassColor(p.classification || '');
        const label = getLabel(p.classification || '');

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:28px; height:28px;
            background:${color};
            border:2px solid #000;
            border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            font-size:9px; font-weight:bold; color:#fff;
            font-family:sans-serif;
            box-shadow:0 0 4px rgba(0,0,0,0.8);
          ">${label}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);

        marker.bindPopup(`
          <div style="min-width:200px;font-family:sans-serif;padding:4px;">
            <h3 style="font-weight:bold;font-size:1rem;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:8px;">
              ${p.classification || 'Unknown'}
            </h3>
            <p><strong>Confidence:</strong> ${p.confidence} (${p.classification_confidence ? Math.round(p.classification_confidence * 100) : 0}%)</p>
            <p><strong>FRP:</strong> ${p.frp} MW</p>
            <p><strong>Temp:</strong> ${p.temperature}K</p>
            <p><strong>Dist to Industrial:</strong> ${p.distance_to_industrial ? Math.round(p.distance_to_industrial) + ' m' : 'N/A'}</p>
          </div>
        `);

        marker.on('click', () => setSelectedId(p.id));
        marker.on('popupclose', () => setSelectedId(null));

        markersRef.current.push({ id: p.id, lat, lng, classification: p.classification || '', marker });
      });

      if (!cancelled) setLoading(false);
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




  // Filter markers
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(({ marker, classification }) => {
      let show = filter === 'All';
      if (!show) {
        if (filter === 'Industrial' && (classification === 'Industrial Fire/Flare' || classification === 'Gas Flare')) show = true;
        if (filter === 'Natural' && classification === 'Natural/Vegetation') show = true;
        if (filter === 'Unknown' && classification === 'Unknown/Uncertain') show = true;
      }
      if (show) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!mapRef.current.hasLayer(marker)) marker.addTo(mapRef.current as any);
      } else {
        marker.remove();
      }
    });
  }, [filter]);

  // 1km halo on selected hotspot
  useEffect(() => {
    if (!mapRef.current) return;
    haloRef.current?.remove();
    haloRef.current = null;

    if (selectedId !== null) {
      const entry = markersRef.current.find((m) => m.id === selectedId);
      if (entry) {
        const initHalo = async () => {
          const L = await import('leaflet');
          haloRef.current = L.circle([entry.lat, entry.lng], {
            radius: 1000,
            color: '#ffffff',
            fillColor: '#ffffff',
            fillOpacity: 0.08,
            weight: 2,
            dashArray: '6 4',
          }).addTo(mapRef.current);
        };
        initHalo().catch(console.error);
      }
    }
  }, [selectedId]);

  return (
    <div className="relative h-full w-full min-h-[600px] bg-zinc-950">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 text-white backdrop-blur-sm">
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-500" />
          <p className="text-lg font-medium">Loading Map Data...</p>
        </div>
      )}

      <div ref={mapContainer} className="absolute inset-0" style={{ zIndex: 0 }} />

      {!loading && (
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-4">
          {/* Filters */}
          <div className="bg-zinc-900/90 border border-zinc-700 rounded-lg p-2 shadow-lg backdrop-blur text-sm flex gap-2">
            {['All', 'Industrial', 'Natural', 'Unknown'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md transition-colors ${
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
          <div className="bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 shadow-lg backdrop-blur text-sm text-zinc-200 w-48">
            <h4 className="font-bold mb-2 text-white">Legend</h4>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-red-500 border border-black shrink-0 flex items-center justify-center text-[9px] font-bold text-white">IND</div><span>Industrial Fire/Flare</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-orange-500 border border-black shrink-0 flex items-center justify-center text-[9px] font-bold text-white">FLR</div><span>Gas Flare</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-green-500 border border-black shrink-0 flex items-center justify-center text-[9px] font-bold text-white">NAT</div><span>Natural/Vegetation</span></div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-yellow-500 border border-black shrink-0 flex items-center justify-center text-[9px] font-bold text-white">?</div><span>Unknown</span></div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-700">
                <div className="w-5 h-4 bg-slate-600 opacity-50 border-2 border-slate-800 shrink-0"></div>
                <span>Industrial Zone</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-white border-dashed bg-white/10 shrink-0"></div>
                <span>1km Halo (click to select)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
