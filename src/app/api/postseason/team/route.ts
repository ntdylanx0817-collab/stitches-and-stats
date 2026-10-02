import { NextRequest, NextResponse } from "next/server";
import { assertOk, errorResponse } from "@/lib/api-errors";
import { integerParam } from "@/lib/api-params";
import { getOrSet } from "@/lib/cache";
import {
  assessBullpenAvailability,
  type PostseasonBullpenArm,
  type PostseasonHealthUpdate,
  type PostseasonRosterPlayer,
  type PostseasonTeamIntelPayload,
} from "@/lib/postseason";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const STATS_API = "https://statsapi.mlb.com/api";

interface RawRosterEntry {
  person?: {
    id?: number;
    fullName?: string;
    batSide?: { code?: string };
    pitchHand?: { code?: string };
  };
  jerseyNumber?: string;
  position?: { abbreviation?: string; type?: string };
  status?: { description?: string };
}

interface RawTransaction {
  id?: number;
  person?: { id?: number; fullName?: string };
  date?: string;
  effectiveDate?: string;
  description?: string;
}

interface RawPitchingSplit {
  player?: { id?: number; fullName?: string };
  stat?: {
    gamesPitched?: number;
    gamesStarted?: number;
    saves?: number;
    holds?: number;
    era?: string;
  };
}

interface RawScheduleGame {
  gamePk?: number;
  officialDate?: string;
  gameDate?: string;
  status?: { abstractGameState?: string };
}

interface PitchingLine {
  person?: { id?: number; fullName?: string };
  stats?: { pitching?: { numberOfPitches?: number } };
}

interface RawBoxscoreSide {
  team?: { id?: number };
  pitchers?: number[];
  players?: Record<string, PitchingLine>;
}

interface RawBoxscore {
  teams?: { away?: RawBoxscoreSide; home?: RawBoxscoreSide };
}

async function getJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  await assertOk(response, label);
  return response.json();
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return ymd(date);
}

