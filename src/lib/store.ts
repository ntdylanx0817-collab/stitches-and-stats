"use client";

import { create } from "zustand";

export type ViewKey = "live" | "live-at-bat" | "standings" | "players" | "leaderboard" | "news" | "simulator" | "compare" | "derby" | "team";

interface SelectedPlayer {
  id: number;
  name: string;
  type: "batter" | "pitcher";
}

interface SavantState {
  view: ViewKey;
  setView: (v: ViewKey) => void;

  selectedGamePk: number | null;
  setSelectedGame: (pk: number | null) => void;

  selectedAtBatIndex: number | null;
  setSelectedAtBatIndex: (idx: number | null) => void;

  atBatAutoAdvanceEnabled: boolean;
  setAtBatAutoAdvanceEnabled: (b: boolean) => void;

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
  setSelectedGame: (selectedGamePk) => set({ selectedGamePk }),

  selectedAtBatIndex: null,
  setSelectedAtBatIndex: (selectedAtBatIndex) => set({ selectedAtBatIndex }),

  atBatAutoAdvanceEnabled: true,
  setAtBatAutoAdvanceEnabled: (atBatAutoAdvanceEnabled) => set({ atBatAutoAdvanceEnabled }),

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
