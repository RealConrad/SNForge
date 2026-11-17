import type { SessionInfo } from '../shared/messages';
import type { SnApi } from '../shared/sn-api';
import type { UrlOptions } from './urls';

export type OutputKind = 'info' | 'error' | 'success';

/**
 * Everything a command may do. Commands never touch the DOM or `chrome.*` directly,
 * only through this object, so they stay small and testable.
 *
 * There are no per-command permissions: the palette only opens for users who passed
 * the global admin gate (content/access.ts), so every command may assume that.
 */
export interface CommandContext {
  /** e.g. "https://dev12345.service-now.com" */
  instanceUrl: string;
  /** For building page URLs with ./urls.ts (handles Next Experience). */
  urlOptions: UrlOptions;
  session: SessionInfo;
  /** Table API, with the session token pre-set. */
  api: SnApi;
  /** Aborted when the palette closes or another command starts. Pass it to api calls. */
  signal: AbortSignal;
  ui: {
    print(line: string, kind?: OutputKind): void;
    clear(): void;
    close(): void;
  };
  /** Opens a new tab (same instance, or the docs URL). */
  openTab(url: string, active?: boolean): Promise<void>;
  /** Navigates the current tab. */
  navigate(url: string): void;
}

export interface Command {
  /** Typed as ":name". */
  name: string;
  aliases?: string[];
  /** One line, shown in suggestions. */
  description: string;
  /** e.g. "help" or "open <table> [query]" */
  usage?: string;
  run(ctx: CommandContext, args: string[]): Promise<void> | void;
}
