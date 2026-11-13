import { ACCESS } from '../config';
import type { SessionInfo } from '../shared/messages';
import { getSession } from './bridge-client';

let accessPromise: Promise<boolean> | undefined;

function hasRequiredRoles(roles: string[]): boolean {
  const matches = ACCESS.requiredRoles.map((role) => roles.includes(role));
  return ACCESS.match === 'all' ? matches.every(Boolean) : matches.some(Boolean);
}

async function lookupRoles(session: SessionInfo): Promise<string[]> {
  const query = ACCESS.requiredRoles.map((role) => `user=${session.userSysId}^role.name=${role}`).join('^OR');
  const params = new URLSearchParams({
    sysparm_query: query,
    sysparm_fields: 'sys_id,role.name',
    sysparm_limit: String(ACCESS.requiredRoles.length),
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

  return payload.result.flatMap((record: unknown) => {
    if (typeof record !== 'object' || record === null) {
      return [];
    }

    if ('role.name' in record && typeof record['role.name'] === 'string') {
      return [record['role.name']];
    }

    if (!('role' in record)) {
      return [];
    }
    const role = record.role;
    if (typeof role === 'object' && role !== null && 'name' in role && typeof role.name === 'string') {
      return [role.name];
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
    return hasRequiredRoles(await lookupRoles(session));
  } catch {
    return false;
  }
}

export function isAccessAllowed(): Promise<boolean> {
  accessPromise ??= checkAccess();
  return accessPromise;
}
