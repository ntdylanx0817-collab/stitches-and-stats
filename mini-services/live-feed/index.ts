import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'
import { appendFileSync } from 'fs'

// ===== Constants =====
const PORT = 3003
const STATS_API = 'https://statsapi.mlb.com/api'
const SAVANT_API = 'https://baseballsavant.mlb.com'
const POLL_INTERVAL_MS = 8_000 // poll each active game every 8s

// ===== Types =====
//
// This service is its own package and does not share the Next app's module
// graph, so the upstream payloads are described here rather than imported.
// They are intentionally permissive: the service relays fields through to the
// client and only reads a handful of them itself.

/** An arbitrary JSON object from an upstream API. */
type Json = Record<string, unknown>

/** A pitch/action event inside a play, from the MLB live feed. */
interface FeedPlayEvent {
  index?: number
  playId?: string
  pitchNumber?: number
  isPitch?: boolean
  startTime?: string
  endTime?: string
  type?: string
  details?: {
    description?: string
    call?: { code: string; description: string }
    isStrike?: boolean
    isBall?: boolean
    isInPlay?: boolean
    type?: { code?: string; description?: string }
  }
  count?: { balls: number; strikes: number; outs: number }
  pitchData?: {
    startSpeed?: number
    strikeZoneTop?: number
    strikeZoneBottom?: number
    coordinates?: { pX?: number; pZ?: number }
    zone?: number
    breakX?: number
    breakZ?: number
    spinRate?: number
    extension?: number
    plateTime?: number
  }
}

/** A play from the MLB live feed's `allPlays`. */
interface FeedPlay {
  atBatIndex: number
  about: { inning: number; halfInning: 'top' | 'bottom'; [k: string]: unknown }
  result?: { event?: string; description?: string; homeScore?: number; awayScore?: number }
  count?: { balls: number; strikes: number; outs: number }
  matchup?: {
    batter?: { id: number; fullName: string }
    pitcher?: { id: number; fullName: string }
    batterSide?: { code: string }
    pitchHand?: { code: string }
    [k: string]: unknown
  }
  playEndTime?: string
  playEvents?: FeedPlayEvent[]
}

/** The MLB live feed response, narrowed to what this service reads. */
interface LiveFeed {
  gameData?: {
    status?: { abstractGameState?: string; [k: string]: unknown }
    teams?: { away?: Json; home?: Json }
    venue?: Json
    datetime?: Json
  }
  liveData?: {
    linescore?: Json
    plays?: { allPlays?: FeedPlay[]; currentPlay?: FeedPlay }
  }
}

/** One Statcast pitch record from Baseball Savant's game feed. */
interface SavantPitch {
  play_id?: string
  inning?: number
  half_inning?: string
  ab_number?: number
  pitch_number?: number
  [metric: string]: unknown
}

/** Baseball Savant's game feed, narrowed to what this service reads. */
interface SavantFeed {
  exit_velocity?: SavantPitch[]
  home_runs?: unknown[]
  game_status?: unknown
}

interface LiveGameState {
  gamePk: number
  status: string
  lastPlayIndex: number
  lastPitchCount: number
  subscribers: Set<string>
}

// ===== State =====
const activeGameSubs = new Map<number, Set<string>>() // gamePk -> socket ids
const liveGames = new Map<number, LiveGameState>()

// ===== Helpers =====
// File logging is opt-in via LOG_FILE. stdout is always written, so a process
// manager (systemd, Docker, pm2) captures logs without any path configuration.
const LOG_FILE = process.env.LOG_FILE ?? ''
const PRETTY_LOGS = process.env.NODE_ENV !== 'production'

/**
 * Emits the same JSON-lines shape as the Next app's logger (src/lib/logger.ts)
 * so both halves of the system aggregate together. Kept as a separate copy
 * because this service is its own package and does not share the app's
 * module graph.
 */
function log(msg: string, fields: Record<string, unknown> = {}, level: 'info' | 'warn' | 'error' = 'info') {
  const ts = new Date().toISOString()
  const line = PRETTY_LOGS
    ? `[${ts}] ${msg}${Object.keys(fields).length ? ' ' + JSON.stringify(fields) : ''}\n`
    : JSON.stringify({ ts, level, msg, service: 'live-feed', ...fields }) + '\n'
  process.stdout.write(line)
  if (LOG_FILE) {
    try { appendFileSync(LOG_FILE, line) } catch {}
  }
}

