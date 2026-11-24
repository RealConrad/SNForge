import type { Command } from '../types';
import { instanceUrl } from '../urls';

/**
 * The endpoint ServiceNow's own language picker calls, so the change applies to the live
 * session. Internal, not a documented API.
 */
const LANGUAGE_ENDPOINT = '/api/now/ui/concoursepicker/language';

export const lang: Command = {
  name: 'lang',
  aliases: ['language', 'locale'],
  description: 'Change your session language, e.g. :lang de',
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
    const codes = records.flatMap((record) => (typeof record.id === 'string' ? [record.id] : []));

    const language = code.toLowerCase();
    if (!codes.includes(language)) {
      throw new Error(`"${code}" is not a language on this instance. Available: ${codes.join(', ')}`);
    }

    await ctx.api.request(LANGUAGE_ENDPOINT, { method: 'PUT', body: { current: language }, signal: ctx.signal });
    ctx.ui.close();
    ctx.navigate(instanceUrl(ctx.currentPath, ctx.urlOptions.origin)); // reload in the new language
  },
};
