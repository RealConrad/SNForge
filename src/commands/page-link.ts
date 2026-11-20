import type { Command } from './types';
import { instanceUrl } from './urls';

/** Data for a command that opens one fixed page of the current instance. */
interface PageLink {
  name: string;
  aliases?: string[];
  description: string;
  /** Path on the current instance, with a leading slash, e.g. "/now/flow-designer". */
  path: string;
}

/**
 * Makes a command that opens `link.path` on the current instance in a new tab.
 * Not a command itself: builtin/fd.ts, builtin/st.ts, … each call it once.
 */
export function pageLinkCommand(link: PageLink): Command {
  return {
    name: link.name,
    aliases: link.aliases,
    description: link.description,
    usage: link.name,
    async run(ctx) {
      // A plain URL, not classicPageUrl(): these pages must not be wrapped in the classic frame.
      const url = instanceUrl(link.path, ctx.urlOptions.origin);
      await ctx.openTab(url);
      ctx.ui.close();
    },
  };
}
