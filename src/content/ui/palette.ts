import { MAX_SUGGESTIONS } from '../../config';
import { el } from '../../shared/dom';
import { getSavedTheme, onThemeChanged } from '../../shared/theme';
import themes from '../../shared/themes.css';
import styles from './palette.css';

interface Suggestion {
  name: string;
  description: string;
  example: string;
}

// TODO: replace with suggestions from the command registry.
const SUGGESTIONS: Suggestion[] = [];

interface PaletteUi {
  host: HTMLDivElement;
  panel: HTMLElement;
  input: HTMLInputElement;
  output: HTMLDivElement;
  list: HTMLDivElement;
}

interface SuggestionState {
  matches: Suggestion[];
  options: HTMLButtonElement[];
  active: number;
}

let ui: PaletteUi | undefined;
let open = false;
const state: SuggestionState = { matches: [], options: [], active: -1 };

// ---------- Suggestions ----------

function normalizeInput(value: string): string {
  return value.trim().replace(/^:/, '').toLowerCase();
}

function findMatches(query: string): Suggestion[] {
  const term = query.split(/\s+/, 1)[0];
  return SUGGESTIONS
    .filter((command) => !term || `${command.name} ${command.description}`.toLowerCase().includes(term))
    .slice(0, MAX_SUGGESTIONS);
}

function createKbd(label: string): HTMLElement {
  return el('kbd', undefined, label);
}

function createEmptyState(query: string): HTMLElement {
  const empty = el('div', 'suggestions-empty');
  empty.append(
    el('span', undefined, query ? `No commands match “${query}”` : 'No commands registered yet'),
    el('span', 'suggestions-empty-hint', query ? 'Press Enter to run it anyway' : 'Type a command and press Enter'),
  );
  return empty;
}

function createOption(command: Suggestion, index: number): HTMLButtonElement {
  const option = el('button', 'suggestion');
  option.type = 'button';
  option.tabIndex = -1;
  option.id = `snforge-suggestion-${index}`;
  option.setAttribute('role', 'option');

  const icon = el('span', 'suggestion-icon', command.name.charAt(0).toUpperCase());
  icon.setAttribute('aria-hidden', 'true');

  const details = el('span', 'suggestion-details');
  details.append(
    el('span', 'suggestion-name', `:${command.name}`),
    el('span', 'suggestion-description', command.description),
  );

  const enter = createKbd('↵');
  enter.classList.add('suggestion-enter');

  option.append(icon, details, el('span', 'suggestion-example', command.example), enter);
  option.addEventListener('mousemove', () => {
    if (state.active !== index) {
      setActive(index);
    }
  });
  option.addEventListener('click', () => acceptSuggestion(command));
  return option;
}

/** Rebuilds the suggestion list for the current input. */
function renderSuggestions(): void {
  if (!ui) {
    return;
  }

  const query = normalizeInput(ui.input.value);
  state.matches = findMatches(query);
  state.options = state.matches.map(createOption);

  const heading = el('div', 'suggestions-heading', query ? 'Matching commands' : 'Suggested commands');
  ui.list.replaceChildren(heading, ...(state.options.length ? state.options : [createEmptyState(query)]));
  setActive(state.options.length ? 0 : -1);
}

/** Moves the highlight without rebuilding the list. */
function setActive(index: number): void {
  if (!ui) {
    return;
  }

  state.active = index;
  state.options.forEach((option, optionIndex) => {
    const isActive = optionIndex === index;
    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', String(isActive));
  });

  const activeOption = state.options[index];
  if (activeOption) {
    ui.input.setAttribute('aria-activedescendant', activeOption.id);
    activeOption.scrollIntoView({ block: 'nearest' });
  } else {
    ui.input.removeAttribute('aria-activedescendant');
  }
}

function moveActive(direction: 1 | -1): void {
  const count = state.options.length;
  if (count > 0) {
    setActive((state.active + direction + count) % count);
  }
}

function acceptSuggestion(command: Suggestion): void {
  if (!ui) {
    return;
  }
  ui.input.value = `${command.name} `;
  ui.input.focus();
  renderSuggestions();
}

// ---------- Output & commands ----------

function showOutput(text: string): void {
  if (!ui) {
    return;
  }
  ui.output.textContent = text;
  ui.output.classList.add('has-content');
}

