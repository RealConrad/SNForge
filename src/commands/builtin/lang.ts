import type { Command } from '../types';
import { instanceUrl } from '../urls';

export const lang: Command = {
  name: 'lang',
  aliases: ['language', 'locale'],
  description: 'Change your session language, e.g. :lang de',
  usage: 'lang <code>',
  async run(ctx, [code]) {
    if (!code) {
      throw new Error('Add a language code, for example :lang de');
    }

    // sys_language holds the languages installed on this instance: id "de", name "German".
    const records = await ctx.api.getRecords('sys_language', {
      query: 'active=true^ORDERBYid',
      fields: ['id'],
      signal: ctx.signal,
    });
    const codes = records.map((record) => String(record.id));

    const language = code.toLowerCase();
    if (!codes.includes(language)) {
      throw new Error(`"${code}" is not a language on this instance. Available: ${codes.join(', ')}`);
    }

    await ctx.api.setSessionLanguage(language, ctx.signal);
    ctx.ui.close();
    ctx.navigate(instanceUrl(ctx.currentPath, ctx.urlOptions.origin)); // reload in the new language
  },
};
