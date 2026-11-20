import { isPaletteToggleMessage } from '../shared/messages';
import { isAccessAllowed } from './access';
import { togglePalette } from './ui/palette';

/** Marker on the isolated-world global: this script is injected on demand and must start once. */
interface ContentGlobal extends Window {
  __snforgeContent?: boolean;
}

let checking = false;

/**
 * The access check runs on each toggle (cached after the first), so non-admins never
 * see anything. Toggles that arrive while a check is still running are ignored;
 * otherwise a double press would open and immediately close the palette.
 */
function onToggle(): void {
  if (checking) {
    return;
  }
  checking = true;
  void isAccessAllowed()
    .then((allowed) => {
      if (allowed) {
        togglePalette();
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
