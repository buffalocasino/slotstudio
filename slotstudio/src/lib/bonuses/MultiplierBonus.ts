import type { Bonus, Win } from "../engine/types";

export class MultiplierBonus implements Bonus {
  name = "Win Multiplier";
  multiplier = 1;

  onSpinStart() {
    // decay or randomize per spin; demo uses +0 or +1 randomly
    if (Math.random() < 0.25) this.multiplier++;
  }

  onSpinEnd({ wins }: { engine: any; wins: Win[] }) {
    if (!wins.length) return;
    const total = wins.reduce((a, w) => a + w.payout, 0);
    const boosted = total * this.multiplier;
    console.log(`[Bonus] Applied x${this.multiplier} => ${boosted}`);
  }
}
