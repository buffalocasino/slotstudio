export type SpinStyle = "regular" | "cascading";

export type GridSize = { cols: number; rows: number };

export type SymbolId =
  | "sym_bear" | "sym_wolf" | "sym_buffalo" | "sym_elk"
  | "sym_card_9" | "sym_card_10" | "sym_card_a" | "sym_card_j"
  | "sym_card_k" | "sym_card_q" | "sym_scatter_free_spins" | "sym_wild";

export type Cell = { sym: SymbolId | null; falling?: boolean };

export type EngineConfig = {
  grid: GridSize;
  spinStyle: SpinStyle;
  spinSpeed: number;      // pixels per tick (viewer uses it)
  fallSpeed: number;      // cascade gravity
  symbolWeights: Record<SymbolId, number>;
  rngSeed?: number;
};

export type Win = { cells: { c: number; r: number }[]; payout: number; line?: number };

export interface Bonus {
  name: string;
  // Called after a spin settles (and cascade chain ends for cascading)
  onSpinEnd?(ctx: { engine: any; wins: Win[] }): void | Promise<void>;
  // Optional hook called before a spin starts
  onSpinStart?(ctx: { engine: any }): void | Promise<void>;
}
