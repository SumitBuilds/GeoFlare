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
  evidence?: string[];
  explanation?: string;
  nearest_facility?: string;
  facility_type?: string;
  nearest_facility_type?: string;
  source?: string;
  source_event_id?: string;
  acq_time?: string;
  data_quality?: string;
  raw_metadata?: unknown;
  [key: string]: unknown;
}

interface InvestigationPanelProps {
  selectedId: number | null;
  /** Properties already stored in the map marker — used as fallback while fetching */
  fallbackProps: HotspotProperties | null;
  onClose: () => void;
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
  { label: 'Resolve', status: 'resolved', Icon: XCircle, style: 'bg-green-600 hover:bg-green-700 focus:ring-green-500' },
  { label: 'False Positive', status: 'false_positive', Icon: ThumbsDown, style: 'bg-zinc-600 hover:bg-zinc-700 focus:ring-zinc-400' },
] as const;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InvestigationPanel({
  selectedId,
  fallbackProps,
  onClose,
}: InvestigationPanelProps) {
  const [data, setData] = useState<HotspotProperties | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState(true);

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
      setActionLoading(status);
      setActionError(null);
      try {
        const res = await fetch(
          `http://localhost:8000/api/v1/alerts/${selectedId}/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }
        );
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || `HTTP ${res.status}`);
        }
        setAlertStatus(status);
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

            <SectionHead title="Proximity" />
            <Row label="Nearest Facility" value={fmt(p.nearest_facility)} />
            <Row label="Facility Type" value={fmt(facilityType)} />
            <Row label="Distance to Industrial Zone" value={dist !== undefined && dist !== null ? `${Math.round(dist)} m` : 'Not available'} />
            <Row label="Within 1 km Halo" value={withinHalo} />

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
