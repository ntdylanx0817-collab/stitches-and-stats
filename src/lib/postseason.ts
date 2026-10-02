export type PostseasonRoundCode = "F" | "D" | "L" | "W";

export const POSTSEASON_ROUNDS: Array<{
  code: PostseasonRoundCode;
  label: string;
  shortLabel: string;
  winsNeeded: number;
}> = [
  { code: "F", label: "Wild Card Series", shortLabel: "Wild Card", winsNeeded: 2 },
  { code: "D", label: "Division Series", shortLabel: "Division", winsNeeded: 3 },
  { code: "L", label: "League Championship Series", shortLabel: "LCS", winsNeeded: 4 },
  { code: "W", label: "World Series", shortLabel: "World Series", winsNeeded: 4 },
];

export interface PostseasonTeam {
  id: number;
  name: string;
  abbreviation: string;
  wins: number;
  losses: number;
  pct: number;
  runDifferential: number;
  league: string;
}

export interface PostseasonPitcher {
  id: number;
  name: string;
  era: number | null;
  whip: number | null;
  strikeoutsPer9: number | null;
  inningsPitched: string | null;
}

export interface PostseasonGameTeam {
  team: PostseasonTeam;
  score: number | null;
  isWinner: boolean;
  probablePitcher: PostseasonPitcher | null;
}

export interface GamePrediction {
  favoredTeamId: number;
  favoredTeamName: string;
  awayWinProbability: number;
  homeWinProbability: number;
  confidence: "Lean" | "Edge" | "Strong edge";
  pitcherAdjusted: boolean;
  factors: string[];
}

export interface PostseasonGame {
  gamePk: number;
  gameDate: string;
  officialDate: string;
  gameNumber: number;
  status: {
    abstractGameState: string;
    detailedState: string;
    statusCode: string;
  };
  venue: string;
  away: PostseasonGameTeam;
  home: PostseasonGameTeam;
  prediction: GamePrediction | null;
}

export interface SeriesProjection {
  favoredTeamId: number;
  favoredTeamName: string;
  teamAWinProbability: number;
  teamBWinProbability: number;
  pitcherAdjusted: boolean;
  summary: string;
}

export interface SeriesScenario {
  headline: string;
  detail: string;
  teamAStatus: string;
  teamBStatus: string;
  isEliminationGame: boolean;
}

export interface PostseasonSeries {
  id: string;
  round: PostseasonRoundCode;
  roundLabel: string;
  league: "AL" | "NL" | "MLB";
  teamA: PostseasonTeam;
  teamB: PostseasonTeam;
  teamAWins: number;
  teamBWins: number;
  winsNeeded: number;
  isComplete: boolean;
  games: PostseasonGame[];
  projection: SeriesProjection | null;
  scenario: SeriesScenario;
}

export interface PostseasonRosterPlayer {
  id: number;
  name: string;
  number: string;
  position: string;
  positionType: string;
  status: string;
  bats: string;
  throws: string;
}

export interface PostseasonHealthUpdate {
  id: string;
  playerId: number | null;
  playerName: string;
  date: string;
  status: "Out" | "Activated" | "Transferred";
  listLabel: string;
  description: string;
}

export type BullpenAvailability = "Fresh" | "Monitor" | "Limited";

export interface PostseasonBullpenArm {
  id: number;
  name: string;
  hand: string;
  role: string;
  era: number | null;
  saves: number;
  holds: number;
  gamesPitched: number;
  pitchesLastGame: number;
  pitchesLast2Days: number;
  appearancesLast3Days: number;
  lastPitched: string | null;
  availability: BullpenAvailability;
  availabilityReason: string;
}

export interface PostseasonTeamIntelPayload {
  teamId: number;
  season: number;
  asOfDate: string;
  generatedAt: number;
  roster: PostseasonRosterPlayer[];
  healthUpdates: PostseasonHealthUpdate[];
  bullpen: PostseasonBullpenArm[];
  note: string;
}

