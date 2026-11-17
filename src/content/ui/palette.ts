import { registerBuiltins } from '../../commands/builtin';
import { createCommandContext } from '../../commands/context';
import { findCommand, matchCommands } from '../../commands/registry';
import { runCommandInput } from '../../commands/runner';
import {
  describeTableShortcut,
  parseTableShortcut,
  tableShortcutUrl,
  type TableShortcut,
} from '../../commands/table-shortcut';
import type { Command, CommandContext, OutputKind } from '../../commands/types';
import { MAX_SUGGESTIONS, SUGGESTED_INPUTS } from '../../config';
import { el } from '../../shared/dom';
import { getSavedTheme, onThemeChanged } from '../../shared/theme';
import themes from '../../shared/themes.css';
import { isNextExperience, navigate, openTab } from '../navigation';
import styles from './palette.css';

/** One row in the suggestion list. */
interface PaletteItem {
  icon: string;
  title: string;
  description: string;
  hint: string;
  /** Enter / click. */
  accept(): void;
  /** Text Tab puts into the input; undefined when Tab has nothing to complete. */
  completion?: string;
}

interface PaletteUi {
  host: HTMLDivElement;
  panel: HTMLElement;
  input: HTMLInputElement;
  output: HTMLDivElement;
  list: HTMLDivElement;
}

interface ListState {
  items: PaletteItem[];
  options: HTMLButtonElement[];
  active: number;
}

let ui: PaletteUi | undefined;
let open = false;
const state: ListState = { items: [], options: [], active: -1 };
/** The command currently running; aborted on close or when a new run starts. */
let currentRun: AbortController | undefined;

// ---------- Output ----------

function showOutput(text: string, kind: OutputKind = 'info'): void {
  if (!ui) {
    return;
  }
  ui.output.textContent = text;
  ui.output.dataset.kind = kind;
  ui.output.hidden = false;
}

function clearOutput(): void {
  if (!ui) {
    return;
  }
  ui.output.textContent = '';
  ui.output.hidden = true;
}

function resetInput(): void {
  if (!ui) {
    return;
  }
  ui.input.value = '';
  renderSuggestions();
}

const commandUi: CommandContext['ui'] = {
  print: showOutput,
  clear: clearOutput,
  close: () => closePalette(),
};

// ---------- Actions ----------

function runTableShortcut(shortcut: TableShortcut): void {
  const url = tableShortcutUrl(shortcut, {
    origin: window.location.origin,
    nextExperience: isNextExperience(),
  });

  if (!shortcut.newTab) {
    closePalette();
    navigate(url);
    return;
  }

  openTab(url).then(
    () => {
      resetInput();
      closePalette();
    },
    () => showOutput('Could not open a new tab. Reload the page and try again.', 'error'),
  );
}

/** Cancels any previous run and creates a fresh context for a new one. */
function startRun(): CommandContext {
  currentRun?.abort();
  currentRun = new AbortController();
  return createCommandContext(commandUi, currentRun.signal);
}

function runCommand(input: string): void {
  clearOutput();
  resetInput();
  void runCommandInput(input, startRun());
}

function completeCommand(command: Command): void {
  if (!ui) {
    return;
  }
  ui.input.value = `:${command.name} `;
  ui.input.focus();
  renderSuggestions();
}

// ---------- Building the item list ----------

function tableItem(shortcut: TableShortcut): PaletteItem {
  const { title, detail } = describeTableShortcut(shortcut);
  return {
    icon: shortcut.newTab ? '↗' : '→',
    title,
    description: detail,
    hint: shortcut.newTab ? 'new tab' : '',
    accept: () => runTableShortcut(shortcut),
  };
}

function commandItem(command: Command, typedName: string, input: string): PaletteItem {
  const isExact = findCommand(typedName) === command;
  return {
    icon: ':',
    title: `:${command.name}`,
    description: command.description,
    hint: '',
    // A fully typed name runs; a partial one completes first.
    accept: () => (isExact ? runCommand(input) : completeCommand(command)),
    completion: `:${command.name} `,
  };
}

/** The item a suggested input ("incident", ":nav") stands for, as if it had been typed. */
function suggestedItem(text: string): PaletteItem | undefined {
  if (text.startsWith(':')) {
    const name = text.slice(1).toLowerCase();
    const command = findCommand(name);
    return command ? commandItem(command, name, text) : undefined;
  }
  const shortcut = parseTableShortcut(text);
  return shortcut ? tableItem(shortcut) : undefined;
}

/**
 * Suggested inputs containing what was typed (all of them for empty input).
 * Typing in uppercase ("INC") keeps the new-tab meaning by uppercasing the suggestion.
 */
function suggestedItems(trimmed: string): PaletteItem[] {
  if (/\s/.test(trimmed)) {
    return []; // arguments typed: the user is past picking a suggestion
  }
  const needle = trimmed.toLowerCase();
  const newTab = trimmed !== needle;

  return SUGGESTED_INPUTS.filter((text) => text.toLowerCase().includes(needle))
    .map((text) => suggestedItem(newTab ? text.toUpperCase() : text))
    .filter((item): item is PaletteItem => item !== undefined);
}

