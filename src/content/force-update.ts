/**
 * The "Force update" path of :edit: writes one field by running a GlideRecord update as
 * a background script. Plain GlideRecord ignores ACLs and read-only, so it can set
 * fields the Table API refuses.
 *
 * This runs server-side script as the user. It may only be called on an explicit,
 * trusted user action (the editor's Save button).
 */

import type { SnApi } from '../shared/sn-api';
import { isSysId } from '../shared/sys-id';

/** GlideRecord flags for a forced update. Both default to false (normal behaviour). */
export interface ForceUpdateOptions {
  /** setWorkflow(false): skip business rules, flows and notifications. */
  skipBusinessRules?: boolean;
  /** autoSysFields(false): leave sys_updated_on / sys_updated_by as they are. */
  keepSystemFields?: boolean;
}

/** Table and field names in script source must be plain identifiers. */
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

/**
 * A GlideRecord update, as background-script source. Throws unless table and field are
 * plain identifiers and sysId is a sys_id, so no script can be built from anything else.
 * Every value also goes in through JSON.stringify: a value with quotes or newlines is a
 * safe JS string literal and can't extend the script.
 */
export function buildUpdateScript(
  table: string,
  sysId: string,
  field: string,
  value: string,
  options: ForceUpdateOptions = {},
): string {
  if (!IDENTIFIER.test(table) || !IDENTIFIER.test(field) || !isSysId(sysId)) {
    throw new Error('Invalid table, field or sys_id');
  }

  const lines = [`var gr = new GlideRecord(${JSON.stringify(table)});`, `if (gr.get(${JSON.stringify(sysId)})) {`];
  if (options.skipBusinessRules) {
    lines.push('  gr.setWorkflow(false);');
  }
  if (options.keepSystemFields) {
    lines.push('  gr.autoSysFields(false);');
  }
  lines.push(`  gr.setValue(${JSON.stringify(field)}, ${JSON.stringify(value)});`, '  gr.update();', '}');
  return lines.join('\n');
}

/**
 * Runs the update and returns the value the record has afterwards, for the caller to
 * compare: the script's own output is unreliable, so the field is read back over REST.
 */
export async function forceUpdateField(
  api: SnApi,
  table: string,
  sysId: string,
  field: string,
  value: string,
  options: ForceUpdateOptions = {},
  signal?: AbortSignal,
): Promise<unknown> {
  await api.runBackgroundScript(buildUpdateScript(table, sysId, field, value, options), signal);
  const record = await api.getRecord(table, sysId, { fields: [field], signal });
  return record ? record[field] : undefined;
}
