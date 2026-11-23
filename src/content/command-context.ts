import type { CommandContext } from '../commands/types';
import { createSnApi } from '../shared/sn-api';
import { grantedSession } from './access';
import { toggleFieldEdit } from './field-edit';
import { toggleFieldNames } from './field-names';
import { loadFoundTables, rememberFoundTable } from './found-tables';
import { isNextExperience, navigate, openTab } from './navigation';

/**
 * Builds the context for one command run. The palette supplies UI callbacks and the abort signal.
 *
 * This is where commands get wired to the page and to chrome.*; it lives in content/ so
 * that nothing in commands/ has to import from content/.
 */
export function createCommandContext(ui: CommandContext['ui'], signal: AbortSignal): CommandContext {
  return {
    urlOptions: { origin: window.location.origin, nextExperience: isNextExperience() },
    currentPath: window.location.pathname + window.location.search,
    signal,
    ui,
    api: createSnApi(grantedSession().token),
    openTab,
    navigate,
    page: { toggleFieldNames, toggleFieldEdit },
    storage: {
      foundTables: { load: loadFoundTables, remember: rememberFoundTable },
    },
  };
}
