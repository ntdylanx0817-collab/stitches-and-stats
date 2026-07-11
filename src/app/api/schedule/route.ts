import { NextRequest, NextResponse } from "next/server";
import { fetchSchedule, ymd } from "@/lib/mlb-api";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET(req: NextRequest) {
  const requestedDate = req.nextUrl.searchParams.get("date");
  // If no date specified, fetch yesterday + today so we always have
  // final games (with pitch data) available alongside live/preview ones.
  const today = requestedDate ?? ymd(new Date());
  // Parse the YYYY-MM-DD string in UTC to avoid timezone-shift bugs.
  // `new Date("2025-04-15")` is parsed as UTC midnight, but getDate()/setDate()
  // operate in local server time — on a US server that yields the wrong "yesterday".
  const [y, m, d] = today.split("-").map(Number);
  const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1));
  const yesterday = ymd(yesterdayDate);

  try {
    const [todaySchedule, yesterdaySchedule] = await Promise.all([
      fetchSchedule(today),
      requestedDate ? Promise.resolve(null) : fetchSchedule(yesterday),
    ]);

    const todayGames = todaySchedule.dates?.[0]?.games ?? [];
    const yesterdayGames = yesterdaySchedule?.dates?.[0]?.games ?? [];

    const mapGame = (g: any, day: string) => ({
      gamePk: g.gamePk,
      gameDate: g.gameDate,
      gameDay: day,
      gameNumber: g.gameNumber || 1,
      doubleHeader: g.doubleHeader || "N",
      status: g.status,
      gameType: g.gameType,
      dayNight: g.dayNight,
      venue: g.venue,
      seriesDescription: g.seriesDescription,
      away: {
        id: g.teams?.away?.team?.id ?? 0,
        name: g.teams?.away?.team?.name ?? "Unknown",
        abbreviation: g.teams?.away?.team?.abbreviation,
        score: g.teams?.away?.score ?? null,
        record: g.teams?.away?.leagueRecord,
        isWinner: g.teams?.away?.isWinner,
      },
      home: {
        id: g.teams?.home?.team?.id ?? 0,
        name: g.teams?.home?.team?.name ?? "Unknown",
        abbreviation: g.teams?.home?.team?.abbreviation,
        score: g.teams?.home?.score ?? null,
        record: g.teams?.home?.leagueRecord,
        isWinner: g.teams?.home?.isWinner,
      },
    });

    // Yesterday's final games first, then today's games
    const games = [
      ...yesterdayGames.map((g: any) => mapGame(g, "yesterday")),
      ...todayGames.map((g: any) => mapGame(g, "today")),
    ];

    return NextResponse.json({
      date: today,
      yesterday,
      totalGames: games.length,
      games,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
