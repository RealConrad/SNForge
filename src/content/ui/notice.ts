import { NOTICE_DURATION_MS } from '../../config';
import { el } from '../../shared/dom';
import { getSavedTheme } from '../../shared/theme';
import themes from '../../shared/themes.css';
import styles from './notice.css';

let host: HTMLElement | undefined;
let timer: number | undefined;

/**
 * Shows a short message where the palette would open, then removes it again.
 * Used when the hotkey was pressed but the palette can't open, so the extension
 * doesn't look broken. A new notice replaces the one on screen.
 */
export function showNotice(message: string): void {
  host?.remove();
  window.clearTimeout(timer);

  const notice = el('div', 'notice', message);
  notice.setAttribute('role', 'status');
  notice.dataset.theme = ''; // default theme until the saved one loads
  void getSavedTheme().then((theme) => {
    notice.dataset.theme = theme;
  });

  const style = el('style');
  style.textContent = `${themes}\n${styles}`;

  host = el('div');
  host.attachShadow({ mode: 'closed' }).append(style, notice);
  document.documentElement.append(host);

  timer = window.setTimeout(() => host?.remove(), NOTICE_DURATION_MS);
}
