'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  XCircle,
  ThumbsDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeatherContext {
  source: string;
  observed_at: string;
  wind_speed: number;
  wind_direction: number;
  units: string;
  is_demo: boolean;
  data_quality_flags?: string;
}

export interface CorroborationSource {
  source_name: string;
  status: string;
  timestamp?: string;
  confidence?: string;
  data_quality?: string;
}

export interface HotspotProperties {
  id?: number;
  classification?: string;
  subclass?: string;
  /** float 0-1 (backend) or string like "high" (fallback) */
  classification_confidence?: number | string;
  alert_status?: string;
  observed_at?: string;
  processed_at?: string;
  satellite?: string;
  instrument?: string;
  temperature?: number;
  brightness_temperature?: number;
  frp?: number;
  /** "High" | "Nominal" | "Low" (FIRMS/backend) */
  confidence?: string;
  source_confidence?: string;
  distance_to_industrial?: number;
  days_observed?: number;
  observation_count?: number;
  persistence_confidence?: string;
  approx_movement?: number;
  severity?: string;
  risk_score?: number;
  score_components?: Record<string, number>;
  evidence?: string[];
  explanation?: string;
  nearest_facility?: string;
  facility_type?: string;
  nearest_facility_type?: string;
  source?: string;
  source_event_id?: string;
  acq_time?: string;
  data_quality?: string;
  weather?: WeatherContext;
  corroboration?: string;
  corroboration_summary?: CorroborationSource[];
  observations_timeline?: Record<string, unknown>[];
  data_freshness_mins?: number;
  raw_metadata?: unknown;
  [key: string]: unknown;
}

export interface GeographicAsset {
  id: string;
  name: string;
  asset_type: string;
  latitude: number;
  longitude: number;
  distance_m: number;
  inside_impact_radius: boolean;
  downwind: boolean;
  source: string;
  is_demo: boolean;
}

export interface ImpactContext {
  event_id: string;
  assets: GeographicAsset[];
  impact_radius_m: number;
  source_status: string;
  is_demo: boolean;
  data_quality_flags: string[];
}

interface InvestigationPanelProps {
  selectedId: number | null;
  /** Properties already stored in the map marker — used as fallback while fetching */
  fallbackProps: HotspotProperties | null;
  onClose: () => void;
  showWind?: boolean;
  onToggleWind?: (show: boolean) => void;
  showAssets?: boolean;
  onToggleAssets?: (show: boolean) => void;
  impactData?: ImpactContext | null;
  impactLoading?: boolean;
  impactError?: string | null;
  selectedAssetId?: string | null;
  onAssetClick?: (asset: GeographicAsset) => void;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

const CLS_MAP: Record<string, string> = {
  industrial_thermal_source: 'Industrial Fire/Thermal Source',
  wildfire_forest_fire: 'Wildfire/Forest Fire',
  agricultural_burning: 'Agricultural Burning',
  unknown_uncertain: 'Unknown/Uncertain',
  industrial_fire_flare: 'Industrial Fire/Flare',
  natural_vegetation: 'Natural/Vegetation Fire',
  'Industrial Fire/Flare': 'Industrial Fire/Flare',
  'Natural/Vegetation': 'Natural/Vegetation Fire',
  'Unknown/Uncertain': 'Unknown/Uncertain',
  'Gas Flare': 'Gas Flare',
};

const SUB_MAP: Record<string, string> = {
  gas_flare: 'Gas Flare',
  industrial_fire: 'Industrial Fire',
  other_industrial_heat: 'Other Industrial Heat',
  mining_activity: 'Mining Activity',
  power_plant_thermal_source: 'Power Plant',
  wildfire: 'Wildfire',
  'Gas Flare': 'Gas Flare',
  'Forest Fire': 'Forest Fire',
  Unknown: 'Unknown',
};

const normCls = (v?: string) => (v ? CLS_MAP[v] || v : 'Not available');
const normSub = (v?: string) => (v ? SUB_MAP[v] || v : 'Not available');

const fmt = (v: unknown, unit?: string): string => {
  if (v === null || v === undefined || v === '') return 'Not available';
  return `${v}${unit ? ' ' + unit : ''}`;
};

const fmtDate = (v: unknown): string => {
  if (!v || typeof v !== 'string') return 'Not available';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
};

const fmtDateUTC = (v: unknown): string => {
  if (!v || typeof v !== 'string') return 'Not available';
  try {
    return new Date(v).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  } catch {
    return v;
  }
};

const fmtConf = (v: unknown): string => {
  if (typeof v === 'number') return `${Math.round(v * 100)}%`;
  if (typeof v === 'string') {
    // handle backend "high"/"low" strings
    const s = v.toLowerCase();
    if (s === 'high') return 'High';
    if (s === 'nominal') return 'Nominal';
    if (s === 'low') return 'Low';
    // handle e.g. "0.99" strings
    const n = parseFloat(v);
    if (!isNaN(n) && n >= 0 && n <= 1) return `${Math.round(n * 100)}%`;
    return v;
  }
  return 'Not available';
};

const getBadge = (cls?: string) => {
  const n = normCls(cls);
  if (n === 'Industrial Fire/Thermal Source' || n === 'Industrial Fire/Flare') return 'bg-red-500/20 text-red-400 border border-red-500/40';
  if (n === 'Gas Flare') return 'bg-orange-500/20 text-orange-400 border border-orange-500/40';
  if (n === 'Wildfire/Forest Fire' || n === 'Natural/Vegetation Fire') return 'bg-green-500/20 text-green-400 border border-green-500/40';
  if (n === 'Agricultural Burning') return 'bg-[#84cc16]/20 text-[#84cc16] border border-[#84cc16]/40';
  return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }) {
  return (
    <h3 className="mt-4 mb-1 pb-1 text-[10px] uppercase tracking-widest font-semibold text-zinc-500 border-b border-zinc-700/80">
      {title}
    </h3>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 border-b border-zinc-800/60 last:border-0">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200 break-words leading-snug">{value}</span>
    </div>
  );
}

