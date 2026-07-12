const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Live Pitch Tracking",
    description:
      "Real-time pitch-by-pitch data via WebSocket. See velocity, movement, location, and result the moment it happens.",
    tag: "WebSocket",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "Statcast Percentiles",
    description:
      "Interactive sliders showing where each player ranks across exit velocity, launch angle, sprint speed, spin rate, and more.",
    tag: "Statcast",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: "Sabermetric Leaderboards",
    description:
      "Fully sortable tables covering WAR, wRC+, FIP, xFIP, BABIP, and 50+ advanced metrics across hitting and pitching.",
    tag: "Sabermetrics",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Spray Charts",
    description:
      "Visual hit location maps overlaid on a field diagram. Filter by batter, pitcher, count, game state, or date range.",
    tag: "Visualization",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: "Game Log History",
    description:
      "Deep-dive into any player's game log with filterable columns. Compare against league average and position peers.",
    tag: "History",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: "Built for Any Screen",
    description:
      "Fully responsive from mobile scoreboards to widescreen analytics dashboards. Dark mode built in.",
    tag: "Responsive",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="mb-14">
          <span className="font-mono text-xs tracking-widest text-accent uppercase">
            Features
          </span>
          <h2 className="text-4xl font-bold mt-3 mb-4 text-balance">
            The complete baseball data toolkit
          </h2>
          <p className="text-muted-foreground max-w-xl leading-relaxed">
            From the first pitch of spring training to the final out of the World Series —
            every number, every play, every moment.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card p-6 group hover:bg-muted transition-colors duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-accent">{feature.icon}</div>
                <span className="font-mono text-[10px] text-muted-foreground border border-border px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {feature.tag}
                </span>
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
