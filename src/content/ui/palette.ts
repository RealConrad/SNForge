import { getSavedTheme, onThemeChanged } from '../../shared/theme';
import themes from '../../shared/themes.css';
import styles from './palette.css';

let host: HTMLDivElement | undefined;
let panel: HTMLElement | undefined;
let commandInput: HTMLInputElement | undefined;
let output: HTMLDivElement | undefined;
let suggestionsList: HTMLDivElement | undefined;
let activeSuggestionIndex = 0;
let open = false;

interface Suggestion {
  name: string;
  description: string;
  example: string;
}

// TODO: replace with suggestions from the command registry.
const SUGGESTIONS: Suggestion[] = [];
const MAX_SUGGESTIONS = 6;

function appendOutput(text: string): void {
  if (!output) {
    return;
  }
  output.textContent = text;
  output.classList.add('has-content');
}

function getQuery(): string {
  return commandInput?.value.trim().replace(/^:/, '').toLowerCase() ?? '';
}

function getSuggestionMatches(): Suggestion[] {
  const query = getQuery().split(/\s+/, 1)[0];
  return SUGGESTIONS.filter((command) => {
    return !query || `${command.name} ${command.description}`.toLowerCase().includes(query);
  }).slice(0, MAX_SUGGESTIONS);
}

function createKbd(label: string): HTMLElement {
  const kbd = document.createElement('kbd');
  kbd.textContent = label;
  return kbd;
}

function renderEmptyState(list: HTMLDivElement, query: string): void {
  const empty = document.createElement('div');
  empty.className = 'suggestions-empty';
  const title = document.createElement('span');
  const hint = document.createElement('span');
  hint.className = 'suggestions-empty-hint';
  if (query) {
    title.textContent = `No commands match “${query}”`;
    hint.textContent = 'Press Enter to run it anyway';
  } else {
    title.textContent = 'No commands registered yet';
    hint.textContent = 'Type a command and press Enter';
  }
  empty.append(title, hint);
  list.append(empty);
}

function renderSuggestions(): void {
  if (!suggestionsList || !commandInput) {
    return;
  }

  const query = getQuery();
  const matches = getSuggestionMatches();

  suggestionsList.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'suggestions-heading';
  heading.textContent = query ? 'Matching commands' : 'Suggested commands';
  suggestionsList.append(heading);

  if (matches.length === 0) {
    commandInput.removeAttribute('aria-activedescendant');
    renderEmptyState(suggestionsList, query);
    activeSuggestionIndex = -1;
    return;
  }

  activeSuggestionIndex = Math.min(Math.max(activeSuggestionIndex, 0), matches.length - 1);
  commandInput.setAttribute('aria-activedescendant', `command-suggestion-${matches[activeSuggestionIndex].name}`);

  matches.forEach((command, index) => {
    const isActive = index === activeSuggestionIndex;
    const option = document.createElement('button');
    option.type = 'button';
    option.tabIndex = -1;
    option.className = 'suggestion';
    option.id = `command-suggestion-${command.name}`;
    option.classList.toggle('is-active', isActive);
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(isActive));

    const icon = document.createElement('span');
    icon.className = 'suggestion-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = command.name.charAt(0).toUpperCase();

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

    const enter = createKbd('↵');
    enter.classList.add('suggestion-enter');

    option.append(icon, details, example, enter);
    option.addEventListener('mousemove', () => {
      if (activeSuggestionIndex !== index) {
        activeSuggestionIndex = index;
        renderSuggestions();
      }
    });
    option.addEventListener('click', () => selectSuggestion(command.name));
    suggestionsList?.append(option);
  });

  suggestionsList.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
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

function createHint(keys: string[], label: string, optional = false): HTMLElement {
  const hint = document.createElement('span');
  hint.className = optional ? 'hint hint-optional' : 'hint';
  hint.append(...keys.map(createKbd), label);
  return hint;
}

function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = 'footer';

  const brand = document.createElement('div');
  brand.className = 'brand';
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.setAttribute('aria-hidden', 'true');
  const title = document.createElement('span');
  title.textContent = 'SNForge';
  brand.append(mark, title);

  const hints = document.createElement('div');
  hints.className = 'hints';
  hints.append(
    createHint(['↑', '↓'], 'Navigate', true),
    createHint(['Tab'], 'Complete', true),
    createHint(['↵'], 'Run'),
  );

  footer.append(brand, hints);
  return footer;
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
  style.textContent = `${themes}\n${styles}`;

  const palette = document.createElement('section');
  palette.className = 'palette';
  palette.dataset.theme = '';
  palette.setAttribute('role', 'dialog');
  palette.setAttribute('aria-label', 'SNForge command palette');
  palette.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    }
  });
  panel = palette;

  const promptRow = document.createElement('div');
  promptRow.className = 'prompt-row';
  const glyph = document.createElement('span');
  glyph.className = 'prompt-glyph';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = ':';

  commandInput = document.createElement('input');
  commandInput.type = 'text';
  commandInput.autocomplete = 'off';
  commandInput.spellcheck = false;
  commandInput.placeholder = 'Type a command or table name…';
  commandInput.setAttribute('aria-label', 'Command input');
  commandInput.setAttribute('role', 'combobox');
  commandInput.setAttribute('aria-autocomplete', 'list');
  commandInput.setAttribute('aria-expanded', 'true');
  commandInput.addEventListener('input', () => {
    activeSuggestionIndex = 0;
    renderSuggestions();
  });
  commandInput.addEventListener('keydown', onInputKeyDown);
  promptRow.append(glyph, commandInput, createKbd('Esc'));

  output = document.createElement('div');
  output.className = 'output';
  output.setAttribute('role', 'status');

  suggestionsList = document.createElement('div');
  suggestionsList.className = 'suggestions';
  suggestionsList.id = 'snforge-command-suggestions';
  suggestionsList.setAttribute('role', 'listbox');
  suggestionsList.setAttribute('aria-label', 'Command suggestions');
  commandInput.setAttribute('aria-controls', suggestionsList.id);

  palette.append(promptRow, output, suggestionsList, createFooter());
  shadow.append(style, palette);
  document.documentElement.append(host);

  void getSavedTheme().then((theme) => {
    palette.dataset.theme = theme;
  });
  onThemeChanged((theme) => {
    palette.dataset.theme = theme;
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
  } else if (event.key === 'Tab') {
    const match = getSuggestionMatches()[activeSuggestionIndex];
    if (match) {
      event.preventDefault();
      selectSuggestion(match.name);
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const value = commandInput?.value.trim();
    if (value) {
      const commandName = value.replace(/^:/, '').split(/\s+/, 1)[0].toLowerCase();
      const exactCommand = SUGGESTIONS.some((command) => command.name === commandName);
      if (!exactCommand) {
        const match = getSuggestionMatches()[activeSuggestionIndex];
        if (match) {
          selectSuggestion(match.name);
          return;
        }
      }
      // TODO: parse `value` and run the matching command.
      appendOutput(`: ${value}`);
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
