import type { Command } from '../types';
import { classicPageUrl, hasNavigation } from '../urls';

export const nav: Command = {
    name: 'nav',
    aliases: ['navbar', 'shell', 'polaris'],
    description: 'Reload the page with Next Experience navigation',
    usage: 'nav',
    run(ctx) {
        if (hasNavigation(ctx.currentPath)) {
            ctx.ui.print('Already using Next Experience navigation', 'info');
            return;
        }
        const url = classicPageUrl(ctx.currentPath, { ...ctx.urlOptions, nextExperience: true });
        ctx.ui.close();
        ctx.navigate(url);
    }
}