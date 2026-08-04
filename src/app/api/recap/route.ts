import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { assertOk, errorMessage, errorResponse } from "@/lib/api-errors";
import { logger } from "@/lib/logger";
import { fetchStandings, buildPlayoffPicture, type PlayoffPicture } from "@/lib/standings";
import {
  buildInjuryReport,
  defaultRecapDate,
  isValidYmd,
  localYmd,
  rankHitters,
  rankPitchers,
  summarizeSlate,
  sumStat,
  type HittingSplitStat,
  type PitchingSplitStat,
  type RecapGame,
  type RecapInjury,
  type RawTransaction,
  type RecapHitter,
  type RecapPitcher,
  type SlateTotals,
  type StatSplit,
} from "@/lib/recap";
import type { MLBGame, MLBSchedule } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const STATS_API = "https://statsapi.mlb.com/api";
const log = logger.child({ component: "recap" });

/** How many standout performances each side of the box score contributes. */
const TOP_HITTERS = 8;
const TOP_PITCHERS = 6;

/**
 * Ceiling on how many player splits `/v1/stats?stats=byDateRange` returns per
 * side. This has to comfortably clear the number of distinct players who can
 * appear in a day's box scores, not just how many the recap displays — the
 * endpoint's own default ordering is not "best performance first", so a limit
 * that truncated the pool would risk silently dropping the actual best line
 * before this module ever gets a chance to rank it.
 *
 * ~15 games at up to ~17 hitters and ~10 pitchers apiece (bench + a bullpen
 * game) covers a normal full slate several times over; doubled for the rare
 * day stacked with doubleheader makeups.
 */
const HITTING_SPLITS_LIMIT = 600;
const PITCHING_SPLITS_LIMIT = 400;

export interface RecapPayload {
  date: string;
  season: number;
  /** Every game on the slate has finished. */
  isComplete: boolean;
  totals: SlateTotals & { homeRuns: number; hits: number; strikeOuts: number };
  games: RecapGame[];
  hitters: RecapHitter[];
  pitchers: RecapPitcher[];
  injuries: RecapInjury[];
  playoffs: PlayoffPicture | null;
  /** Sections that failed upstream, so the client can say so instead of showing an empty list. */
  warnings: string[];
  generatedAt: number;
}

interface DecisionPerson {
  id?: number;
  fullName?: string;
}

/** A schedule game with the `decisions` hydration attached. */
type ScheduledGame = MLBGame & {
  decisions?: { winner?: DecisionPerson; loser?: DecisionPerson; save?: DecisionPerson };
  scheduledInnings?: number;
};

async function getJson<T>(url: string, label: string, timeoutMs = 12_000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  await assertOk(res, label);
  return (await res.json()) as T;
}

function person(p: DecisionPerson | undefined): { id: number; name: string } | undefined {
  if (!p?.id) return undefined;
  return { id: p.id, name: p.fullName ?? "Unknown" };
}

function recordStr(r?: { wins: number; losses: number }): string | undefined {
  if (!r) return undefined;
  return `${r.wins ?? 0}-${r.losses ?? 0}`;
}

function toRecapGame(g: ScheduledGame): RecapGame {
  const away = g.teams?.away;
  const home = g.teams?.home;
  const linescore = g.linescore;

  // `scheduledInnings` rather than a hardcoded 9: doubleheaders have been
  // played at seven, and a seven-inning game is not an extra-inning game.
  const regulation = g.scheduledInnings ?? 9;
  const innings = linescore?.currentInning ?? regulation;

  return {
    gamePk: g.gamePk,
    state: g.status?.abstractGameState ?? "Preview",
    detailedState: g.status?.detailedState ?? "",
    gameDate: g.gameDate,
    venue: g.venue?.name,
    seriesDescription: g.seriesDescription,
    gameType: g.gameType,
    gameNumber: g.doubleHeader && g.doubleHeader !== "N" ? g.gameNumber : undefined,
    innings,
    isExtras: innings > regulation,
    away: {
      id: away?.team?.id ?? 0,
      abbr: away?.team?.abbreviation ?? "???",
      name: away?.team?.name ?? "Unknown",
      score: away?.score ?? null,
      record: recordStr(away?.leagueRecord),
      isWinner: away?.isWinner === true,
    },
    home: {
      id: home?.team?.id ?? 0,
      abbr: home?.team?.abbreviation ?? "???",
      name: home?.team?.name ?? "Unknown",
      score: home?.score ?? null,
      record: recordStr(home?.leagueRecord),
      isWinner: home?.isWinner === true,
    },
    decisions: g.decisions
      ? {
          winner: person(g.decisions.winner),
          loser: person(g.decisions.loser),
          save: person(g.decisions.save),
        }
      : undefined,
  };
}

