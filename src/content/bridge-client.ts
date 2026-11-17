import { BRIDGE_TIMEOUT_MS } from '../config';
import {
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  isBridgeResponse,
  type BridgeRequest,
  type SessionInfo,
} from '../shared/messages';

export class BridgeTimeoutError extends Error {
  constructor() {
    super('The page bridge did not respond');
    this.name = 'BridgeTimeoutError';
  }
}

/**
 * Asks the page bridge for the current session.
 * Resolves `null` when the page has no logged-in user; rejects with
 * `BridgeTimeoutError` when the bridge does not answer in time.
 */
export function getSession(): Promise<SessionInfo | null> {
  const id = crypto.randomUUID();
  const request: BridgeRequest = { id, type: 'bridge/getSession' };

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
      reject(new BridgeTimeoutError());
    }, BRIDGE_TIMEOUT_MS);

    function onResponse(event: Event): void {
      const response: unknown = event instanceof CustomEvent ? event.detail : undefined;
      if (!isBridgeResponse(response) || response.id !== id) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
      resolve(response.session);
    }

    window.addEventListener(BRIDGE_RESPONSE_EVENT, onResponse);
    window.dispatchEvent(new CustomEvent(BRIDGE_REQUEST_EVENT, { detail: request }));
  });
}
