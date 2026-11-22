import { isNextExperiencePath } from '../commands/urls';
import { isTabOpenResponse, type TabOpenMessage } from '../shared/messages';

/** Navigates the current tab. */
export function navigate(url: string): void {
  window.location.assign(url);
}

/**
 * Opens `url` in a new tab next to this one (via the service worker). Rejects when the
 * service worker refused the URL or could not create the tab.
 */
export async function openTab(url: string, active = true): Promise<void> {
  const message: TabOpenMessage = { type: 'tab/open', url, active };
  const response: unknown = await chrome.runtime.sendMessage(message);
  if (!isTabOpenResponse(response) || !response.ok) {
    throw new Error('Could not open a new tab.');
  }
}

/** True when the page runs inside the Next Experience (Polaris) shell. */
export function isNextExperience(): boolean {
  return isNextExperiencePath(window.location.pathname);
}
