import {
  DOCS_URL,
  SECRET_THEMES,
  THEMES,
  WANTED_COOLDOWN_MS,
  WANTED_LEVEL,
  type SecretThemeId,
  type ThemeId,
} from '../config';
import { el } from '../shared/dom';
import { TOGGLE_PALETTE_COMMAND } from '../shared/messages';
import { getSavedTheme, getUnlockedThemes, isThemeId, saveTheme, unlockTheme } from '../shared/theme';

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

/** The regular themes, then the secret ones this browser has unlocked. */
function renderThemes(selected: ThemeId, unlocked: readonly SecretThemeId[]): void {
  const template = required<HTMLTemplateElement>('#theme-card-template');
  const fieldset = required<HTMLFieldSetElement>('#themes');
  for (const [id, label] of Object.entries(THEMES)) {
    if (isThemeId(id)) {
      fieldset.append(createThemeCard(template, id, label, selected));
    }
  }
  for (const id of unlocked) {
    fieldset.append(createThemeCard(template, id, SECRET_THEMES[id], selected));
  }
}

/** The theme the wanted level unlocks. */
const WANTED_THEME: SecretThemeId = 'vice';

/** Adds the unlocked theme's card, selects it and remembers both. */
function revealTheme(theme: SecretThemeId): void {
  const template = required<HTMLTemplateElement>('#theme-card-template');
  const fieldset = required<HTMLFieldSetElement>('#themes');
  fieldset.append(createThemeCard(template, theme, SECRET_THEMES[theme], theme));
  fieldset.lastElementChild?.classList.add('revealed');

  applyTheme(theme);
  void unlockTheme(theme);
  void saveTheme(theme);
}

/**
 * Easter egg: every click on the logo lights one star of a wanted level. Reach
 * WANTED_LEVEL stars without pausing longer than the cooldown and the hidden theme is
 * unlocked; pause, and the stars are gone again. Nothing hints at it until the first click.
 */
function setUpWantedLevel(unlocked: readonly SecretThemeId[]): void {
  if (unlocked.includes(WANTED_THEME)) {
    return; // already found
  }

  const stars = required<HTMLElement>('#stars');
  stars.replaceChildren(...Array.from({ length: WANTED_LEVEL }, () => el('span', undefined, '★')));
  let level = 0;
  let cooldown: number | undefined;

  function show(): void {
    stars.hidden = level === 0;
    [...stars.children].forEach((star, index) => star.classList.toggle('lit', index < level));
  }

  required<HTMLElement>('#mark').addEventListener('click', () => {
    if (level >= WANTED_LEVEL) {
      return;
    }
    level += 1;
    show();
    window.clearTimeout(cooldown);

    if (level === WANTED_LEVEL) {
      stars.classList.add('unlocked');
      revealTheme(WANTED_THEME);
    } else {
      cooldown = window.setTimeout(() => {
        level = 0;
        show();
      }, WANTED_COOLDOWN_MS);
    }
  });
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

  const [theme, unlocked] = await Promise.all([getSavedTheme(), getUnlockedThemes()]);
  applyTheme(theme);
  renderThemes(theme, unlocked);
  setUpWantedLevel(unlocked);
  await renderShortcut();
}

void init();
