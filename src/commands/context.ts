import { isNextExperience, navigate, openTab } from '../content/navigation';
import type { SessionInfo } from '../shared/messages';
import { createSnApi } from '../shared/sn-api';
import type { CommandContext } from './types';

/** Builds the context for one command run. The palette supplies UI callbacks and the abort signal. */
export function createCommandContext(
  session: SessionInfo,
  ui: CommandContext['ui'],
  signal: AbortSignal,
): CommandContext {
  const instanceUrl = window.location.origin;
  return {
    instanceUrl,
    urlOptions: { origin: instanceUrl, nextExperience: isNextExperience() },
    session,
    api: createSnApi(session.token),
    signal,
    ui,
    openTab,
    navigate,
  };
}
