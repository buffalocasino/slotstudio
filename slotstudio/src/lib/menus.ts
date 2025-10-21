import type { CommandId } from './commands';

interface MenuItemBase {
  label?: string;
  cmd?: CommandId;
  shortcut?: string;
  separator?: boolean;
}

interface MenuDefinition {
  title: string;
  items: MenuItemBase[];
}

export const menus: MenuDefinition[] = [
  {
    title: 'File',
    items: [
      { label: 'New Project', cmd: 'newProject', shortcut: 'Ctrl+N' },
      { label: 'Open...', cmd: 'openProject', shortcut: 'Ctrl+O' },
      { label: 'Save', cmd: 'saveProject', shortcut: 'Ctrl+S' },
      { separator: true },
      { label: 'Quit', cmd: 'quit' },
    ],
  },
  {
    title: 'Edit',
    items: [
      { label: 'Undo', cmd: 'undo', shortcut: 'Ctrl+Z' },
      { label: 'Redo', cmd: 'redo', shortcut: 'Ctrl+Y' },
    ],
  },
  {
    title: 'View',
    items: [{ label: 'Toggle Console', cmd: 'toggleConsole', shortcut: 'Ctrl+`' }],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Run Emulator', cmd: 'runEmulator' },
      { label: 'Build Project', cmd: 'buildProject' },
    ],
  },
  { title: 'Window', items: [] },
  { title: 'Help', items: [{ label: 'About Slot Studio', cmd: 'showAbout' }] },
];
