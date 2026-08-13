// Command palette overlay: a hotkey opens a centered input over the page.
// Hand-written commands ("new") run on Enter directly. Tables use
// ServiceNow's own convention from the classic application navigator:
// "<table>.list" opens that table's list view, and "<table>.list?<filter>"
// opens it with that sysparm_query filter applied - same syntax you'd type
// into the native nav bar. There's no autocomplete/fetch against the
// instance for this - it's a pure, offline URL construction, so it works
// instantly regardless of how many tables the instance has.
//
// Classic ServiceNow UI (UI16) puts the actual form in a same-origin iframe
// (gsft_main), so the hotkey has to be caught in every frame - but the
// overlay itself only renders once, in the top frame. Other frames relay the
// keypress up via postMessage (all_frames: true in manifest.json).
// Wrapped in an IIFE so top-level names here don't leak into the page's (or
// this frame's isolated-world) shared global scope.
//
// File layout, top to bottom: types & config -> static commands -> table
// command parsing -> messaging to the background worker -> the iframe-relay
// early exit -> the overlay itself (DOM, theming, matching/rendering, event
// wiring).

// --- Types -------------------------------------------------------------------

interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  run: () => void;
}

// --- Config --------------------------------------------------------------

// Default palette hotkey. Rebinding isn't implemented yet - the popup
// (src/popup/) is where that settings UI will eventually live - but keeping
// this as a single named constant makes it a one-line change now, and the
// natural spot to swap for a chrome.storage-backed value later.
const DEFAULT_SHORTCUT_KEY = "m";

// Mirrors ServiceNow's own application-navigator shortcut: "<table>.list" or
// "<table>.list?<filter>", where <filter> is a raw sysparm_query (the same
// field=value^field2=value2 syntax the platform itself uses).
const TABLE_LIST_PATTERN = /^([a-z][a-z0-9_]*)\.list(?:\?(.*))?$/i;

// Theme data lives in chrome.storage.local, seeded by background.ts - see
// src/types/theme.d.ts for why.
const THEMES_STORAGE_KEY = "snforge_themes";
const SELECTED_THEME_STORAGE_KEY = "snforge_theme";

