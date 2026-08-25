export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white font-sans">
      <main className="flex flex-col items-center gap-6 p-8 text-center border border-zinc-800 rounded-xl bg-zinc-900 shadow-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-red-500">
          GeoFlare AI
        </h1>
        <p className="text-xl text-zinc-300">
          Frontend initialized
        </p>
        <div className="mt-4 inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-500">
          Demo Mode
        </div>
      </main>
    </div>
  );
}
