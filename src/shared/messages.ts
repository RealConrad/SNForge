/** Name of the `chrome.commands` entry in manifest.json. */
export const TOGGLE_PALETTE_COMMAND = 'toggle-palette';

/** CustomEvent names used between the content script and the page bridge. */
export const BRIDGE_REQUEST_EVENT = 'snforge:req';
export const BRIDGE_RESPONSE_EVENT = 'snforge:res';

/** Service worker → content script. */
export type PaletteToggleMessage = { type: 'palette/toggle' };

/** Content script → service worker: open `url` in a new tab next to the sender's. */
export type TabOpenMessage = { type: 'tab/open'; url: string; active?: boolean };

export type RuntimeMessage = PaletteToggleMessage | TabOpenMessage;

export interface SessionInfo {
  userName: string;
  userSysId: string;
  roles: string[];
  token: string;
}

export type BridgeRequest = { id: string; type: 'bridge/getSession' };

export type BridgeResponse = {
  id: string;
  type: 'bridge/session';
  session: SessionInfo | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isPaletteToggleMessage(value: unknown): value is PaletteToggleMessage {
  return isRecord(value) && value.type === 'palette/toggle';
}

export function isTabOpenMessage(value: unknown): value is TabOpenMessage {
  return isRecord(value) &&
    value.type === 'tab/open' &&
    typeof value.url === 'string' &&
    (value.active === undefined || typeof value.active === 'boolean');
}

export function isBridgeRequest(value: unknown): value is BridgeRequest {
  return isRecord(value) && value.type === 'bridge/getSession' && typeof value.id === 'string';
}

function isSessionInfo(value: unknown): value is SessionInfo {
  return isRecord(value) &&
    typeof value.userName === 'string' &&
    typeof value.userSysId === 'string' &&
    typeof value.token === 'string' &&
    isStringArray(value.roles);
}

export function isBridgeResponse(value: unknown): value is BridgeResponse {
  return isRecord(value) &&
    value.type === 'bridge/session' &&
    typeof value.id === 'string' &&
    (value.session === null || isSessionInfo(value.session));
}
