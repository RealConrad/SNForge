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
