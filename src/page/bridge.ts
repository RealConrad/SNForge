import { ACCESS } from '../config';
import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  isBridgeRequest,
  type BridgeResponse,
  type SessionInfo,
} from '../shared/messages';

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
  __snforgeBridge?: boolean;
}

/** The top window plus any same-origin frames (e.g. gsft_main in UI16). */
function getPageCandidates(): ServiceNowPage[] {
  const pages: ServiceNowPage[] = [window];

  for (let index = 0; index < window.frames.length; index += 1) {
    try {
      const frame: ServiceNowPage | undefined = window.frames[index];
      if (frame) {
        void frame.document; // throws for cross-origin frames
        pages.push(frame);
      }
    } catch {
      // Cross-origin frames' globals are not available to the bridge.
    }
  }

  return pages;
}

function getUser(page: ServiceNowPage): ServiceNowUser | undefined {
  return page.g_user ?? page.NOW?.user;
}

function getUserSysId(user: ServiceNowUser): string | undefined {
  const id = user.userID ?? user.userId ?? user.sys_id;
  return typeof id === 'string' ? id : undefined;
}

function getRoles(user: ServiceNowUser): string[] {
  let roles: string[] = [];
  if (Array.isArray(user.roles)) {
    roles = user.roles.filter((role): role is string => typeof role === 'string');
  } else if (typeof user.roles === 'string') {
    roles = user.roles.split(',').map((role) => role.trim()).filter(Boolean);
  }

  // Some UIs omit the role list; the role helpers still know. Only the roles the gate
  // asks for (config.ts) are checked.
  for (const role of ACCESS.requiredRoles) {
    try {
      // hasRole() says yes to an admin for any role, so it is only trusted for admin itself.
      const has = user.hasRoleExactly?.(role) ?? (role === 'admin' && user.hasRole?.(role));
      if (has && !roles.includes(role)) {
        roles.push(role);
      }
    } catch {
      // Keep the explicit role list if the page's role helper throws.
    }
  }

  return roles;
}

function readSession(): SessionInfo | null {
  const pages = getPageCandidates();
  const user = pages.map(getUser).find((candidate) => candidate && getUserSysId(candidate));
  const userSysId = user && getUserSysId(user);
  if (!user || !userSysId) {
    return null;
  }

  const token = pages.map((page) => page.g_ck).find((value) => typeof value === 'string');

  return {
    userName: typeof user.userName === 'string' ? user.userName : '',
    userSysId,
    roles: getRoles(user),
    token: typeof token === 'string' ? token : '',
  };
}

function onRequest(event: Event): void {
  const request: unknown = event instanceof CustomEvent ? event.detail : undefined;
  if (!isBridgeRequest(request)) {
    return;
  }

  const response: BridgeResponse = {
    id: request.id,
    type: 'bridge/session',
    session: readSession(),
  };
  window.dispatchEvent(new CustomEvent(BRIDGE_RESPONSE_EVENT, { detail: response }));
}

// The service worker may inject the bridge into a tab that already has it.
const page: ServiceNowPage = window;
if (!page.__snforgeBridge) {
  page.__snforgeBridge = true;
  window.addEventListener(BRIDGE_REQUEST_EVENT, onRequest);
}
