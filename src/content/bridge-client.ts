import type { BridgeRequest, BridgeResponse, SessionInfo } from '../shared/messages';

export function getSession(): Promise<SessionInfo | null> {
  const id = crypto.randomUUID();
  const request: BridgeRequest = { id, type: 'bridge/getSession' };

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('snforge:res', onResponse);
      resolve(null);
    }, 2_000);

    function onResponse(event: Event): void {
      const response = (event as CustomEvent<BridgeResponse>).detail;
      if (!response || response.id !== id || response.type !== 'bridge/session') {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener('snforge:res', onResponse);
      resolve(response.session);
    }

    window.addEventListener('snforge:res', onResponse);
    window.dispatchEvent(new CustomEvent('snforge:req', { detail: request }));
  });
}