export interface PostseasonPayload {
  season: number;
  generatedAt: number;
  rounds: typeof POSTSEASON_ROUNDS;
  series: PostseasonSeries[];
  nextGames: PostseasonGame[];
  liveGames: PostseasonGame[];
  completedGames: number;
  methodology: string;
}

interface PredictionInput {
  away: PostseasonTeam;
  home: PostseasonTeam;
  awayPitcher?: PostseasonPitcher | null;
  homePitcher?: PostseasonPitcher | null;
}

function finite(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * A deliberately transparent game model. Team record and run differential
 * establish the baseline, home field is a small fixed adjustment, and the
 * confirmed starters move the estimate using ERA, WHIP, and K/9.
 */
export function predictPostseasonGame(input: PredictionInput): GamePrediction {
  const awayGames = Math.max(1, input.away.wins + input.away.losses);
  const homeGames = Math.max(1, input.home.wins + input.home.losses);
  const awayRunDiffPerGame = input.away.runDifferential / awayGames;
  const homeRunDiffPerGame = input.home.runDifferential / homeGames;

  let awayProbability = 50;
  awayProbability += (input.away.pct - input.home.pct) * 65;
  awayProbability += (awayRunDiffPerGame - homeRunDiffPerGame) * 2.1;
  awayProbability -= 3; // modest home-field advantage

  const factors = [
    `${input.away.abbreviation} ${input.away.wins}-${input.away.losses} vs ${input.home.abbreviation} ${input.home.wins}-${input.home.losses}`,
    `Run differential: ${signed(input.away.runDifferential)} vs ${signed(input.home.runDifferential)}`,
    `${input.home.abbreviation} receives the home-field adjustment`,
  ];

  const awayEra = input.awayPitcher?.era;
  const homeEra = input.homePitcher?.era;
  const awayWhip = input.awayPitcher?.whip;
  const homeWhip = input.homePitcher?.whip;
  const awayK9 = input.awayPitcher?.strikeoutsPer9;
  const homeK9 = input.homePitcher?.strikeoutsPer9;
  const pitcherAdjusted = awayEra != null && homeEra != null;

  if (pitcherAdjusted) {
    awayProbability += (finite(homeEra, 4.2) - finite(awayEra, 4.2)) * 2.7;
    awayProbability += (finite(homeWhip, 1.3) - finite(awayWhip, 1.3)) * 5;
    awayProbability += (finite(awayK9, 8.5) - finite(homeK9, 8.5)) * 0.5;
    factors.push(
      `Starter edge: ${input.awayPitcher?.name} (${finite(awayEra, 0).toFixed(2)} ERA) vs ${input.homePitcher?.name} (${finite(homeEra, 0).toFixed(2)} ERA)`
    );
  } else {
    factors.push("Probable-starter adjustment pending both confirmations");
  }

  awayProbability = Math.max(24, Math.min(76, awayProbability));
  const roundedAway = Math.round(awayProbability);
  const roundedHome = 100 - roundedAway;
  const edge = Math.abs(roundedAway - 50);
  const confidence = edge >= 14 ? "Strong edge" : edge >= 7 ? "Edge" : "Lean";
  const awayFavored = roundedAway >= roundedHome;

  return {
    favoredTeamId: awayFavored ? input.away.id : input.home.id,
    favoredTeamName: awayFavored ? input.away.name : input.home.name,
    awayWinProbability: roundedAway,
    homeWinProbability: roundedHome,
    confidence,
    pitcherAdjusted,
    factors,
  };
}

/** Probability team A wins a series from its current score. */
export function seriesWinProbability(
  teamAGameProbability: number,
  teamAWins: number,
  teamBWins: number,
  winsNeeded: number
): number {
  const p = Math.max(0, Math.min(1, teamAGameProbability));
  const memo = new Map<string, number>();

  const solve = (aWins: number, bWins: number): number => {
    if (aWins >= winsNeeded) return 1;
    if (bWins >= winsNeeded) return 0;
    const key = `${aWins}:${bWins}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const result = p * solve(aWins + 1, bWins) + (1 - p) * solve(aWins, bWins + 1);
    memo.set(key, result);
    return result;
  };

  return solve(teamAWins, teamBWins);
}

export function buildSeriesScenario(
  teamAName: string,
  teamBName: string,
  teamAWins: number,
  teamBWins: number,
  winsNeeded: number
): SeriesScenario {
  if (teamAWins >= winsNeeded || teamBWins >= winsNeeded) {
    const winner = teamAWins > teamBWins ? teamAName : teamBName;
    const loser = teamAWins > teamBWins ? teamBName : teamAName;
    return {
      headline: `${winner} advance`,
      detail: `${winner} won the series ${Math.max(teamAWins, teamBWins)}-${Math.min(teamAWins, teamBWins)}. ${loser} is eliminated.`,
      teamAStatus: teamAWins > teamBWins ? "Advanced" : "Eliminated",
      teamBStatus: teamBWins > teamAWins ? "Advanced" : "Eliminated",
      isEliminationGame: false,
    };
  }

  const aNeeds = winsNeeded - teamAWins;
  const bNeeds = winsNeeded - teamBWins;
  if (aNeeds === 1 && bNeeds === 1) {
    return {
      headline: "Winner advances",
      detail: `The next game decides the series. The winner moves on and the loser is eliminated.`,
      teamAStatus: "Win and advance",
      teamBStatus: "Win and advance",
      isEliminationGame: true,
    };
  }
  if (aNeeds === 1 || bNeeds === 1) {
    const leader = aNeeds === 1 ? teamAName : teamBName;
    const trailing = aNeeds === 1 ? teamBName : teamAName;
    return {
      headline: `${leader} can clinch`,
      detail: `${leader} advances with one more win. ${trailing} must win the next game to extend the series.`,
      teamAStatus: aNeeds === 1 ? "1 win to advance" : "Must win next",
      teamBStatus: bNeeds === 1 ? "1 win to advance" : "Must win next",
      isEliminationGame: true,
    };
  }

  return {
    headline: teamAWins === teamBWins ? "Series level" : `${teamAWins > teamBWins ? teamAName : teamBName} leads`,
    detail: `${teamAName} needs ${aNeeds} ${aNeeds === 1 ? "win" : "wins"} to advance; ${teamBName} needs ${bNeeds}.`,
    teamAStatus: `${aNeeds} ${aNeeds === 1 ? "win" : "wins"} to advance`,
    teamBStatus: `${bNeeds} ${bNeeds === 1 ? "win" : "wins"} to advance`,
    isEliminationGame: false,
  };
}

export function assessBullpenAvailability(input: {
  pitchesLastGame: number;
  pitchesLast2Days: number;
  appearancesLast3Days: number;
  daysSinceLastAppearance: number | null;
}): { availability: BullpenAvailability; reason: string } {
  const { pitchesLastGame, pitchesLast2Days, appearancesLast3Days, daysSinceLastAppearance } = input;
  if (
    pitchesLast2Days >= 35
    || (daysSinceLastAppearance === 0 && pitchesLastGame >= 25)
    || (daysSinceLastAppearance !== null && daysSinceLastAppearance <= 1 && appearancesLast3Days >= 2)
  ) {
    return { availability: "Limited", reason: `${pitchesLast2Days} pitches over the last two days` };
  }
  if (
    pitchesLast2Days >= 20
    || (daysSinceLastAppearance !== null && daysSinceLastAppearance <= 1)
    || appearancesLast3Days >= 2
  ) {
    return {
      availability: "Monitor",
      reason: daysSinceLastAppearance === 0
        ? `${pitchesLastGame} pitches in the latest game`
        : `${appearancesLast3Days} appearances in the last three days`,
    };
  }
  return {
    availability: "Fresh",
    reason: daysSinceLastAppearance === null ? "No workload in the three-day window" : `${daysSinceLastAppearance} days of rest`,
  };
}

export function roundFor(code: string): (typeof POSTSEASON_ROUNDS)[number] | undefined {
  return POSTSEASON_ROUNDS.find((round) => round.code === code);
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
