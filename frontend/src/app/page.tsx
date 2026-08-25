'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import AlertCenter from '@/components/AlertCenter';
import { MapIcon, Bell } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'map' | 'alerts'>('map');
  
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
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
          </div>
        </div>

        <div
          className="inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500"
          suppressHydrationWarning
        >
          Demo Mode
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
        </div>
      </div>

      <main className="flex-1 relative overflow-y-auto" suppressHydrationWarning>
        {activeTab === 'map' ? <Map /> : <AlertCenter />}
      </main>
    </div>
  );
}
