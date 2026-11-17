import type { TabOpenMessage } from '../shared/messages';

/** Navigates the current tab. */
export function navigate(url: string): void {
  window.location.assign(url);
}

/** Opens `url` in a new tab next to this one (via the service worker). */
export async function openTab(url: string, active = true): Promise<void> {
  const message: TabOpenMessage = { type: 'tab/open', url, active };
  await chrome.runtime.sendMessage(message);
}

/** True when the page runs inside the Next Experience (Polaris) shell. */
export function isNextExperience(): boolean {
  return window.location.pathname.startsWith('/now/');
}
