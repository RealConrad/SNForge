import { TOGGLE_PALETTE_COMMAND, type RuntimeMessage } from '../shared/messages';

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
  const message: RuntimeMessage = { type: 'palette/toggle' };
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
