import { ACCESS } from '../config';
import type { SessionInfo } from '../shared/messages';
import { createSnApi } from '../shared/sn-api';
import { getSession } from './bridge-client';

/**
 * - granted:     the user has the required role(s); the palette may open.
 * - denied:      the user is logged in but lacks the role(s).
 * - unavailable: no session could be read (not logged in, or the bridge didn't answer).
 */
export type Access = 'granted' | 'denied' | 'unavailable';

let accessPromise: Promise<Access> | undefined;
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

async function checkAccess(): Promise<Access> {
  const user = await getSession();
  // No token (g_ck not found on the page) means every REST call would be rejected, so
  // that is "no usable session" too, not a palette whose commands all fail.
  if (!user?.token) {
    return 'unavailable';
  }

  const allowed =
    hasRequiredRoles(user.roles) || hasRequiredRoles([...user.roles, ...(await lookupRoles(user))]);
  if (!allowed) {
    return 'denied';
  }
  session = user;
  return 'granted';
}

/**
 * Resolves whether the current user may use SNForge. This is the ONLY permission check:
 * once it is granted, every palette feature is available. The answer is cached for the
 * page lifetime once it is granted or denied. 'unavailable' is not cached: the page may
 * simply not have finished loading its session yet, so the next call checks again.
 */
export function getAccess(): Promise<Access> {
  accessPromise ??= checkAccess()
    .catch((): Access => 'unavailable') // the bridge timed out
    .then((access) => {
      if (access === 'unavailable') {
        accessPromise = undefined;
      }
      return access;
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
