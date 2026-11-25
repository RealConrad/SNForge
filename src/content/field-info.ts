/**
 * What the field details dialog (:names, click on a pill) shows about one form field:
 * its dictionary entry, its value on the record, and links to related configuration.
 * No DOM here: field-details.ts renders it.
 *
 * A field is often defined on a parent table (incident.priority lives on task), so the
 * dictionary entry is looked up along the table's whole hierarchy.
 */

import { classicPageUrl, type UrlOptions } from '../commands/urls';
import { isIdentifier } from '../shared/identifiers';
import type { SnApi, SnRecord } from '../shared/sn-api';
import { isSysId } from '../shared/sys-id';

/** The field that was clicked. */
export interface FieldRef {
  table: string;
  /** A column name, or a dot-walked path ("caller_id.name"). */
  field: string;
  /** The record the form shows; undefined for a record that isn't saved yet. */
  sysId: string | undefined;
}

export interface FieldInfo extends FieldRef {
  /** The table and its parents, nearest first: ["incident", "task"]. */
  hierarchy: string[];
  /** From the dictionary entry; all undefined when none was found (dot-walked fields are not looked up). */
  label?: string;
  type?: string;
  /** Table a reference field points to. */
  reference?: string;
  maxLength?: string;
  defaultValue?: string;
  /** Limits which records a reference field offers: an encoded query, a "javascript:" expression, or a named dynamic filter. */
  referenceQualifier?: string;
  /** The entry's attributes, as stored: "ref_auto_completer=AJAXTableCompleter,no_sort=true". */
  attributes?: string;
  mandatory: boolean;
  readOnly: boolean;
  /**
   * The field's sys_choice rows are a dropdown (the only values offered) or suggestions
   * (free text with a list to pick from, e.g. task.short_description). Undefined: none.
   */
  choices?: 'dropdown' | 'suggestion';
  /** Table the field is defined on, and the sys_id of that dictionary entry. */
  definedOn?: string;
  dictionaryId?: string;
  /** Stored value (sys_id for references) and what the form displays; undefined when the record couldn't be read. */
  value?: string;
  displayValue?: string;
}

/** Pages that can be opened for a field; a key is missing when there is no such page. */
export interface FieldUrls {
  /** The field's dictionary entry. */
  dictionary?: string;
  /** The record a reference field points to. */
  record?: string;
  /** The field's sys_choice rows (dropdown choices or suggestions). */
  choices?: string;
  /** Every ACL that can decide access to the field. */
  acls?: string;
  /** Audit entries of this field on this record. */
  history?: string;
}

/** How many parent tables are followed. ServiceNow's deepest hierarchies (CMDB) stay below this. */
const HIERARCHY_DEPTH = 8;

/** "super_class.name", "super_class.super_class.name", …: every parent's name in one request. */
const PARENT_NAME_FIELDS = Array.from(
  { length: HIERARCHY_DEPTH },
  (_, level) => `${'super_class.'.repeat(level + 1)}name`,
);

const DICTIONARY_FIELDS = [
  'sys_id',
  'name',
  'column_label',
  'internal_type',
  'reference',
  'max_length',
  'default_value',
  'reference_qual',
  'dynamic_ref_qual.name',
  'attributes',
  'mandatory',
  'read_only',
  'choice',
];

/** Parent tables are read once per table: the hierarchy doesn't change while you work. */
const hierarchies = new Map<string, string[]>();

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/** `table` and its parents, nearest first, from its sys_db_object record (undefined: table only). */
export function hierarchyOf(table: string, record: SnRecord | undefined): string[] {
  const parents = PARENT_NAME_FIELDS.map((field) => text(record?.[field])).filter(
    (name): name is string => name !== undefined && isIdentifier(name),
  );
  return [table, ...parents];
}

async function loadHierarchy(api: SnApi, table: string, signal?: AbortSignal): Promise<string[]> {
  const known = hierarchies.get(table);
  if (known) {
    return known;
  }
  const [record] = await api.getRecords('sys_db_object', {
    query: `name=${table}`,
    fields: PARENT_NAME_FIELDS,
    limit: 1,
    signal,
  });
  const hierarchy = hierarchyOf(table, record);
  hierarchies.set(table, hierarchy);
  return hierarchy;
}

/** The dictionary entry that applies: the one on the nearest table of the hierarchy. */
export function nearestEntry(entries: readonly SnRecord[], hierarchy: readonly string[]): SnRecord | undefined {
  return hierarchy.map((table) => entries.find((entry) => entry.name === table)).find((entry) => entry !== undefined);
}

