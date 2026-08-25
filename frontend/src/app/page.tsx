'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

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
  
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 font-sans" suppressHydrationWarning>
         <div className="flex flex-1 items-center justify-center text-white">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 font-sans" suppressHydrationWarning>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6">
        <h1 className="text-xl font-bold tracking-tight text-red-500">
          GeoFlare AI
        </h1>
        <div className="inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500">
          Demo Mode
        </div>
      </header>
      <main className="flex-1 relative">
        <Map />
      </main>
    </div>
  );
}
