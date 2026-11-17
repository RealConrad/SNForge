import { THEMES, type ThemeId } from '../config';
import themes from '../shared/themes.css';
import { getSavedTheme, isThemeId, saveTheme } from '../shared/theme';
import styles from './popup.css';

const PALETTE_COMMAND = 'toggle-palette';
const SHORTCUTS_URL = 'chrome://extensions/shortcuts';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function applyTheme(theme: ThemeId): void {
  document.body.dataset.theme = theme;
}

function createHeader(): HTMLElement {
  const header = el('header', 'header');
  const mark = el('span', 'mark', ':');
  mark.setAttribute('aria-hidden', 'true');
  const title = el('div', 'title');
  title.append(
    el('strong', undefined, 'SNForge'),
    el('span', undefined, `v${chrome.runtime.getManifest().version} · ServiceNow command palette`),
  );
  header.append(mark, title);
  return header;
}

function createThemeCard(id: ThemeId, label: string, selected: ThemeId): HTMLLabelElement {
  const card = el('label', 'theme-card');
  card.dataset.theme = id;

  const input = el('input');
  input.type = 'radio';
  input.name = 'theme';
  input.value = id;
  input.checked = id === selected;
  input.addEventListener('change', () => {
    if (input.checked && isThemeId(input.value)) {
      applyTheme(input.value);
      void saveTheme(input.value);
    }
  });

  const preview = el('span', 'preview');
  preview.setAttribute('aria-hidden', 'true');
  const row = el('span', 'preview-row');
  row.append(el('span', 'preview-dot'), el('span', 'preview-line'));
  const row2 = el('span', 'preview-row');
  row2.append(el('span', 'preview-line short'));
  preview.append(el('span', 'preview-bar'), row, row2);

  const name = el('span', 'theme-name');
  const check = el('span', 'check', '✓');
  check.setAttribute('aria-hidden', 'true');
  name.append(label, check);

  card.append(input, preview, name);
  return card;
}

function createThemeSection(selected: ThemeId): HTMLElement {
  const section = el('section', 'section');
  const fieldset = el('fieldset', 'themes');
  fieldset.append(el('legend', 'section-title', 'Theme'));
  for (const [id, label] of Object.entries(THEMES)) {
    if (isThemeId(id)) {
      fieldset.append(createThemeCard(id, label, selected));
    }
  }
  section.append(fieldset);
  return section;
}

function renderShortcut(keys: HTMLElement, shortcut: string | undefined): void {
  keys.replaceChildren();
  if (!shortcut) {
    keys.append('Not set');
    return;
  }
  // Chrome formats shortcuts as e.g. "Ctrl+Shift+Space".
  keys.append(...shortcut.split('+').map((key) => el('kbd', undefined, key)));
}

function createShortcutSection(): HTMLElement {
  const section = el('section', 'section');
  section.append(el('h2', 'section-title', 'Open palette'));

  const row = el('div', 'shortcut');
  const keys = el('div', 'keys');
  const change = el('button', 'link-button', 'Change');
  change.type = 'button';
  change.addEventListener('click', () => {
    void chrome.tabs.create({ url: SHORTCUTS_URL });
  });
  row.append(keys, change);
  section.append(row);

  void chrome.commands.getAll().then((commands) => {
    renderShortcut(keys, commands.find((command) => command.name === PALETTE_COMMAND)?.shortcut);
  });
  return section;
}

async function init(): Promise<void> {
  const style = el('style');
  style.textContent = `${themes}\n${styles}`;
  document.head.append(style);

  const app = document.getElementById('app');
  if (!app) {
    return;
  }

  const theme = await getSavedTheme();
  applyTheme(theme);
  app.append(createHeader(), createThemeSection(theme), createShortcutSection());
}

void init();
