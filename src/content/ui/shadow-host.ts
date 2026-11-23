import type { ThemeId } from '../../config';
import { el } from '../../shared/dom';
import { getSavedTheme, onThemeChanged } from '../../shared/theme';
import themes from '../../shared/themes.css';

/** Every themed element currently mounted; they all follow the saved theme. */
const themed = new Set<HTMLElement>();
let watching = false;

function applyTheme(theme: ThemeId): void {
  for (const element of themed) {
    if (element.isConnected) {
      element.dataset.theme = theme;
    } else {
      themed.delete(element); // its host was removed (a notice that timed out, a closed editor)
    }
  }
}

/**
 * Puts `content` on the page inside its own host element and returns the host. All
 * SNForge UI (palette, notice, field editor) is mounted this way:
 *
 * - A closed Shadow DOM: ServiceNow's CSS and ours never collide, and page scripts
 *   cannot reach the content through host.shadowRoot.
 * - `styles` plus the theme tokens; `content` gets the saved theme and follows changes
 *   made in the popup.
 *
 * Remove the host to take the UI off the page again.
 */
export function mountShadow(styles: string, content: HTMLElement): HTMLDivElement {
  const style = el('style');
  style.textContent = `${themes}\n${styles}`;

  const host = el('div');
  host.attachShadow({ mode: 'closed' }).append(style, content);
  document.documentElement.append(host);

  content.dataset.theme = ''; // default theme until the saved one loads
  themed.add(content);
  void getSavedTheme().then(applyTheme);
  if (!watching) {
    watching = true;
    onThemeChanged(applyTheme);
  }
  return host;
}
