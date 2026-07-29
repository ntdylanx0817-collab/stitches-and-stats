import { NextResponse } from "next/server";
import { fetchSchedule, ymd } from "@/lib/mlb-api";
import { errorResponse } from "@/lib/api-errors";
import type { MLBGame } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 15;

interface TickerGame {
  gamePk: number;
  gameDay: "yesterday" | "today" | "tomorrow" | "upcoming";
  abstractState: string; // "Live" | "Final" | "Preview"
  detailedState: string;
  statusCode: string;
  gameDate: string;
  gameType?: string;
  seriesDescription?: string;
  venue?: string;
  inning?: number;
  inningState?: string; // "Top" | "Bottom" | "End" | "Middle"
  isTopInning?: boolean;
  away: {
    id: number;
    abbr: string;
    name: string;
    score: number | null;
    record?: string;
    isWinner?: boolean;
  };
  home: {
    id: number;
    abbr: string;
    name: string;
    score: number | null;
    record?: string;
    isWinner?: boolean;
  };
}

function recordStr(r?: { wins: number; losses: number }): string | undefined {
  if (!r) return undefined;
  return `${r.wins ?? 0}-${r.losses ?? 0}`;
}

export async function GET() {
  try {
    // Pull today + yesterday + tomorrow in parallel
    const today = ymd(new Date());
    const [y, m, d] = today.split("-").map(Number);
    const yesterday = ymd(new Date(Date.UTC(y, m - 1, d - 1)));
    const tomorrow = ymd(new Date(Date.UTC(y, m - 1, d + 1)));

    const [todaySched, yestSched, tomSched] = await Promise.all([
      fetchSchedule(today),
      fetchSchedule(yesterday),
      fetchSchedule(tomorrow),
    ]);

    const mapGame = (g: MLBGame, day: TickerGame["gameDay"]): TickerGame => {
      const awayTeam = g.teams?.away?.team ?? {};
      const homeTeam = g.teams?.home?.team ?? {};
      const linescore = g.linescore;
      return {
        gamePk: g.gamePk,
        gameDay: day,
        abstractState: g.status?.abstractGameState ?? "Preview",
        detailedState: g.status?.detailedState ?? "",
        statusCode: g.status?.statusCode ?? "S",
        gameDate: g.gameDate,
        gameType: g.gameType,
        seriesDescription: g.seriesDescription,
        venue: g.venue?.name,
        inning: linescore?.currentInning,
        inningState: linescore?.inningState,
        isTopInning: linescore?.isTopInning,
        away: {
          id: awayTeam.id ?? 0,
          abbr: awayTeam.abbreviation ?? "???",
          name: awayTeam.name ?? "Unknown",
          score: g.teams?.away?.score ?? null,
          record: recordStr(g.teams?.away?.leagueRecord),
          isWinner: g.teams?.away?.isWinner,
        },
        home: {
          id: homeTeam.id ?? 0,
          abbr: homeTeam.abbreviation ?? "???",
          name: homeTeam.name ?? "Unknown",
          score: g.teams?.home?.score ?? null,
          record: recordStr(g.teams?.home?.leagueRecord),
          isWinner: g.teams?.home?.isWinner,
        },
      };
    };

    const todayGames = (todaySched.dates?.[0]?.games ?? []).map((g) => mapGame(g, "today"));
    const yestGames = (yestSched.dates?.[0]?.games ?? []).map((g) => mapGame(g, "yesterday"));
    const tomGames = (tomSched.dates?.[0]?.games ?? []).map((g) => mapGame(g, "tomorrow"));

    // Sort: Live first, then Preview (today), then Final (yesterday), then tomorrow
    const order = (g: TickerGame): number => {
      if (g.abstractState === "Live") return 0;
      if (g.gameDay === "today" && g.abstractState === "Preview") return 1;
      if (g.gameDay === "today" && g.abstractState === "Final") return 2;
      if (g.gameDay === "yesterday") return 3;
      if (g.gameDay === "tomorrow") return 4;
      return 5;
    };

    const games = [...todayGames, ...yestGames, ...tomGames].sort((a, b) => order(a) - order(b));

    const hasLive = games.some((g) => g.abstractState === "Live");

    return NextResponse.json({
      date: today,
      totalGames: games.length,
      hasLive,
      games,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
