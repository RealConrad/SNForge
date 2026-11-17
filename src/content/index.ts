import { isRuntimeMessage } from '../shared/messages';
import { isAccessAllowed } from './access';
import { togglePalette } from './ui/palette';

// The access check runs lazily on the first toggle, so non-admins never trigger
// a REST lookup just by browsing. Until it passes, nothing is mounted.
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isRuntimeMessage(message)) {
    return;
  }

  void isAccessAllowed().then((allowed) => {
    if (allowed) {
      togglePalette();
    }
  });
});
