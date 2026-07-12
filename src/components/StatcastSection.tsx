const metrics = [
  { label: "Exit Velocity", pct: 92, value: "95.8 mph" },
  { label: "Launch Angle", pct: 78, value: "14.2°" },
  { label: "Sprint Speed", pct: 85, value: "29.1 ft/s" },
  { label: "Hard Hit %", pct: 88, value: "51.3%" },
  { label: "Barrel %", pct: 96, value: "18.7%" },
  { label: "xwOBA", pct: 91, value: ".401" },
];

function pctColor(pct: number) {
  if (pct >= 90) return "#c8102e";
  if (pct >= 70) return "#f59e0b";
  return "#3b82f6";
}

export default function StatcastSection() {
  return (
    <section className="py-24 border-t border-border bg-card">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Statcast
            </span>
            <h2 className="text-4xl font-bold mt-3 mb-6 text-balance">
              Percentile rankings, visualized
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              See where any player stands across every Statcast dimension.
              Color-coded percentile sliders make it instantly clear — red is elite,
              yellow is above average, blue is developing.
            </p>
            <div className="flex gap-4 flex-wrap font-mono text-xs">
              {[
                { label: "Elite (90th+)", color: "#c8102e" },
                { label: "Above Avg (70–89th)", color: "#f59e0b" },
                { label: "Average (below 70th)", color: "#3b82f6" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right: percentile bars */}
          <div
            className="bg-background border border-border rounded-xl p-6 space-y-4"
            aria-label="Statcast percentile sliders"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-foreground">Shohei Ohtani</span>
              <span className="font-mono text-xs text-muted-foreground">LAD · 2025</span>
            </div>
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground font-mono">{m.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-foreground">{m.value}</span>
                    <span
                      className="font-mono text-sm font-bold w-8 text-right"
                      style={{ color: pctColor(m.pct) }}
                    >
                      {m.pct}
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={m.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${m.label}: ${m.pct}th percentile`}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${m.pct}%`, backgroundColor: pctColor(m.pct) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
