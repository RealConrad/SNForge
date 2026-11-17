import { DOCS_URL } from '../config';
import { TOGGLE_PALETTE_COMMAND, isTabOpenMessage, type PaletteToggleMessage } from '../shared/messages';

function isServiceNowUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname === 'service-now.com' || url.hostname.endsWith('.service-now.com'));
  } catch {
    return false;
  }
}

async function injectScripts(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['bridge.js'], world: 'MAIN' });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'], world: 'ISOLATED' });
}

async function toggleInTab(tabId: number): Promise<void> {
  const message: PaletteToggleMessage = { type: 'palette/toggle' };
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch {
    // No content script yet, e.g. the tab was open before the extension loaded.
  }

  try {
    await injectScripts(tabId);
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Restricted pages and unavailable tabs cannot run extension scripts.
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== TOGGLE_PALETTE_COMMAND || tab?.id === undefined || !isServiceNowUrl(tab.url)) {
    return;
  }

  void toggleInTab(tab.id);
});

/** True when `url` is on the same ServiceNow origin as the tab that asked for it. */
function isSameInstance(url: string, senderUrl: string | undefined): boolean {
  if (!isServiceNowUrl(url) || !isServiceNowUrl(senderUrl)) {
    return false;
  }
  return new URL(url).origin === new URL(senderUrl ?? '').origin;
}

/** Content scripts may open their own instance, plus the docs page. Nothing else. */
function isAllowedTabUrl(url: string, senderUrl: string | undefined): boolean {
  return url === DOCS_URL || isSameInstance(url, senderUrl);
}

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isTabOpenMessage(message) || !sender.tab || !isAllowedTabUrl(message.url, sender.tab.url)) {
    return;
  }

  void chrome.tabs.create({
    url: message.url,
    active: message.active ?? true,
    index: sender.tab.index + 1,
    windowId: sender.tab.windowId,
  });
});