function submit(): void {
  if (!ui) {
    return;
  }

  const value = ui.input.value.trim();
  if (!value) {
    return;
  }

  // An incomplete command name with a highlighted suggestion completes it first.
  const commandName = normalizeInput(value).split(/\s+/, 1)[0];
  const isExactCommand = SUGGESTIONS.some((command) => command.name === commandName);
  const highlighted = state.matches[state.active];
  if (!isExactCommand && highlighted) {
    acceptSuggestion(highlighted);
    return;
  }

  // TODO: parse `value` and run the matching command.
  showOutput(`: ${value}`);
  ui.input.value = '';
  renderSuggestions();
}

// ---------- Keyboard & pointer ----------

function onInputKeyDown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      if (state.options.length) {
        event.preventDefault();
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      }
      break;
    case 'Tab': {
      const highlighted = state.matches[state.active];
      if (highlighted) {
        event.preventDefault();
        acceptSuggestion(highlighted);
      }
      break;
    }
    case 'Enter':
      event.preventDefault();
      submit();
      break;
  }
}

/** Keeps every key pressed inside the palette away from ServiceNow's shortcuts. */
function onPanelKeyDown(event: KeyboardEvent): void {
  event.stopPropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    closePalette();
  }
}

/** While open, swallow keys aimed at the page (focus outside the palette). */
function onDocumentKeyDown(event: KeyboardEvent): void {
  if (!open || !ui || event.composedPath().includes(ui.host)) {
    return;
  }

  event.stopImmediatePropagation();
  event.preventDefault();
  if (event.key === 'Escape') {
    closePalette();
  }
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (open && ui && !event.composedPath().includes(ui.panel)) {
    closePalette();
  }
}

// ---------- Construction ----------

function createHint(keys: string[], label: string, optional = false): HTMLElement {
  const hint = el('span', optional ? 'hint hint-optional' : 'hint');
  hint.append(...keys.map(createKbd), label);
  return hint;
}

function createFooter(): HTMLElement {
  const mark = el('span', 'mark');
  mark.setAttribute('aria-hidden', 'true');
  const brand = el('div', 'brand');
  brand.append(mark, el('span', undefined, 'SNForge'));

  const hints = el('div', 'hints');
  hints.append(
    createHint(['↑', '↓'], 'Navigate', true),
    createHint(['Tab'], 'Complete', true),
    createHint(['↵'], 'Run'),
  );

  const footer = el('footer', 'footer');
  footer.append(brand, hints);
  return footer;
}

function createInput(listId: string): HTMLInputElement {
  const input = el('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Type a command or table name…';
  input.setAttribute('aria-label', 'Command input');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', listId);
  input.addEventListener('input', renderSuggestions);
  input.addEventListener('keydown', onInputKeyDown);
  return input;
}

function createPalette(): PaletteUi {
  const host = el('div');
  host.setAttribute('data-snforge', '');
  const shadow = host.attachShadow({ mode: 'open' });

  const panel = el('section', 'palette');
  panel.dataset.theme = '';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'SNForge command palette');
  panel.addEventListener('keydown', onPanelKeyDown);

  const list = el('div', 'suggestions');
  list.id = 'snforge-suggestions';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Command suggestions');

  const input = createInput(list.id);
  const glyph = el('span', 'prompt-glyph', ':');
  glyph.setAttribute('aria-hidden', 'true');
  const promptRow = el('div', 'prompt-row');
  promptRow.append(glyph, input, createKbd('Esc'));

  const output = el('div', 'output');
  output.setAttribute('role', 'status');

  const style = el('style');
  style.textContent = `${themes}\n${styles}`;
  panel.append(promptRow, output, list, createFooter());
  shadow.append(style, panel);
  document.documentElement.append(host);

  document.addEventListener('keydown', onDocumentKeyDown, true);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  void getSavedTheme().then((theme) => {
    panel.dataset.theme = theme;
  });
  onThemeChanged((theme) => {
    panel.dataset.theme = theme;
  });

  return { host, panel, input, output, list };
}

// ---------- Public API ----------

export function togglePalette(): void {
  if (open) {
    closePalette();
    return;
  }

  if (!ui) {
    ui = createPalette();
    renderSuggestions();
  }
  open = true;
  ui.host.style.display = 'block';
  ui.input.focus();
}

function closePalette(): void {
  if (!ui || !open) {
    return;
  }
  open = false;
  ui.host.style.display = 'none';
}
