/**
 * Classic forms render each field as a row with the id "element.<table>.<field>".
 * :names and :edit both find fields through it; this is the one place that knows the format.
 */

import { isIdentifier } from '../shared/identifiers';

/** Matches every form row of a classic form. */
export const FORM_ROW_SELECTOR = '[id^="element."]';

const FORM_ROW_ID = /^element\.([^.]+)\.(.+)$/;

export interface FormRow {
  table: string;
  /** A column name, or a dot-walked path ("caller_id.name") for a field of a related record. */
  field: string;
}

/** Table and field of a form row id; undefined when `id` isn't one. The id is page data, so it is shape-checked. */
export function parseFormRowId(id: string): FormRow | undefined {
  const [, table, field] = FORM_ROW_ID.exec(id) ?? [];
  if (!table || !field || !isIdentifier(table) || !field.split('.').every(isIdentifier)) {
    return undefined;
  }
  return { table, field };
}
