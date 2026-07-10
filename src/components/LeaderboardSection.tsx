"use client";

import { useState } from "react";

const HITTERS = [
  { rank: 1, name: "Shohei Ohtani", team: "LAD", war: 8.2, wrc: 178, avg: ".313", hr: 38, ops: "1.036" },
  { rank: 2, name: "Aaron Judge", team: "NYY", war: 7.8, wrc: 171, avg: ".297", hr: 42, ops: ".998" },
  { rank: 3, name: "Freddie Freeman", team: "LAD", war: 6.1, wrc: 155, avg: ".306", hr: 22, ops: ".929" },
  { rank: 4, name: "José Ramírez", team: "CLE", war: 5.9, wrc: 149, avg: ".282", hr: 28, ops: ".907" },
  { rank: 5, name: "Juan Soto", team: "NYM", war: 5.7, wrc: 162, avg: ".291", hr: 24, ops: ".963" },
];

const PITCHERS = [
  { rank: 1, name: "Zack Wheeler", team: "PHI", war: 6.4, fip: 2.41, era: "2.58", k9: "10.8", ip: "198.1" },
  { rank: 2, name: "Gerrit Cole", team: "NYY", war: 5.9, fip: 2.68, era: "2.89", k9: "11.4", ip: "184.0" },
  { rank: 3, name: "Logan Gilbert", team: "SEA", war: 5.3, fip: 2.82, era: "3.01", k9: "9.9", ip: "190.2" },
  { rank: 4, name: "Spencer Strider", team: "ATL", war: 5.1, fip: 2.95, era: "3.14", k9: "13.1", ip: "171.0" },
  { rank: 5, name: "Pablo López", team: "MIN", war: 4.8, fip: 3.11, era: "3.28", k9: "9.3", ip: "187.2" },
];

const COLUMNS_HITTERS = ["Rank", "Name", "Team", "WAR", "wRC+", "AVG", "HR", "OPS"];
const COLUMNS_PITCHERS = ["Rank", "Name", "Team", "WAR", "FIP", "ERA", "K/9", "IP"];

export default function LeaderboardSection() {
  const [tab, setTab] = useState<"hitters" | "pitchers">("hitters");
  const [sortCol, setSortCol] = useState<string>("WAR");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = tab === "hitters" ? HITTERS : PITCHERS;
  const cols = tab === "hitters" ? COLUMNS_HITTERS : COLUMNS_PITCHERS;

  function handleSort(col: string) {
    if (col === sortCol) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  return (
    <section id="leaderboards" className="py-24 border-t border-border">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Leaderboards
            </span>
            <h2 className="text-4xl font-bold mt-3 text-balance">
              Who&apos;s running the show
            </h2>
          </div>

          {/* Tab switcher */}
          <div
            className="flex gap-1 bg-muted border border-border rounded-lg p-1 w-fit"
            role="tablist"
            aria-label="Leaderboard type"
          >
            {(["hitters", "pitchers"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setSortCol("WAR");
                  setSortDir("desc");
                }}
                className={`px-4 py-2 rounded-md text-sm font-semibold capitalize transition-colors ${
                  tab === t
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm" aria-label={`${tab} leaderboard`}>
            <thead>
              <tr className="border-b border-border bg-muted">
                {cols.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    onClick={() => handleSort(col)}
                    className={`px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider cursor-pointer select-none transition-colors ${
                      sortCol === col
                        ? "text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-sort={
                      sortCol === col
                        ? sortDir === "desc"
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                  >
                    <span className="flex items-center gap-1">
                      {col}
                      {sortCol === col && (
                        <span aria-hidden="true">{sortDir === "desc" ? "↓" : "↑"}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.name}
                  className={`border-b border-border last:border-0 transition-colors hover:bg-muted/60 ${
                    i === 0 ? "bg-accent/5" : "bg-card"
                  }`}
                >
                  {tab === "hitters" ? (
                    <>
                      <td className="px-4 py-3 font-mono text-muted-foreground text-xs">
                        {(row as (typeof HITTERS)[0]).rank}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {row.name}
                        {i === 0 && (
                          <span className="ml-2 text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-mono uppercase">
                            #1
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {(row as (typeof HITTERS)[0]).team}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground font-bold">
                        {(row as (typeof HITTERS)[0]).war}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {(row as (typeof HITTERS)[0]).wrc}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {(row as (typeof HITTERS)[0]).avg}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {(row as (typeof HITTERS)[0]).hr}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {(row as (typeof HITTERS)[0]).ops}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-muted-foreground text-xs">
                        {(row as (typeof PITCHERS)[0]).rank}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {row.name}
                        {i === 0 && (
                          <span className="ml-2 text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-mono uppercase">
                            #1
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {(row as (typeof PITCHERS)[0]).team}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground font-bold">
                        {(row as (typeof PITCHERS)[0]).war}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {(row as (typeof PITCHERS)[0]).fip}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {(row as (typeof PITCHERS)[0]).era}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {(row as (typeof PITCHERS)[0]).k9}
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground">
                        {(row as (typeof PITCHERS)[0]).ip}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-muted-foreground font-mono">
          * Sample data shown for preview. Live leaderboards update every 15 minutes during the season.
        </p>
      </div>
    </section>
  );
}