function daysBetween(later: string, earlier: string): number {
  return Math.max(0, Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000));
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function healthUpdates(transactions: RawTransaction[]): PostseasonHealthUpdate[] {
  const seen = new Set<string>();
  return [...transactions]
    .filter((transaction) => /injured list/i.test(transaction.description ?? ""))
    .sort((a, b) => String(b.effectiveDate ?? b.date).localeCompare(String(a.effectiveDate ?? a.date)))
    .filter((transaction) => {
      const key = String(transaction.person?.id ?? transaction.person?.fullName ?? transaction.id ?? "unknown");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((transaction, index) => {
      const description = transaction.description ?? "Injury-list transaction";
      const lengths = [...description.matchAll(/(\d+)-day injured list/gi)];
      const length = lengths.at(-1)?.[1];
      const status: PostseasonHealthUpdate["status"] = /activated|reinstated/i.test(description)
        ? "Activated"
        : /transferred/i.test(description)
          ? "Transferred"
          : "Out";
      return {
        id: String(transaction.id ?? `${transaction.person?.id ?? "unknown"}-${index}`),
        playerId: transaction.person?.id ?? null,
        playerName: transaction.person?.fullName ?? "Unknown player",
        date: transaction.effectiveDate ?? transaction.date ?? "",
        status,
        listLabel: length ? `${length}-day IL` : "IL",
        description,
      };
    });
}

export async function GET(request: NextRequest) {
  const currentYear = new Date().getUTCFullYear();
  const teamId = integerParam(request.nextUrl.searchParams.get("teamId"), { min: 1, max: 9999 });
  const season = integerParam(request.nextUrl.searchParams.get("season"), {
    min: 2015,
    max: currentYear + 1,
    defaultValue: currentYear,
  });
  if (teamId === null || season === null) {
    return NextResponse.json({ error: "teamId and season must be valid MLB values" }, { status: 400 });
  }

  try {
    const data = await getOrSet(`postseason-team:${teamId}:${season}`, 5 * 60_000, async (): Promise<PostseasonTeamIntelPayload> => {
      const today = ymd(new Date());
      const asOfDate = season < currentYear ? `${season}-11-15` : today;
      const recentStart = shiftDate(asOfDate, -3);
      const transactionStart = `${season}-07-01`;
      const scheduleParams = new URLSearchParams({
        sportId: "1",
        teamId: String(teamId),
        startDate: recentStart,
        endDate: asOfDate,
        gameTypes: "R,F,D,L,W",
      });
      const pitchingParams = new URLSearchParams({
        stats: "season",
        group: "pitching",
        teamId: String(teamId),
        season: String(season),
        hydrate: "person",
        playerPool: "ALL",
        limit: "1000",
        sortStat: "gamesPitched",
      });

      const [rosterResult, transactionResult, pitchingResult, scheduleResult] = await Promise.allSettled([
        getJson<{ roster?: RawRosterEntry[] }>(
          `${STATS_API}/v1/teams/${teamId}/roster?rosterType=active&season=${season}&hydrate=person`,
          "postseason active roster"
        ),
        getJson<{ transactions?: RawTransaction[] }>(
          `${STATS_API}/v1/transactions?teamId=${teamId}&startDate=${transactionStart}&endDate=${asOfDate}`,
          "postseason transactions"
        ),
        getJson<{ stats?: Array<{ splits?: RawPitchingSplit[] }> }>(
          `${STATS_API}/v1/stats?${pitchingParams}`,
          "postseason pitching staff"
        ),
        getJson<{ dates?: Array<{ games?: RawScheduleGame[] }> }>(
          `${STATS_API}/v1/schedule?${scheduleParams}`,
          "recent team schedule"
        ),
      ]);

      const rosterRaw = rosterResult.status === "fulfilled" ? rosterResult.value.roster ?? [] : [];
      const transactions = transactionResult.status === "fulfilled" ? transactionResult.value.transactions ?? [] : [];
      const pitchingSplits = pitchingResult.status === "fulfilled" ? pitchingResult.value.stats?.[0]?.splits ?? [] : [];
      const recentGames = scheduleResult.status === "fulfilled"
        ? (scheduleResult.value.dates ?? [])
            .flatMap((date) => date.games ?? [])
            .filter((game) => game.gamePk && game.status?.abstractGameState === "Final")
            .sort((a, b) => String(a.gameDate).localeCompare(String(b.gameDate)))
            .slice(-3)
        : [];

      const boxscores = await Promise.allSettled(
        recentGames.map((game) => getJson<RawBoxscore>(`${STATS_API}/v1/game/${game.gamePk}/boxscore`, "recent boxscore"))
      );
      const usage = new Map<number, {
        pitchesLastGame: number;
        pitchesLast2Days: number;
        appearancesLast3Days: number;
        lastPitched: string | null;
      }>();
      boxscores.forEach((result, gameIndex) => {
        if (result.status !== "fulfilled") return;
        const game = recentGames[gameIndex];
        const gameDate = game.officialDate ?? game.gameDate?.slice(0, 10) ?? asOfDate;
        const sides = [result.value.teams?.away, result.value.teams?.home];
        const side = sides.find((candidate) => candidate?.team?.id === teamId);
        for (const pitcherId of side?.pitchers ?? []) {
          const pitches = asNumber(side?.players?.[`ID${pitcherId}`]?.stats?.pitching?.numberOfPitches);
          if (pitches <= 0) continue;
          const existing = usage.get(pitcherId) ?? {
            pitchesLastGame: 0,
            pitchesLast2Days: 0,
            appearancesLast3Days: 0,
            lastPitched: null,
          };
          const age = daysBetween(asOfDate, gameDate);
          existing.pitchesLastGame = pitches;
          if (age <= 1) existing.pitchesLast2Days += pitches;
          if (age <= 2) existing.appearancesLast3Days++;
          existing.lastPitched = gameDate;
          usage.set(pitcherId, existing);
        }
      });

      const roster: PostseasonRosterPlayer[] = rosterRaw
        .map((entry) => ({
          id: entry.person?.id ?? 0,
          name: entry.person?.fullName ?? "Unknown player",
          number: entry.jerseyNumber ?? "",
          position: entry.position?.abbreviation ?? "?",
          positionType: entry.position?.type ?? "Other",
          status: entry.status?.description ?? "Active",
          bats: entry.person?.batSide?.code ?? "?",
          throws: entry.person?.pitchHand?.code ?? "?",
        }))
        .filter((player) => player.id > 0)
        .sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name));

      const seasonStats = new Map<number, RawPitchingSplit["stat"]>();
      for (const split of pitchingSplits) {
        if (split.player?.id) seasonStats.set(split.player.id, split.stat);
      }

      const bullpen: PostseasonBullpenArm[] = roster
        .filter((player) => player.position === "P")
        .filter((player) => {
          const stat = seasonStats.get(player.id);
          if (!stat) return true;
          const games = stat.gamesPitched ?? 0;
          return (stat.gamesStarted ?? 0) <= Math.max(3, games * 0.35) || (stat.saves ?? 0) > 0 || (stat.holds ?? 0) > 0;
        })
        .map((player) => {
          const stat = seasonStats.get(player.id);
          const workload = usage.get(player.id) ?? {
            pitchesLastGame: 0,
            pitchesLast2Days: 0,
            appearancesLast3Days: 0,
            lastPitched: null,
          };
          const assessment = assessBullpenAvailability({
            ...workload,
            daysSinceLastAppearance: workload.lastPitched ? daysBetween(asOfDate, workload.lastPitched) : null,
          });
          const saves = stat?.saves ?? 0;
          const holds = stat?.holds ?? 0;
          return {
            id: player.id,
            name: player.name,
            hand: player.throws,
            role: saves >= 10 ? "Closer" : saves + holds >= 10 ? "High leverage" : "Reliever",
            era: stat?.era ? asNumber(stat.era) : null,
            saves,
            holds,
            gamesPitched: stat?.gamesPitched ?? 0,
            ...workload,
            availability: assessment.availability,
            availabilityReason: assessment.reason,
          };
        })
        .sort((a, b) => {
          const urgency = { Limited: 0, Monitor: 1, Fresh: 2 } as const;
          return urgency[a.availability] - urgency[b.availability]
            || b.saves - a.saves
            || b.holds - a.holds
            || b.gamesPitched - a.gamesPitched;
        });

      return {
        teamId,
        season,
        asOfDate,
        generatedAt: Date.now(),
        roster,
        healthUpdates: healthUpdates(transactions),
        bullpen,
        note: "Availability is an estimate from recent official box-score workload, not an official club designation.",
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error);
  }
}
