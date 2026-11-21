import { SYS_ID_SEARCH_TABLES } from '../../config';
import type { SnApi } from '../../shared/sn-api';
import { isSysId } from '../../shared/sys-id';
import type { Command } from '../types';
import { classicPageUrl } from '../urls';

/**
 * Finds the table of the record with `sysId`, or null when none of the search tables
 * has it.
 *
 * ServiceNow has no "which table is this sys_id in?" API, so we ask a short list of
 * base tables at the same time. A base table also answers for every table that extends
 * it (`task` finds incidents, changes, …) and says which one in sys_class_name. Each
 * request is a primary-key lookup, and the first hit cancels the rest.
 */
async function findTable(api: SnApi, sysId: string, signal: AbortSignal): Promise<string | null> {
  const firstHit = new AbortController();
  const lookupSignal = AbortSignal.any([signal, firstHit.signal]);

  const lookups = SYS_ID_SEARCH_TABLES.map(async (table) => {
    const record = await api.getRecord(table, sysId, { fields: ['sys_class_name'], signal: lookupSignal });
    if (!record) {
      throw new Error(`Not in ${table}`);
    }
    // Tables that can't be extended have no sys_class_name; the record is in `table` itself.
    return typeof record.sys_class_name === 'string' && record.sys_class_name ? record.sys_class_name : table;
  });

  try {
    // Resolves with the first hit. A lookup that fails (table not installed, no read
    // access) counts as a miss, the same as "not found".
    return await Promise.any(lookups);
  } catch {
    return null; // every lookup missed
  } finally {
    firstHit.abort();
  }
}

export const find: Command = {
  name: 'find',
  aliases: ['sysid', 'id'],
  description: 'Open the record with a sys_id, e.g. :find 6816f79cc0a8016401c5a33be04be441',
  usage: 'find <sys_id>',
  async run(ctx, [input]) {
    const sysId = input?.toLowerCase() ?? '';
    if (!isSysId(sysId)) {
      throw new Error('Add a sys_id (32 characters, 0-9 and a-f), for example :find 6816f79cc0a8016401c5a33be04be441');
    }

    ctx.ui.print('Searching…');
    const table = await findTable(ctx.api, sysId, ctx.signal);
    if (!table) {
      throw new Error(`No record found for ${sysId} in: ${SYS_ID_SEARCH_TABLES.join(', ')}`);
    }

    ctx.ui.close();
    ctx.navigate(classicPageUrl(`/${encodeURIComponent(table)}.do?sys_id=${sysId}`, ctx.urlOptions));
  },
};
