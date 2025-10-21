import { writable, derived } from "svelte/store";
import { SlotEngine } from "../engine/SlotEngine";
import type { GridSize, SpinStyle } from "../engine/types";
import { FreeSpinsBonus } from "../bonuses/FreeSpinsBonus";
import { MultiplierBonus } from "../bonuses/MultiplierBonus";

const engine = new SlotEngine();

engine.registerBonus(new FreeSpinsBonus());
engine.registerBonus(new MultiplierBonus());

export const spinStyle = writable<SpinStyle>(engine.config.spinStyle);
export const gridSize = writable<GridSize>(engine.config.grid);
export const spinSpeed = writable<number>(engine.config.spinSpeed);
export const fallSpeed = writable<number>(engine.config.fallSpeed);

export const gridSnapshot = writable(engine.getSnapshot());
export const isSpinning = writable(false);

export function setGridPreset(preset: "5x3" | "5x4") {
  const [cols, rows] = preset === "5x3" ? [5, 3] : [5, 4];
  engine.setGrid({ cols, rows });
  gridSize.set({ cols, rows });
  gridSnapshot.set(engine.getSnapshot());
}

export function setSpinStyle(v: SpinStyle) {
  engine.setSpinStyle(v);
  spinStyle.set(v);
}

export function setSpeeds({ spin, fall }: { spin?: number; fall?: number }) {
  if (spin != null || fall != null) engine.setSpeed(spin ?? engine.config.spinSpeed, fall ?? engine.config.fallSpeed);
  if (spin != null) spinSpeed.set(spin);
  if (fall != null) fallSpeed.set(fall);
}

export async function doSpin() {
  isSpinning.set(true);
  const result = await engine.spin();
  gridSnapshot.set(engine.getSnapshot());
  isSpinning.set(false);
  return result;
}

export const engineRef = derived([], () => engine);
