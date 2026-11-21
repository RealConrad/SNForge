/**
 * Remembers, per instance, the tables where the slow part of :find located a record,
 * so the next search asks them straight away. Only table names are saved, in
 * chrome.storage.local as { "<instance origin>": ["table_a", "table_b"] }.
 */

import { FOUND_TABLES_MAX, FOUND_TABLES_STORAGE_KEY } from '../config';

type Store = Record<string, unknown>;

async function readStore(): Promise<Store> {
  const stored = await chrome.storage.local.get(FOUND_TABLES_STORAGE_KEY);
  const store: unknown = stored[FOUND_TABLES_STORAGE_KEY];
  return typeof store === 'object' && store !== null ? { ...store } : {};
}

function tablesOf(store: Store): string[] {
  const tables = store[window.location.origin];
  return Array.isArray(tables) ? tables.filter((table) => typeof table === 'string') : [];
}

/** The remembered tables for the current instance; empty when storage is unavailable. */
export async function loadFoundTables(): Promise<string[]> {
  try {
    return tablesOf(await readStore());
  } catch {
    return [];
  }
}

/** Adds `table` for the current instance, keeping the newest FOUND_TABLES_MAX. */
export async function rememberFoundTable(table: string): Promise<void> {
  try {
    const store = await readStore();
    const tables = tablesOf(store);
    if (!tables.includes(table)) {
      store[window.location.origin] = [...tables, table].slice(-FOUND_TABLES_MAX);
      await chrome.storage.local.set({ [FOUND_TABLES_STORAGE_KEY]: store });
    }
  } catch {
    // Remembering is an optimisation; the search result is still valid without it.
  }
}
