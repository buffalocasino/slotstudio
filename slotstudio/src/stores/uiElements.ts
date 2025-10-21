import { writable } from 'svelte/store';

export interface UIElement {
  id: string;
  type: 'button' | 'text' | 'icon';
  x: number;
  y: number;
  label?: string;
}

export const uiElements = writable<UIElement[]>([]);