function buildItems(input: string): PaletteItem[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return suggestedItems('').slice(0, MAX_SUGGESTIONS);
  }

  const typedName = trimmed.replace(/^:/, '').split(/\s+/, 1)[0].toLowerCase();
  const isCommandInput = trimmed.startsWith(':');
  const exact = findCommand(typedName);
  const items: PaletteItem[] = [];

  // A bare word that is exactly a command name ("help") offers the command first.
  if (exact) {
    items.push(commandItem(exact, typedName, trimmed));
  }

  const shortcut = parseTableShortcut(trimmed);
  if (shortcut) {
    items.push(tableItem(shortcut));
  }

  items.push(...suggestedItems(trimmed));

  // Partial command names are only suggested after ":", to keep the list short.
  if (isCommandInput) {
    for (const command of matchCommands(typedName)) {
      if (command !== exact) {
        items.push(commandItem(command, typedName, trimmed));
      }
    }
  }

  return uniqueByTitle(items).slice(0, MAX_SUGGESTIONS);
}

/** Suggestions overlap with the typed shortcut / command matches; keep the first of each. */
function uniqueByTitle(items: PaletteItem[]): PaletteItem[] {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.title) && seen.add(item.title));
}

// ---------- Rendering ----------

function createKbd(label: string): HTMLElement {
  return el('kbd', undefined, label);
}

function createOption(item: PaletteItem, index: number): HTMLButtonElement {
  const option = el('button', 'suggestion');
  option.type = 'button';
  option.tabIndex = -1;
  option.id = `snforge-suggestion-${index}`;
  option.setAttribute('role', 'option');

  const icon = el('span', 'suggestion-icon', item.icon);
  icon.setAttribute('aria-hidden', 'true');

  const details = el('span', 'suggestion-details');
  details.append(
    el('span', 'suggestion-name', item.title),
    el('span', 'suggestion-description', item.description),
  );

  const enter = createKbd('↵');
  enter.classList.add('suggestion-enter');

  option.append(icon, details);
  if (item.hint) {
    option.append(el('span', 'suggestion-example', item.hint));
  }
  option.append(enter);
  option.addEventListener('mousemove', () => {
    if (state.active !== index) {
      setActive(index);
    }
  });
  option.addEventListener('click', () => item.accept());
  return option;
}

/**
 * Rebuilds the suggestion list for the current input. Empty input shows the suggested
 * inputs with nothing highlighted, so Enter on an empty prompt does nothing by accident.
 */
function renderSuggestions(): void {
  if (!ui) {
    return;
  }

  const input = ui.input.value;
  state.items = buildItems(input);
  state.options = state.items.map(createOption);

  if (state.options.length) {
    ui.list.replaceChildren(...state.options);
  } else if (input.trim()) {
    ui.list.replaceChildren(el('div', 'suggestions-empty', 'No matches'));
  } else {
    ui.list.replaceChildren();
  }
  setActive(state.options.length && input.trim() ? 0 : -1);
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
  if (count === 0) {
    return;
  }
  // Nothing highlighted yet: ↓ starts at the top, ↑ at the bottom.
  const from = state.active < 0 ? (direction === 1 ? -1 : 0) : state.active;
  setActive((from + direction + count) % count);
}

// ---------- Keyboard & pointer ----------

function onInputKeyDown(event: KeyboardEvent): void {
  const highlighted = state.items[state.active];

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      if (state.options.length) {
        event.preventDefault();
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      }
      break;
    case 'Tab':
      if (highlighted?.completion && ui) {
        event.preventDefault();
        ui.input.value = highlighted.completion;
        renderSuggestions();
      }
      break;
    case 'Enter':
      event.preventDefault();
      if (highlighted) {
        highlighted.accept();
      } else if (ui?.input.value.trim()) {
        showOutput(`Not a table name or command: ${ui.input.value.trim()}`, 'error');
      }
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

function createFooter(): HTMLElement {
  const mark = el('span', 'mark');
  mark.setAttribute('aria-hidden', 'true');
  const brand = el('div', 'brand');
  brand.append(mark, el('span', undefined, 'SNForge'));

  const hint = el('span', 'hint');
  hint.append(createKbd(':help'), 'Docs');

  const footer = el('footer', 'footer');
  footer.append(brand, hint);
  return footer;
}

function createInput(listId: string): HTMLInputElement {
  const input = el('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Table name or :command';
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
  list.setAttribute('aria-label', 'Suggestions');

  const input = createInput(list.id);
  const glyph = el('span', 'prompt-glyph', ':');
  glyph.setAttribute('aria-hidden', 'true');
  const promptRow = el('div', 'prompt-row');
  promptRow.append(glyph, input, createKbd('Esc'));

  const output = el('div', 'output');
  output.setAttribute('role', 'status');
  output.hidden = true;

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
    registerBuiltins();
    ui = createPalette();
  }
  // Every open starts fresh: no leftover output or input from the last session.
  clearOutput();
  resetInput();
  open = true;
  ui.host.style.display = 'block';
  ui.input.focus();
}

function closePalette(): void {
  if (!ui || !open) {
    return;
  }
  currentRun?.abort(); // closing cancels a running command's requests
  currentRun = undefined;
  open = false;
  ui.host.style.display = 'none';
}