/**
 * Origins allowed to open a WebSocket connection to this service.
 *
 * The frontend normally reaches this service through the Caddy gateway on
 * the same origin (see socket-provider.tsx's `XTransformPort` comment), so a
 * same-origin browser client never needs CORS clearance at all — this list
 * only matters for direct cross-origin connections. It used to be `origin:
 * '*'`, which let any website's script connect and ride along on this
 * deployment's outbound polling of the MLB/Savant APIs.
 *
 * Comma-separated via ALLOWED_ORIGINS. Unset means "same-origin only" in
 * production; local dev gets localhost so `bun dev` works without any setup.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV === 'production') {
  log(
    'ALLOWED_ORIGINS is unset in production — cross-origin WebSocket connections will be rejected. Set it to a comma-separated list of trusted origins if the frontend is served from a different origin than this service.',
    {},
    'warn'
  )
}

const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000']

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true
  const allowed = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEV_ORIGINS
  return allowed.includes(origin)
}

/**
 * Sets Access-Control-Allow-Origin on the polling transport's HTTP
 * responses. This alone does NOT block anything — the `cors` package only
 * shapes response headers, and a browser does not enforce CORS on the raw
 * WebSocket transport the way it does on XHR/fetch. `allowRequest` below is
 * what actually rejects a connection.
 */
function corsOriginCheck(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  callback(null, isOriginAllowed(origin))
}

/**
 * Engine.IO invokes this for every incoming request — polling *and* the
 * WebSocket upgrade alike — before a transport is established, and can
 * refuse the connection outright. This is the actual enforcement point.
 *
 * `cors.origin` alone left every transport open regardless of its verdict:
 * a `transports: ['websocket']` client with an untrusted Origin header
 * connected successfully in testing even after `cors.origin` was wired up,
 * because Socket.IO's `cors` config never gates the upgrade path.
 */
