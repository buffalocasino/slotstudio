import { writable } from 'svelte/store';

export type Tool = 'none' | 'reel' | 'ui' | 'delete' | 'spine';

export const activeTool = writable<Tool>('none');
