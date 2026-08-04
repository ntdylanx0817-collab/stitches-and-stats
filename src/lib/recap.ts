/**
 * Morning Recap — one day's slate, settled.
 *
 * This module is the pure half of the feature: date arithmetic, the heuristics
 * that pick standout performances out of a league-wide stat dump, and the
 * filter that turns MLB's raw transaction log into an injury report. All of it
 * is dependency-free so it can be unit tested without a network or a clock.
 *
 * The fetching and composition live in src/app/api/recap/route.ts.
 */

import { TEAM_IDS } from "./team-colors";

/**
 * Local hour at which the previous day's slate is guaranteed settled.
 *
 * The last first pitch of a normal day is ~10:10pm ET, so a west-coast game
 * that goes long can end after 1am — the calendar day is over well before its
 * baseball is. Five is the first hour that is safely past all of it, which is
 * why the recap advertises itself as a 5am product rather than a midnight one.
 */
export const RECAP_ROLLOVER_HOUR = 5;

// ---------------------------------------------------------------------------
// Dates
//
// Everything here works on "YYYY-MM-DD" strings and does its arithmetic in
// UTC. Constructing a Date at UTC midnight and then reading it back with the
// local getters is off by a day for every user west of Greenwich, so the
// getters below are UTC too and the only place local time enters is
// `localYmd`, which is explicitly asking "what day is it where the user is".
// ---------------------------------------------------------------------------

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** True for a well-formed calendar date. Rejects "2025-02-30" as well as junk. */
export function isValidYmd(value: string): boolean {
  if (!YMD_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

/** Today's date in the viewer's timezone. The one place local time is read. */
export function localYmd(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Move a date by whole days. `shiftYmd("2025-03-01", -1)` → "2025-02-28". */
export function shiftYmd(value: string, deltaDays: number): string {
  const [y, m, d] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Whole days from `a` to `b`. Negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

/**
 * The slate the recap opens on: yesterday.
 *
 * Deliberately calendar yesterday rather than "yesterday, shifted by the 5am
 * rollover". At 1am the games that just ended are yesterday's, and those are
 * the scores someone opening the app wants — pushing the window back a further
 * day to keep the slate 100% final would serve them something 24 hours stale.
 * The handful of overnight hours where the slate is still settling are handled
 * by reporting it (see `slateIsSettled`), not by hiding it.
 */
export function defaultRecapDate(todayYmd: string): string {
  return shiftYmd(todayYmd, -1);
}

/**
 * Has the 5am guarantee passed for this slate? True once the local clock is
 * past `RECAP_ROLLOVER_HOUR` on the morning after `date`.
 */
export function slateIsSettled(
  date: string,
  now: Date,
  rolloverHour: number = RECAP_ROLLOVER_HOUR
): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const deadline = new Date(y, m - 1, d + 1, rolloverHour, 0, 0, 0);
  return now.getTime() >= deadline.getTime();
}

/** Milliseconds until the next local `hour`, for scheduling the auto-roll. */
export function msUntilHour(now: Date, hour: number = RECAP_ROLLOVER_HOUR): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** "Today" / "Yesterday" / "Saturday, Aug 2" — how the header names a slate. */
export function recapDayLabel(date: string, todayYmd: string): string {
  const delta = daysBetween(todayYmd, date);
  if (delta === 0) return "Today";
  if (delta === -1) return "Yesterday";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ---------------------------------------------------------------------------
// Upstream stat shapes
//
// From /v1/stats?stats=byDateRange, which returns one split per player for the
// requested window. Every field is optional because the endpoint omits rather
// than zero-fills, and a pitcher's split carries no hitting keys at all.
// ---------------------------------------------------------------------------

export interface HittingSplitStat {
  gamesPlayed?: number;
  plateAppearances?: number;
  atBats?: number;
  runs?: number;
  hits?: number;
  doubles?: number;
  triples?: number;
  homeRuns?: number;
  rbi?: number;
  baseOnBalls?: number;
  strikeOuts?: number;
  stolenBases?: number;
  totalBases?: number;
}

export interface PitchingSplitStat {
  gamesPlayed?: number;
  gamesStarted?: number;
  /** MLB writes thirds after the decimal: "6.2" is six and two-thirds. */
  inningsPitched?: string;
  hits?: number;
  runs?: number;
  earnedRuns?: number;
  baseOnBalls?: number;
  strikeOuts?: number;
  homeRuns?: number;
  wins?: number;
  losses?: number;
  saves?: number;
  battersFaced?: number;
  completeGames?: number;
  shutouts?: number;
}

export interface StatSplit<S> {
  player?: { id?: number; fullName?: string };
  team?: { id?: number; name?: string };
  stat?: S;
}

/** The team abbreviation for an MLB team id, or "—" for anything unmapped. */
const ABBR_BY_ID = new Map(TEAM_IDS.map((t) => [t.id, t.abbr]));

export function teamAbbr(teamId: number | null | undefined): string {
  if (teamId == null) return "—";
  return ABBR_BY_ID.get(teamId) ?? "—";
}

/**
 * Innings pitched as a real number.
 *
 * "6.2" means six and two-thirds, so reading it as a decimal understates every
 * partial inning and would rank a 6.2 IP start below a clean 6.0 one.
 */
export function parseInningsPitched(ip: string | number | null | undefined): number {
  if (ip == null) return 0;
  const n = typeof ip === "number" ? ip : Number(ip);
  if (!Number.isFinite(n) || n < 0) return 0;
  const whole = Math.trunc(n);
  // Guard the third digit: the feed only ever emits .0/.1/.2, and rounding
  // protects against binary-float drift (6.2 - 6 is 0.19999… in IEEE 754).
  const thirds = Math.min(Math.round((n - whole) * 10), 2);
  return whole + thirds / 3;
}

// ---------------------------------------------------------------------------
// Standout performances
//
// These two scores exist to sort a day's worth of box-score lines into
// "who should a recap mention first". They are readable heuristics, not
// sabermetrics — the weights are tuned so a 3-HR game outranks a 4-single
// game and a shutout outranks a win with five runs allowed, and no further.
// ---------------------------------------------------------------------------

function impliedTotalBases(s: HittingSplitStat): number {
  const hits = s.hits ?? 0;
  const doubles = s.doubles ?? 0;
  const triples = s.triples ?? 0;
  const homeRuns = s.homeRuns ?? 0;
  return hits + doubles + triples * 2 + homeRuns * 3;
}

export function hitterDayScore(s: HittingSplitStat): number {
  const totalBases = s.totalBases ?? impliedTotalBases(s);
  return (
    totalBases +
    (s.rbi ?? 0) * 1.2 +
    (s.runs ?? 0) * 0.8 +
    (s.baseOnBalls ?? 0) * 0.5 +
    (s.stolenBases ?? 0) * 0.8
  );
}

export function pitcherDayScore(s: PitchingSplitStat): number {
  return (
    parseInningsPitched(s.inningsPitched) * 1.6 +
    (s.strikeOuts ?? 0) * 0.9 +
    (s.wins ?? 0) * 1.5 +
    (s.saves ?? 0) * 1.2 -
    (s.earnedRuns ?? 0) * 2 -
    (s.hits ?? 0) * 0.3 -
    (s.baseOnBalls ?? 0) * 0.4
  );
}

export interface RecapHitter {
  playerId: number;
  name: string;
  teamId: number | null;
  teamAbbr: string;
  hits: number;
  atBats: number;
  homeRuns: number;
  rbi: number;
  runs: number;
  doubles: number;
  triples: number;
  walks: number;
  stolenBases: number;
  totalBases: number;
  /** Box-score shorthand, e.g. "3-4, 2 HR, 5 RBI". */
  line: string;
  score: number;
}

export interface RecapPitcher {
  playerId: number;
  name: string;
  teamId: number | null;
  teamAbbr: string;
  inningsPitched: string;
  strikeOuts: number;
  earnedRuns: number;
  hits: number;
  walks: number;
  wins: number;
  saves: number;
  started: boolean;
  /** Box-score shorthand, e.g. "7.0 IP, 0 ER, 11 K". */
  line: string;
  score: number;
}

/** "3-4, 2 HR, 5 RBI, 3 R" — only the categories the player actually filled. */
export function formatHitterLine(s: HittingSplitStat): string {
  const parts = [`${s.hits ?? 0}-${s.atBats ?? 0}`];
  if (s.homeRuns) parts.push(`${s.homeRuns} HR`);
  if (s.triples) parts.push(`${s.triples} 3B`);
  if (s.doubles) parts.push(`${s.doubles} 2B`);
  if (s.rbi) parts.push(`${s.rbi} RBI`);
  if (s.runs) parts.push(`${s.runs} R`);
  if (s.baseOnBalls) parts.push(`${s.baseOnBalls} BB`);
  if (s.stolenBases) parts.push(`${s.stolenBases} SB`);
  return parts.join(", ");
}

/** "6.2 IP, 1 ER, 9 K, 2 BB" — IP and K always, the rest when non-zero. */
export function formatPitcherLine(s: PitchingSplitStat): string {
  const parts = [`${s.inningsPitched ?? "0.0"} IP`];
  parts.push(`${s.earnedRuns ?? 0} ER`);
  parts.push(`${s.strikeOuts ?? 0} K`);
  if (s.baseOnBalls) parts.push(`${s.baseOnBalls} BB`);
  if (s.saves) parts.push("SV");
  return parts.join(", ");
}

/**
 * The day's best hitting lines, best first.
 *
 * Anyone who did not come to the plate is dropped: the endpoint returns a row
 * for pinch-runners and defensive replacements too, and a 0-0 line scores 0,
 * which would pad the tail of the list with players who never hit.
 */
export function rankHitters(splits: StatSplit<HittingSplitStat>[], limit: number): RecapHitter[] {
  return splits
    .filter((split) => {
      const s = split.stat;
      if (!s || !split.player?.id) return false;
      return (s.plateAppearances ?? s.atBats ?? 0) > 0;
    })
    .map((split) => {
      const s = split.stat as HittingSplitStat;
      const teamId = split.team?.id ?? null;
      return {
        playerId: split.player?.id as number,
        name: split.player?.fullName ?? "Unknown",
        teamId,
        teamAbbr: teamAbbr(teamId),
        hits: s.hits ?? 0,
        atBats: s.atBats ?? 0,
        homeRuns: s.homeRuns ?? 0,
        rbi: s.rbi ?? 0,
        runs: s.runs ?? 0,
        doubles: s.doubles ?? 0,
        triples: s.triples ?? 0,
        walks: s.baseOnBalls ?? 0,
        stolenBases: s.stolenBases ?? 0,
        totalBases: s.totalBases ?? impliedTotalBases(s),
        line: formatHitterLine(s),
        score: hitterDayScore(s),
      };
    })
    .sort((a, b) => b.score - a.score || b.homeRuns - a.homeRuns || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** The day's best pitching lines, best first. Anyone who did not throw is dropped. */
export function rankPitchers(splits: StatSplit<PitchingSplitStat>[], limit: number): RecapPitcher[] {
  return splits
    .filter((split) => {
      const s = split.stat;
      if (!s || !split.player?.id) return false;
      return parseInningsPitched(s.inningsPitched) > 0 || (s.battersFaced ?? 0) > 0;
    })
    .map((split) => {
      const s = split.stat as PitchingSplitStat;
      const teamId = split.team?.id ?? null;
      return {
        playerId: split.player?.id as number,
        name: split.player?.fullName ?? "Unknown",
        teamId,
        teamAbbr: teamAbbr(teamId),
        inningsPitched: s.inningsPitched ?? "0.0",
        strikeOuts: s.strikeOuts ?? 0,
        earnedRuns: s.earnedRuns ?? 0,
        hits: s.hits ?? 0,
        walks: s.baseOnBalls ?? 0,
        wins: s.wins ?? 0,
        saves: s.saves ?? 0,
        started: (s.gamesStarted ?? 0) > 0,
        line: formatPitcherLine(s),
        score: pitcherDayScore(s),
      };
    })
    .sort((a, b) => b.score - a.score || b.strikeOuts - a.strikeOuts || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Sum one numeric stat across every split. Used for the league-wide totals. */
export function sumStat<S>(splits: StatSplit<S>[], key: keyof S): number {
  let total = 0;
  for (const split of splits) {
    const value = split.stat?.[key];
    if (typeof value === "number" && Number.isFinite(value)) total += value;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Injury report
//
// MLB has no injury endpoint. What it has is /v1/transactions, an
// undifferentiated log of every roster move — trades, options, recalls,
// signings — where IL activity is identifiable only from the prose in
// `description`. So the filter below is text matching, kept deliberately
// narrow: a move only counts as an injury if it names the injured list.
// ---------------------------------------------------------------------------

export type InjuryMove = "to-il" | "activated" | "transferred";

export interface RecapInjury {
  id: string;
  playerId: number | null;
  playerName: string;
  teamId: number | null;
  teamAbbr: string;
  teamName: string;
  move: InjuryMove;
  /** "10-day IL", "60-day IL", or plain "IL" when the feed omits the length. */
  listLabel: string;
  description: string;
  date: string;
}

export interface RawTransaction {
  id?: number;
  person?: { id?: number; fullName?: string };
  team?: { id?: number; name?: string };
  date?: string;
  effectiveDate?: string;
  typeCode?: string;
  typeDesc?: string;
  description?: string;
}

const IL_MENTION = /injured list/i;
const IL_LENGTH = /(\d+)-day injured list/i;
const MOVE_ACTIVATED = /\bactivated\b|\breinstated\b/i;
const MOVE_TRANSFERRED = /\btransferred\b/i;

/**
 * Turn one transaction into an injury-report entry, or null if it is not an
 * IL move. `index` only disambiguates the React key when the feed omits ids.
 */
export function classifyInjuryTransaction(tx: RawTransaction, index: number): RecapInjury | null {
  const description = tx.description?.trim() ?? "";
  if (!description || !IL_MENTION.test(description)) return null;

  // "Transferred to the 60-day" is checked before "activated" because the
  // 60-day transfer wording sometimes also mentions reinstating a roster spot,
  // and the transfer is the newsworthy half.
  const move: InjuryMove = MOVE_TRANSFERRED.test(description)
    ? "transferred"
    : MOVE_ACTIVATED.test(description)
      ? "activated"
      : "to-il";

  const lengthMatch = description.match(IL_LENGTH);
  const teamId = tx.team?.id ?? null;

  return {
    id: String(tx.id ?? `${tx.person?.id ?? "unknown"}-${index}`),
    playerId: tx.person?.id ?? null,
    playerName: tx.person?.fullName ?? "Unknown player",
    teamId,
    teamAbbr: teamAbbr(teamId),
    teamName: tx.team?.name ?? "",
    move,
    listLabel: lengthMatch ? `${lengthMatch[1]}-day IL` : "IL",
    description,
    date: tx.effectiveDate ?? tx.date ?? "",
  };
}

/**
 * Every IL move on the slate, players going out listed before players coming
 * back — an injury report leads with the bad news.
 */
export function buildInjuryReport(transactions: RawTransaction[]): RecapInjury[] {
  const order: Record<InjuryMove, number> = { "to-il": 0, transferred: 1, activated: 2 };
  return transactions
    .map(classifyInjuryTransaction)
    .filter((entry): entry is RecapInjury => entry !== null)
    .sort((a, b) => order[a.move] - order[b.move] || a.teamAbbr.localeCompare(b.teamAbbr));
}

// ---------------------------------------------------------------------------
// Slate summary
// ---------------------------------------------------------------------------

export interface RecapGameSide {
  id: number;
  abbr: string;
  name: string;
  score: number | null;
  record?: string;
  isWinner: boolean;
}

export interface RecapGame {
  gamePk: number;
  state: string;
  detailedState: string;
  gameDate: string;
  venue?: string;
  seriesDescription?: string;
  gameType?: string;
  /** Doubleheader game number, present only for the second game of one. */
  gameNumber?: number;
  innings: number;
  isExtras: boolean;
  away: RecapGameSide;
  home: RecapGameSide;
  decisions?: {
    winner?: { id: number; name: string };
    loser?: { id: number; name: string };
    save?: { id: number; name: string };
  };
}

export interface SlateTotals {
  games: number;
  final: number;
  live: number;
  scheduled: number;
  runs: number;
  extraInnings: number;
  shutouts: number;
  oneRunGames: number;
}

/** Counts across the slate, for the strip of numbers above the scores. */
export function summarizeSlate(games: RecapGame[]): SlateTotals {
  const totals: SlateTotals = {
    games: games.length,
    final: 0,
    live: 0,
    scheduled: 0,
    runs: 0,
    extraInnings: 0,
    shutouts: 0,
    oneRunGames: 0,
  };

  for (const game of games) {
    if (game.state === "Final") totals.final++;
    else if (game.state === "Live") totals.live++;
    else totals.scheduled++;

    const away = game.away.score;
    const home = game.home.score;
    if (away == null || home == null) continue;

    totals.runs += away + home;
    if (game.isExtras) totals.extraInnings++;

    // Only decided games can be a shutout or a one-run game — a 0-0 game still
    // in the third would otherwise count as both.
    if (game.state !== "Final") continue;
    if (away === 0 || home === 0) totals.shutouts++;
    if (Math.abs(away - home) === 1) totals.oneRunGames++;
  }

  return totals;
}
