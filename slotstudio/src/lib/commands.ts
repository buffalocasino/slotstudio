import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { get } from 'svelte/store';
import { uiElements } from '../stores/uiElements';

// Registry of all commands the UI can invoke.
export const commands = {
  newProject: async () => {
    console.log('New project (placeholder)');
  },
  openProject: async () => {
    if (!isTauri()) {
      console.warn('openProject is only available in the desktop app.');
      return;
    }

    const path = await open({ filters: [{ name: 'Slot Studio Project', extensions: ['json'] }] });
    if (typeof path === 'string') {
      const data = await readTextFile(path);
      console.log('Loaded project', path, JSON.parse(data));
    }
  },
  saveProject: async () => {
    if (!isTauri()) {
      console.warn('saveProject is only available in the desktop app.');
      return;
    }

    const path = await save({ filters: [{ name: 'Slot Studio Project', extensions: ['json'] }] });
    if (path) {
      const data = JSON.stringify(get(uiElements), null, 2);
      await writeTextFile(path, data);
      console.log('Project saved to', path);
    }
  },
  toggleConsole: async () => {
    if (typeof document === 'undefined') {
      console.warn('toggleConsole requires a browser environment.');
      return;
    }

    document.dispatchEvent(new CustomEvent('toggleConsole'));
  },
  quit: async () => {
    if (!isTauri()) {
      console.warn('quit is only available in the desktop app.');
      return;
    }

    await invoke('close_window');
  },
  undo: async () => {
    console.log('Undo (placeholder)');
  },
  redo: async () => {
    console.log('Redo (placeholder)');
  },
  runEmulator: async () => {
    console.log('Run emulator (placeholder)');
  },
  buildProject: async () => {
    console.log('Build project (placeholder)');
  },
  showAbout: async () => {
    console.log('About Slot Studio (placeholder)');
  },
};

export type CommandId = keyof typeof commands;

// Run a command by id so menus, toolbars, and shortcuts share logic.
export function runCommand(id: CommandId) {
  const cmd = commands[id];
  if (!cmd) {
    console.warn(`Command '${id}' is not registered.`);
    return;
  }

  cmd();
}

function isTauri() {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}
