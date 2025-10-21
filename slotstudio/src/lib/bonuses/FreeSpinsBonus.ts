import type { Bonus, Win } from "../engine/types";

export class FreeSpinsBonus implements Bonus {
  name = "Free Spins";
  freeSpins = 0;
  triggerSymbol = "sym_scatter_free_spins";
  minScatters = 3;
  onSpinEnd({ engine, wins }: { engine: any; wins: Win[] }) {
    // simple trigger: if the board contains >= minScatters, award 5 free spins
    const grid = engine.getSnapshot();
    let scatters = 0;
    for (const col of grid) for (const sym of col) if (sym === this.triggerSymbol) scatters++;
    if (scatters >= this.minScatters) {
      this.freeSpins += 5;
      // You could set a flag in engine to not deduct balance etc.
      console.log(`[Bonus] Awarded 5 free spins! Total: ${this.freeSpins}`);
    }
  }
}
