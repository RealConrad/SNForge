import { registerBuiltins } from '../../commands/builtin';
import { runCommandInput } from '../../commands/runner';
import { tableShortcutUrl, type TableShortcut } from '../../commands/table-shortcut';
import type { Command, CommandContext, OutputKind } from '../../commands/types';
import { el } from '../../shared/dom';
import { createCommandContext } from '../command-context';
import { isNextExperience, navigate, openTab } from '../navigation';
import { buildItems, type ItemActions, type PaletteItem } from './palette-items';
import styles from './palette.css';
import { mountShadow } from './shadow-host';

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

/** What accepting a suggestion does (see palette-items.ts). */
const itemActions: ItemActions = { runCommand, completeCommand, runTableShortcut };

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
  option.addEventListener('click', (event) => {
    if (event.isTrusted) {
      item.accept();
    }
  });
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
  state.items = buildItems(input, itemActions);
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

/**
 * The palette only reacts to real user input. Page scripts can dispatch synthetic events
 * at the host element; those have isTrusted === false and are ignored everywhere.
 */
function onInputKeyDown(event: KeyboardEvent): void {
  if (!event.isTrusted) {
    return;
  }
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
  if (event.isTrusted && event.key === 'Escape') {
    event.preventDefault();
    closePalette();
  }
}

/** While open, swallow keys aimed at the page (focus outside the palette). */
function onDocumentKeyDown(event: KeyboardEvent): void {
  if (!open || !ui || !event.isTrusted || event.composedPath().includes(ui.host)) {
    return;
  }

  event.stopImmediatePropagation();
  event.preventDefault();
  if (event.key === 'Escape') {
    closePalette();
  }
}

/**
 * The host covers the viewport as a backdrop. Pointer events from inside the panel are
 * stopped at the panel (see createPalette), so whatever reaches the host is a click on
 * the backdrop, i.e. outside the palette.
 */
function onBackdropPointerDown(event: PointerEvent): void {
  if (open && event.isTrusted) {
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
  const panel = el('section', 'palette');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'SNForge command palette');
  panel.addEventListener('keydown', onPanelKeyDown);
  panel.addEventListener('pointerdown', (event) => event.stopPropagation());

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

  panel.append(promptRow, output, list, createFooter());

  const host = mountShadow(styles, panel);
  host.setAttribute('data-snforge', '');
  host.addEventListener('pointerdown', onBackdropPointerDown);
  document.addEventListener('keydown', onDocumentKeyDown, true);

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
