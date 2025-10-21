export const DEFAULT_REEL_COLS = 5;
export const DEFAULT_REEL_ROWS = 3;
export const DEFAULT_CELL_SIZE = 150;
export const DEFAULT_CELL_GAP = 14;

export const DEFAULT_TITLE = 'Slot Studio Emulator';

export const DEFAULT_SYMBOL_KEYS = [
  'babybuffalo/sym_card_10.png',
  'babybuffalo/sym_card_j.png',
  'babybuffalo/sym_card_q.png',
  'babybuffalo/sym_card_k.png',
  'babybuffalo/sym_card_a.png',
  'babybuffalo/sym_bear.png',
  'babybuffalo/sym_buffalo.png',
  'babybuffalo/sym_wolf.png'
];

export interface ScriptHelpers {
  randomChoice<T>(items: T[]): T;
  range(count: number): number[];
  repeat<T>(count: number, callback: (index: number) => T): T[];
}

export interface GenerateContext {
  columns: number;
  rows: number;
  helpers: ScriptHelpers;
}

export interface EmulatorConfig {
  title?: string;
  symbolKeys?: string[];
  generateResults?: (context: GenerateContext) => string[][];
  helpers?: ScriptHelpers;
}

export function createScriptHelpers(): ScriptHelpers {
  return {
    randomChoice<T>(items: T[]) {
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('randomChoice requires a non-empty array.');
      }
      const index = Math.floor(Math.random() * items.length);
      return items[index]!;
    },
    range(count: number) {
      return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => i);
    },
    repeat<T>(count: number, callback: (index: number) => T) {
      return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => callback(i));
    }
  };
}

export const DEFAULT_EMULATOR_SCRIPT = `const { defaults, helpers, columns: gridColumns, rows: gridRows } = api;

const symbolKeys = [
  ...defaults.symbolKeys
];

function generateResults({ columns, rows, helpers }) {
  return helpers.repeat(columns, () =>
    helpers.repeat(rows, () => helpers.randomChoice(symbolKeys))
  );
}

return {
  title: 'Buffalo Stampede Demo',
  symbolKeys,
  generateResults
};`;
