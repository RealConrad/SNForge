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

async function toggleInTab(tabId: number): Promise<void> {
  const message = { type: 'palette/toggle' } as const;
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch {
    // The extension may have been loaded after this tab was already open.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['bridge.js'],
      world: 'MAIN',
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
      world: 'ISOLATED',
    });
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Restricted pages and unavailable tabs cannot run extension scripts.
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'toggle-palette' || tab?.id === undefined || !isServiceNowUrl(tab.url)) {
    return;
  }

  void toggleInTab(tab.id);
});