// ─── Alert Actions ────────────────────────────────────────────────────────────

const ACTIONS = [
  { label: 'Acknowledge', status: 'acknowledged', Icon: CheckCircle, style: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' },
  { label: 'Investigating', status: 'investigating', Icon: Eye, style: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' },
  { label: 'Confirm', status: 'confirmed', Icon: AlertCircle, style: 'bg-red-600 hover:bg-red-700 focus:ring-red-500' },
  { label: 'Resolve', status: 'resolved', Icon: XCircle, style: 'bg-green-600 hover:bg-green-700 focus:ring-green-500' },
  { label: 'False Positive', status: 'false_positive', Icon: ThumbsDown, style: 'bg-zinc-600 hover:bg-zinc-700 focus:ring-zinc-400' },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvestigationPanel({
  selectedId,
  fallbackProps,
  onClose,
  showWind = false,
  onToggleWind,
  showAssets = false,
  onToggleAssets,
  impactData,
  impactLoading = false,
  impactError,
  selectedAssetId,
  onAssetClick,
}: InvestigationPanelProps) {
  const [data, setData] = useState<HotspotProperties | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState(true);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  
  // Nearest industries state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nearestIndustries, setNearestIndustries] = useState<any>(null);
  const [nearestLoading, setNearestLoading] = useState(false);
  
  // Imagery state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [imagery, setImagery] = useState<any>(null);
  const [imageryLoading, setImageryLoading] = useState(false);
  const [imageryError, setImageryError] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'panel' | 'modal' | 'floating'>('panel');

  const miniMapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const miniMapRef = useRef<any>(null);

  // Expanded map uses a completely separate container and map instance
  const expandedMapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expandedMapRef = useRef<any>(null);

  // Floating window drag & resize state
  const [floatPos, setFloatPos] = useState({ x: 80, y: window.innerHeight - 480 });
  const [floatSize, setFloatSize] = useState({ w: 500, h: 400 });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Drag handlers for floating window
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: floatPos.x, startPosY: floatPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setFloatPos({
        x: dragRef.current.startPosX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.startPosY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [floatPos]);

  // Resize handlers for floating window
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: floatSize.w, startH: floatSize.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      setFloatSize({
        w: Math.max(300, resizeRef.current.startW + (ev.clientX - resizeRef.current.startX)),
        h: Math.max(250, resizeRef.current.startH + (ev.clientY - resizeRef.current.startY)),
      });
    };
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [floatSize]);

  // Initialize inline mini-map (panel view)
  useEffect(() => {
    if (!imagery || !miniMapContainer.current) return;
    
    let cancelled = false;
    
    const initMiniMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled) return;
      
      if (!miniMapRef.current && miniMapContainer.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fProps = fallbackProps as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pProps = (data || {}) as any;
        const lat = pProps.latitude ?? pProps.lat ?? fProps?.latitude ?? fProps?.lat ?? fProps?.marker?.lat ?? 0;
        const lng = pProps.longitude ?? pProps.lng ?? fProps?.longitude ?? fProps?.lng ?? fProps?.marker?.lng ?? 0;
        
        const map = L.map(miniMapContainer.current, { 
          center: [lat, lng], 
          zoom: 16,
          zoomControl: true,
          dragging: true,
          scrollWheelZoom: true
        });
        
        L.tileLayer(imagery.wmts_url, {
          maxZoom: imagery.max_zoom
        }).addTo(map);

        L.circleMarker([lat, lng], {
          radius: 6,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.8,
          weight: 2
        }).addTo(map);

        miniMapRef.current = map;
      }
    };
    
    initMiniMap();
    
    return () => {
      cancelled = true;
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
      }
    };
  }, [imagery, fallbackProps, data]);

  // Create / destroy expanded map when mode changes
  useEffect(() => {
    if (mapViewMode === 'panel') {
      // Destroy expanded map when returning to panel
      if (expandedMapRef.current) {
        expandedMapRef.current.remove();
        expandedMapRef.current = null;
      }
      return;
    }

    if (!imagery || !expandedMapContainer.current) return;

    let cancelled = false;

    const initExpandedMap = async () => {
      // Small delay to let the DOM render the container at its full size
      await new Promise(r => setTimeout(r, 100));
      if (cancelled || !expandedMapContainer.current) return;

      // Destroy previous instance if any
      if (expandedMapRef.current) {
        expandedMapRef.current.remove();
        expandedMapRef.current = null;
      }

      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !expandedMapContainer.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fProps = fallbackProps as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pProps = (data || {}) as any;
      const lat = pProps.latitude ?? pProps.lat ?? fProps?.latitude ?? fProps?.lat ?? fProps?.marker?.lat ?? 0;
      const lng = pProps.longitude ?? pProps.lng ?? fProps?.longitude ?? fProps?.lng ?? fProps?.marker?.lng ?? 0;

      const map = L.map(expandedMapContainer.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: true
      });

      L.tileLayer(imagery.wmts_url, {
        maxZoom: imagery.max_zoom
      }).addTo(map);

      L.circleMarker([lat, lng], {
        radius: 6,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.8,
        weight: 2
      }).addTo(map);

      expandedMapRef.current = map;

      // ResizeObserver for float resizing
      const ro = new ResizeObserver(() => expandedMapRef.current?.invalidateSize());
      ro.observe(expandedMapContainer.current);
      expandedMapRef.current.__ro = ro;
    };

    initExpandedMap();

    return () => {
      cancelled = true;
      if (expandedMapRef.current) {
        if (expandedMapRef.current.__ro) expandedMapRef.current.__ro.disconnect();
        expandedMapRef.current.remove();
        expandedMapRef.current = null;
      }
    };
  }, [mapViewMode, imagery, fallbackProps, data]);

  // ── Fetch detail on selection ──────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    // Defer all state updates so no setState is called synchronously in the effect body
    const t = setTimeout(() => {
      if (cancelled) return;

      if (selectedId === null) {
        setData(null);
        setFetchError(null);
        setAlertStatus(null);
        setActionError(null);
        setHistory([]);
        setImagery(null);
        setImageryError(null);
        setMapViewMode('panel');
        setNearestIndustries(null);
        return;
      }

      setFetchLoading(true);
      setFetchError(null);
      setActionError(null);

      (async () => {
        try {
          const res = await fetch(`http://localhost:8000/api/v1/fires/${selectedId}`);
          if (cancelled) return;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (cancelled) return;
          const props: HotspotProperties = { ...(json.properties || {}), id: selectedId };
          setData(props);
          setAlertStatus(props.alert_status ?? null);
          setBackendUp(true);
          
          try {
            const histRes = await fetch(`http://localhost:8000/api/v1/alerts/${selectedId}/history`);
            if (histRes.ok) {
              const histData = await histRes.json();
              setHistory(histData);
            }
          } catch {
            // ignore
          }

          // Fetch nearest industries
          try {
            setNearestLoading(true);
            const niRes = await fetch(`http://localhost:8000/api/v1/fires/${selectedId}/nearest-industries?limit=10`);
            if (niRes.ok) {
              const niData = await niRes.json();
              setNearestIndustries(niData);
            }
          } catch {
            // ignore
          } finally {
            setNearestLoading(false);
          }

          // Fetch imagery metadata
          if (props.observed_at) {
            try {
              setImageryLoading(true);
              setImageryError(null);
              const dateStr = new Date(props.observed_at).toISOString().split('T')[0];
              // fallback for lat/lng
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fProps = fallbackProps as any;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pProps = props as any;
              const lat = pProps.latitude ?? pProps.lat ?? fProps?.latitude ?? fProps?.lat ?? fProps?.marker?.lat ?? 0;
              const lng = pProps.longitude ?? pProps.lng ?? fProps?.longitude ?? fProps?.lng ?? fProps?.marker?.lng ?? 0;
              const imgRes = await fetch(`http://localhost:8000/api/v1/imagery/preview?date=${dateStr}&lat=${lat}&lng=${lng}`);
              if (imgRes.ok) {
                const imgData = await imgRes.json();
                setImagery(imgData);
              } else {
                setImageryError('Imagery unavailable');
              }
            } catch (err) {
              setImageryError('Imagery unavailable');
            } finally {
              setImageryLoading(false);
            }
          }
        } catch (err) {
          if (cancelled) return;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          setFetchError(`Backend unreachable (${msg})`);
          setData(fallbackProps);
          setAlertStatus(fallbackProps?.alert_status ?? null);
          setBackendUp(false);
        } finally {
          if (!cancelled) setFetchLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [selectedId, fallbackProps]);

  // ── Escape key handler ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Alert PATCH ──────────────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (status: string) => {
      if (!selectedId || !backendUp || actionLoading) return;
      
      let notes = '';
      try {
        const input = window.prompt(`Changing status to ${status.toUpperCase()}.\nEnter optional analyst notes/reason:`);
        if (input === null) return; // User cancelled
        notes = input;
      } catch {
        // ignore
      }

      setActionLoading(status);
      setActionError(null);
      try {
        const res = await fetch(
          `http://localhost:8000/api/v1/alerts/${selectedId}/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, notes, reason: status, source: 'Analyst UI' }),
          }
        );
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || `HTTP ${res.status}`);
        }
        setAlertStatus(status);
        
        // Refresh history
        const histRes = await fetch(`http://localhost:8000/api/v1/alerts/${selectedId}/history`);
        if (histRes.ok) setHistory(await histRes.json());
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Failed to update alert');
      } finally {
        setActionLoading(null);
      }
    },
    [selectedId, backendUp, actionLoading]
  );

  if (selectedId === null) return null;

  const p = data || fallbackProps;
  const displayCls = normCls(p?.classification);
  const displaySub = normSub(p?.subclass);
  const temp = p?.temperature ?? p?.brightness_temperature;
  const sourceConf = p?.confidence ?? p?.source_confidence;
  const facilityType = p?.facility_type ?? p?.nearest_facility_type;
  const dist = p?.distance_to_industrial;
  const withinHalo =
    dist !== undefined && dist !== null
      ? dist <= 1000
        ? '✓ Yes (within 1 km)'
        : `✗ No (${Math.round(dist)} m away)`
      : 'Not available';

  return (
    <div
      className="absolute top-0 right-0 h-full w-80 z-[1001] flex flex-col bg-zinc-900/97 border-l border-zinc-700 shadow-2xl"
      role="complementary"
      aria-label="Hotspot Investigation Panel"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-700 shrink-0">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold rounded px-2 py-0.5 w-fit ${getBadge(p?.classification)}`}>
              {displayCls}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider rounded px-1.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/40" title="This is live data ingested from NASA FIRMS.">
              Source: NASA FIRMS
            </span>
          </div>
          <span className="text-xs text-zinc-500">Hotspot #{selectedId}</span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto shrink-0 rounded p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500"
          aria-label="Close investigation panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Backend warning */}
        {fetchError && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-yellow-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{fetchError} — showing cached data.</span>
          </div>
        )}

        {/* Loading */}
        {fetchLoading && (
          <div className="flex items-center gap-2 mt-4 text-zinc-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading hotspot detail…
          </div>
        )}

        {/* Empty */}
        {!fetchLoading && !p && !fetchError && (
          <p className="mt-4 text-xs text-zinc-500">No data available for this hotspot.</p>
        )}

        {/* Content */}
        {!fetchLoading && p && (
          <>
            <div className="bg-zinc-800/50 border border-zinc-700/80 rounded px-3 py-2 mt-2 mb-2 text-[10px] text-zinc-400 leading-tight">
              <strong>Disclaimer:</strong> This classification describes the likely context of a satellite-observed thermal anomaly. It is not independent confirmation of a fire.
            </div>
            
            <SectionHead title="Classification" />
            <Row label="Classification" value={displayCls} />
            <Row label="Subclass" value={displaySub} />
            <Row label="Taxonomy Version" value={fmt(p.taxonomy_version)} />
            <Row label="Classification Method" value={fmt(p.classification_method)} />
            <Row label="Model Probability" value={fmt(p.model_probability)} />
            <Row label="Classification Confidence" value={fmtConf(p.classification_confidence)} />
            <Row label="FIRMS Detection Confidence" value={fmtConf(p.firms_detection_confidence ?? sourceConf)} />
            <Row label="Prototype Risk Score" value={fmt(p.prototype_risk_score ?? p.risk_score)} />
            <Row label="Alert Status" value={fmt(alertStatus ?? p.alert_status)} />

            <SectionHead title="Observation" />
            <Row label="Observed At" value={fmtDate(p.observed_at)} />
            <Row label="Processed At" value={fmtDate(p.processed_at)} />
            <Row label="Data Freshness" value={p.data_freshness_mins !== undefined ? `${p.data_freshness_mins} mins ago` : 'Not available'} />
            <Row label="Satellite" value={fmt(p.satellite)} />
            <Row label="Instrument" value={fmt(p.instrument)} />
            <Row label="Temperature / Brightness" value={temp !== undefined && temp !== null ? `${temp} K` : 'Not available'} />
            <Row label="FRP" value={p.frp !== undefined && p.frp !== null ? `${p.frp} MW` : 'Not available'} />
            <Row label="Data Quality Flags" value={Array.isArray(p.data_quality_flags) && p.data_quality_flags.length > 0 ? p.data_quality_flags.join(', ') : fmt(p.data_quality_flags ?? p.data_quality)} />
            <Row label="Days Observed" value={fmt(p.days_observed)} />
            <Row label="Observation Count" value={fmt(p.observation_count)} />
            <Row label="Persistence Confidence" value={fmt(p.persistence_confidence)} />
            <Row label="Approximate Movement" value={p.approx_movement !== undefined && p.approx_movement !== null ? `${p.approx_movement} m` : 'Not available'} />

            <SectionHead title="Satellite Verification" />
            <div className="bg-zinc-950 p-2 rounded border border-zinc-800 space-y-2 mt-1 mb-2">
              {imageryLoading ? (
                <div className="flex justify-center items-center py-4 text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-xs">Checking imagery availability...</span>
                </div>
              ) : imageryError ? (
                <p className="text-xs text-yellow-500 font-medium py-2 text-center bg-yellow-500/10 rounded">
                  Imagery unavailable.
                </p>
              ) : imagery ? (
                <>
                  <div className="space-y-1">
                    <Row label="Source" value={imagery.source_name} />
                    <Row label="Image Date" value={imagery.imagery_date} />
                    <Row label="FIRMS Date" value={fmtDate(p.observed_at)} />
                    <Row label="Cloud Cover" value={imagery.cloud_cover} />
                    <Row label="Processing" value={imagery.processing_timestamp} />
                  </div>
                  {/* Inline mini-map (always stays in panel) */}
                  <div className="pt-2">
                    <div 
                      ref={miniMapContainer} 
                      onClick={() => mapViewMode === 'panel' && setMapViewMode('modal')}
                      className="w-full h-40 rounded border border-zinc-700 cursor-pointer hover:border-zinc-500 transition-colors overflow-hidden relative"
                    >
                      {mapViewMode === 'panel' && (
                        <div className="absolute top-2 right-2 z-[400] bg-zinc-900/80 p-1.5 rounded backdrop-blur-sm text-zinc-300 pointer-events-none border border-zinc-700 shadow-sm">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-600 text-center mt-2 px-1 leading-tight">
                    {imagery.attribution}
                  </div>
                </>
              ) : null}
            </div>

            {/* Expanded map (modal or floating) - rendered as a portal-style overlay */}
            {mapViewMode !== 'panel' && imagery && (
              <>
                {mapViewMode === 'modal' && (
                  <div 
                    className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" 
                    onClick={() => setMapViewMode('panel')}
                  />
                )}
                <div 
                  className={
                    mapViewMode === 'modal' 
                      ? "fixed inset-8 z-[9999] bg-zinc-950 border border-zinc-700 shadow-2xl rounded-lg flex flex-col overflow-hidden" 
                      : "fixed z-[9999] bg-zinc-950 border border-zinc-700 shadow-2xl rounded-lg flex flex-col overflow-hidden"
                  }
                  style={mapViewMode === 'floating' ? { left: floatPos.x, top: floatPos.y, width: floatSize.w, height: floatSize.h } : undefined}
                >
                  {/* Title bar - draggable in floating mode */}
                  <div 
                    className={`flex justify-between items-center px-3 py-2 border-b border-zinc-800 shrink-0 ${mapViewMode === 'floating' ? 'cursor-grab active:cursor-grabbing select-none' : ''}`}
                    onMouseDown={mapViewMode === 'floating' ? onDragStart : undefined}
                  >
                    <h3 className="text-sm font-semibold text-zinc-200">Satellite Imagery Verification</h3>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setMapViewMode(mapViewMode === 'modal' ? 'floating' : 'modal'); }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-[10px] uppercase font-bold tracking-widest border border-zinc-700 px-2"
                        aria-label="Toggle View"
                      >
                        {mapViewMode === 'modal' ? 'Float' : 'Fullscreen'}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setMapViewMode('panel'); }}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        aria-label="Close expanded map"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  {/* Expanded map container - completely separate from inline mini-map */}
                  <div 
                    ref={expandedMapContainer} 
                    className="w-full flex-1 overflow-hidden"
                  />
                  {/* Resize handle (floating mode only) */}
                  {mapViewMode === 'floating' && (
                    <div 
                      onMouseDown={onResizeStart}
                      className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-[10000]"
                      style={{ background: 'linear-gradient(135deg, transparent 50%, #52525b 50%)' }}
                    />
                  )}
                </div>
              </>
            )}

            <SectionHead title="Risk Assessment" />
            <Row label="Severity" value={fmt(p.severity)} />
            <Row label="Risk Score (Prototype Score)" value={p.risk_score !== undefined && p.risk_score !== null ? `${p.risk_score} / 100` : 'Not available'} />
            {p.score_components && typeof p.score_components === 'object' && (
              <div className="mt-1 ml-4 border-l-2 border-zinc-700 pl-2">
                {Object.entries(p.score_components).map(([k, v]) => (
                  <Row key={k} label={k} value={fmt(v)} />
                ))}
              </div>
            )}

            <SectionHead title="Wind & Smoke Assessment" />
            {p.weather ? (
              <div className="bg-zinc-950 p-2 rounded border border-zinc-800 space-y-1 relative">
                {p.weather.is_demo && (
                  <div className="text-[10px] text-yellow-500 font-bold mb-1">
                    Demo Wind Scenario — not live weather.
                  </div>
                )}
                <Row label="Wind Speed" value={`${p.weather.wind_speed} ${p.weather.units}`} />
                <Row label="Wind Direction (From)" value={`${p.weather.wind_direction}°`} />
                <Row label="Downwind (Toward)" value={`${(p.weather.wind_direction + 180) % 360}°`} />
                <Row label="Source" value={p.weather.source} />
                <Row label="Observed At" value={fmtDate(p.weather.observed_at)} />
                <Row label="Data Quality" value={fmt(p.weather.data_quality_flags)} />
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => onToggleWind && onToggleWind(!showWind)}
                    aria-label={showWind ? 'Hide corridor' : 'Show corridor'}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      showWind 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-inner' 
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {showWind ? 'Hide corridor' : 'Show Wind Direction & Indicative Corridor'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 mt-1">No wind data available.</p>
            )}

            <SectionHead title="Proximity" />
            <Row label="Nearest Facility" value={fmt(p.nearest_facility)} />
            <Row label="Facility Type" value={fmt(facilityType)} />
            <Row label="Distance to Industrial Zone" value={dist !== undefined && dist !== null ? `${Math.round(dist)} m` : 'Not available'} />
            <Row label="Within 1 km Halo" value={withinHalo} />

            <SectionHead title="Top 10 Nearest Industries" />
            <div className="bg-zinc-950 p-2 rounded border border-zinc-800 space-y-2 mt-1 mb-2">
              {nearestLoading ? (
                <div className="flex justify-center items-center py-3 text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-xs">Loading nearest industries...</span>
                </div>
              ) : nearestIndustries && nearestIndustries.facilities ? (
                <>
                  <div className="text-[10px] text-zinc-500 mb-1">Showing {nearestIndustries.facilities.length} nearest industrial facilities</div>
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {nearestIndustries.facilities.map((fac: {id: number; name: string; facility_type: string; distance_m: number; distance_km: number; within_1km_halo: boolean}, idx: number) => (
                      <div 
                        key={fac.id}
                        className={`text-xs p-2 rounded border ${
                          fac.within_1km_halo 
                            ? 'border-red-500/40 bg-red-500/5' 
                            : 'border-zinc-800 bg-zinc-900'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-zinc-500 font-mono text-[10px] shrink-0 w-4">#{idx + 1}</span>
                            <span className="font-semibold text-zinc-200 truncate">{fac.name.replace(' (Reference)', '').replace(' [OSM]', '')}</span>
                          </div>
                          <span className={`shrink-0 font-mono text-[10px] font-bold ${
                            fac.within_1km_halo ? 'text-red-400' : fac.distance_km < 5 ? 'text-orange-400' : 'text-zinc-400'
                          }`}>
                            {fac.distance_km < 1 ? `${Math.round(fac.distance_m)}m` : `${fac.distance_km}km`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded uppercase text-zinc-400">{fac.facility_type}</span>
                          {fac.within_1km_halo && (
                            <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded border border-red-900/50">Inside 1km Halo</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-zinc-500 py-2 text-center">No industry data available.</p>
              )}
            </div>

            <SectionHead title="Potential Impact Context" />
            <div className="bg-zinc-950 p-2 rounded border border-zinc-800 space-y-2">
              <div className="text-[10px] text-yellow-500 font-bold mb-1">
                This is an indicative geospatial assessment and is not an official evacuation instruction.
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={() => onToggleAssets && onToggleAssets(!showAssets)}
                  disabled={impactLoading}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    showAssets 
                      ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-inner' 
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  } disabled:opacity-50`}
                >
                  {impactLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" />
                  ) : null}
                  {showAssets ? 'Hide Nearby Assets' : 'Show Nearby Assets'}
                </button>
              </div>

              {impactError && (
                <p className="text-xs text-red-400 mt-1">{impactError}</p>
              )}

              {showAssets && impactData && (
                <div className="mt-2 space-y-1">
                   {impactData.is_demo && (
                     <div className="text-[10px] text-yellow-500 font-bold mb-1">
                        Demo geographic context — not verified live data.
                     </div>
                   )}
                   <Row label="Source" value={impactData.source_status} />
                   <div className="pt-1 border-t border-zinc-800 mt-2">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Total Visible Assets: {impactData.assets.length}</p>
                      
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {impactData.assets.map(asset => (
                          <div 
                             key={asset.id} 
                             onClick={() => onAssetClick && onAssetClick(asset)}
                             className={`text-xs p-1.5 rounded cursor-pointer border ${selectedAssetId === asset.id ? 'border-purple-500 bg-purple-500/20' : 'border-transparent bg-zinc-900 hover:bg-zinc-800'} ${asset.downwind ? 'border-l-2 border-l-blue-500' : ''}`}
                          >
                             <div className="flex justify-between items-start">
                                <span className="font-semibold text-zinc-200">{asset.name}</span>
                                <span className="text-zinc-500">{asset.distance_m}m</span>
                             </div>
                             <div className="text-[10px] text-zinc-400 mt-0.5 flex flex-wrap gap-1">
                                <span className="bg-zinc-800 px-1 rounded uppercase">{asset.asset_type}</span>
                                {asset.inside_impact_radius && <span className="bg-red-900/30 text-red-400 px-1 rounded border border-red-900/50">Inside Radius</span>}
                                {asset.downwind && <span className="bg-blue-900/30 text-blue-400 px-1 rounded border border-blue-900/50">Downwind</span>}
                             </div>
                          </div>
                        ))}
                        {impactData.assets.length === 0 && <p className="text-xs text-zinc-500">No assets found.</p>}
                      </div>
                   </div>
                </div>
              )}
            </div>

            <SectionHead title="Source Corroboration" />
            <div className="bg-zinc-950 p-2 rounded border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-zinc-400">Corroboration Level</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${
                  p.corroboration === 'Strong' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
                  p.corroboration === 'Partial' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                  'text-red-400 border-red-500/30 bg-red-500/10'
                }`}>
                  {p.corroboration || 'Weak'}
                </span>
              </div>
              <div className="space-y-1 mt-2">
                {p.corroboration_summary?.map((src, idx) => {
                  let displayStatus = src.status;
                  if (displayStatus === 'Not connected') displayStatus = 'No matching observation';

                  return (
                    <div key={idx} className="text-[10px] border-b border-zinc-800 last:border-0 pb-1 last:pb-0">
                      <div className="flex justify-between">
                        <span className="font-semibold text-zinc-300">{src.source_name}</span>
                        <span className={`px-1 rounded ${
                          src.status === 'Detected' ? 'bg-green-900/30 text-green-400' :
                          src.status === 'Synthetic scenario' ? 'bg-purple-900/30 text-purple-400' :
                          src.status === 'Not connected' ? 'bg-zinc-800 text-zinc-500' :
                          'bg-red-900/30 text-red-400'
                        }`}>
                          {displayStatus}
                        </span>
                      </div>
                    {src.status === 'Detected' && (
                      <div className="flex justify-between text-zinc-500 mt-0.5">
                        <span>{src.timestamp ? fmtDate(src.timestamp) : ''}</span>
                        <span>{src.confidence ? `Conf: ${src.confidence}` : ''}</span>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            <SectionHead title="Evidence" />
            {Array.isArray(p.evidence) && p.evidence.length > 0 ? (
              <ul className="mt-1 space-y-1.5">
                {(p.evidence as string[]).map((e, i) => (
                  <li key={i} className="flex gap-2 text-xs text-zinc-300 leading-snug">
                    <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500 mt-1">No evidence recorded.</p>
            )}

            <SectionHead title="Explanation" />
            <p className="text-xs text-zinc-300 leading-relaxed mt-1">
              {fmt(p.explanation)}
            </p>

            {p.observations_timeline && p.observations_timeline.length > 0 && (
              <>
                <SectionHead title="Observation Timeline" />
                <div className="space-y-2 mt-2">
                  {p.observations_timeline.map((obs: Record<string, unknown>, idx: number) => (
                    <div key={idx} className="bg-zinc-950 p-2 rounded border border-zinc-800 text-[10px]">
                      <div className="flex justify-between text-zinc-400 mb-1">
                        <span>{fmtDate(obs.observed_at)}</span>
                        <span>{String(obs.satellite || obs.source)} / {String(obs.instrument)}</span>
                      </div>
                      <div className="flex justify-between font-mono text-zinc-300">
                        <span>Conf: {String(obs.confidence || '—')}</span>
                        <span>{String(obs.data_quality_flags || 'No flags')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {history.length > 0 && (
              <>
                <SectionHead title="Alert History" />
                <div className="space-y-2 mt-2 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-700 before:to-transparent">
                  {history.map((h: Record<string, unknown>) => (
                    <div key={String(h.id)} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-3 h-3 rounded-full border border-zinc-500 bg-zinc-800 text-slate-500 group-[.is-active]:text-emerald-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-zinc-950 p-2 rounded border border-zinc-800 text-[10px]">
                        <div className="flex justify-between mb-1">
                          <span className="font-bold text-zinc-200 uppercase">{String(h.new_status)}</span>
                          <span className="text-zinc-500">{fmtDate(h.changed_at)}</span>
                        </div>
                        {Boolean(h.analyst_notes) && <p className="text-zinc-400 mt-1 italic">&quot;{String(h.analyst_notes)}&quot;</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <SectionHead title="FIRMS Verification" />
            <div className="mt-1 bg-zinc-950 p-2 rounded border border-zinc-800 text-[10px] font-mono text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>Source:</span>
                <span className="text-zinc-300 text-right">{fmt(p.source)}</span>
              </div>
              <div className="flex justify-between">
                <span>Satellite:</span>
                <span className="text-zinc-300 text-right">{fmt(p.satellite)}</span>
              </div>
              <div className="flex justify-between">
                <span>Instrument:</span>
                <span className="text-zinc-300 text-right">{fmt(p.instrument)}</span>
              </div>
              <div className="flex justify-between">
                <span>Latitude:</span>
                <span className="text-zinc-300 text-right">{p.latitude !== undefined ? Number(p.latitude).toFixed(5) : 'Not available'}</span>
              </div>
              <div className="flex justify-between">
                <span>Longitude:</span>
                <span className="text-zinc-300 text-right">{p.longitude !== undefined ? Number(p.longitude).toFixed(5) : 'Not available'}</span>
              </div>
              <div className="flex justify-between">
                <span>Acquisition Date:</span>
                <span className="text-zinc-300 text-right">{p.observed_at ? new Date(p.observed_at).toISOString().split('T')[0] : 'Not available'}</span>
              </div>
              <div className="flex justify-between">
                <span>Acquisition Time (UTC):</span>
                <span className="text-zinc-300 text-right">{fmtDateUTC(p.observed_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Local Time:</span>
                <span className="text-zinc-300 text-right">{fmtDate(p.observed_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>FRP:</span>
                <span className="text-zinc-300 text-right">{p.frp !== undefined && p.frp !== null ? `${p.frp} MW` : 'Not available'}</span>
              </div>
              <div className="flex justify-between">
                <span>Brightness:</span>
                <span className="text-zinc-300 text-right">{temp !== undefined && temp !== null ? `${temp} K` : 'Not available'}</span>
              </div>
              <div className="flex justify-between">
                <span>Confidence:</span>
                <span className="text-zinc-300 text-right">{fmt(sourceConf)}</span>
              </div>
              <div className="flex justify-between pt-1 mt-1 border-t border-zinc-800">
                <span>Source ID:</span>
                <span className="text-zinc-300 text-right">{fmt(p.source_event_id || `NASA_FIRMS_${p.id}`)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Alert Actions ── */}
      <div className="shrink-0 border-t border-zinc-700 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
          Alert Actions
        </p>
        {!backendUp && (
          <p className="text-xs text-zinc-500 mb-2 italic">
            Backend offline — alert actions disabled.
          </p>
        )}
        {actionError && (
          <p className="text-xs text-red-400 mb-2">{actionError}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map(({ label, status, Icon, style }) => (
            <button
              key={status}
              id={`alert-action-${status}`}
              onClick={() => handleAction(status)}
              disabled={!backendUp || actionLoading !== null}
              aria-label={`${label} hotspot #${selectedId}`}
              aria-pressed={alertStatus === status}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${style} ${
                alertStatus === status ? 'ring-2 ring-white/40' : ''
              }`}
            >
              {actionLoading === status ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
