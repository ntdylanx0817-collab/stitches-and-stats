---
Task ID: savant-xl-platform
Agent: main
Task: Build immersive baseball analytics platform inspired by Baseball Savant with real-time pitch tracking, percentile sliders, and Statcast leaderboards.

Work Log:
- Initialized fullstack Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui scaffold
- Tested MLB Stats API (statsapi.mlb.com) — works for schedule, play-by-play, players
- Tested Baseball Savant game feed (baseballsavant.mlb.com/gf?game_pk=) — works for Statcast per-pitch metrics (exit velocity, launch angle, spin rate, barrel, xBA, bat speed, etc.)
- Tested Baseball Savant leaderboard CSV endpoint — works for season-long batter/pitcher leaderboards
- Built custom dark-mode design system in globals.css: deep charcoal (#0B0F19) + neon cobalt/crimson/mint accents, glassmorphism utilities, custom animations (live-dot, pitch-ping, slide-up-fade, pulse-glow)
- Built lib layer: types, in-memory TTL cache, MLB API client with parallel fetch + enriched pitch merging
- Built API routes:
  - /api/schedule (yesterday + today merged so Final games always available)
  - /api/game/[gamePk] (enriched pitches = MLB live feed + Statcast metrics)
  - /api/savant/[gamePk] (raw savant feed)
  - /api/leaderboard (year fallback logic, type batter/pitcher)
  - /api/players (search via MLB Stats API player registry)
  - /api/player/[playerId] (bio + season stats + percentile rankings)
- Built WebSocket mini-service on port 3003 (mini-services/live-feed): polls MLB + savant every 8s, pushes snapshots to subscribers, room-based game subscriptions, gateway-routed via Caddy with XTransformPort query
- Built Zustand store for view switching + game/player selection + leaderboard filters
- Built SocketProvider with React 19-safe ref pattern (subscribeGame/unsubscribeGame/onSnapshot/onPitch callbacks)
- Built Header with sticky nav (Live Feed / Players / Leaderboards), global predictive player search with keyboard navigation, live WS indicator
- Built Live Feed view: 3-column layout (Scoreboard + Strike Zone | Pitch Log | Latest Metrics + Pitch Mix), high-fidelity SVG strike zone with pitch dots colored by pitch type, 3x3 sub-zone grid, batter silhouette, home plate, glow rings on latest pitch, click-to-select; pitch log with expandable cards showing 11+ Statcast metrics per pitch; live metric cards for latest pitch; pitch mix distribution bars
- Built Player Profile view: hero header with avatar/number/position/bio, percentile slider cards (15 batter / 11 pitcher metrics) with color-coded glow (90+ = crimson, 75+ = amber, 50+ = cobalt, 25+ = violet, <25 = mint), season stats grid
- Built Statcast Leaderboards view: multi-filter bar (type toggle, season, min PA/BF slider, team, position, name search, Statcast columns toggle), sticky-header + sticky-player-column table, sortable columns with arrow indicators, tone-colored values (mint=elite, cobalt=good, crimson=poor), lazy-load pagination (50 rows at a time)
- Wired main page with AnimatePresence view transitions + sticky footer
- Browser-verified all three views via agent-browser: live feed shows 278 pitches with full Statcast data, player search returns Ohtani/Judge, percentile rankings show 99th xwOBA for Ohtani, leaderboard shows Aaron Judge #1 with .331/.688/.463
- Fixed lint errors: refactored socket provider to use ref + state pattern, used key={gamePk} for state reset, used filter-signature pattern for leaderboard filter resets

Stage Summary:
- Production-grade baseball analytics platform at /home/z/my-project (Next.js 16 app on port 3000, WS mini-service on port 3003, accessible via Caddy gateway on port 81)
- 3 fully-functional views: Live Feed, Players, Leaderboards — all verified via agent-browser with real MLB data
- Real-time pitch tracking via WebSocket (8s poll interval, room-based subscriptions, gateway-routed)
- All 8 Statcast metric categories from the brief are surfaced: Exit Velocity, Launch Angle, Spin Rate, Sweet Spot %, Bat Speed, Barrel %, Hard Hit %, xBA, plus Pitch Movement (break X/Z, IVB), xwOBA, xSLG, wOBA
- Glassmorphism + neon dark aesthetic with framer-motion micro-interactions throughout
- ESLint passes clean, no console errors, no hydration mismatches
- Sample final games from yesterday always available so demo always shows pitch data even without live games
