// Core baseball analytics types

// Re-export EnrichedPitch from mlb-api so all components can import from one place.
// This was previously imported from "@/lib/types" but the type was only defined in
// mlb-api.ts — with noImplicitAny: false, TypeScript silently treated it as `any`,
// which hid the server/client shape mismatch that caused the React crash.
export type { EnrichedPitch } from "./mlb-api";

export interface MLBTeam {
  id: number;
  name: string;
  link?: string;
  abbreviation?: string;
}

export interface MLBGame {
  gamePk: number;
  gameGuid?: string;
  gameDate: string;
  officialDate: string;
  status: {
    abstractGameState: string; // "Live" | "Final" | "Preview"
    detailedState: string;
    statusCode: string;
  };
  teams: {
    away: {
      team: MLBTeam;
      leagueRecord?: { wins: number; losses: number; pct: string };
      score: number | null;
      isWinner?: boolean;
    };
    home: {
      team: MLBTeam;
      leagueRecord?: { wins: number; losses: number; pct: string };
      score: number | null;
      isWinner?: boolean;
    };
  };
  venue?: { id: number; name: string };
  gameType?: string;
  dayNight?: string;
  seriesDescription?: string;
}

export interface MLBSchedule {
  totalGames: number;
  dates: Array<{
    date: string;
    games: MLBGame[];
  }>;
}

export interface PitchCoordinates {
  pX: number; // plate x (ft, 0 = center)
  pZ: number; // plate z (ft, 0 = ground)
  x0?: number;
  y0?: number;
  z0?: number;
  vX0?: number;
  vY0?: number;
  vZ0?: number;
  aX?: number;
  aY?: number;
  aZ?: number;
}

export interface PitchData {
  startSpeed?: number;
  endSpeed?: number;
  strikeZoneTop?: number;
  strikeZoneBottom?: number;
  strikeZoneWidth?: number;
  strikeZoneDepth?: number;
  coordinates: PitchCoordinates;
  zone?: number;
  breakX?: number;
  breakZ?: number;
  spinRate?: number;
  spinDirection?: number;
  extension?: number;
  plateTime?: number;
}

export interface PitchDetails {
  call?: { code: string; description: string };
  description?: string;
  code?: string;
  ballColor?: string;
  trailColor?: string;
  isInPlay?: boolean;
  isStrike?: boolean;
  isBall?: boolean;
  type?: { code: string; description?: string };
  issueType?: string;
}

export interface PlayEvent {
  index: number;
  playId?: string;
  pitchNumber?: number;
  isPitch: boolean;
  startTime?: string;
  endTime?: string;
  type?: string;
  details: PitchDetails;
  count?: { balls: number; strikes: number; outs: number; inning?: number };
  pitchData: PitchData;
}

export interface Play {
  playId?: string;
  atBatIndex: number;
  about: {
    atBatIndex: number;
    halfInning: "top" | "bottom";
    inning: number;
    isTopInning: boolean;
    startTime?: string;
    endTime?: string;
    isComplete: boolean;
    isScoringPlay: boolean;
    hasOut: boolean;
    captivatingIndex?: number;
  };
  result: {
    type: string;
    event: string;
    eventType?: string;
    description: string;
    rbi: number;
    awayScore: number;
    homeScore: number;
    isOut?: boolean;
  };
  count: { balls: number; strikes: number; outs: number };
  matchup: {
    batter: { id: number; fullName: string; link?: string };
    pitcher: { id: number; fullName: string; link?: string };
    batterSide?: { code: string; description: string };
    pitchHand?: { code: string; description: string };
    postOnFirst?: { id: number; fullName: string } | null;
    postOnSecond?: { id: number; fullName: string } | null;
    postOnThird?: { id: number; fullName: string } | null;
  };
  pitchIndex: number[];
  playEvents: PlayEvent[];
  playEndTime?: string;
}

export interface Linescore {
  currentInning?: number;
  currentInningOrdinal?: string;
  inningState?: string;
  isTopInning?: boolean;
  innings: Array<{
    num: number;
    ordinalNum: string;
    home: { runs: number; hits: number; errors: number; leftOnBase: number };
    away: { runs: number; hits: number; errors: number; leftOnBase: number };
  }>;
  teams?: {
    away?: { runs: number; hits: number; errors: number; leftOnBase: number };
    home?: { runs: number; hits: number; errors: number; leftOnBase: number };
  };
}