/** The dictionary part of FieldInfo. Everything comes from the server and is shape-checked before use in a URL. */
function describeEntry(entry: SnRecord | undefined): Partial<FieldInfo> & Pick<FieldInfo, 'mandatory' | 'readOnly'> {
  const reference = text(entry?.reference);
  const dictionaryId = text(entry?.sys_id);
  const choice = text(entry?.choice);
  const dynamicQualifier = text(entry?.['dynamic_ref_qual.name']);
  return {
    label: text(entry?.column_label),
    type: text(entry?.internal_type),
    reference: reference && isIdentifier(reference) ? reference : undefined,
    maxLength: text(entry?.max_length),
    defaultValue: text(entry?.default_value),
    // A dynamic qualifier is a named filter (a reference); the other kinds are stored as text.
    referenceQualifier: dynamicQualifier ? `dynamic: ${dynamicQualifier}` : text(entry?.reference_qual),
    attributes: text(entry?.attributes),
    mandatory: entry?.mandatory === 'true',
    readOnly: entry?.read_only === 'true',
    // Dictionary "choice": 0 none, 1 and 3 dropdowns, 2 suggestions.
    choices: choice === '2' ? 'suggestion' : choice === '1' || choice === '3' ? 'dropdown' : undefined,
    definedOn: text(entry?.name),
    dictionaryId: dictionaryId && isSysId(dictionaryId) ? dictionaryId : undefined,
  };
}

async function loadEntry(api: SnApi, { field }: FieldRef, hierarchy: string[], signal?: AbortSignal): Promise<SnRecord | undefined> {
  if (!isIdentifier(field)) {
    return undefined; // dot-walked: defined on another table's hierarchy
  }
  const entries = await api.getRecords('sys_dictionary', {
    query: `nameIN${hierarchy.join(',')}^element=${field}`,
    fields: DICTIONARY_FIELDS,
    signal,
  });
  return nearestEntry(entries, hierarchy);
}

/** { value, display_value } of the field on the record; empty when the record isn't saved or can't be read. */
async function loadValue(api: SnApi, { table, field, sysId }: FieldRef, signal?: AbortSignal): Promise<Pick<FieldInfo, 'value' | 'displayValue'>> {
  if (!sysId) {
    return {};
  }
  try {
    const [record] = await api.getRecords(table, {
      query: `sys_id=${sysId}`,
      fields: ['sys_id', field],
      limit: 1,
      display: 'all',
      signal,
    });
    const id = record?.sys_id;
    const cell = record?.[field];
    // ServiceNow can ignore a sys_id condition and return another row; only trust the right one.
    if (!isPair(id) || id.value !== sysId || !isPair(cell)) {
      return {};
    }
    return { value: cell.value, displayValue: cell.display_value };
  } catch {
    return {}; // the dictionary details are still worth showing
  }
}

function isPair(value: unknown): value is { value: string; display_value: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'string' &&
    'display_value' in value &&
    typeof value.display_value === 'string'
  );
}

export async function loadFieldInfo(api: SnApi, ref: FieldRef, signal?: AbortSignal): Promise<FieldInfo> {
  const [hierarchy, value] = await Promise.all([loadHierarchy(api, ref.table, signal), loadValue(api, ref, signal)]);
  const entry = await loadEntry(api, ref, hierarchy, signal);
  return { ...ref, hierarchy, ...describeEntry(entry), ...value };
}

/** "reference → sys_user", "string (160)", …; undefined when the type is unknown. */
export function typeText({ type, reference, maxLength }: FieldInfo): string | undefined {
  if (!type) {
    return undefined;
  }
  if (reference) {
    return `${type} → ${reference}`;
  }
  return maxLength ? `${type} (${maxLength})` : type;
}

/**
 * Names of the ACLs that can decide access to `field`. A field rarely has an ACL of
 * its own: ServiceNow falls back from "<table>.<field>" to "<table>.*" along the table's
 * parents and finally to the wildcard rules, and the row-level rules ("<table>") apply
 * before any of them. All of those are listed, most specific first.
 */
export function aclNames(hierarchy: readonly string[], field: string): string[] {
  return [
    ...hierarchy.map((table) => `${table}.${field}`),
    `*.${field}`,
    ...hierarchy.map((table) => `${table}.*`),
    '*.*',
    ...hierarchy,
    '*',
  ];
}

/** The pages that exist for this field. */
export function fieldUrls(info: FieldInfo, urlOptions: UrlOptions): FieldUrls {
  const { table, field, sysId, hierarchy } = info;
  const list = (listTable: string, query: string): string =>
    classicPageUrl(`/${listTable}_list.do?${new URLSearchParams({ sysparm_query: query }).toString()}`, urlOptions);
  const urls: FieldUrls = {};

  if (info.dictionaryId) {
    urls.dictionary = classicPageUrl(`/sys_dictionary.do?sys_id=${info.dictionaryId}`, urlOptions);
  }
  if (info.reference && info.value && isSysId(info.value)) {
    urls.record = classicPageUrl(`/${info.reference}.do?sys_id=${info.value}`, urlOptions);
  }
  if (!isIdentifier(field)) {
    return urls; // the rest is per column, and a dot-walked field is another table's column
  }

  if (info.choices) {
    urls.choices = list('sys_choice', `nameIN${hierarchy.join(',')}^element=${field}^ORDERBYname^ORDERBYsequence`);
  }
  urls.acls = list('sys_security_acl', `nameIN${aclNames(hierarchy, field).join(',')}^ORDERBYname^ORDERBYoperation`);
  if (sysId) {
    urls.history = list('sys_audit', `tablename=${table}^documentkey=${sysId}^fieldname=${field}^ORDERBYDESCsys_created_on`);
  }
  return urls;
}
