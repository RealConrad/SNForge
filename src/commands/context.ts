import { grantedSession } from '../content/access';
import { toggleFieldNames } from '../content/field-names';
import { isNextExperience, navigate, openTab } from '../content/navigation';
import { createSnApi } from '../shared/sn-api';
import type { CommandContext } from './types';

/** Builds the context for one command run. The palette supplies UI callbacks and the abort signal. */
export function createCommandContext(ui: CommandContext['ui'], signal: AbortSignal): CommandContext {
  return {
    urlOptions: { origin: window.location.origin, nextExperience: isNextExperience() },
    currentPath: window.location.pathname + window.location.search,
    signal,
    ui,
    api: createSnApi(grantedSession().token),
    openTab,
    navigate,
    toggleFieldNames,
  };
}
