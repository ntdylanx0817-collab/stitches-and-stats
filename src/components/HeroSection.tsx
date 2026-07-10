export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
        aria-hidden="true"
      />

      {/* Red accent line top */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-accent" aria-hidden="true" />

      {/* Live indicator */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 w-full pt-32 pb-24">
        <div className="flex items-center gap-2 mb-8">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
          </span>
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Live Season Data
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div>
            <h1 className="text-5xl lg:text-7xl font-bold leading-[1.05] text-balance mb-6">
              Every pitch.
              <br />
              <span className="text-accent">Every stat.</span>
              <br />
              In real time.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg mb-10">
              Live MLB pitch-by-pitch tracking, Statcast percentile sliders, and
              sortable sabermetric leaderboards — all in one place.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#features"
                className="inline-flex items-center gap-2 bg-accent text-accent-foreground font-semibold px-6 py-3 rounded-md hover:bg-accent/90 transition-colors"
              >
                Explore the dashboard
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </a>
              <a
                href="#leaderboards"
                className="inline-flex items-center gap-2 border border-border text-foreground font-semibold px-6 py-3 rounded-md hover:border-foreground/40 transition-colors"
              >
                View leaderboards
              </a>
            </div>
          </div>

          {/* Right: pitch tracker mockup */}
          <div className="relative">
            <PitchTrackerMockup />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
          {[
            { value: "700K+", label: "Pitches Tracked" },
            { value: "30", label: "MLB Teams" },
            { value: "500+", label: "Statcast Metrics" },
            { value: "Real-time", label: "WebSocket Feed" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card px-6 py-5">
              <div className="text-2xl font-bold text-foreground font-mono">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PitchTrackerMockup() {
  const pitches = [
    { type: "4-Seam FB", velo: "98.2", result: "Strike", x: 48, y: 42, color: "#c8102e" },
    { type: "Slider", velo: "89.4", result: "Ball", x: 28, y: 68, color: "#3b82f6" },
    { type: "Changeup", velo: "85.1", result: "Strike", x: 55, y: 55, color: "#10b981" },
    { type: "4-Seam FB", velo: "97.8", result: "Ball", x: 72, y: 38, color: "#c8102e" },
    { type: "Curveball", velo: "79.3", result: "Strike", x: 44, y: 60, color: "#f59e0b" },
  ];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          <span className="font-mono text-xs text-muted-foreground">LIVE · TOP 5TH</span>
        </div>
        <span className="font-mono text-xs text-foreground">NYY 3 — BOS 2</span>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Strike zone */}
        <div>
          <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase tracking-widest">
            Strike Zone
          </p>
          <div
            className="relative bg-muted rounded-md"
            style={{ paddingBottom: "100%" }}
            role="img"
            aria-label="Strike zone pitch plot"
          >
            <div className="absolute inset-0 p-3">
              {/* Zone box */}
              <div
                className="absolute border border-border/60 rounded-sm"
                style={{ left: "25%", top: "20%", width: "50%", height: "60%" }}
                aria-hidden="true"
              />
              {/* Zone thirds */}
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute border-t border-dashed border-border/30"
                  style={{ left: "25%", top: `${20 + i * 20}%`, width: "50%" }}
                  aria-hidden="true"
                />
              ))}
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute border-l border-dashed border-border/30"
                  style={{ left: `${25 + i * 16.67}%`, top: "20%", height: "60%" }}
                  aria-hidden="true"
                />
              ))}
              {/* Pitches */}
              {pitches.map((p, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-full border-2 border-background -translate-x-1/2 -translate-y-1/2 transition-all"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    backgroundColor: p.color,
                  }}
                  aria-label={`${p.type} at ${p.velo} mph — ${p.result}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Recent pitches list */}
        <div>
          <p className="font-mono text-[10px] text-muted-foreground mb-2 uppercase tracking-widest">
            Pitch Log
          </p>
          <div className="space-y-1.5">
            {pitches.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md bg-muted"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                    aria-hidden="true"
                  />
                  <span className="text-foreground font-mono text-[10px]">{p.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-[10px]">{p.velo}</span>
                  <span
                    className="font-mono text-[10px] font-semibold"
                    style={{ color: p.result === "Strike" ? "#10b981" : "#f59e0b" }}
                  >
                    {p.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Count indicator */}
      <div className="px-4 pb-4 flex gap-3 font-mono text-xs text-muted-foreground">
        <span>
          B: <span className="text-foreground font-bold">2</span>
        </span>
        <span>
          S: <span className="text-foreground font-bold">1</span>
        </span>
        <span>
          O: <span className="text-foreground font-bold">1</span>
        </span>
      </div>
    </div>
  );
}
