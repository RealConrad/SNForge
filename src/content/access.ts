import { ACCESS } from '../config';
import type { SessionInfo } from '../shared/messages';
import { BridgeTimeoutError, getSession } from './bridge-client';

let accessPromise: Promise<boolean> | undefined;

export function hasRequiredRoles(roles: readonly string[]): boolean {
  const has = (role: string): boolean => roles.includes(role);
  return ACCESS.match === 'all' ? ACCESS.requiredRoles.every(has) : ACCESS.requiredRoles.some(has);
}

/** Fallback: read the user's roles from sys_user_has_role. */
async function lookupRoles(session: SessionInfo): Promise<string[]> {
  const params = new URLSearchParams({
    sysparm_query: `user=${session.userSysId}^role.nameIN${ACCESS.requiredRoles.join(',')}`,
    sysparm_fields: 'role.name',
  });

  const response = await fetch(`/api/now/table/sys_user_has_role?${params}`, {
    headers: {
      Accept: 'application/json',
      'X-UserToken': session.token,
    },
    credentials: 'same-origin',
  });
  if (!response.ok) {
    return [];
  }

  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null || !('result' in payload) || !Array.isArray(payload.result)) {
    return [];
  }

  // Dot-walked fields come back flat: { "role.name": "admin" }.
  return payload.result.flatMap((record: unknown) => {
    if (typeof record === 'object' && record !== null && 'role.name' in record && typeof record['role.name'] === 'string') {
      return [record['role.name']];
    }
    return [];
  });
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
 * Resolves whether the current user may use SNForge. The answer is cached for the
 * page lifetime, except when the bridge timed out — then the next call retries.
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