function allowRequest(req: IncomingMessage, callback: (err: string | null | undefined, success: boolean) => void) {
  callback(null, isOriginAllowed(req.headers.origin))
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(8_000),
    headers: {
      'Accept': 'application/json',
      'Referer': 'https://baseballsavant.mlb.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  return (await res.json()) as T
}

/** Fetch live feed for a game. */
async function fetchLiveFeed(gamePk: number): Promise<LiveFeed | null> {
  try {
    const url = `${STATS_API}/v1.1/game/${gamePk}/feed/live`
    return await fetchJSON<LiveFeed>(url)
  } catch (err) {
    log(`Error fetching feed ${gamePk}: ${(err as Error).message}`)
    return null
  }
}

/** Fetch savant statcast data for a game. */
async function fetchSavantFeed(gamePk: number): Promise<SavantFeed | null> {
  try {
    const url = `${SAVANT_API}/gf?game_pk=${gamePk}`
    return await fetchJSON<SavantFeed>(url)
  } catch {
    return null
  }
}

/** Strip a feed to its essential real-time updates. */
function extractFeedSnapshot(feed: LiveFeed) {
  const allPlays = feed?.liveData?.plays?.allPlays ?? []
  const currentPlay = feed?.liveData?.plays?.currentPlay ?? null
  return {
    status: feed?.gameData?.status ?? null,
    linescore: feed?.liveData?.linescore ?? null,
    teams: {
      away: feed?.gameData?.teams?.away,
      home: feed?.gameData?.teams?.home,
    },
    venue: feed?.gameData?.venue,
    datetime: feed?.gameData?.datetime,
    allPlays: allPlays.map((p: FeedPlay) => ({
      atBatIndex: p.atBatIndex,
      about: p.about,
      result: p.result,
      count: p.count,
      matchup: {
        batter: p.matchup?.batter,
        pitcher: p.matchup?.pitcher,
        batterSide: p.matchup?.batterSide,
        pitchHand: p.matchup?.pitchHand,
        postOnFirst: p.matchup?.postOnFirst,
        postOnSecond: p.matchup?.postOnSecond,
        postOnThird: p.matchup?.postOnThird,
      },
      playEndTime: p.playEndTime,
      // Include ALL pitch events (not just the last one) so the client can
      // render the full pitch log and strike zone. Each event is trimmed to
      // the fields we actually use to keep payload size manageable.
      playEvents: (p.playEvents ?? []).map((e: FeedPlayEvent) => ({
        index: e.index,
        playId: e.playId,
        pitchNumber: e.pitchNumber,
        isPitch: e.isPitch,
        startTime: e.startTime,
        endTime: e.endTime,
        type: e.type,
        details: e.details,
        count: e.count,
        pitchData: e.pitchData,
      })),
      pitchCount: p.playEvents?.filter((e: FeedPlayEvent) => e.isPitch).length ?? 0,
    })),
    currentPlay,
    playCount: allPlays.length,
  }
}

function extractSavantSnapshot(savant: SavantFeed) {
  return {
    exit_velocity: (savant?.exit_velocity ?? []).map((p: SavantPitch) => ({
      play_id: p.play_id,
      inning: p.inning,
      half_inning: p.half_inning,
      ab_number: p.ab_number,
      pitch_number: p.pitch_number,
      batter_name: p.batter_name,
      pitcher_name: p.pitcher_name,
      pitch_type: p.pitch_type,
      pitch_name: p.pitch_name,
      start_speed: p.start_speed,
      spin_rate: p.spin_rate,
      breakX: p.breakX,
      breakZ: p.breakZ,
      inducedBreakZ: p.inducedBreakZ,
      extension: p.extension,
      plateTime: p.plateTime,
      px: p.px,
      pz: p.pz,
      sz_top: p.sz_top,
      sz_bot: p.sz_bot,
      zone: p.zone,
      hit_speed: p.hit_speed,
      hit_angle: p.hit_angle,
      hit_distance: p.hit_distance,
      xba: p.xba,
      is_barrel: p.is_barrel,
      batSpeed: p.batSpeed,
      isSword: p.isSword,
      result: p.result,
      des: p.des,
      team_batting: p.team_batting,
      team_fielding: p.team_fielding,
      outs: p.outs,
      balls: p.balls,
      strikes: p.strikes,
    })),
    home_runs: savant?.home_runs ?? [],
    game_status: savant?.game_status,
  }
}

// ===== Real-time loop =====
let polling = false

async function pollLoop() {
  if (polling) return
  polling = true
  try {
    // Only poll games that have at least one subscriber
    const gamesToPoll = Array.from(activeGameSubs.entries())
        .filter(([_, subs]) => subs.size > 0)
        .map(([pk, _]) => pk)

    for (const gamePk of gamesToPoll) {
      try {
        const [feed, savant] = await Promise.all([
          fetchLiveFeed(gamePk),
          fetchSavantFeed(gamePk),
        ])
        if (!feed) continue

        const snapshot = extractFeedSnapshot(feed)
        const savantSnapshot = savant ? extractSavantSnapshot(savant) : null

        const state = liveGames.get(gamePk)
        const isNewPlay = state ? state.lastPlayIndex !== snapshot.playCount - 1 : true
        const lastPlay = snapshot.allPlays[snapshot.allPlays.length - 1] ?? null

        // Build the latest pitch event (if any) by combining feed + savant.
        // Use the LAST pitch event from the last play (not just lastEvent which
        // could be a non-pitch action like a pickoff).
        let latestPitch: { pitchNumber: number; [field: string]: unknown } | null = null
        const pitchEvents = lastPlay?.playEvents?.filter((e: FeedPlayEvent) => e.isPitch) ?? []
        const lastPitchEvent = pitchEvents[pitchEvents.length - 1] ?? null
        if (lastPitchEvent) {
          const inning = lastPlay.about.inning
          const halfInning = lastPlay.about.halfInning
          const atBatIndex = lastPlay.atBatIndex
          const pitchNumber = lastPitchEvent.pitchNumber ?? 0
          const abNumber = atBatIndex + 1
          const key = `${inning}-${halfInning}-${abNumber}-${pitchNumber}`
          const sp = savantSnapshot?.exit_velocity?.find(
            (p: SavantPitch) => `${p.inning}-${p.half_inning}-${p.ab_number}-${p.pitch_number}` === key
          )
          latestPitch = {
            key,
            inning,
            halfInning,
            atBatIndex,
            abNumber,
            pitchNumber,
            batter: lastPlay.matchup?.batter,
            pitcher: lastPlay.matchup?.pitcher,
            batterSide: lastPlay.matchup?.batterSide?.code,
            pitchHand: lastPlay.matchup?.pitchHand?.code,
            description: lastPitchEvent.details?.description,
            call: lastPitchEvent.details?.call,
            isStrike: lastPitchEvent.details?.isStrike,
            isBall: lastPitchEvent.details?.isBall,
            isInPlay: lastPitchEvent.details?.isInPlay,
            coordinates: lastPitchEvent.pitchData?.coordinates,
            startSpeed: sp?.start_speed != null ? Number(sp.start_speed) : (lastPitchEvent.pitchData?.startSpeed ?? null),
            spinRate: sp?.spin_rate != null ? Number(sp.spin_rate) : (lastPitchEvent.pitchData?.spinRate ?? null),
            breakX: sp?.breakX != null ? Number(sp.breakX) : (lastPitchEvent.pitchData?.breakX ?? null),
            breakZ: sp?.breakZ != null ? Number(sp.breakZ) : (lastPitchEvent.pitchData?.breakZ ?? null),
            extension: sp?.extension != null ? Number(sp.extension) : (lastPitchEvent.pitchData?.extension ?? null),
            plateTime: sp?.plateTime != null ? Number(sp.plateTime) : (lastPitchEvent.pitchData?.plateTime ?? null),
            szTop: sp?.sz_top != null ? Number(sp.sz_top) : (lastPitchEvent.pitchData?.strikeZoneTop ?? null),
            szBot: sp?.sz_bot != null ? Number(sp.sz_bot) : (lastPitchEvent.pitchData?.strikeZoneBottom ?? null),
            pX: sp?.px != null ? Number(sp.px) : (lastPitchEvent.pitchData?.coordinates?.pX ?? null),
            pZ: sp?.pz != null ? Number(sp.pz) : (lastPitchEvent.pitchData?.coordinates?.pZ ?? null),
            zone: sp?.zone ?? lastPitchEvent.pitchData?.zone,
            pitchType: sp?.pitch_type ?? lastPitchEvent.details?.type?.code,
            pitchName: sp?.pitch_name ?? lastPitchEvent.details?.type?.description,
            exitVelocity: sp?.hit_speed != null && sp.hit_speed !== '' ? parseFloat(String(sp.hit_speed)) : null,
            launchAngle: sp?.hit_angle != null && sp.hit_angle !== '' ? parseFloat(String(sp.hit_angle)) : null,
            hitDistance: sp?.hit_distance != null && sp.hit_distance !== '' ? parseFloat(String(sp.hit_distance)) : null,
            xBA: sp?.xba != null && sp.xba !== '' ? parseFloat(String(sp.xba)) : null,
            isBarrel: sp?.is_barrel === 1,
            isSword: !!sp?.isSword,
            batSpeed: sp?.batSpeed != null ? Number(sp.batSpeed) : null,
            result: lastPlay.result?.event,
            resultDescription: lastPlay.result?.description,
            homeScore: lastPlay.result?.homeScore,
            awayScore: lastPlay.result?.awayScore,
            count: lastPlay.count,
            timestamp: lastPitchEvent.endTime ?? lastPlay.playEndTime,
          }
        }

        // Detect a genuinely new pitch (vs. a new at-bat) by tracking the last
        // pitch key we emitted for this game.
        const lastSeenKey = state ? `${state.lastPlayIndex}-${state.lastPitchCount}` : ''
        const currentKey = `${snapshot.playCount - 1}-${latestPitch?.pitchNumber ?? 0}`
        const isNewPitch = !!latestPitch && lastSeenKey !== currentKey

        // Update state
        liveGames.set(gamePk, {
          gamePk,
          status: snapshot.status?.abstractGameState ?? 'Unknown',
          lastPlayIndex: snapshot.playCount - 1,
          lastPitchCount: latestPitch?.pitchNumber ?? 0,
          subscribers: state?.subscribers ?? new Set(),
        })

        // Emit to subscribers of this game
        io.to(`game:${gamePk}`).emit('game:snapshot', {
          gamePk,
          status: snapshot.status,
          linescore: snapshot.linescore,
          teams: snapshot.teams,
          allPlays: snapshot.allPlays,
          currentPlay: snapshot.currentPlay,
          playCount: snapshot.playCount,
          savant: savantSnapshot,
          latestPitch,
          isNewPlay,
          timestamp: Date.now(),
        })

        // If there's a new pitch, also emit a separate event for snappy UI feedback
        if (latestPitch && isNewPitch) {
          io.to(`game:${gamePk}`).emit('game:pitch', latestPitch)
        }
      } catch (err) {
        log(`Error polling ${gamePk}: ${(err as Error).message}`)
      }
    }
  } finally {
    polling = false
  }
}

// ===== HTTP server + Socket.io =====
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, activeGames: liveGames.size, totalSubs: Array.from(activeGameSubs.values()).reduce((a, s) => a + s.size, 0) }))
    return
  }
  res.writeHead(404)
  res.end('Not Found')
})

