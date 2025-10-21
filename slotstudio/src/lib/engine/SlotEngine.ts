import type { Cell, EngineConfig, GridSize, SymbolId, Win } from "./types";

function seededRng(seed: number) {
  // simple xorshift-ish
  let x = seed || 123456789;
  return () => (x ^= x << 13, x ^= x >> 17, x ^= x << 5, (x >>> 0) / 4294967296);
}

const DEFAULT_WEIGHTS: EngineConfig["symbolWeights"] = {
  sym_bear: 5, sym_wolf: 5, sym_buffalo: 3, sym_elk: 5,
  sym_card_9: 10, sym_card_10: 10, sym_card_a: 8, sym_card_j: 9,
  sym_card_k: 8, sym_card_q: 9, sym_scatter_free_spins: 1, sym_wild: 2
};

export class SlotEngine {
  config: EngineConfig;
  grid: Cell[][];
  rng: () => number;
  spinning = false;
  cascadesInChain = 0;
  bonuses: any[] = [];

  constructor(cfg?: Partial<EngineConfig>) {
    this.config = {
      grid: { cols: 5, rows: 3 },
      spinStyle: "regular",
      spinSpeed: 18,
      fallSpeed: 28,
      symbolWeights: DEFAULT_WEIGHTS,
      rngSeed: Math.floor(Math.random() * 1e9),
      ...cfg
    };
    this.rng = seededRng(this.config.rngSeed!);
    this.grid = this.makeEmptyGrid(this.config.grid);
    this.fillAllRandom();
  }

  makeEmptyGrid(size: GridSize) {
    return Array.from({ length: size.cols }, () =>
      Array.from({ length: size.rows }, () => ({ sym: null as SymbolId | null }))
    );
  }

  setGrid(size: GridSize) {
    this.config.grid = size;
    this.grid = this.makeEmptyGrid(size);
    this.fillAllRandom();
  }

  setSpinStyle(style: EngineConfig["spinStyle"]) {
    this.config.spinStyle = style;
  }

  setSpeed(spinSpeed: number, fallSpeed?: number) {
    this.config.spinSpeed = spinSpeed;
    if (fallSpeed != null) this.config.fallSpeed = fallSpeed;
  }

  setWeights(weights: Partial<Record<SymbolId, number>>) {
    this.config.symbolWeights = { ...this.config.symbolWeights, ...weights };
  }

  registerBonus(bonus: any) {
    this.bonuses.push(bonus);
  }

  private pickRandomSymbol(): SymbolId {
    // weighted pick
    const entries = Object.entries(this.config.symbolWeights) as [SymbolId, number][];
    const total = entries.reduce((a, [, w]) => a + w, 0);
    let t = this.rng() * total;
    for (const [sym, w] of entries) {
      if ((t -= w) <= 0) return sym;
    }
    return entries[entries.length - 1][0];
  }

  private fillAllRandom() {
    for (let c = 0; c < this.config.grid.cols; c++) {
      for (let r = 0; r < this.config.grid.rows; r++) {
        this.grid[c][r].sym = this.pickRandomSymbol();
      }
    }
  }

  async spin(): Promise<{ wins: Win[]; cascades: number }> {
    if (this.spinning) return { wins: [], cascades: 0 };
    this.spinning = true;
    for (const b of this.bonuses) await b.onSpinStart?.({ engine: this });

    // Regular spin: replace whole grid
    // Cascading: we still “spin”, but viewer animates; engine provides result grid after.
    this.fillAllRandom();

    // Evaluate wins (toy example: any 3+ same in a row horizontally)
    let wins = this.evaluateWins();

    if (this.config.spinStyle === "cascading") {
      this.cascadesInChain = 0;
      while (wins.length) {
        this.deleteWins(wins);
        this.applyGravity();
        this.fillTop();
        this.cascadesInChain++;
        wins = this.evaluateWins();
      }
    }

    this.spinning = false;
    for (const b of this.bonuses) await b.onSpinEnd?.({ engine: this, wins });

    return { wins, cascades: this.cascadesInChain };
  }

  evaluateWins(): Win[] {
    const wins: Win[] = [];
    const { cols, rows } = this.config.grid;
    for (let r = 0; r < rows; r++) {
      let streak: { sym: SymbolId; cells: { c: number; r: number }[] } | null = null;
      for (let c = 0; c < cols; c++) {
        const sym = this.grid[c][r].sym;
        if (!sym) continue;
        if (!streak || streak.sym !== sym) {
          if (streak && streak.cells.length >= 3) {
            wins.push({ cells: streak.cells, payout: streak.cells.length * 10 });
          }
          streak = { sym, cells: [{ c, r }] };
        } else {
          streak.cells.push({ c, r });
        }
      }
      if (streak && streak.cells.length >= 3) {
        wins.push({ cells: streak.cells, payout: streak.cells.length * 10 });
      }
    }
    return wins;
  }

  deleteWins(wins: Win[]) {
    for (const w of wins) {
      for (const { c, r } of w.cells) {
        this.grid[c][r].sym = null;
      }
    }
  }

  applyGravity() {
    const { cols, rows } = this.config.grid;
    for (let c = 0; c < cols; c++) {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        const sym = this.grid[c][r].sym;
        if (sym != null) {
          if (write !== r) {
            this.grid[c][write].sym = sym;
            this.grid[c][r].sym = null;
          }
          write--;
        }
      }
    }
  }

  fillTop() {
    const { cols, rows } = this.config.grid;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (this.grid[c][r].sym == null) {
          this.grid[c][r].sym = this.pickRandomSymbol();
        }
      }
    }
  }

  getSnapshot(): SymbolId[][] {
    // column-major to 2D array (cols x rows)
    return this.grid.map(col => col.map(cell => cell.sym as SymbolId));
  }
}
