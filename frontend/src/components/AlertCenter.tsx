'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  XCircle,
  ThumbsDown,
  RefreshCw,
  Flame,
  Leaf,
  HelpCircle,
  Activity,
  Database,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertItem {
  id: number;
  classification: string;
  subclass: string | null;
  classification_confidence: number | string;
  confidence: string;
  satellite: string;
  observed_at: string | null;
  alert_status: string;
  explanation: string;
  evidence: string[];
  frp: number | null;
  temperature: number | null;
  distance_to_industrial: number | null;
  is_demo: boolean;
}

// ─── No fallback demo data ───────────────────────────────────────────────────────


// ─── Normalisation ────────────────────────────────────────────────────────────

const CLS_MAP: Record<string, string> = {
  industrial_fire_flare: 'Industrial Fire/Flare',
  natural_vegetation: 'Natural/Vegetation',
  unknown_uncertain: 'Unknown/Uncertain',
};
const normCls = (v?: string) => (v ? CLS_MAP[v] || v : 'Unknown');

const SUB_MAP: Record<string, string> = {
  gas_flare: 'Gas Flare',
  industrial_fire: 'Industrial Fire',
  wildfire: 'Wildfire',
};
const normSub = (v?: string | null) => (v ? SUB_MAP[v] || v : '—');

const fmtConf = (v: number | string): string => {
  if (typeof v === 'number') return `${Math.round(v * 100)}%`;
  const n = parseFloat(v);
  if (!isNaN(n) && n <= 1) return `${Math.round(n * 100)}%`;
  return v || '—';
};

const fmtDate = (v: string | null): string => {
  if (!v) return 'Not available';
  try { return new Date(v).toLocaleString(); } catch { return v; }
};

const fmtDist = (v: number | null): string => {
  if (v === null || v === undefined) return 'N/A';
  if (v === 0) return '0 m (inside zone)';
  return `${Math.round(v)} m`;
};

// ─── Style helpers ────────────────────────────────────────────────────────────

const clsBadge = (cls: string): string => {
  const n = normCls(cls);
  if (n === 'Industrial Fire/Flare') return 'bg-red-500/20 text-red-300 border border-red-500/40';
  if (n === 'Gas Flare') return 'bg-orange-500/20 text-orange-300 border border-orange-500/40';
  if (n === 'Natural/Vegetation') return 'bg-green-500/20 text-green-300 border border-green-500/40';
  return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
};

const clsIcon = (cls: string) => {
  const n = normCls(cls);
  if (n === 'Industrial Fire/Flare' || n === 'Gas Flare')
    return <Flame className="h-3.5 w-3.5" />;
  if (n === 'Natural/Vegetation')
    return <Leaf className="h-3.5 w-3.5" />;
  return <HelpCircle className="h-3.5 w-3.5" />;
};

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
  acknowledged: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
  investigating: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
  confirmed: 'bg-red-500/20 text-red-300 border border-red-500/40',
  resolved: 'bg-green-500/20 text-green-300 border border-green-500/40',
  false_positive: 'bg-zinc-600/40 text-zinc-400 border border-zinc-500/40',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  confirmed: 'Confirmed',
  resolved: 'Resolved',
  false_positive: 'False Positive',
};

const ACTIONS = [
  { label: 'Acknowledge', status: 'acknowledged', Icon: CheckCircle, style: 'bg-indigo-700 hover:bg-indigo-600 focus:ring-indigo-400' },
  { label: 'Investigating', status: 'investigating', Icon: Eye, style: 'bg-purple-700 hover:bg-purple-600 focus:ring-purple-400' },
  { label: 'Confirm', status: 'confirmed', Icon: AlertCircle, style: 'bg-red-700 hover:bg-red-600 focus:ring-red-400' },
  { label: 'Resolve', status: 'resolved', Icon: XCircle, style: 'bg-green-700 hover:bg-green-600 focus:ring-green-400' },
  { label: 'False Positive', status: 'false_positive', Icon: ThumbsDown, style: 'bg-zinc-700 hover:bg-zinc-600 focus:ring-zinc-400' },
] as const;

// ─── Status filter chips ───────────────────────────────────────────────────────

const STATUS_FILTERS = ['All', 'new', 'acknowledged', 'investigating', 'confirmed', 'resolved', 'false_positive'] as const;
const CLS_FILTERS = ['All', 'Industrial Fire/Flare', 'Natural/Vegetation', 'Unknown/Uncertain'] as const;

