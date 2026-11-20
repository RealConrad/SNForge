/**
 * Table shortcuts: bare table names typed into the palette.
 *
 *   incident                    → incident list, current tab
 *   INCIDENT                    → same, new tab (any uppercase letter in the first word)
 *   incident active=true^priority=1
 *                               → list filtered by an encoded query
 *   incident.list               → list (explicit)
 *   incident.filter [query]     → list with the filter builder open, no records loaded
 *   incident.new / incident.do [query]
 *                               → new-record form; the query pre-fills field values
 */

import { classicPageUrl, type UrlOptions } from './urls';

export type TableView = 'list' | 'filter' | 'new';

export interface TableShortcut {
  table: string;
  view: TableView;
  /** Encoded query, e.g. "active=true^priority=1"; empty when none was given. */
  query: string;
  newTab: boolean;
}

const VIEW_SUFFIXES: Readonly<Record<string, TableView>> = {
  list: 'list',
  filter: 'filter',
  new: 'new',
  do: 'new',
};

/** ServiceNow table names: lowercase letters, digits and underscores. */
const TABLE_NAME = /^[a-z][a-z0-9_]*$/;

/**
 * Parses palette input as a table shortcut. Returns null when the input isn't one
 * (empty, starts with ":", invalid table name or unknown suffix).
 */
export function parseTableShortcut(input: string): TableShortcut | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return null;
  }

  const [target = '', ...rest] = trimmed.split(/\s+/);
  // Only the first word decides the tab and is lowercased; query values keep their case.
  const newTab = target !== target.toLowerCase();
  const [table = '', suffix = 'list', ...extra] = target.toLowerCase().split('.');
  const view = Object.hasOwn(VIEW_SUFFIXES, suffix) ? VIEW_SUFFIXES[suffix] : undefined;

  if (!TABLE_NAME.test(table) || !view || extra.length > 0) {
    return null;
  }

  return { table, view, query: rest.join(' '), newTab };
}

/** Path + search for a shortcut, relative to the instance, e.g. "/incident_list.do?…". */
function classicPath({ table, view, query }: TableShortcut): string {
  const params = new URLSearchParams();
  let path: string;

  switch (view) {
    case 'list':
      path = `/${table}_list.do`;
      break;
    case 'filter':
      path = `/${table}_list.do`;
      params.set('sysparm_filter_only', 'true');
      break;
    case 'new':
      path = `/${table}.do`;
      params.set('sys_id', '-1');
      break;
  }

  if (query) {
    params.set('sysparm_query', query);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function tableShortcutUrl(shortcut: TableShortcut, options: UrlOptions): string {
  return classicPageUrl(classicPath(shortcut), options);
}

const VIEW_LABELS: Readonly<Record<TableView, string>> = {
  list: 'Open list',
  filter: 'Open list filter',
  new: 'New record',
};

/** Human-readable summary for the palette, e.g. { title: "Open list: incident", detail: "all records" }. */
export function describeTableShortcut({ table, view, query }: TableShortcut): {
  title: string;
  detail: string;
} {
  const details: Record<TableView, string> = {
    list: query ? `where ${query}` : 'all records',
    filter: query ? `filter starts as ${query}` : 'filter builder, no records loaded',
    new: query ? `prefill ${query}` : 'empty form',
  };
  return { title: `${VIEW_LABELS[view]}: ${table}`, detail: details[view] };
}
