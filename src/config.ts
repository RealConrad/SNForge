export const ACCESS = {
  requiredRoles: ['admin'],
  match: 'any' as 'any' | 'all',
};

export const THEMES = {
  tokyo: 'Tokyo',
  midnight: 'Midnight',
  obsidian: 'Obsidian',
} as const;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeId = 'tokyo';
export const THEME_STORAGE_KEY = 'snforge.theme';

/** User documentation, opened by :help and the popup. */
export const DOCS_URL = 'https://github.com/RealConrad/SNForge#readme';

/** How long the content script waits for the page bridge to answer. */
export const BRIDGE_TIMEOUT_MS = 2_000;

/** How long the "palette can't open" notice stays on screen. */
export const NOTICE_DURATION_MS = 4_000;

/**
 * Stage 1 of the sys_id search (:find): tables asked first, all at once. Each one also
 * covers every table that extends it, so a few base tables reach most records:
 * sys_metadata is all configuration (scripts, business rules, dictionary, …), task is
 * incidents, changes, requests, …, cmdb_ci is every CI. This list only makes common
 * lookups fast; anything not found here is still found by stage 2.
 */
export const SYS_ID_SEARCH_TABLES: readonly string[] = [
  'sys_metadata',
  'task',
  'cmdb_ci',
  'sys_user',
  'sys_user_group',
  'sys_update_set',
  'sys_update_xml',
  'sys_choice',
  'sys_attachment',
  'kb_knowledge',
  'core_company',
  'cmn_location',
  'alm_asset',
  'sysapproval_approver',
  'sys_user_grmember',
  'sys_user_has_role',
];

/**
 * Stage 2 of the sys_id search: every base table of the instance (read from
 * sys_db_object), asked in batches of this size. One batch is one HTTP request.
 */
export const SYS_ID_SCAN_BATCH_SIZE = 100;

/**
 * Table-name prefixes stage 2 skips: logs, history and index tables that are huge,
 * slow to query, and not something you look up by sys_id.
 */
export const SYS_ID_SCAN_SKIP_PREFIXES: readonly string[] = [
  'ts_', // text search index
  'v_', // in-memory virtual tables
  'syslog',
  'sysevent',
  'sys_audit',
  'sys_history',
  'sys_rollback',
];

/** Maximum number of command suggestions shown in the palette. */
export const MAX_SUGGESTIONS = 6;

/**
 * Suggested inputs: all shown when the palette input is empty, filtered as you type.
 * Each entry is exactly what you would type: a table name or a ":command".
 */
export const SUGGESTED_INPUTS: readonly string[] = [
  ':fd',
  ':st',
  ':nav',
  ':names',
  ':help',
];