// ─── Stats card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-3 min-w-[110px]" suppressHydrationWarning>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  actionLoading,
  onAction,
  backendUp,
}: {
  alert: AlertItem;
  actionLoading: string | null;
  onAction: (id: number, status: string) => void;
  backendUp: boolean;
}) {
  const displayCls = normCls(alert.classification);
  const displaySub = normSub(alert.subclass);

  return (
    <div
      className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 flex flex-col gap-3"
      suppressHydrationWarning
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${clsBadge(alert.classification)}`}>
            {clsIcon(alert.classification)}
            {displayCls}
          </span>
          {displaySub !== '—' && (
            <span className="text-xs text-zinc-400 font-medium">{displaySub}</span>
          )}
          {alert.is_demo && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
              DEMO DATA
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[alert.alert_status] || STATUS_STYLES.new}`}>
            {STATUS_LABELS[alert.alert_status] || alert.alert_status}
          </span>
          <span className="text-xs text-zinc-500">#{alert.id}</span>
        </div>
      </div>

      {/* Grid of key fields */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-zinc-500">Classification Conf.</span>
          <p className="text-zinc-200 font-medium">{fmtConf(alert.classification_confidence)}</p>
        </div>
        <div>
          <span className="text-zinc-500">Source Confidence</span>
          <p className="text-zinc-200 font-medium">{alert.confidence || '—'}</p>
        </div>
        <div>
          <span className="text-zinc-500">FRP</span>
          <p className="text-zinc-200 font-medium">{alert.frp !== null ? `${alert.frp} MW` : '—'}</p>
        </div>
        <div>
          <span className="text-zinc-500">Temperature</span>
          <p className="text-zinc-200 font-medium">{alert.temperature !== null ? `${alert.temperature} K` : '—'}</p>
        </div>
        <div>
          <span className="text-zinc-500">Dist. to Industrial</span>
          <p className="text-zinc-200 font-medium">{fmtDist(alert.distance_to_industrial)}</p>
        </div>
        <div>
          <span className="text-zinc-500">Satellite</span>
          <p className="text-zinc-200 font-medium truncate">{alert.satellite || '—'}</p>
        </div>
        <div className="col-span-2">
          <span className="text-zinc-500">Observed At</span>
          <p className="text-zinc-200 font-medium">{fmtDate(alert.observed_at)}</p>
        </div>
      </div>

      {/* Explanation */}
      {alert.explanation && (
        <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-700 pt-2">
          {alert.explanation}
        </p>
      )}

      {/* Evidence bullets */}
      {alert.evidence?.length > 0 && (
        <ul className="space-y-0.5">
          {alert.evidence.map((e, i) => (
            <li key={i} className="flex gap-1.5 text-[11px] text-zinc-400">
              <span className="text-blue-400 shrink-0 mt-px">•</span>
              {e}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-zinc-700 pt-2">
        {!backendUp && (
          <p className="text-[11px] text-zinc-500 italic w-full">Backend offline — actions disabled.</p>
        )}
        {ACTIONS.map(({ label, status, Icon, style }) => (
          <button
            key={status}
            id={`alert-${alert.id}-action-${status}`}
            onClick={() => onAction(alert.id, status)}
            disabled={!backendUp || actionLoading === `${alert.id}:${status}`}
            aria-label={`${label} alert #${alert.id}`}
            aria-pressed={alert.alert_status === status}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${style} ${alert.alert_status === status ? 'ring-2 ring-white/30' : ''}`}
          >
            {actionLoading === `${alert.id}:${status}` ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Icon className="h-3 w-3" />
            )}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AlertCenter() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendUp, setBackendUp] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [clsFilter, setClsFilter] = useState<string>('All');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<number, string>>({});

  const fetchAlerts = useCallback(async () => {
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);

    try {
      const res = await fetch('http://localhost:8000/api/v1/fires');
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const geoJson = await res.json();

      const items: AlertItem[] = (geoJson.features || []).map(
        (f: { properties: Record<string, unknown> }) => {
          const p = f.properties || {};
          return {
            id: p.id as number,
            classification: (p.classification as string) || 'unknown_uncertain',
            subclass: (p.subclass as string | null) || null,
            classification_confidence: (p.classification_confidence as number | string) ?? '—',
            confidence: (p.confidence as string) || '—',
            satellite: (p.satellite as string) || '—',
            observed_at: (p.observed_at as string | null) || null,
            alert_status: (p.alert_status as string) || 'new',
            explanation: (p.explanation as string) || '',
            evidence: (p.evidence as string[]) || [],
            frp: p.frp !== undefined ? (p.frp as number) : null,
            temperature: p.temperature !== undefined ? (p.temperature as number) : null,
            distance_to_industrial: p.distance_to_industrial !== undefined
              ? (p.distance_to_industrial as number)
              : null,
            is_demo: false,
          };
        }
      );

      setAlerts(items);
      setBackendUp(true);
      setUsingDemo(false);
      setLastRefreshed(new Date());
    } catch (err) {
      clearTimeout(t);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Backend unreachable (${msg}). No data to display.`);
      setAlerts([]);
      setBackendUp(false);
      setUsingDemo(false);
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchAlerts(), 0);
    return () => clearTimeout(t);
  }, [fetchAlerts]);

  const handleAction = useCallback(async (id: number, status: string) => {
    if (!backendUp) return;
    
    // Optional prompt for analyst notes
    let notes = '';
    try {
      const input = window.prompt(`Changing status to ${STATUS_LABELS[status] || status}.\nEnter optional analyst notes/reason:`);
      if (input === null) return; // User cancelled
      notes = input;
    } catch {
      // ignore
    }

    const key = `${id}:${status}`;
    setActionLoading(key);
    setActionErrors(prev => { const n = { ...prev }; delete n[id]; return n; });

    try {
      const res = await fetch(`http://localhost:8000/api/v1/alerts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes, reason: status }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, alert_status: status } : a));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      setActionErrors(prev => ({ ...prev, [id]: msg }));
    } finally {
      setActionLoading(null);
    }
  }, [backendUp]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total: alerts.length,
    industrial: alerts.filter(a => normCls(a.classification) === 'Industrial Fire/Flare').length,
    natural: alerts.filter(a => normCls(a.classification) === 'Natural/Vegetation').length,
    unknown: alerts.filter(a => normCls(a.classification) === 'Unknown/Uncertain').length,
    persistent: alerts.filter(a => {
      const dist = a.distance_to_industrial;
      return dist !== null && dist <= 1000;
    }).length,
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = alerts.filter(a => {
    const statusOk = statusFilter === 'All' || a.alert_status === statusFilter;
    const clsOk = clsFilter === 'All' || normCls(a.classification) === clsFilter;
    return statusOk && clsOk;
  });

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 px-4 py-6 md:px-8 max-w-6xl mx-auto" suppressHydrationWarning>

      {/* ── Page header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Alert Center</h2>
          <p className="text-sm text-zinc-400 mt-0.5">
            Thermal hotspot alerts — classified and prioritised
          </p>
        </div>
        <div className="flex items-center gap-3">
          {usingDemo && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
              <Database className="h-3 w-3" />
              Using Demo Data
            </span>
          )}
          <button
            id="refresh-alerts-btn"
            onClick={fetchAlerts}
            disabled={loading}
            aria-label="Refresh alerts"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Backend error banner ─── */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-yellow-300 text-sm" suppressHydrationWarning>
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Data freshness ─── */}
      {lastRefreshed && !loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500" suppressHydrationWarning>
          <Activity className="h-3.5 w-3.5 text-green-500" />
          Data as of {lastRefreshed.toLocaleTimeString()}
          {usingDemo && ' — DEMO DATA (backend offline)'}
        </div>
      )}

      {/* ── Stats cards ─── */}
      <div className="flex flex-wrap gap-3" suppressHydrationWarning>
        <StatCard label="Total Anomalies" value={stats.total} icon={Flame} color="text-zinc-300" />
        <StatCard label="Industrial Events" value={stats.industrial} icon={Flame} color="text-red-400" />
        <StatCard label="Natural Events" value={stats.natural} icon={Leaf} color="text-green-400" />
        <StatCard label="Unknown Events" value={stats.unknown} icon={HelpCircle} color="text-yellow-400" />
        <StatCard label="In 1 km Halo" value={stats.persistent} icon={Activity} color="text-blue-400" />
      </div>

      {/* ── Filters ─── */}
      <div className="flex flex-col gap-2" suppressHydrationWarning>
        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              id={`status-filter-${f}`}
              onClick={() => setStatusFilter(f)}
              aria-pressed={statusFilter === f}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                statusFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {STATUS_LABELS[f] || f}
            </button>
          ))}
        </div>
        {/* Classification filters */}
        <div className="flex flex-wrap gap-2">
          {CLS_FILTERS.map(f => (
            <button
              key={f}
              id={`cls-filter-${f.replace(/\//g, '-')}`}
              onClick={() => setClsFilter(f)}
              aria-pressed={clsFilter === f}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                clsFilter === f
                  ? 'bg-zinc-600 text-white'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading state ─── */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm">Loading alerts…</p>
        </div>
      )}

      {/* ── Empty state ─── */}
      {!loading && filtered.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-zinc-500">
          <CheckCircle className="h-10 w-10 text-green-600/50" />
          <p className="text-sm font-medium">No NASA FIRMS observations available for this selection.</p>
          <button
            onClick={() => { setStatusFilter('All'); setClsFilter('All'); }}
            className="text-xs text-blue-400 hover:underline mt-1 focus:outline-none"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Alert cards ─── */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(alert => (
            <div key={alert.id}>
              {actionErrors[alert.id] && (
                <p className="mb-1 text-xs text-red-400 px-1">{actionErrors[alert.id]}</p>
              )}
              <AlertCard
                alert={alert}
                actionLoading={actionLoading}
                onAction={handleAction}
                backendUp={backendUp}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Count summary ─── */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-zinc-500 text-right">
          Showing {filtered.length} of {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
