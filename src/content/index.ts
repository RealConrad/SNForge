import { isAccessAllowed } from './access';
import { togglePalette } from './ui/palette';

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (typeof message !== 'object' || message === null || !('type' in message) || message.type !== 'palette/toggle') {
    return;
  }

  void isAccessAllowed().then((allowed) => {
    if (allowed) {
      togglePalette();
    }
  });
});
