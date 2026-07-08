import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Stitches and Stats API",
    endpoints: [
      "/api/schedule",
      "/api/game/[gamePk]",
      "/api/savant/[gamePk]",
      "/api/leaderboard",
      "/api/players?q=...",
      "/api/player/[playerId]",
    ],
  });
}
