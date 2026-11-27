// Light / Dark theme preference stored locally in localStorage.
// Defaults to crisp light mode; toggling switches seamlessly without a page reload.

import { createStore } from '../util/store';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'private-ledger-theme';

function readStoredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Storage may be unavailable in restricted contexts.
  }
  return 'light';
}

export const themeStore = createStore<{ theme: Theme }>({ theme: 'light' });

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#090a0f' : '#1e2058';
}

export function initTheme(): void {
  const theme = readStoredTheme();
  themeStore.set({ theme });
  applyTheme(theme);
}

export function toggleTheme(): void {
  const next: Theme = themeStore.get().theme === 'dark' ? 'light' : 'dark';
  themeStore.set({ theme: next });
  applyTheme(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage write failures.
  }
}
