import { SYS_ID_SCAN_BATCH_SIZE, SYS_ID_SCAN_SKIP_PREFIXES, SYS_ID_SEARCH_TABLES } from '../../config';
import type { FoundRecord, SnApi } from '../../shared/sn-api';
import { isSysId } from '../../shared/sys-id';
import type { Command, CommandContext } from '../types';
import { classicPageUrl } from '../urls';

/*
 * ServiceNow has no "which table is this sys_id in?" API; you can only ask one table at
 * a time. Two things keep that fast:
 *
 * - A base table also answers for every table that extends it (`task` finds incidents,
 *   changes, …) and says which one in sys_class_name. So only base tables are asked.
 * - Stage 1 asks the few tables that hold most records, all at once. Only when that
 *   misses does stage 2 go through every other base table, in batches.
 */

const FIELDS = ['sys_class_name'];

/** The base tables for stage 2. Fetched once per page: the table list doesn't change while you work. */
let otherBaseTables: string[] | undefined;

/** The record's real table. Tables that can't be extended have no sys_class_name. */
function realTable({ table, record }: FoundRecord): string {
  return typeof record.sys_class_name === 'string' && record.sys_class_name ? record.sys_class_name : table;
}

/** Stage 1: every common table at the same time; the first hit cancels the rest. */
async function findInCommonTables(api: SnApi, sysId: string, signal: AbortSignal): Promise<string | null> {
  const firstHit = new AbortController();
  const lookupSignal = AbortSignal.any([signal, firstHit.signal]);

  const lookups = SYS_ID_SEARCH_TABLES.map(async (table) => {
    const record = await api.getRecord(table, sysId, { fields: FIELDS, signal: lookupSignal });
    if (!record) {
      throw new Error(`Not in ${table}`);
    }
    return realTable({ table, record });
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

/** Every base table of the instance that stage 1 didn't ask, business tables first. */
async function loadOtherBaseTables(api: SnApi, signal: AbortSignal): Promise<string[]> {
  const records = await api.getRecords('sys_db_object', {
    query: 'super_classISEMPTY', // no parent table = base table
    fields: ['name'],
    limit: 10_000,
    signal,
  });

  const names = records
    .map((record) => String(record.name))
    .filter((name) => !SYS_ID_SEARCH_TABLES.includes(name))
    .filter((name) => !SYS_ID_SCAN_SKIP_PREFIXES.some((prefix) => name.startsWith(prefix)));

  // Platform tables (sys…) are the larger group and the less likely place for a record.
  const isSystem = (name: string): boolean => name.startsWith('sys');
  return [...names.filter((name) => !isSystem(name)), ...names.filter(isSystem)];
}

/** Stage 2: all remaining base tables, one batch (= one request) at a time. Esc cancels via ctx.signal. */
async function findInOtherTables(ctx: CommandContext, sysId: string): Promise<string | null> {
  otherBaseTables ??= await loadOtherBaseTables(ctx.api, ctx.signal);
  const tables = otherBaseTables;

  for (let done = 0; done < tables.length; done += SYS_ID_SCAN_BATCH_SIZE) {
    ctx.ui.print(`Not in the common tables. Searching all tables… ${done} / ${tables.length} (Esc to cancel)`);
    const batch = tables.slice(done, done + SYS_ID_SCAN_BATCH_SIZE);
    const found = await ctx.api.findInTables(batch, sysId, { fields: FIELDS, signal: ctx.signal });
    if (found) {
      return realTable(found);
    }
  }
  return null;
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
    const table =
      (await findInCommonTables(ctx.api, sysId, ctx.signal)) ?? (await findInOtherTables(ctx, sysId));
    if (!table) {
      throw new Error(`No record with sys_id ${sysId} was found in any table.`);
    }

    ctx.ui.close();
    ctx.navigate(classicPageUrl(`/${encodeURIComponent(table)}.do?sys_id=${sysId}`, ctx.urlOptions));
  },
};
