"use client";

import { create } from "zustand";

export type ViewKey = "live" | "players" | "leaderboard";

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

  selectedPlayer: SelectedPlayer | null;
  setSelectedPlayer: (p: SelectedPlayer | null) => void;

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

  selectedPlayer: null,
  setSelectedPlayer: (selectedPlayer) => set({ selectedPlayer }),

  lbType: "batter",
  setLbType: (lbType) => set({ lbType }),
  // Default to most recent season with completed data; the API will fall back if needed
  lbYear: 2025,
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