(() => {
  function isShortcut(event: KeyboardEvent): boolean {
    return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === DEFAULT_SHORTCUT_KEY;
  }

  // --- Static commands -------------------------------------------------------
  // "open-path" commands come from background.ts's SHARED_COMMANDS - the
  // single source of truth, fetched live below so nothing here is duplicated
  // or persisted to storage. "custom" commands are metadata-only over there;
  // their actual behavior is defined here, since this is the only context
  // with the page/chrome.runtime access to run arbitrary logic. Add a
  // "custom" entry to SHARED_COMMANDS AND a matching id here when you add one.
  const CUSTOM_COMMAND_RUNNERS: Record<string, () => void> = {
    // dup: () => { ... },
  };

  let staticCommands: PaletteCommand[] = [];

  function toPaletteCommand(def: SharedCommandDef): PaletteCommand | null {
    if (def.kind === "open-path") {
      return { id: def.id, title: def.id, subtitle: def.subtitle, run: () => openInNewTab(`${window.location.origin}${def.path}`) };
    }
    const run = CUSTOM_COMMAND_RUNNERS[def.id];
    if (!run) {
      console.warn(`SNForge: "${def.id}" is declared as a custom command but has no local runner`);
      return null;
    }
    return { id: def.id, title: def.id, subtitle: def.subtitle, run };
  }

  async function loadStaticCommands(): Promise<void> {
    const message: SNForgeGetCommandsMessage = { type: "SNFORGE_GET_COMMANDS" };
    const shared = (await chrome.runtime.sendMessage(message).catch(() => [])) as SharedCommandDef[];
    staticCommands = shared.map(toPaletteCommand).filter((c): c is PaletteCommand => c !== null);
  }

  // --- Table commands -------------------------------------------------------
  function parseTableCommand(query: string): { table: string; filter?: string } | null {
    const match = TABLE_LIST_PATTERN.exec(query);
    if (!match) return null;
    const [, table, filter] = match;
    return { table: table.toLowerCase(), filter };
  }

  function openTable(table: string, filter?: string): void {
    const url = new URL(`${window.location.origin}/${table}_list.do`);
    if (filter) url.searchParams.set("sysparm_query", filter);
    openInNewTab(url.toString());
  }

  function buildTableEntry(table: string, filter?: string): PaletteCommand {
    const path = filter ? `/${table}_list.do?sysparm_query=${filter}` : `/${table}_list.do`;
    return {
      id: `table:${table}`,
      title: filter ? `Open ${table}.list?${filter}` : `Open ${table}.list`,
      subtitle: path,
      run: () => openTable(table, filter),
    };
  }

  // --- Messaging -------------------------------------------------------
  // Content scripts can't call chrome.tabs directly - the background worker
  // does the actual privileged action.
  function openInNewTab(url: string): void {
    const message: SNForgeOpenTabMessage = { type: "SNFORGE_OPEN_TAB", url };
    chrome.runtime.sendMessage(message).catch(() => {
      // Background isn't ready, or the tab is closing - safe to drop.
    });
  }

  // --- Iframe relay -------------------------------------------------------
  const isTopFrame = window.top === window.self;

  if (!isTopFrame) {
    // Inside an iframe (e.g. gsft_main) - just watch for the hotkey and
    // relay it to the top frame, which owns the actual overlay.
    window.addEventListener(
      "keydown",
      (event) => {
        if (!isShortcut(event)) return;
        event.preventDefault();
        window.top?.postMessage({ source: "snforge", type: "SNFORGE_TOGGLE_PALETTE" }, window.location.origin);
      },
      true,
    );
    return;
  }

  void loadStaticCommands();

  // --- Overlay: DOM (hidden until toggled) -------------------------------
  const host = document.createElement("div");
  host.id = "snforge-palette-host";
  const shadow = host.attachShadow({ mode: "closed" }); // isolates our styles from the host page's CSS, and vice versa

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        --sn-bg: #1a1b26;
        --sn-border: #3b4261;
        --sn-text: #c0caf5;
        --sn-accent: #7aa2f7;
        --sn-selected-bg: #283457;
        --sn-muted: #565f89;
      }
      .backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(10, 12, 20, 0.55);
        backdrop-filter: blur(6px) saturate(1.2);
        justify-content: center;
        padding-top: 15vh;
        z-index: 2147483647;
        font: 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      /* Toggled via a class, not the "hidden" attribute: this stylesheet's
         own .backdrop { display } rule would out-cascade the UA's default
         [hidden] { display: none }, since author styles beat UA styles at
         equal specificity regardless of the hidden attribute's value. */
      .backdrop.open {
        display: flex;
      }
      .panel {
        width: 520px;
        max-width: 90vw;
        height: fit-content;
        background: var(--sn-bg);
        color: var(--sn-text);
        border: 1px solid var(--sn-border);
        border-radius: 12px;
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--sn-accent) 15%, transparent), 0 16px 48px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        transform: translateY(-6px) scale(0.98);
        opacity: 0;
        transition: transform 0.12s ease-out, opacity 0.12s ease-out;
      }
      .backdrop.open .panel {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        padding: 14px 16px;
        background: transparent;
        color: var(--sn-text);
        caret-color: var(--sn-accent);
        border: none;
        border-bottom: 1px solid var(--sn-border);
        outline: none;
        font: inherit;
      }
      input::placeholder {
        color: var(--sn-muted);
        opacity: 1;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 6px;
        max-height: 280px;
        overflow-y: auto;
      }
      li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px;
        border-radius: 7px;
        cursor: pointer;
        color: var(--sn-muted);
      }
      li.selected {
        background: var(--sn-selected-bg);
      }
      .title {
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        color: var(--sn-text);
        white-space: nowrap;
      }
      li.selected .title {
        color: var(--sn-accent);
      }
      .subtitle {
        font-size: 11.5px;
        color: var(--sn-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      li.empty {
        font-style: italic;
        cursor: default;
      }
    </style>
    <div class="backdrop">
      <div class="panel">
        <input type="text" placeholder="Type a command, or <table>.list…" autocomplete="off" spellcheck="false" />
        <ul></ul>
      </div>
    </div>
  `;
  document.documentElement.append(host);

  const backdrop = shadow.querySelector<HTMLDivElement>(".backdrop")!;
  const input = shadow.querySelector<HTMLInputElement>("input")!;
  const list = shadow.querySelector<HTMLUListElement>("ul")!;

  // --- Theming -------------------------------------------------------
  function applyTheme(theme: Theme): void {
    host.style.setProperty("--sn-bg", theme.bg);
    host.style.setProperty("--sn-border", theme.border);
    host.style.setProperty("--sn-text", theme.text);
    host.style.setProperty("--sn-accent", theme.accent);
    host.style.setProperty("--sn-selected-bg", theme.selectedBg);
    host.style.setProperty("--sn-muted", theme.muted);
  }

  async function applySelectedTheme(): Promise<void> {
    const [themesResult, selectedResult] = await Promise.all([chrome.storage.local.get(THEMES_STORAGE_KEY), chrome.storage.sync.get(SELECTED_THEME_STORAGE_KEY)]);
    const themes = themesResult[THEMES_STORAGE_KEY] as Theme[] | undefined;
    if (!themes || themes.length === 0) return; // background hasn't seeded storage yet - keep the CSS defaults above
    const selectedId = selectedResult[SELECTED_THEME_STORAGE_KEY] as string | undefined;
    applyTheme(themes.find((t) => t.id === selectedId) ?? themes[0]);
  }

  void applySelectedTheme();

  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area === "sync" && changes[SELECTED_THEME_STORAGE_KEY]) || (area === "local" && changes[THEMES_STORAGE_KEY])) void applySelectedTheme();
  });

  // --- Overlay: open/close state -------------------------------------------
  let visibleMatches: PaletteCommand[] = [];
  let selectedIndex = 0;

  function isOpen(): boolean {
    return backdrop.classList.contains("open");
  }

  function open(): void {
    backdrop.classList.add("open");
    input.value = "";
    render();
    input.focus();
  }

  function close(): void {
    backdrop.classList.remove("open");
    input.value = "";
  }

  function toggle(): void {
    isOpen() ? close() : open();
  }

  // --- Overlay: matching -------------------------------------------------
  function getMatches(rawQuery: string): PaletteCommand[] {
    const trimmed = rawQuery.trim();
    const query = trimmed.toLowerCase();

    const commandMatches = staticCommands.filter((c) => c.id.includes(query) || c.title.toLowerCase().includes(query));

    const parsed = parseTableCommand(trimmed);
    return parsed ? [...commandMatches, buildTableEntry(parsed.table, parsed.filter)] : commandMatches;
  }

  // --- Overlay: rendering -------------------------------------------------
  function render(): void {
    visibleMatches = getMatches(input.value);
    selectedIndex = 0;
    list.innerHTML = "";

    if (visibleMatches.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No matches";
      list.append(li);
      return;
    }

    visibleMatches.forEach((command, index) => {
      const li = document.createElement("li");
      li.className = index === selectedIndex ? "selected" : "";

      const title = document.createElement("span");
      title.className = "title";
      title.textContent = command.title;
      li.append(title);

      if (command.subtitle) {
        const subtitle = document.createElement("span");
        subtitle.className = "subtitle";
        subtitle.textContent = command.subtitle;
        li.append(subtitle);
      }

      li.addEventListener("mousedown", (event) => {
        event.preventDefault(); // don't steal focus from the input
        execute(index);
      });
      list.append(li);
    });
  }

  function updateSelection(nextIndex: number): void {
    if (visibleMatches.length === 0) return;
    selectedIndex = (nextIndex + visibleMatches.length) % visibleMatches.length;
    [...list.children].forEach((el, index) => el.classList.toggle("selected", index === selectedIndex));
  }

  function execute(index: number): void {
    const command = visibleMatches[index];
    if (!command) return;
    command.run();
    close();
  }

  // --- Overlay: event wiring -------------------------------------------------
  input.addEventListener("input", render);

  input.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        execute(selectedIndex);
        break;
      case "ArrowDown":
        event.preventDefault();
        updateSelection(selectedIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        updateSelection(selectedIndex - 1);
        break;
    }
  });

  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });

  window.addEventListener(
    "keydown",
    (event) => {
      if (isShortcut(event)) {
        event.preventDefault();
        toggle();
        return;
      }
      if (event.key === "Escape" && isOpen()) close();
    },
    true,
  );

  // Relay from an iframe (see the !isTopFrame branch above).
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.source === "snforge" && event.data.type === "SNFORGE_TOGGLE_PALETTE") toggle();
  });
})();
