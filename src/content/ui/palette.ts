import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, type ThemeId } from '../../config';
import styles from './palette.css';

let host: HTMLDivElement | undefined;
let panel: HTMLElement | undefined;
let commandInput: HTMLInputElement | undefined;
let output: HTMLDivElement | undefined;
let suggestionsList: HTMLDivElement | undefined;
let activeSuggestionIndex = 0;
let open = false;

const DEMO_COMMANDS = [
  { name: 'open', description: 'Open a table list', example: 'open incident active=true' },
  { name: 'new', description: 'Create a record', example: 'new incident' },
  { name: 'sysid', description: 'Show the current record ID', example: 'sysid' },
  { name: 'help', description: 'Browse available commands', example: 'help open' },
  { name: 'recent', description: 'Reopen a recently viewed record', example: 'recent' },
];
const MAX_SUGGESTIONS = 5;

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && Object.hasOwn(THEMES, value);
}

async function getSavedTheme(): Promise<ThemeId> {
  try {
    const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);
    const theme: unknown = stored[THEME_STORAGE_KEY];
    return isThemeId(theme) ? theme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

async function saveTheme(theme: ThemeId): Promise<void> {
  try {
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
  } catch {
    // The current selection still applies for this page if storage is unavailable.
  }
}

function appendOutput(text: string): void {
  if (!output) {
    return;
  }
  output.textContent = text;
  output.classList.add('has-content');
}

function getSuggestionMatches(): typeof DEMO_COMMANDS {
  const rawQuery = commandInput?.value.trim().replace(/^:/, '').toLowerCase() ?? '';
  const query = rawQuery.split(/\s+/, 1)[0];
  return DEMO_COMMANDS.filter((command) => {
    return !query || `${command.name} ${command.description}`.toLowerCase().includes(query);
  }).slice(0, MAX_SUGGESTIONS);
}

function renderSuggestions(): void {
  if (!suggestionsList || !commandInput) {
    return;
  }

  const query = commandInput.value.trim().replace(/^:/, '').toLowerCase();
  const matches = getSuggestionMatches();

  suggestionsList.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'suggestions-heading';
  heading.textContent = query ? 'MATCHING COMMANDS' : 'SUGGESTED COMMANDS';
  suggestionsList.append(heading);

  if (matches.length === 0) {
    commandInput.removeAttribute('aria-activedescendant');
    const empty = document.createElement('div');
    empty.className = 'suggestions-empty';
    empty.textContent = 'No matching commands';
    suggestionsList.append(empty);
    activeSuggestionIndex = -1;
    return;
  }

  activeSuggestionIndex = Math.min(Math.max(activeSuggestionIndex, 0), matches.length - 1);
  commandInput.setAttribute('aria-activedescendant', `command-suggestion-${matches[activeSuggestionIndex].name}`);
  matches.forEach((command, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'suggestion';
    option.id = `command-suggestion-${command.name}`;
    option.classList.toggle('is-active', index === activeSuggestionIndex);
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(index === activeSuggestionIndex));

    const details = document.createElement('span');
    details.className = 'suggestion-details';
    const name = document.createElement('span');
    name.className = 'suggestion-name';
    name.textContent = `:${command.name}`;
    const description = document.createElement('span');
    description.className = 'suggestion-description';
    description.textContent = command.description;
    details.append(name, description);

    const example = document.createElement('span');
    example.className = 'suggestion-example';
    example.textContent = command.example;
    option.append(details, example);
    option.addEventListener('click', () => selectSuggestion(command.name));
    suggestionsList?.append(option);
  });
}

function selectSuggestion(name: string): void {
  if (!commandInput) {
    return;
  }
  commandInput.value = `${name} `;
  commandInput.focus();
  renderSuggestions();
}

function onDocumentKeyDown(event: KeyboardEvent): void {
  if (!open || !host) {
    return;
  }

  const isInsidePalette = event.composedPath().includes(host);
  if (isInsidePalette) {
    return;
  }

  event.stopImmediatePropagation();
  event.preventDefault();
  if (event.key === 'Escape') {
    closePalette();
  }
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!open || !panel || event.composedPath().includes(panel)) {
    return;
  }

  closePalette();
}

