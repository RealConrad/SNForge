// Extension settings popup (click the toolbar icon).
//
// Theme data lives in chrome.storage.local, seeded by background.ts - see
// src/types/theme.d.ts for why it's not just a hardcoded array here too.
const THEMES_STORAGE_KEY = "snforge_themes";
const SELECTED_THEME_STORAGE_KEY = "snforge_theme";

function applyThemeVars(theme: Theme): void {
  const root = document.documentElement.style;
  root.setProperty("--sn-bg", theme.bg);
  root.setProperty("--sn-border", theme.border);
  root.setProperty("--sn-text", theme.text);
  root.setProperty("--sn-accent", theme.accent);
  root.setProperty("--sn-selected-bg", theme.selectedBg);
  root.setProperty("--sn-muted", theme.muted);
}

function renderThemes(themes: Theme[], selectedId: string): void {
  const container = document.getElementById("themes")!;
  container.innerHTML = "";
  for (const theme of themes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = theme.id === selectedId ? "swatch selected" : "swatch";
    button.title = theme.name;
    button.style.background = theme.bg;

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = theme.accent;

    const label = document.createElement("span");
    label.className = "swatch-label";
    label.textContent = theme.name;

    button.append(dot, label);
    button.addEventListener("click", () => {
      void chrome.storage.sync.set({ [SELECTED_THEME_STORAGE_KEY]: theme.id });
      applyThemeVars(theme);
      renderThemes(themes, theme.id);
    });
    container.append(button);
  }
}

// Custom key bindings aren't implemented yet - see DEFAULT_SHORTCUT_KEY in
// src/content/palette.ts (kept in sync by hand until that's storage-backed).
const SHORTCUT_LABEL = "Ctrl / Cmd + M";

// The command list itself is NOT hardcoded here - it's fetched live from
// background.ts's SHARED_COMMANDS (the single source of truth palette.ts
// also reads from), so this stays accurate without hand-editing two lists.
// See src/types/command.d.ts.
async function loadCommands(): Promise<SharedCommandDef[]> {
  const message: SNForgeGetCommandsMessage = { type: "SNFORGE_GET_COMMANDS" };
  return (await chrome.runtime.sendMessage(message).catch(() => [])) as SharedCommandDef[];
}

function renderCommands(commands: SharedCommandDef[]): void {
  document.getElementById("shortcut")!.textContent = SHORTCUT_LABEL;

  const listEl = document.getElementById("commands")!;
  listEl.innerHTML = "";
  for (const command of commands) {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = command.id;
    const desc = document.createElement("span");
    desc.className = "desc";
    desc.textContent = command.subtitle ?? "";
    li.append(name, desc);
    listEl.append(li);
  }
}

async function main(): Promise<void> {
  const [commands, themesStored] = await Promise.all([loadCommands(), chrome.storage.local.get(THEMES_STORAGE_KEY)]);
  renderCommands(commands);

  const themes = themesStored[THEMES_STORAGE_KEY] as Theme[] | undefined;
  if (!themes || themes.length === 0) return; // background hasn't seeded storage yet

  const selected = await chrome.storage.sync.get(SELECTED_THEME_STORAGE_KEY);
  const selectedId = (selected[SELECTED_THEME_STORAGE_KEY] as string | undefined) ?? themes[0].id;
  const theme = themes.find((t) => t.id === selectedId) ?? themes[0];

  applyThemeVars(theme);
  renderThemes(themes, theme.id);
}

main();
