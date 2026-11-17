export const ACCESS = {
  requiredRoles: ['admin'],
  match: 'any' as 'any' | 'all',
};

export const THEMES = {
  tokyo: 'Tokyo',
  midnight: 'Midnight',
  obsidian: 'Obsidian',
} as const;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeId = 'tokyo';
export const THEME_STORAGE_KEY = 'snforge.theme';

/** User documentation, opened by :help and the popup. */
export const DOCS_URL = 'https://github.com/RealConrad/SNForge#readme';

/** How long the content script waits for the page bridge to answer. */
export const BRIDGE_TIMEOUT_MS = 2_000;

/** Maximum number of command suggestions shown in the palette. */
export const MAX_SUGGESTIONS = 6;
