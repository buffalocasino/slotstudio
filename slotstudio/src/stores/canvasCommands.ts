import { writable } from 'svelte/store';

export type CanvasCommandAction = 'clear-reels' | 'clear-ui';

interface CanvasCommand {
  id: number;
  action: CanvasCommandAction;
}

const canvasCommand = writable<CanvasCommand | null>(null);

export function issueCanvasCommand(action: CanvasCommandAction) {
  canvasCommand.set({ id: Date.now(), action });
}

export default canvasCommand;
