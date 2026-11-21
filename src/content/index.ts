import { ACCESS } from '../config';
import { isPaletteToggleMessage } from '../shared/messages';
import { getAccess, type Access } from './access';
import { showNotice } from './ui/notice';
import { togglePalette } from './ui/palette';

/** Marker on the isolated-world global: this script is injected on demand and must start once. */
interface ContentGlobal extends Window {
  __snforgeContent?: boolean;
}

const requiredRoles = ACCESS.requiredRoles.join(ACCESS.match === 'all' ? ' and ' : ' or ');

/** Shown when the hotkey was pressed but the palette can't open, so SNForge doesn't look broken. */
const NOTICES: Record<Exclude<Access, 'granted'>, string> = {
  denied: `SNForge is only available to users with the ${requiredRoles} role.`,
  unavailable: 'SNForge could not read your ServiceNow session. Reload the page and try again.',
};

let checking = false;

/**
 * The access check runs on each toggle (cached after the first). Toggles that arrive
 * while a check is still running are ignored; otherwise a double press would open and
 * immediately close the palette.
 */
function onToggle(): void {
  if (checking) {
    return;
  }
  checking = true;
  void getAccess()
    .then((access) => {
      if (access === 'granted') {
        togglePalette();
      } else {
        showNotice(NOTICES[access]);
      }
    })
    .finally(() => {
      checking = false;
    });
}

const contentGlobal: ContentGlobal = window;
if (!contentGlobal.__snforgeContent) {
  contentGlobal.__snforgeContent = true;
  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (isPaletteToggleMessage(message)) {
      onToggle();
    }
  });
}
