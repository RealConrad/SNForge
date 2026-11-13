export type RuntimeMessage = { type: 'palette/toggle' };

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