function createPalette(): void {
  if (host) {
    return;
  }

  host = document.createElement('div');
  host.setAttribute('data-snforge', '');
  document.addEventListener('keydown', onDocumentKeyDown, true);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;

  const palette = document.createElement('section');
  palette.className = 'palette';
  palette.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
  });
  panel = palette;

  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  const brand = document.createElement('div');
  brand.className = 'brand';
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.textContent = 'S';
  const title = document.createElement('span');
  title.textContent = 'SNForge';
  brand.append(mark, title);

  const controls = document.createElement('div');
  controls.className = 'controls';
  const themeLabel = document.createElement('label');
  themeLabel.className = 'theme-label';
  themeLabel.htmlFor = 'snforge-theme';
  themeLabel.textContent = 'Theme';
  const themeSelect = document.createElement('select');
  themeSelect.id = 'snforge-theme';
  themeSelect.setAttribute('aria-label', 'Color theme');

  for (const [id, label] of Object.entries(THEMES)) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    themeSelect.append(option);
  }

  themeSelect.addEventListener('change', () => {
    if (!isThemeId(themeSelect.value)) {
      return;
    }
    palette.dataset.theme = themeSelect.value;
    void saveTheme(themeSelect.value);
  });

  controls.append(themeLabel, themeSelect);
  topbar.append(brand, controls);

  output = document.createElement('div');
  output.className = 'output';
  output.setAttribute('role', 'status');

  const promptRow = document.createElement('div');
  promptRow.className = 'prompt-row';
  const searchIcon = document.createElement('span');
  searchIcon.className = 'search-icon';
  searchIcon.setAttribute('aria-hidden', 'true');
  commandInput = document.createElement('input');
  commandInput.type = 'text';
  commandInput.autocomplete = 'off';
  commandInput.spellcheck = false;
  commandInput.setAttribute('aria-label', 'Command input');
  commandInput.placeholder = 'Search commands or type a command…';
  commandInput.setAttribute('role', 'combobox');
  commandInput.setAttribute('aria-autocomplete', 'list');
  commandInput.setAttribute('aria-expanded', 'true');
  commandInput.addEventListener('input', () => {
    activeSuggestionIndex = 0;
    renderSuggestions();
  });
  commandInput.addEventListener('keydown', onInputKeyDown);
  promptRow.append(searchIcon, commandInput);

  suggestionsList = document.createElement('div');
  suggestionsList.className = 'suggestions';
  suggestionsList.id = 'snforge-command-suggestions';
  suggestionsList.setAttribute('role', 'listbox');
  suggestionsList.setAttribute('aria-label', 'Command suggestions');
  commandInput.setAttribute('aria-controls', suggestionsList.id);

  palette.append(topbar, output, promptRow, suggestionsList);
  shadow.append(style, palette);
  document.documentElement.append(host);

  void getSavedTheme().then((theme) => {
    if (panel) {
      panel.dataset.theme = theme;
    }
    themeSelect.value = theme;
  });
  renderSuggestions();
}

function onInputKeyDown(event: KeyboardEvent): void {
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    closePalette();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const count = getSuggestionMatches().length;
    if (count > 0) {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      activeSuggestionIndex = (activeSuggestionIndex + direction + count) % count;
      renderSuggestions();
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const value = commandInput?.value.trim();
    if (value) {
      const commandName = value.replace(/^:/, '').split(/\s+/, 1)[0].toLowerCase();
      const exactCommand = DEMO_COMMANDS.some((command) => command.name === commandName);
      if (!exactCommand) {
        const match = getSuggestionMatches()[activeSuggestionIndex];
        if (match) {
          selectSuggestion(match.name);
          return;
        }
      }
      appendOutput(`: ${value}\nCommand execution will be available in the next step.`);
      if (commandInput) {
        commandInput.value = '';
      }
      activeSuggestionIndex = 0;
      renderSuggestions();
    }
  }
}

export function togglePalette(): void {
  createPalette();
  open = !open;
  if (!host) {
    return;
  }
  host.style.display = open ? 'block' : 'none';
  if (open) {
    commandInput?.focus();
  }
}

function closePalette(): void {
  if (!host || !open) {
    return;
  }
  open = false;
  host.style.display = 'none';
}
