import type { Command } from '../types';
import { classicPageUrl, isNextExperiencePath } from '../urls';

export const nav: Command = {
  name: 'nav',
  aliases: ['navbar', 'shell', 'polaris'],
  description: 'Reload the page with Next Experience navigation',
  run(ctx) {
    if (isNextExperiencePath(ctx.currentPath)) {
      ctx.ui.print('Already a Next Experience page', 'info');
      return;
    }
    // Force the wrap: urlOptions.nextExperience is false on exactly the pages this is for.
    const url = classicPageUrl(ctx.currentPath, { ...ctx.urlOptions, nextExperience: true });
    ctx.ui.close();
    ctx.navigate(url);
  },
};