export interface LiveGameFeed {
  gamePk: number;
  gameData: {
    game: { id: string; pk: number; type: string };
    teams: {
      away: { id: number; name: string; teamCode?: string; abbreviation?: string; clubName?: string };
      home: { id: number; name: string; teamCode?: string; abbreviation?: string; clubName?: string };
    };
    venue?: { id: number; name: string };
    datetime?: { dateTime: string; officialDate: string; dayNight?: string };
    status: {
      abstractGameState: string;
      codedGameState: string;
      detailedState: string;
      statusCode: string;
      inning?: number;
      inningState?: string;
      isTopInning?: boolean;
    };
    players?: Record<string, { id: number; fullName: string; primaryNumber?: string; primaryPosition?: { code: string; abbreviation: string } }>;
  };
  liveData: {
    linescore: Linescore;
    plays: {
      allPlays: Play[];
      currentPlay?: Play;
    };
    boxscore?: {
      teams?: {
        away?: { players?: Record<string, { person: { id: number; fullName: string }; position?: { abbreviation: string }; stats?: any }> };
        home?: { players?: Record<string, { person: { id: number; fullName: string }; position?: { abbreviation: string }; stats?: any }> };
      };
    };
  };
}

// Statcast (Baseball Savant) types
export interface StatcastPitch {
  play_id: string;
  inning: number;
  half_inning: "top" | "bottom";
  ab_number: number;
  batter: number;
  batter_name: string;
  stand: "L" | "R" | "S";
  pitcher: number;
  pitcher_name: string;
  p_throws: "L" | "R";
  team_batting: string;
  team_fielding: string;
  result: string;
  des: string;
  events?: string;
  call?: string;
  call_name?: string;
  pitch_type: string;
  pitch_name: string;
  pitch_call?: string;
  start_speed: number | null;
  end_speed?: number | null;
  sz_top: number;
  sz_bot: number;
  sz_depth?: number;
  sz_width?: number;
  spin_rate: number | null;
  breakX?: number;
  breakZ?: number;
  inducedBreakZ?: number;
  extension?: number;
  plateTime?: number;
  zone?: number;
  px?: number;
  pz?: number;
  plate_x?: number;
  plate_z?: number;
  hit_speed?: string | null; // exit velocity
  hit_angle?: string | null; // launch angle
  hit_distance?: string | null;
  xba?: string | null;
  is_barrel?: 0 | 1;
  batSpeed?: number | null;
  hc_x?: number;
  hc_y?: number;
  hc_x_ft?: number;
  hc_y_ft?: number;
  isSword?: boolean;
  is_abs_challenge?: boolean;
  pitch_number?: number;
  player_total_pitches?: number;
  game_total_pitches?: number;
  balls?: number;
  strikes?: number;
  pre_balls?: number;
  pre_strikes?: number;
  outs?: number;
  is_bip_out?: string;
}

export interface SavantGameFeed {
  game_status_code: string;
  game_status: string;
  scoreboard: {
    gamePk: number;
    linescore: Linescore;
    teams?: {
      away?: { abbreviation: string; name: string; teamName?: string };
      home?: { abbreviation: string; name: string; teamName?: string };
    };
  };
  home_team_data?: { id: number; name: string; abbreviation: string };
  away_team_data?: { id: number; name: string; abbreviation: string };
  team_home_id?: number;
  team_away_id?: number;
  team_home?: string;
  team_away?: string;
  exit_velocity: StatcastPitch[];
  home_runs?: any[];
  hit_chart?: any[];
  players?: Record<string, { id: number; name: string; team?: string; position?: string }>;
  home_batters?: any[];
  away_batters?: any[];
  home_pitchers?: any[];
  away_pitchers?: any[];
  boxscore?: any;
}

// Leaderboard / player search types
export interface LeaderboardRow {
  player_id: number;
  player_name: string;
  year: number;
  ab?: number;
  pa?: number;
  hit?: number;
  single?: number;
  double?: number;
  triple?: number;
  home_run?: number;
  k_percent?: number;
  bb_percent?: number;
  batting_avg?: string;
  slg_percent?: string;
  on_base_percent?: string;
  woba?: string;
  xwoba?: string;
  xba?: string;
  xslg?: string;
  hard_hit_percent?: number;
  barrel_brea?: number; // barrel %
  sweet_spot_percent?: number;
  avg_hit_speed?: number; // avg EV
  max_hit_speed?: number;
  swing_percent?: number;
  whiff_percent?: number;
  launch_angle_average?: number;
  poz_swing_percent?: number;
  oz_swing_percent?: number;
  [key: string]: any;
}

export interface MLBPlayer {
  id: number;
  fullName: string;
  firstName?: string;
  lastName?: string;
  primaryNumber?: string;
  birthDate?: string;
  currentAge?: number;
  birthCity?: string;
  birthCountry?: string;
  height?: string;
  weight?: number;
  active?: boolean;
  currentTeam?: { id: number; name: string };
  primaryPosition?: { code: string; name: string; abbreviation: string };
  batSide?: { code: string; description: string };
  pitchHand?: { code: string; description: string };
}

export interface PercentileRankings {
  player_id: number;
  player_name: string;
  metrics: Array<{
    key: string;
    label: string;
    value: number | string;
    percentile: number;
    display?: string;
  }>;
}