const io = new Server(httpServer, {
  path: '/',
  cors: { origin: corsOriginCheck, methods: ['GET', 'POST'] },
  allowRequest,
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  log(`Client connected: ${socket.id}`)

  socket.on('subscribe:game', async ({ gamePk }: { gamePk: number }) => {
    if (!gamePk) return
    socket.join(`game:${gamePk}`)
    if (!activeGameSubs.has(gamePk)) activeGameSubs.set(gamePk, new Set())
    activeGameSubs.get(gamePk)!.add(socket.id)
    log(`Socket ${socket.id} subscribed to game ${gamePk}`)

    // Send initial snapshot immediately
    try {
      const [feed, savant] = await Promise.all([
        fetchLiveFeed(gamePk),
        fetchSavantFeed(gamePk),
      ])
      if (feed) {
        const snapshot = extractFeedSnapshot(feed)
        const savantSnapshot = savant ? extractSavantSnapshot(savant) : null
        socket.emit('game:snapshot', {
          gamePk,
          status: snapshot.status,
          linescore: snapshot.linescore,
          teams: snapshot.teams,
          allPlays: snapshot.allPlays,
          currentPlay: snapshot.currentPlay,
          playCount: snapshot.playCount,
          savant: savantSnapshot,
          latestPitch: null,
          isNewPlay: false,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      log(`Initial snapshot error for ${gamePk}: ${(err as Error).message}`)
    }

    // Trigger immediate poll for this game
    setTimeout(() => pollLoop(), 100)
  })

  socket.on('unsubscribe:game', ({ gamePk }: { gamePk: number }) => {
    socket.leave(`game:${gamePk}`)
    const subs = activeGameSubs.get(gamePk)
    if (subs) {
      subs.delete(socket.id)
      if (subs.size === 0) {
        activeGameSubs.delete(gamePk)
        liveGames.delete(gamePk)
      }
    }
  })

  socket.on('disconnect', () => {
    log(`Client disconnected: ${socket.id}`)
    for (const [pk, subs] of activeGameSubs.entries()) {
      subs.delete(socket.id)
      if (subs.size === 0) {
        activeGameSubs.delete(pk)
        liveGames.delete(pk)
      }
    }
  })

  socket.on('error', (err: Error) => {
    log(`Socket ${socket.id} error: ${err.message}`)
  })
})

httpServer.listen(PORT, () => {
  log(`Stitches and Stats live-feed WebSocket service listening on port ${PORT}`)
  log(`Polling interval: ${POLL_INTERVAL_MS}ms`)
  // Start polling loop — keep a handle so we can clear it on shutdown
  const pollInterval = setInterval(pollLoop, POLL_INTERVAL_MS)
  // Initial poll
  setTimeout(pollLoop, 1000)

  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down')
    clearInterval(pollInterval)
    io.close()
    httpServer.close(() => process.exit(0))
  })
  process.on('SIGINT', () => {
    log('SIGINT received, shutting down')
    clearInterval(pollInterval)
    io.close()
    httpServer.close(() => process.exit(0))
  })
})
