'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  industrial_fire_flare: 'Industrial Fire/Flare',
  natural_vegetation: 'Natural/Vegetation',
  unknown_uncertain: 'Unknown/Uncertain',
  'Industrial Fire/Flare': 'Industrial Fire/Flare',
  'Natural/Vegetation': 'Natural/Vegetation',
  'Unknown/Uncertain': 'Unknown/Uncertain',
  'Gas Flare': 'Gas Flare',
};

const SUB_MAP: Record<string, string> = {
  gas_flare: 'Gas Flare',
  industrial_fire: 'Industrial Fire',
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
  if (n === 'Industrial Fire/Flare') return 'bg-red-500/20 text-red-400 border border-red-500/40';
  if (n === 'Gas Flare') return 'bg-orange-500/20 text-orange-400 border border-orange-500/40';
  if (n === 'Natural/Vegetation') return 'bg-green-500/20 text-green-400 border border-green-500/40';
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
            <SectionHead title="Classification" />
            <Row label="Classification" value={displayCls} />
            <Row label="Subclass" value={displaySub} />
            <Row label="Classification Confidence" value={fmtConf(p.classification_confidence)} />
            <Row label="Alert Status" value={fmt(alertStatus ?? p.alert_status)} />

            <SectionHead title="Observation" />
            <Row label="Observed At" value={fmtDate(p.observed_at)} />
            <Row label="Processed At" value={fmtDate(p.processed_at)} />
            <Row label="Data Freshness" value={p.data_freshness_mins !== undefined ? `${p.data_freshness_mins} mins ago` : 'Not available'} />
            <Row label="Satellite" value={fmt(p.satellite)} />
            <Row label="Instrument" value={fmt(p.instrument)} />
            <Row label="Temperature / Brightness" value={temp !== undefined && temp !== null ? `${temp} K` : 'Not available'} />
            <Row label="FRP" value={p.frp !== undefined && p.frp !== null ? `${p.frp} MW` : 'Not available'} />
            <Row label="Source Confidence" value={fmt(sourceConf)} />
            <Row label="Days Observed" value={fmt(p.days_observed)} />
            <Row label="Observation Count" value={fmt(p.observation_count)} />
            <Row label="Persistence Confidence" value={fmt(p.persistence_confidence)} />
            <Row label="Approximate Movement" value={p.approx_movement !== undefined && p.approx_movement !== null ? `${p.approx_movement} m` : 'Not available'} />

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
                {p.corroboration_summary?.map((src, idx) => (
                  <div key={idx} className="text-[10px] border-b border-zinc-800 last:border-0 pb-1 last:pb-0">
                    <div className="flex justify-between">
                      <span className="font-semibold text-zinc-300">{src.source_name}</span>
                      <span className={`px-1 rounded ${
                        src.status === 'Detected' ? 'bg-green-900/30 text-green-400' :
                        src.status === 'Synthetic scenario' ? 'bg-purple-900/30 text-purple-400' :
                        src.status === 'Not connected' ? 'bg-zinc-800 text-zinc-500' :
                        'bg-red-900/30 text-red-400'
                      }`}>
                        {src.status}
                      </span>
                    </div>
                    {src.status === 'Detected' && (
                      <div className="flex justify-between text-zinc-500 mt-0.5">
                        <span>{src.timestamp ? fmtDate(src.timestamp) : ''}</span>
                        <span>{src.confidence ? `Conf: ${src.confidence}` : ''}</span>
                      </div>
                    )}
                  </div>
                ))}
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

            <SectionHead title="Data Verification" />
            <div className="mt-1 bg-zinc-950 p-2 rounded border border-zinc-800 text-[10px] font-mono text-zinc-400 space-y-1">
              <div className="flex justify-between">
                <span>Source ID:</span>
                <span className="text-zinc-300">{fmt(p.source)}</span>
              </div>
              <div className="flex justify-between">
                <span>Event ID:</span>
                <span className="text-zinc-300">{fmt(p.source_event_id || `NASA_FIRMS_${p.id}`)}</span>
              </div>
              <div className="flex justify-between">
                <span>Acq. Timestamp:</span>
                <span className="text-zinc-300">{fmtDate(p.observed_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Satellite:</span>
                <span className="text-zinc-300">{fmt(p.satellite)}</span>
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
