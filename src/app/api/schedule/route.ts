import { NextRequest, NextResponse } from "next/server";
import { fetchSchedule, ymd } from "@/lib/mlb-api";
import { errorResponse } from "@/lib/api-errors";
import type { MLBGame } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 30;

export async function GET(req: NextRequest) {
  const requestedDate = req.nextUrl.searchParams.get("date");
  const today = requestedDate ?? ymd(new Date());
  const [y, m, d] = today.split("-").map(Number);

  // Calculate yesterday, tomorrow, and day-after-tomorrow for fallback
  const yesterdayDate = new Date(Date.UTC(y, m - 1, d - 1));
  const yesterday = ymd(yesterdayDate);
  const tomorrowDate = new Date(Date.UTC(y, m - 1, d + 1));
  const tomorrow = ymd(tomorrowDate);
  const dayAfterDate = new Date(Date.UTC(y, m - 1, d + 2));
  const dayAfter = ymd(dayAfterDate);

  try {
    // Always fetch yesterday (final games) + today + tomorrow (in case today is empty)
    const [todaySchedule, yesterdaySchedule, tomorrowSchedule] = await Promise.all([
      fetchSchedule(today),
      requestedDate ? Promise.resolve(null) : fetchSchedule(yesterday),
      requestedDate ? Promise.resolve(null) : fetchSchedule(tomorrow),
    ]);

    const todayGames = todaySchedule.dates?.[0]?.games ?? [];
    const yesterdayGames = yesterdaySchedule?.dates?.[0]?.games ?? [];
    const tomorrowGames = tomorrowSchedule?.dates?.[0]?.games ?? [];

    // If today AND tomorrow are both empty (e.g., All-Star break), check day after tomorrow
    let dayAfterGames: MLBGame[] = [];
    if (todayGames.length === 0 && tomorrowGames.length === 0 && !requestedDate) {
      const dayAfterSchedule = await fetchSchedule(dayAfter);
      dayAfterGames = dayAfterSchedule.dates?.[0]?.games ?? [];
    }

    const mapGame = (g: MLBGame, day: string) => ({
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

    // Build game list: yesterday's finals first, then today, then tomorrow, then day after
    const games = [
      ...yesterdayGames.map((g) => mapGame(g, "yesterday")),
      ...todayGames.map((g) => mapGame(g, "today")),
      ...tomorrowGames.map((g) => mapGame(g, "tomorrow")),
      ...dayAfterGames.map((g) => mapGame(g, "upcoming")),
    ];

    return NextResponse.json({
      date: today,
      yesterday,
      tomorrow,
      totalGames: games.length,
      games,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
