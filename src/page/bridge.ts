import type { BridgeRequest, BridgeResponse, SessionInfo } from '../shared/messages';

interface ServiceNowUser {
  userName?: unknown;
  userID?: unknown;
  userId?: unknown;
  sys_id?: unknown;
  roles?: unknown;
  hasRoleExactly?: (role: string) => boolean;
  hasRole?: (role: string) => boolean;
}

interface ServiceNowPage extends Window {
  g_user?: ServiceNowUser;
  NOW?: { user?: ServiceNowUser };
  g_ck?: unknown;
}

function getPageCandidates(): ServiceNowPage[] {
  const pages: ServiceNowPage[] = [window as ServiceNowPage];

  for (let index = 0; index < window.frames.length; index += 1) {
    try {
      const frame = window.frames[index] as ServiceNowPage;
      void frame.document;
      pages.push(frame);
    } catch {
      // Ignore cross-origin frames; their globals are not available to the bridge.
    }
  }

  return pages;
}

function getRoles(user: ServiceNowUser): string[] {
  let roles: string[] = [];
  if (Array.isArray(user.roles)) {
    roles = user.roles.filter((role): role is string => typeof role === 'string');
  } else if (typeof user.roles === 'string') {
    roles = user.roles.split(',').map((role) => role.trim()).filter(Boolean);
  }

  try {
    if ((user.hasRoleExactly?.('admin') || user.hasRole?.('admin')) && !roles.includes('admin')) {
      roles.push('admin');
    }
  } catch {
    // Keep any explicit role list if the page's role helper is unavailable.
  }

  return roles;
}

function readSession(): SessionInfo | null {
  const pages = getPageCandidates();
  const pageWithUser = pages.find((candidate) => {
    const user = candidate.g_user ?? candidate.NOW?.user;
    return typeof (user?.userID ?? user?.userId ?? user?.sys_id) === 'string';
  });
  const user = pageWithUser?.g_user ?? pageWithUser?.NOW?.user;
  const userSysId = user?.userID ?? user?.userId ?? user?.sys_id;

  if (!user || typeof userSysId !== 'string') {
    return null;
  }

  const token = pages.find((candidate) => typeof candidate.g_ck === 'string')?.g_ck;
  const roles = getRoles(user);

  return {
    userName: typeof user.userName === 'string' ? user.userName : '',
    userSysId,
    roles,
    token: typeof token === 'string' ? token : '',
  };
}

window.addEventListener('snforge:req', (event: Event) => {
  const request = (event as CustomEvent<BridgeRequest>).detail;
  if (!request || request.type !== 'bridge/getSession') {
    return;
  }

  const response: BridgeResponse = {
    id: request.id,
    type: 'bridge/session',
    session: readSession(),
  };
  window.dispatchEvent(new CustomEvent('snforge:res', { detail: response }));
});
