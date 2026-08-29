'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Loader2, Flame, HelpCircle, Activity } from 'lucide-react';

interface HotspotProperties {
  id?: number;
  classification?: string;
  observed_at?: string;
}

interface Feature {
  properties: HotspotProperties;
}

interface FeatureCollection {
  features: Feature[];
}

const COLORS = {
  industrial: '#ef4444',
  natural: '#22c55e',
  agricultural: '#84cc16',
  unknown: '#eab308'
};

export default function AnalyticsDashboard() {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/fires');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (!data) return { total: 0, ind: 0, nat: 0, agr: 0, unk: 0 };
    let ind = 0, nat = 0, agr = 0, unk = 0;
    data.features.forEach((f) => {
      const cls = f.properties.classification;
      if (cls === 'industrial_thermal_source' || cls === 'industrial_fire_flare' || cls === 'Industrial Fire/Flare' || cls === 'Industrial Fire/Thermal Source') ind++;
      else if (cls === 'wildfire_forest_fire' || cls === 'natural_vegetation' || cls === 'Natural/Vegetation' || cls === 'Wildfire/Forest Fire') nat++;
      else if (cls === 'agricultural_burning' || cls === 'Agricultural Burning') agr++;
      else unk++;
    });
    return { total: data.features.length, ind, nat, agr, unk };
  }, [data]);

  const pieData = useMemo(() => [
    { name: 'Industrial', value: stats.ind, color: COLORS.industrial },
    { name: 'Wildfire', value: stats.nat, color: COLORS.natural },
    { name: 'Agricultural', value: stats.agr, color: COLORS.agricultural },
    { name: 'Unknown', value: stats.unk, color: COLORS.unknown }
  ], [stats]);

  const timeSeriesData = useMemo(() => {
    if (!data) return [];
    
    // Group by date (YYYY-MM-DD)
    const grouped: Record<string, { ind: number, nat: number, agr: number, unk: number }> = {};
    
    data.features.forEach((f) => {
      const dateStr = f.properties.observed_at ? f.properties.observed_at.substring(0, 10) : 'Unknown';
      if (!grouped[dateStr]) grouped[dateStr] = { ind: 0, nat: 0, agr: 0, unk: 0 };
      
      const cls = f.properties.classification;
      if (cls === 'industrial_thermal_source' || cls === 'industrial_fire_flare' || cls === 'Industrial Fire/Flare' || cls === 'Industrial Fire/Thermal Source') grouped[dateStr].ind++;
      else if (cls === 'wildfire_forest_fire' || cls === 'natural_vegetation' || cls === 'Natural/Vegetation' || cls === 'Wildfire/Forest Fire') grouped[dateStr].nat++;
      else if (cls === 'agricultural_burning' || cls === 'Agricultural Burning') grouped[dateStr].agr++;
      else grouped[dateStr].unk++;
    });
    
    // Sort dates
    return Object.entries(grouped)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-white">
        <Loader2 className="mr-3 h-8 w-8 animate-spin text-blue-500" />
        Loading Analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center text-red-500">
        Error loading analytics: {error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-zinc-950 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-white">Analytics Dashboard</h2>
        <p className="text-sm text-zinc-400">Overview of hotspot classifications and temporal trends.</p>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 text-zinc-400">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Hotspots</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-center gap-2 text-red-400">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Industrial</span>
          </div>
          <div className="text-3xl font-bold text-red-500">{stats.ind}</div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-green-500/20 bg-green-500/5 p-5">
          <div className="flex items-center gap-2 text-green-400">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Wildfire</span>
          </div>
          <div className="text-3xl font-bold text-green-500">{stats.nat}</div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-[#84cc16]/20 bg-[#84cc16]/5 p-5">
          <div className="flex items-center gap-2 text-[#84cc16]">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Agricultural</span>
          </div>
          <div className="text-3xl font-bold text-[#84cc16]">{stats.agr}</div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <div className="flex items-center gap-2 text-yellow-400">
            <HelpCircle className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Unknown</span>
          </div>
          <div className="text-3xl font-bold text-yellow-500">{stats.unk}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 min-h-[400px]">
        {/* Trend Area Chart */}
        <div className="col-span-1 lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Hotspot Trend over Time</h3>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.industrial} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.industrial} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.natural} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.natural} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAgr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.agricultural} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.agricultural} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUnk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.unknown} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.unknown} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ fontSize: '14px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="ind" name="Industrial" stroke={COLORS.industrial} fillOpacity={1} fill="url(#colorInd)" strokeWidth={2} />
                <Area type="monotone" dataKey="nat" name="Wildfire" stroke={COLORS.natural} fillOpacity={1} fill="url(#colorNat)" strokeWidth={2} />
                <Area type="monotone" dataKey="agr" name="Agricultural" stroke={COLORS.agricultural} fillOpacity={1} fill="url(#colorAgr)" strokeWidth={2} />
                <Area type="monotone" dataKey="unk" name="Unknown" stroke={COLORS.unknown} fillOpacity={1} fill="url(#colorUnk)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="col-span-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white">Classification Breakdown</h3>
          </div>
          <div className="flex-1 flex justify-center items-center min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
