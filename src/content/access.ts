import { ACCESS } from '../config';
import type { SessionInfo } from '../shared/messages';
import { createSnApi } from '../shared/sn-api';
import { BridgeTimeoutError, getSession } from './bridge-client';

let accessPromise: Promise<boolean> | undefined;
/** The session that passed the gate; commands use its token for REST calls. */
let session: SessionInfo | undefined;

export function hasRequiredRoles(roles: readonly string[]): boolean {
  const has = (role: string): boolean => roles.includes(role);
  return ACCESS.match === 'all' ? ACCESS.requiredRoles.every(has) : ACCESS.requiredRoles.some(has);
}

/** Fallback when the page doesn't expose the roles: read them from sys_user_has_role. */
async function lookupRoles(user: SessionInfo): Promise<string[]> {
  try {
    const records = await createSnApi(user.token).getRecords('sys_user_has_role', {
      query: `user=${user.userSysId}^role.nameIN${ACCESS.requiredRoles.join(',')}`,
      fields: ['role.name'],
    });
    // Dot-walked fields come back flat: { "role.name": "admin" }.
    return records.flatMap((record) => (typeof record['role.name'] === 'string' ? [record['role.name']] : []));
  } catch {
    return []; // a failed lookup grants nothing
  }
}

async function checkAccess(): Promise<boolean> {
  const user = await getSession();
  if (!user) {
    return false;
  }

  const allowed =
    hasRequiredRoles(user.roles) || hasRequiredRoles([...user.roles, ...(await lookupRoles(user))]);
  if (allowed) {
    session = user;
  }
  return allowed;
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

/** The session that passed the gate. The palette only opens after that, so commands can rely on it. */
export function grantedSession(): SessionInfo {
  if (!session) {
    throw new Error('No ServiceNow session: the access check has not passed');
  }
  return session;
}
