export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">Stitches and Stats</h1>
        <p className="text-lg mb-2">
          Live MLB pitch-by-pitch tracking, Statcast percentile sliders, and sortable sabermetric leaderboards
        </p>
        <p className="text-sm text-gray-600">
          Built with Next.js 16, TypeScript, and WebSockets
        </p>
      </div>
    </main>
  );
}
