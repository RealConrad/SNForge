import { ACCESS } from '../config';
import type { SessionInfo } from '../shared/messages';
import { createSnApi } from '../shared/sn-api';
import { BridgeTimeoutError, getSession } from './bridge-client';

let accessPromise: Promise<boolean> | undefined;

export function hasRequiredRoles(roles: readonly string[]): boolean {
  const has = (role: string): boolean => roles.includes(role);
  return ACCESS.match === 'all' ? ACCESS.requiredRoles.every(has) : ACCESS.requiredRoles.some(has);
}

/** Fallback: read the user's roles from sys_user_has_role. */
async function lookupRoles(session: SessionInfo): Promise<string[]> {
  const records = await createSnApi(session.token).getRecords('sys_user_has_role', {
    query: `user=${session.userSysId}^role.nameIN${ACCESS.requiredRoles.join(',')}`,
    fields: ['role.name'],
  });
  // Dot-walked fields come back flat: { "role.name": "admin" }.
  return records.flatMap((record) => (typeof record['role.name'] === 'string' ? [record['role.name']] : []));
}

async function checkAccess(): Promise<boolean> {
  const session = await getSession();
  if (!session) {
    return false;
  }

  if (hasRequiredRoles(session.roles)) {
    return true;
  }

  try {
    return hasRequiredRoles([...session.roles, ...await lookupRoles(session)]);
  } catch {
    return false;
  }
}

/**
 * Resolves whether the current user may use SNForge. This is the ONLY permission check:
 * once it passes, every palette feature is available. The answer is cached for the page
 * lifetime, except when the bridge timed out — then the next call retries.
 */
export function isAccessAllowed(): Promise<boolean> {
  accessPromise ??= checkAccess().catch((error: unknown) => {
    if (error instanceof BridgeTimeoutError) {
      accessPromise = undefined;
    }
    return false;
  });
  return accessPromise;
}
