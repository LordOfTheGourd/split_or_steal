"use client";
import { create } from "zustand";
import { ChoiceState } from "./page";

export const useChoiceStore = create<ChoiceState>((set) => ({
  choice: "split",
  setChoice: (choice) => set({ choice }),
  amount: 0,
  setAmount: (amount) => set({ amount }),
  // Put into another store later maybe?
  splitCount: 0,
  setSplitCount: (count) => set({ splitCount: count }),
  stealCount: 0,
  setStealCount: (count) => set({ stealCount: count }),
  // Could also put info about the mint progress here
  initialTokens: 0,
  setInitialTokens: (tokens) => set({ initialTokens: tokens }),
  mintRemaining: 0,
  setMintRemaining: (tokens) => set({ mintRemaining: tokens }),
  burnedAmount: 0,
  setBurnedAmount: (tokens) => set({ burnedAmount: tokens }),
}));
