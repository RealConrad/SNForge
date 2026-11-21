import type { SnApi } from '../shared/sn-api';
import type { UrlOptions } from './urls';

export type OutputKind = 'info' | 'error' | 'success';

/**
 * Everything a command may do. Commands never touch the DOM or `chrome.*` directly,
 * only through this object, so they stay small and testable.
 *
 * Add a field here (and fill it in context.ts) only when a command needs it.
 *
 * There are no per-command permissions: the palette only opens for users who passed
 * the global admin gate (content/access.ts), so every command may assume that.
 */
export interface CommandContext {
  /** For building page URLs with ./urls.ts (handles Next Experience). */
  urlOptions: UrlOptions;
  /** Aborted when the palette closes or another command starts. */
  signal: AbortSignal;
  ui: {
    print(line: string, kind?: OutputKind): void;
    clear(): void;
    close(): void;
  };
  /** REST calls to the current instance, as the logged-in user. Pass `signal` along. */
  api: SnApi;
  /** Opens a new tab (same instance, or the docs URL). */
  openTab(url: string, active?: boolean): Promise<void>;
  /** Navigates the current tab. */
  navigate(url: string): void;
  /** Path + query of the current page, e.g. "/incident.do?sys_id=abc". */
  currentPath: string;
  /**
   * Shows technical field names on classic forms / lists, or hides them if shown.
   * Returns how many were added or removed; 0 means the page has no classic form or list.
   */
  toggleFieldNames(): number;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  run(ctx: CommandContext, args: string[]): Promise<void> | void;
}
