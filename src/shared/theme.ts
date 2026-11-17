import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, type ThemeId } from '../config';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && Object.hasOwn(THEMES, value);
}

export async function getSavedTheme(): Promise<ThemeId> {
  try {
    const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
    const theme: unknown = stored[THEME_STORAGE_KEY];
    return isThemeId(theme) ? theme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export async function saveTheme(theme: ThemeId): Promise<void> {
  try {
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
  } catch {
    // The selection still applies to the current view if storage is unavailable.
  }
}

/** Calls `listener` whenever the saved theme changes (e.g. from the popup). */
export function onThemeChanged(listener: (theme: ThemeId) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !(THEME_STORAGE_KEY in changes)) {
      return;
    }
    const theme: unknown = changes[THEME_STORAGE_KEY].newValue;
    listener(isThemeId(theme) ? theme : DEFAULT_THEME);
  });
}
