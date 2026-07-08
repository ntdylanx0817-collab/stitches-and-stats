import { NextRequest, NextResponse } from "next/server";
import { fetchSchedule, ymd } from "@/lib/mlb-api";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET(req: NextRequest) {
  const requestedDate = req.nextUrl.searchParams.get("date");
  // If no date specified, fetch yesterday + today so we always have
  // final games (with pitch data) available alongside live/preview ones.
  const today = requestedDate ?? ymd(new Date());
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
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
      status: g.status,
      gameType: g.gameType,
      dayNight: g.dayNight,
      venue: g.venue,
      seriesDescription: g.seriesDescription,
      away: {
        id: g.teams.away.team.id,
        name: g.teams.away.team.name,
        abbreviation: g.teams.away.team.abbreviation,
        score: g.teams.away.score,
        record: g.teams.away.leagueRecord,
        isWinner: g.teams.away.isWinner,
      },
      home: {
        id: g.teams.home.team.id,
        name: g.teams.home.team.name,
        abbreviation: g.teams.home.team.abbreviation,
        score: g.teams.home.score,
        record: g.teams.home.leagueRecord,
        isWinner: g.teams.home.isWinner,
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
