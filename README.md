# Stitches and Stats — Real-Time Statcast Baseball Analytics

An immersive, production-grade baseball analytics platform inspired by [MLB's Baseball Savant](https://baseballsavant.mlb.com/), redesigned with a modern, ultra-clean dark-mode aesthetic. Built with Next.js 16, TypeScript, and real-time WebSocket pitch tracking.

![Stitches and Stats](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Live 'Savant' Gamefeed
- **Real-time pitch-by-pitch tracking** via WebSocket (with REST polling fallback every 5s)
- **High-fidelity SVG strike zone** showing every pitch colored by type (4-Seam, Sinker, Slider, Curveball, Cutter, Sweeper, Changeup), with glow rings on the latest pitch, click-to-select, and a 3×3 sub-zone grid
- **Pitch log** with expandable cards showing 11+ Statcast metrics per pitch (Exit Velocity, Launch Angle, Hit Distance, xBA, Spin Rate, Bat Speed, Break X/Z, Induced Vertical Break, Extension, Plate Time, Plate Location, Zone)
- **Live metric cards** for the latest pitch with barrel detection
- **Pitch mix distribution** bars with average speed per pitch type
- **Scoreboard** with inning-by-inning linescore, R/H/E totals, and live game state

### Interactive Player Profiles & Percentile Rankings
- **Global predictive search** with keyboard navigation (↑↓↵) — finds any active MLB player
- **15 batter / 11 pitcher percentile sliders** with color-coded glow:
  - 90th+ percentile → neon crimson
  - 75th+ → amber
  - 50th+ → electric cobalt
  - 25th+ → violet
  - below 25th → mint
- **Season stat grid**: standard (AVG/OBP/SLG/OPS/wOBA/HR/PA/K%/BB%) + Statcast (xwOBA/xBA/xSLG/Barrel%/HardHit%/SweetSpot%/Avg EV/Max EV/Avg LA/Whiff%/O-Swing%)
- Percentiles computed live from the leaderboard (always current)

### Advanced Statcast Search & Leaderboards
- **Multi-filter bar**: Batter/Pitcher toggle, Season (2015–2025), Min PA/BF slider, Team (all 30 MLB), Position, name search, Statcast columns toggle
- **Sortable table** with sticky header + sticky player-name column; click any column header to sort asc/desc/none
- **Tone-colored values**: elite=mint, good=cobalt, poor=crimson
- **Lazy-load pagination**: 50 rows at a time with "Load more" overlay
- Click any row to navigate to that player's percentile profile

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), TypeScript 5, Tailwind CSS 4, shadcn/ui, Framer Motion |
| **State** | Zustand (app state), TanStack Query (server state with retry + dedup) |
| **Real-time** | Socket.io WebSocket mini-service (port 3003) + REST polling fallback |
| **Caching** | In-memory TTL cache with LRU eviction + concurrent request deduplication |
| **Data sources** | MLB Stats API (`statsapi.mlb.com`) + Baseball Savant Statcast feed (`baseballsavant.mlb.com/gf`) |
| **Gateway** | Caddy (reverse proxy on port 81 → port 3000 + WebSocket routing) |

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) ≥ 20 or [Bun](https://bun.sh/) ≥ 1.3
- No API keys required — all data comes from public MLB endpoints

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/stitches-and-stats.git
cd stitches-and-stats

# Install dependencies
bun install
# or: npm install

# Install mini-service dependencies
cd mini-services/live-feed && bun install && cd ../..
```

### Development

```bash
# 1. Start the Next.js dev server (port 3000)
bun run dev

# 2. In a separate terminal, start the WebSocket mini-service (port 3003)
cd mini-services/live-feed
bun run dev
```

The app will be available at `http://localhost:3000`.

> **Note:** The app works fully via REST polling even without the WebSocket service running. The WS service enables real-time push updates for live games.

### Production Build

```bash
# Build the Next.js app (standalone output)
bun run build

# Start the production server
bun run start

# Start the WebSocket service in production mode
cd mini-services/live-feed
bun start
```

The standalone build is output to `.next/standalone/` and can be deployed to any Node.js host (Vercel, Railway, Fly.io, a VPS, Docker, etc.).

## Project Structure

```
stitches-and-stats/
├── src/
│   ├── app/
│   │   ├── api/                    # Next.js API routes
│   │   │   ├── schedule/           # Today + yesterday's games
│   │   │   ├── game/[gamePk]/      # Enriched pitch data (MLB + Statcast)
│   │   │   ├── savant/[gamePk]/    # Raw Statcast game feed
│   │   │   ├── leaderboard/        # Season leaderboards (batters/pitchers)
│   │   │   ├── players/            # Player search
│   │   │   └── player/[playerId]/  # Player bio + stats + percentiles
│   │   ├── globals.css             # Dark theme + glassmorphism utilities
│   │   ├── layout.tsx              # Root layout (forces dark mode)
│   │   └── page.tsx                # Main page (view switching)
│   ├── components/
│   │   ├── header.tsx              # Sticky nav + WS status indicator
│   │   ├── footer.tsx
│   │   ├── global-player-search.tsx # Predictive search with keyboard nav
│   │   ├── strike-zone.tsx         # SVG strike zone with pitch dots
│   │   ├── pitch-log-entry.tsx     # Expandable pitch card
│   │   ├── live-feed-view.tsx      # Live game dashboard
│   │   ├── players-view.tsx        # Player profile + percentile sliders
│   │   ├── leaderboards-view.tsx   # Filterable, sortable leaderboard table
│   │   ├── socket-provider.tsx     # Socket.io client + React context
│   │   ├── error-boundary.tsx      # Global error boundary
│   │   ├── loading-states.tsx      # Skeleton/empty/error state components
│   │   ├── providers.tsx           # React Query + Socket providers
│   │   └── ui/                     # shadcn/ui components
│   ├── lib/
│   │   ├── mlb-api.ts              # MLB + Savant API client with cache
│   │   ├── cache.ts                # In-memory TTL cache with LRU + dedup
│   │   ├── store.ts                # Zustand store (view, game, filters)
│   │   ├── types.ts                # TypeScript types
│   │   ├── db.ts                   # Prisma client
│   │   └── utils.ts                # cn() utility
│   └── hooks/
├── mini-services/
│   └── live-feed/                  # Socket.io WebSocket service (port 3003)
│       ├── index.ts                # Service entry point
│       ├── package.json
│       ├── supervisor.sh           # Auto-restart supervisor
│       └── keepalive.sh            # Health-check respawner
├── prisma/
│   └── schema.prisma               # Database schema (SQLite by default)
├── public/
├── .env.example                    # Environment variable template
├── .gitignore
├── Caddyfile                       # Caddy reverse proxy config (reference)
├── next.config.ts                  # Next.js config (standalone output)
├── package.json
└── README.md
```

## How It Works

### Data Pipeline

1. **Schedule**: Fetches today's + yesterday's games from MLB Stats API (`/api/v1/schedule`). Yesterday's final games are included so pitch data is always available even when no live games are in progress.

2. **Live Feed**: For each game, two data sources are merged:
   - **MLB Stats API** (`/api/v1.1/game/{gamePk}/feed/live`) — provides play-by-play structure, pitch coordinates (pX, pZ), strike zone dimensions, and game state
   - **Baseball Savant** (`/gf?game_pk={gamePk}`) — provides Statcast metrics per pitch (exit velocity, launch angle, spin rate, barrel, xBA, bat speed, break, etc.)
   
   Pitches are joined by a composite key: `{inning}-{halfInning}-{abNumber}-{pitchNumber}`.

3. **Leaderboards**: Fetched from Baseball Savant's CSV leaderboard endpoint (`/leaderboard/custom`) with configurable filters (season, min PA, team, position, game type). CSV is parsed into typed records.

4. **Percentiles**: Computed live by comparing a player's stats against the full leaderboard population. Each metric's percentile = percentage of players with a worse value.

### Real-Time Updates

- **WebSocket service** (port 3003): Polls MLB + Savant APIs every 8 seconds for each subscribed game. Emits `game:snapshot` (full state) and `game:pitch` (granular new-pitch event) to subscribed clients.
- **Client**: Subscribes via `socket.io-client` through the Caddy gateway (`/?XTransformPort=3003`). Falls back to REST polling (5s interval) if the WS service is unavailable.
- **Reconnection**: Infinite attempts with exponential backoff (1s → 10s max).

### Caching Strategy

- **Schedule**: 1 minute TTL (refreshes live game states)
- **Live feed**: 1 minute TTL for live games, 1 hour for final games
- **Statcast game feed**: 1 minute TTL
- **Leaderboards**: 5 minute TTL
- **Player search registry**: 1 day TTL
- **Player bios**: 1 day TTL
- **LRU eviction** at 1000 entries
- **Concurrent request deduplication**: Multiple callers requesting the same cache key share a single in-flight promise

## Deployment

### Vercel (recommended for the Next.js app)

1. Push this repo to GitHub
2. Import the repo in Vercel
3. No environment variables needed (all data is from public APIs)
4. Deploy

> **Note:** The WebSocket mini-service cannot run on Vercel (serverless). Deploy it separately to a host that supports persistent processes (Railway, Fly.io, Render, a VPS). The Next.js app will gracefully fall back to REST polling without it.

### Docker / VPS / Railway

```bash
# Build
bun run build

# Run the Next.js standalone server
bun run start

# In a separate process, run the WS service
cd mini-services/live-feed && bun start
```

### Caddy Gateway (reference)

The included `Caddyfile` shows the reverse proxy setup:
- Port 81 → Next.js (port 3000) for all HTTP traffic
- Port 81 with `?XTransformPort=3003` query → WebSocket service (port 3003)

For production, configure Caddy with your domain and TLS termination.

## Data Sources

All data is fetched from public, official MLB endpoints:

- **MLB Stats API** — `https://statsapi.mlb.com/api/`
  - Schedule, game feeds, play-by-play, player registry
  - No API key required
- **Baseball Savant Statcast** — `https://baseballsavant.mlb.com/gf?game_pk={id}`
  - Per-pitch tracking metrics (exit velocity, launch angle, spin rate, etc.)
  - Season leaderboards (CSV format)
  - No API key required

This project is for educational/demonstration purposes and is not affiliated with MLB.

## Tech Notes

- **No `ignoreBuildErrors`**: TypeScript and ESLint are enforced in CI
- **Error boundary**: Catches render errors so a single broken component doesn't crash the app
- **Loading states**: Shimmer skeletons for all async views
- **Empty/error states**: Graceful handling for API failures, missing data, and preview games
- **Fetch timeouts**: All upstream API calls have 8–15s `AbortSignal.timeout` to prevent hangs
- **Mobile responsive**: All 3 views work on mobile (single-column layout, icon-only nav)
- **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation, screen-reader support

## License

MIT — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [MLB Stats API](https://statsapi.mlb.com/) — public baseball data
- [Baseball Savant](https://baseballsavant.mlb.com/) — Statcast metrics and leaderboards
- [shadcn/ui](https://ui.shadcn.com/) — component library
- [Framer Motion](https://www.framer.com/motion/) — animations
- [Socket.io](https://socket.io/) — real-time communication
