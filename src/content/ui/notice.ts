import { NOTICE_DURATION_MS } from '../../config';
import { el } from '../../shared/dom';
import styles from './notice.css';
import { mountShadow } from './shadow-host';

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
  host = mountShadow(styles, notice);

  timer = window.setTimeout(() => host?.remove(), NOTICE_DURATION_MS);
}
