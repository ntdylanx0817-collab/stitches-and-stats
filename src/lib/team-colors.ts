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

/** WCAG relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * A team's primary colour, lifted until it actually reads against the midnight
 * background.
 *
 * Roughly a third of the league is branded in near-black navy — Yankees
 * #003087, Rays #0C2340, Astros #12284B — which disappears on #050a14. Call
 * sites had been guarding with `primary === "#000000"`, which only catches the
 * two literal blacks and misses every dark navy, so those teams silently
 * rendered invisible accents.
 *
 * Raises lightness in HSL and leaves saturation alone. Mixing toward white
 * instead would wash the colour out — Yankees navy lands on a grey-blue and
 * Rays navy on outright grey — and saturation is what makes an accent read as
 * that team's, so it is the one channel worth protecting.
 */
export function getDisplayTeamColor(teamId: number): string {
  const color = getTeamColor(teamId).primary;
  const [h, s, l] = hexToHsl(color);
  let out = color;
  // Step lightness up until the colour clears the background. The cap keeps a
  // pathological input from looping; by then lightness is essentially 1.
  for (let i = 1; i <= 12 && luminance(out) < 0.18; i++) {
    out = hslToHex(h, s, Math.min(l + i * 0.06, 1));
  }
  return out;
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

/**
 * Resolve a team id from whatever a feed hands over — a numeric id, an
 * abbreviation ("NYY"), or a name ("Yankees", "New York Yankees").
 *
 * Savant's leaderboard CSV is the reason this is loose: the column it returns
 * for team has to be discovered at runtime (see TEAM_COLUMN_CANDIDATES in
 * mlb-api.ts), so its contents could be any of those forms.
 *
 * Returns null when nothing matches, which callers should treat as "no team
 * known" rather than substituting a default — a wrong team colour is worse
 * than none.
 */
export function resolveTeamId(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;

  if (typeof value === "number" || /^\d+$/.test(String(value).trim())) {
    const id = Number(value);
    return TEAM_COLORS[id] ? id : null;
  }

  const needle = String(value).trim().toLowerCase();
  if (!needle) return null;

  const byAbbr = TEAM_IDS.find((t) => t.abbr.toLowerCase() === needle);
  if (byAbbr) return byAbbr.id;

  // Names arrive both bare ("Yankees") and full ("New York Yankees"), so match
  // an exact name first and only then fall back to a suffix match — otherwise
  // a short nickname could match the wrong club.
  const byName = TEAM_IDS.find((t) => t.name.toLowerCase() === needle);
  if (byName) return byName.id;

  const bySuffix = TEAM_IDS.find((t) => needle.endsWith(t.name.toLowerCase()));
  return bySuffix ? bySuffix.id : null;
}
