import {
  DEFAULT_THEME,
  SECRET_THEMES,
  THEMES,
  THEME_STORAGE_KEY,
  UNLOCKED_THEMES_STORAGE_KEY,
  type SecretThemeId,
  type ThemeId,
} from '../config';

export function isSecretThemeId(value: unknown): value is SecretThemeId {
  return typeof value === 'string' && Object.hasOwn(SECRET_THEMES, value);
}

export function isThemeId(value: unknown): value is ThemeId {
  return (typeof value === 'string' && Object.hasOwn(THEMES, value)) || isSecretThemeId(value);
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

/** The secret themes unlocked in this browser; none when storage is unavailable. */
export async function getUnlockedThemes(): Promise<SecretThemeId[]> {
  try {
    const stored = await chrome.storage.local.get(UNLOCKED_THEMES_STORAGE_KEY);
    const unlocked: unknown = stored[UNLOCKED_THEMES_STORAGE_KEY];
    return Array.isArray(unlocked) ? unlocked.filter(isSecretThemeId) : [];
  } catch {
    return [];
  }
}

/** Remembers that `theme` was unlocked, so the popup lists it from now on. */
export async function unlockTheme(theme: SecretThemeId): Promise<void> {
  try {
    const unlocked = await getUnlockedThemes();
    if (!unlocked.includes(theme)) {
      await chrome.storage.local.set({ [UNLOCKED_THEMES_STORAGE_KEY]: [...unlocked, theme] });
    }
  } catch {
    // Still unlocked for this popup session.
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
