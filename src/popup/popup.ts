import { DOCS_URL, THEMES, type ThemeId } from '../config';
import { el } from '../shared/dom';
import { TOGGLE_PALETTE_COMMAND } from '../shared/messages';
import { getSavedTheme, isThemeId, saveTheme } from '../shared/theme';

const SHORTCUTS_URL = 'chrome://extensions/shortcuts';

/** Finds an element that popup.html is guaranteed to contain. */
function required<T extends Element>(selector: string, root: ParentNode = document): T {
  const node = root.querySelector<T>(selector);
  if (!node) {
    throw new Error(`popup.html is missing ${selector}`);
  }
  return node;
}

function applyTheme(theme: ThemeId): void {
  document.body.dataset.theme = theme;
}

function createThemeCard(template: HTMLTemplateElement, id: ThemeId, label: string, selected: ThemeId): Node {
  const fragment = template.content.cloneNode(true);
  if (!(fragment instanceof DocumentFragment)) {
    throw new Error('Theme card template did not clone to a fragment');
  }

  required<HTMLLabelElement>('.theme-card', fragment).dataset.theme = id;
  required<HTMLElement>('.theme-label', fragment).textContent = label;

  const input = required<HTMLInputElement>('input', fragment);
  input.value = id;
  input.checked = id === selected;
  input.addEventListener('change', () => {
    if (input.checked && isThemeId(input.value)) {
      applyTheme(input.value);
      void saveTheme(input.value);
    }
  });

  return fragment;
}

function renderThemes(selected: ThemeId): void {
  const template = required<HTMLTemplateElement>('#theme-card-template');
  const fieldset = required<HTMLFieldSetElement>('#themes');
  for (const [id, label] of Object.entries(THEMES)) {
    if (isThemeId(id)) {
      fieldset.append(createThemeCard(template, id, label, selected));
    }
  }
}

async function renderShortcut(): Promise<void> {
  const keys = required<HTMLElement>('#shortcut-keys');
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((command) => command.name === TOGGLE_PALETTE_COMMAND)?.shortcut;

  if (!shortcut) {
    keys.textContent = 'Not set';
    return;
  }
  // Chrome formats shortcuts as e.g. "Ctrl+Shift+Space".
  keys.replaceChildren(...shortcut.split('+').map((key) => el('kbd', undefined, key)));
}

async function init(): Promise<void> {
  required<HTMLElement>('#version').textContent = `v${chrome.runtime.getManifest().version}`;
  required<HTMLButtonElement>('#change-shortcut').addEventListener('click', () => {
    void chrome.tabs.create({ url: SHORTCUTS_URL });
  });
  required<HTMLButtonElement>('#open-docs').addEventListener('click', () => {
    void chrome.tabs.create({ url: DOCS_URL });
  });

  const theme = await getSavedTheme();
  applyTheme(theme);
  renderThemes(theme);
  await renderShortcut();
}

void init();
