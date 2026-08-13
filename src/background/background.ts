// Service worker. Content scripts can't call privileged chrome.* APIs like
// tabs.create directly - this is the one place that actually does it, on
// behalf of the palette (src/content/palette.ts).
//
// This is also the single source of truth for the built-in themes and for
// "open a fixed path" commands. Themes are storage-backed (see
// src/types/theme.d.ts for why); commands are answered live over messaging
// instead - nothing about the command list needs to persist, it's re-derived
// from this file on every request, so there's no reason to write it to
// storage too.

const THEMES_STORAGE_KEY = "snforge_themes";

// All dark, by design. Add a theme by adding an entry here - palette.ts and
// popup.ts both pick it up automatically, nothing else to touch.
const THEMES: Theme[] = [
  { id: "tokyo-night", name: "Tokyo Night", bg: "#1a1b26", border: "#3b4261", text: "#c0caf5", accent: "#7aa2f7", selectedBg: "#283457", muted: "#565f89" },
  { id: "dracula", name: "Dracula", bg: "#282a36", border: "#44475a", text: "#f8f8f2", accent: "#bd93f9", selectedBg: "#44475a", muted: "#6272a4" },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", bg: "#1e1e2e", border: "#313244", text: "#cdd6f4", accent: "#a6e3a1", selectedBg: "#45475a", muted: "#6c7086" },
];

// Re-seeded on every service worker startup (not just on install/update), so
// editing THEMES during development shows up after the next "reload
// extension" instead of needing a version bump to trigger onInstalled.
void chrome.storage.local.set({ [THEMES_STORAGE_KEY]: THEMES });

// Commands that just open a fixed path on the current instance - the only
// kind of command that's pure data and safe to hand out over messaging (a
// "custom" command's actual behavior is a real closure, which can't survive
// being sent as a message - see command.d.ts). Add an "open-path" command by
// adding an entry here; palette.ts and popup.ts both pick it up
// automatically. Add a "custom" one here too (metadata only, no path) AND a
// matching entry in palette.ts's CUSTOM_COMMAND_RUNNERS.
const SHARED_COMMANDS = [
  { id: "new", subtitle: "Opens /now/nav/ui", kind: "open-path", path: "/now/nav/ui" },
  { id: "fd", subtitle: "Opens Flow Designer", kind: "open-path", path: "/now/workflow-studio/home/flow" },
  { id: "st", subtitle: "Opens Studio", kind: "open-path", path: "/now/servicenow-studio/home" },
] as const satisfies SharedCommandDef[];

chrome.runtime.onMessage.addListener((message: SNForgeMessage, _sender, sendResponse) => {
  if (message.type === "SNFORGE_OPEN_TAB") {
    void chrome.tabs.create({ url: message.url });
    return false;
  }

  if (message.type === "SNFORGE_GET_COMMANDS") {
    sendResponse(SHARED_COMMANDS);
    return false; // answered synchronously above - no need to keep the channel open
  }

  return false;
});
