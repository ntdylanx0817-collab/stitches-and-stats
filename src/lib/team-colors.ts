// Official MLB team primary colors
// Source: MLB brand guidelines (publicly available)
export const TEAM_COLORS: Record<number, { primary: string; secondary: string }> = {
  133: { primary: "#003831", secondary: "#EFB21E" }, // Athletics
  134: { primary: "#FDB827", secondary: "#27251F" }, // Pirates
  135: { primary: "#2F241D", secondary: "#FFC425" }, // Padres
  136: { primary: "#0C2C56", secondary: "#005C5C" }, // Mariners
  137: { primary: "#FD5A1E", secondary: "#27251F" }, // Giants
  138: { primary: "#C41E3A", secondary: "#0C2340" }, // Cardinals
  139: { primary: "#0C2340", secondary: "#FA4616" }, // Rays
  140: { primary: "#003278", secondary: "#C0111F" }, // Rangers
  141: { primary: "#1A2848", secondary: "#E0B33A" }, // Blue Jays
  142: { primary: "#002B5C", secondary: "#D31145" }, // Twins
  143: { primary: "#E81828", secondary: "#002D72" }, // Phillies
  144: { primary: "#CE1141", secondary: "#13274F" }, // Braves
  145: { primary: "#33006F", secondary: "#C4CED4" }, // White Sox
  146: { primary: "#00A3E0", secondary: "#EF3340" }, // Marlins
  147: { primary: "#003087", secondary: "#E4002C" }, // Yankees
  108: { primary: "#BA0021", secondary: "#003263" }, // Angels
  109: { primary: "#A71930", secondary: "#E3D4AD" }, // Diamondbacks
  110: { primary: "#DF4601", secondary: "#000000" }, // Orioles
  111: { primary: "#BD3039", secondary: "#0C2340" }, // Red Sox
  112: { primary: "#0E3386", secondary: "#CC3433" }, // Cubs
  113: { primary: "#C6011F", secondary: "#000000" }, // Reds
  114: { primary: "#00385D", secondary: "#E50022" }, // Guardians
  115: { primary: "#33006F", secondary: "#C4CED4" }, // Rockies
  116: { primary: "#0C2340", secondary: "#FA4616" }, // Tigers
  117: { primary: "#12284B", secondary: "#FFC52F" }, // Astros
  118: { primary: "#004687", secondary: "#BD9B60" }, // Royals
  119: { primary: "#005A9C", secondary: "#EF3E42" }, // Dodgers
  120: { primary: "#AB0003", secondary: "#112A61" }, // Nationals
  121: { primary: "#FF5910", secondary: "#002D72" }, // Mets
  158: { primary: "#12284B", secondary: "#FFC52F" }, // Brewers
};

export function getTeamColor(teamId: number): { primary: string; secondary: string } {
  return TEAM_COLORS[teamId] ?? { primary: "#4DA3FF", secondary: "#e67e22" };
}

// All 30 team IDs and abbreviations for the odds API
export const TEAM_IDS: Array<{ id: number; abbr: string; name: string }> = [
  { id: 133, abbr: "ATH", name: "Athletics" },
  { id: 134, abbr: "PIT", name: "Pirates" },
  { id: 135, abbr: "SD", name: "Padres" },
  { id: 136, abbr: "SEA", name: "Mariners" },
  { id: 137, abbr: "SF", name: "Giants" },
  { id: 138, abbr: "STL", name: "Cardinals" },
  { id: 139, abbr: "TB", name: "Rays" },
  { id: 140, abbr: "TEX", name: "Rangers" },
  { id: 141, abbr: "TOR", name: "Blue Jays" },
  { id: 142, abbr: "MIN", name: "Twins" },
  { id: 143, abbr: "PHI", name: "Phillies" },
  { id: 144, abbr: "ATL", name: "Braves" },
  { id: 145, abbr: "CWS", name: "White Sox" },
  { id: 146, abbr: "MIA", name: "Marlins" },
  { id: 147, abbr: "NYY", name: "Yankees" },
  { id: 108, abbr: "LAA", name: "Angels" },
  { id: 109, abbr: "AZ", name: "Diamondbacks" },
  { id: 110, abbr: "BAL", name: "Orioles" },
  { id: 111, abbr: "BOS", name: "Red Sox" },
  { id: 112, abbr: "CHC", name: "Cubs" },
  { id: 113, abbr: "CIN", name: "Reds" },
  { id: 114, abbr: "CLE", name: "Guardians" },
  { id: 115, abbr: "COL", name: "Rockies" },
  { id: 116, abbr: "DET", name: "Tigers" },
  { id: 117, abbr: "HOU", name: "Astros" },
  { id: 118, abbr: "KC", name: "Royals" },
  { id: 119, abbr: "LAD", name: "Dodgers" },
  { id: 120, abbr: "WSH", name: "Nationals" },
  { id: 121, abbr: "NYM", name: "Mets" },
  { id: 158, abbr: "MIL", name: "Brewers" },
];
