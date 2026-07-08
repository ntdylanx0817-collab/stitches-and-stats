import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'
import { appendFileSync } from 'fs'

// ===== Constants =====
const PORT = 3003
const STATS_API = 'https://statsapi.mlb.com/api'
const SAVANT_API = 'https://baseballsavant.mlb.com'
const POLL_INTERVAL_MS = 8_000 // poll each active game every 8s

// ===== Types =====
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
const gameDataCache = new Map<number, { fetchedAt: number; data: any }>()
const GAME_TTL_MS = 30_000

// ===== Helpers =====
function log(msg: string) {
  const ts = new Date().toISOString()
  const line = `[${ts}] ${msg}\n`
  process.stdout.write(line)
  try { appendFileSync('/home/z/my-project/mini-services/live-feed/service.log', line) } catch {}
}

async function fetchJSON(url: string, init?: RequestInit): Promise<any> {
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
  return await res.json()
}

function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Fetch the list of today's games (with status), pick live ones to monitor. */
async function fetchLiveGamePks(): Promise<Array<{ gamePk: number; status: string; away?: string; home?: string }>> {
  const date = ymd(new Date())
  const url = `${STATS_API}/v1/schedule?sportId=1&date=${encodeURIComponent(date)}`
  try {
    const data = await fetchJSON(url)
    const games = data?.dates?.[0]?.games ?? []
    return games
      .filter((g: any) => {
        const state = g?.status?.abstractGameState
        // Live games OR recently final (within last hour) so users can still see final plays
        return state === 'Live' || state === 'Final' || state === 'Preview'
      })
      .map((g: any) => ({
        gamePk: g.gamePk,
        status: g.status.abstractGameState,
        away: g.teams?.away?.team?.name,
        home: g.teams?.home?.team?.name,
      }))
  } catch (err) {
    log(`Error fetching schedule: ${(err as Error).message}`)
    return []
  }
}

/** Fetch live feed for a game. */
async function fetchLiveFeed(gamePk: number): Promise<any | null> {
  try {
    const url = `${STATS_API}/v1.1/game/${gamePk}/feed/live`
    return await fetchJSON(url)
  } catch (err) {
    log(`Error fetching feed ${gamePk}: ${(err as Error).message}`)
    return null
  }
}

/** Fetch savant statcast data for a game. */
async function fetchSavantFeed(gamePk: number): Promise<any | null> {
  try {
    const url = `${SAVANT_API}/gf?game_pk=${gamePk}`
    return await fetchJSON(url)
  } catch (err) {
    return null
  }
}

/** Strip a feed to its essential real-time updates. */
function extractFeedSnapshot(feed: any) {
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
    allPlays: allPlays.map((p: any) => ({
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
      playEvents: (p.playEvents ?? []).map((e: any) => ({
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
      pitchCount: p.playEvents?.filter((e: any) => e.isPitch).length ?? 0,
    })),
    currentPlay,
    playCount: allPlays.length,
  }
}

function extractSavantSnapshot(savant: any) {
  return {
    exit_velocity: (savant?.exit_velocity ?? []).map((p: any) => ({
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
        let latestPitch: any = null
        const pitchEvents = lastPlay?.playEvents?.filter((e: any) => e.isPitch) ?? []
        const lastPitchEvent = pitchEvents[pitchEvents.length - 1] ?? null
        if (lastPitchEvent) {
          const inning = lastPlay.about.inning
          const halfInning = lastPlay.about.halfInning
          const abNumber = lastPlay.atBatIndex + 1
          const pitchNumber = lastPitchEvent.pitchNumber ?? 0
          const key = `${inning}-${halfInning}-${abNumber}-${pitchNumber}`
          const sp = savantSnapshot?.exit_velocity?.find(
            (p: any) => `${p.inning}-${p.half_inning}-${p.ab_number}-${p.pitch_number}` === key
          )
          latestPitch = {
            key,
            inning,
            halfInning,
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
            startSpeed: sp?.start_speed ?? lastPitchEvent.pitchData?.startSpeed,
            spinRate: sp?.spin_rate ?? lastPitchEvent.pitchData?.spinRate,
            breakX: sp?.breakX ?? lastPitchEvent.pitchData?.breakX,
            breakZ: sp?.breakZ ?? lastPitchEvent.pitchData?.breakZ,
            extension: sp?.extension ?? lastPitchEvent.pitchData?.extension,
            plateTime: sp?.plateTime ?? lastPitchEvent.pitchData?.plateTime,
            szTop: sp?.sz_top ?? lastPitchEvent.pitchData?.strikeZoneTop,
            szBot: sp?.sz_bot ?? lastPitchEvent.pitchData?.strikeZoneBottom,
            pX: sp?.px ?? lastPitchEvent.pitchData?.coordinates?.pX,
            pZ: sp?.pz ?? lastPitchEvent.pitchData?.coordinates?.pZ,
            zone: sp?.zone ?? lastPitchEvent.pitchData?.zone,
            pitchType: sp?.pitch_type ?? lastPitchEvent.details?.type?.code,
            pitchName: sp?.pitch_name ?? lastPitchEvent.details?.type?.description,
            exitVelocity: sp?.hit_speed != null ? parseFloat(sp.hit_speed) : null,
            launchAngle: sp?.hit_angle != null ? parseFloat(sp.hit_angle) : null,
            hitDistance: sp?.hit_distance != null ? parseFloat(sp.hit_distance) : null,
            xBA: sp?.xba != null && sp.xba !== '' ? parseFloat(sp.xba) : null,
            isBarrel: sp?.is_barrel === 1,
            isSword: !!sp?.isSword,
            batSpeed: sp?.batSpeed ?? null,
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
  cors: { origin: '*', methods: ['GET', 'POST'] },
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
  log(`Savant XL live-feed WebSocket service listening on port ${PORT}`)
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
