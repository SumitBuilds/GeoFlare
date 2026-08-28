'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import AlertCenter from '@/components/AlertCenter';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { MapIcon, Bell, BarChart, RefreshCw, Loader2 } from 'lucide-react';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full min-h-[600px] items-center justify-center bg-zinc-950 text-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mr-3"></div>
      Loading Map Component...
    </div>
  ),
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'alerts' | 'analytics'>('map');
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  
  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/ingestion/status');
      if (res.ok) {
        const data = await res.json();
        // find the most recent successful ingest
        let latest: string | null = null;
        for (const s of data.sources || []) {
          if (s.last_successful_ingest) {
            if (!latest || new Date(s.last_successful_ingest) > new Date(latest)) {
              latest = s.last_successful_ingest;
            }
          }
        }
        setLastUpdate(latest);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      // Refresh the VIIRS source
      const res = await fetch('http://localhost:8000/api/v1/ingestion/firms?source=VIIRS_SNPP_NRT', {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchStatus();
      // force reload map
      window.dispatchEvent(new Event('refresh-map'));
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 font-sans" suppressHydrationWarning>
        <div className="flex flex-1 items-center justify-center text-white" suppressHydrationWarning>
          Loading Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 font-sans text-white" suppressHydrationWarning>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6" suppressHydrationWarning>
        <div className="flex items-center gap-6" suppressHydrationWarning>
          <h1 className="text-xl font-bold tracking-tight text-red-500 flex items-center gap-2" suppressHydrationWarning>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            GeoFlare AI
          </h1>
          
          <div className="hidden sm:flex bg-zinc-950/50 p-1 rounded-lg border border-zinc-800" suppressHydrationWarning>
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                activeTab === 'map' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <MapIcon className="h-4 w-4" />
              Map View
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                activeTab === 'alerts' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Bell className="h-4 w-4" />
              Alert Center
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                activeTab === 'analytics' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <BarChart className="h-4 w-4" />
              Analytics
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4" suppressHydrationWarning>
          <div className="text-xs text-zinc-400 text-right hidden md:block">
            {refreshError ? (
              <span className="text-red-400">Update failed</span>
            ) : lastUpdate ? (
              <span>Last updated: {new Date(lastUpdate).toLocaleTimeString()}</span>
            ) : (
              <span>Status: Unknown</span>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
            suppressHydrationWarning
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh Live Data
          </button>
        </div>
      </header>

      {/* Mobile tabs */}
      <div className="sm:hidden flex p-2 border-b border-zinc-800 bg-zinc-900" suppressHydrationWarning>
        <div className="flex w-full bg-zinc-950/50 p-1 rounded-lg border border-zinc-800" suppressHydrationWarning>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 flex justify-center items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'map' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400'
            }`}
          >
            <MapIcon className="h-4 w-4" />
            Map
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex-1 flex justify-center items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'alerts' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400'
            }`}
          >
            <Bell className="h-4 w-4" />
            Alerts
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 flex justify-center items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'analytics' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400'
            }`}
          >
            <BarChart className="h-4 w-4" />
            Analytics
          </button>
        </div>
      </div>

      <main className="flex-1 relative overflow-y-auto" suppressHydrationWarning>
        {activeTab === 'map' && <Map />}
        {activeTab === 'alerts' && <AlertCenter />}
        {activeTab === 'analytics' && <AnalyticsDashboard />}
      </main>
    </div>
  );
}
