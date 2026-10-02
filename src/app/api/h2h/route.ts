import { NextRequest, NextResponse } from "next/server";
import { integerParam } from "@/lib/api-params";
import { getHeadToHeadData } from "@/lib/h2h";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(req: NextRequest) {
  const team1Id = integerParam(req.nextUrl.searchParams.get("team1Id"), { min: 1, max: 9999 });
  const team2Id = integerParam(req.nextUrl.searchParams.get("team2Id"), { min: 1, max: 9999 });

  if (team1Id === null || team2Id === null || team1Id === team2Id) {
    return NextResponse.json({ error: "team1Id and team2Id must be distinct positive integers" }, { status: 400 });
  }

  const data = await getHeadToHeadData(team1Id, team2Id);

  if (!data) {
    return NextResponse.json({ error: "H2H data not available" }, { status: 404 });
  }

  return NextResponse.json(data);
}
