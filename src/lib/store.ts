"use client";

import { create } from "zustand";

export type ViewKey = "live" | "live-at-bat" | "recap" | "standings" | "players" | "leaderboard" | "news" | "simulator" | "compare" | "derby" | "team";

interface SelectedPlayer {
  id: number;
  name: string;
  type: "batter" | "pitcher";
}

interface SavantState {
  view: ViewKey;
  setView: (v: ViewKey) => void;

  selectedGamePk: number | null;
  /** Also clears the at-bat selection, which only means anything per-game. */
  setSelectedGame: (pk: number | null) => void;

  /**
   * At-bat pinned in the Live At-Bat tab. `null` means "follow the live
   * at-bat", which is the default and what makes the tab watchable hands-off.
   *
   * Cleared on every game change — an index from one game points at an
   * unrelated plate appearance in another.
   */
  selectedAtBatIndex: number | null;
  setSelectedAtBatIndex: (idx: number | null) => void;

  selectedPlayer: SelectedPlayer | null;
  setSelectedPlayer: (p: SelectedPlayer | null) => void;

  selectedTeamId: number | null;
  setSelectedTeamId: (id: number | null) => void;

  // leaderboard filters
  lbType: "batter" | "pitcher";
  setLbType: (t: "batter" | "pitcher") => void;
  lbYear: number;
  setLbYear: (y: number) => void;
  lbMin: number;
  setLbMin: (m: number) => void;
  lbTeam: string;
  setLbTeam: (t: string) => void;
  lbPosition: string;
  setLbPosition: (p: string) => void;
  lbShowAdvanced: boolean;
  setLbShowAdvanced: (b: boolean) => void;
}

export const useSavantStore = create<SavantState>((set) => ({
  view: "live",
  setView: (view) => set({ view }),

  selectedGamePk: null,
  setSelectedGame: (selectedGamePk) => set({ selectedGamePk, selectedAtBatIndex: null }),

  selectedAtBatIndex: null,
  setSelectedAtBatIndex: (selectedAtBatIndex) => set({ selectedAtBatIndex }),

  selectedPlayer: null,
  setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),

  selectedTeamId: null,
  setSelectedTeamId: (selectedTeamId) => set({ selectedTeamId }),

  lbType: "batter",
  setLbType: (lbType) => set({ lbType }),
  // Default to current year — the API will fall back to the most recent
  // season with data if the current year isn't available yet.
  lbYear: new Date().getFullYear(),
  setLbYear: (lbYear) => set({ lbYear }),
  lbMin: 50,
  setLbMin: (lbMin) => set({ lbMin }),
  lbTeam: "",
  setLbTeam: (lbTeam) => set({ lbTeam }),
  lbPosition: "",
  setLbPosition: (lbPosition) => set({ lbPosition }),
  lbShowAdvanced: true,
  setLbShowAdvanced: (lbShowAdvanced) => set({ lbShowAdvanced }),
}));