/** Games in the order a recap reads best: closest finishes and extras first. */
function sortGames(games: RecapGame[]): RecapGame[] {
  return [...games].sort((a, b) => {
    // Anything still being played leads — it is the only part of the slate
    // that is going to change.
    const liveRank = (g: RecapGame) => (g.state === "Live" ? 0 : g.state === "Final" ? 1 : 2);
    const byLive = liveRank(a) - liveRank(b);
    if (byLive !== 0) return byLive;

    const drama = (g: RecapGame) => {
      if (g.away.score == null || g.home.score == null) return 99;
      const margin = Math.abs(g.away.score - g.home.score);
      return (g.isExtras ? -1 : 0) + margin;
    };
    return drama(a) - drama(b) || a.gameDate.localeCompare(b.gameDate);
  });
}

function statsUrl(group: "hitting" | "pitching", date: string, limit: number): string {
  const params = new URLSearchParams({
    stats: "byDateRange",
    group,
    startDate: date,
    endDate: date,
    sportId: "1",
    limit: String(limit),
  });
  return `${STATS_API}/v1/stats?${params}`;
}

interface StatsResponse<S> {
  stats?: Array<{ splits?: StatSplit<S>[] }>;
}

function splitsOf<S>(res: StatsResponse<S> | null): StatSplit<S>[] {
  return res?.stats?.flatMap((block) => block.splits ?? []) ?? [];
}

export async function GET(req: NextRequest) {
  const today = localYmd(new Date());
  const requested = req.nextUrl.searchParams.get("date");
  const date = requested ?? defaultRecapDate(today);

  if (!isValidYmd(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD", status: 400 }, { status: 400 });
  }
  if (date > today) {
    return NextResponse.json({ error: "date is in the future", status: 400 }, { status: 400 });
  }

  const cacheKey = `recap:${date}`;
  const cached = getCached<RecapPayload>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const season = Number(date.slice(0, 4));

  try {
    const scheduleUrl =
      `${STATS_API}/v1/schedule?sportId=1&date=${encodeURIComponent(date)}` +
      `&hydrate=team,linescore,decisions`;

    // The schedule is the only hard requirement — without it there is no
    // recap. Everything else is a section of the page, so each is settled
    // independently and a failure degrades to an empty section plus a warning
    // rather than a blank screen.
    const [scheduleRes, hittingRes, pitchingRes, transactionsRes, standingsRes] =
      await Promise.allSettled([
        getJson<MLBSchedule>(scheduleUrl, "recap schedule"),
        getJson<StatsResponse<HittingSplitStat>>(statsUrl("hitting", date, HITTING_SPLITS_LIMIT), "recap hitting"),
        getJson<StatsResponse<PitchingSplitStat>>(statsUrl("pitching", date, PITCHING_SPLITS_LIMIT), "recap pitching"),
        getJson<{ transactions?: RawTransaction[] }>(
          `${STATS_API}/v1/transactions?startDate=${date}&endDate=${date}`,
          "recap transactions"
        ),
        fetchStandings(season, date),
      ]);

    if (scheduleRes.status === "rejected") throw scheduleRes.reason;

    const warnings: string[] = [];

    /** A section's value if it loaded; otherwise the fallback, and a warning. */
    const section = <T, F>(result: PromiseSettledResult<T>, name: string, fallback: F): T | F => {
      if (result.status === "fulfilled") return result.value;
      warnings.push(name);
      log.warn("recap section failed", { date, section: name, error: errorMessage(result.reason) });
      return fallback;
    };

    const hittingSplits = splitsOf(section(hittingRes, "hitting", null));
    const pitchingSplits = splitsOf(section(pitchingRes, "pitching", null));
    const transactions = section(transactionsRes, "injuries", null)?.transactions ?? [];
    const standings = section(standingsRes, "playoffs", null);
    const playoffs = standings ? buildPlayoffPicture(standings.allTeams) : null;

    const scheduled = (scheduleRes.value.dates?.[0]?.games ?? []) as ScheduledGame[];
    const games = sortGames(scheduled.map(toRecapGame));
    const slate = summarizeSlate(games);

    const payload: RecapPayload = {
      date,
      season,
      // An off day (zero games — a rare all-star break or scheduling gap) has
      // nothing to wait for, so it counts as complete too. Without this, a
      // zero-game slate can never satisfy `final === games` and the client
      // polls it every 2 minutes forever.
      isComplete: slate.final === slate.games,
      totals: {
        ...slate,
        // Taken from the stat splits rather than the linescores: a linescore
        // carries runs and hits but no home run count, and these are a single
        // sum over data already fetched.
        homeRuns: sumStat(hittingSplits, "homeRuns"),
        hits: sumStat(hittingSplits, "hits"),
        strikeOuts: sumStat(pitchingSplits, "strikeOuts"),
      },
      games,
      hitters: rankHitters(hittingSplits, TOP_HITTERS),
      pitchers: rankPitchers(pitchingSplits, TOP_PITCHERS),
      injuries: buildInjuryReport(transactions),
      playoffs,
      warnings,
      generatedAt: Date.now(),
    };

    // A finished slate in the past is immutable, so it is worth holding for
    // hours. Anything still settling gets a short TTL so the overnight view
    // catches up as games go final.
    const settled = payload.isComplete && warnings.length === 0 && date < today;
    setCached(cacheKey, payload, settled ? 6 * 60 * 60_000 : 2 * 60_000);

    return NextResponse.json(payload);
  } catch (err) {
    return errorResponse(err);
  }
}
