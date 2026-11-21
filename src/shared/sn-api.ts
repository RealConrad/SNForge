/**
 * ServiceNow REST helper. Runs in the content script with relative URLs, so requests
 * only ever go to the current instance and the browser attaches the session cookie;
 * the CSRF token goes in X-UserToken.
 */

export type SnRecord = Record<string, unknown>;

export class SnApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SnApiError';
  }
}

export interface GetRecordsOptions {
  /** Encoded query, e.g. "active=true^priority=1". */
  query?: string;
  fields?: string[];
  limit?: number;
  signal?: AbortSignal;
}

export interface SnApi {
  getRecords(table: string, options?: GetRecordsOptions): Promise<SnRecord[]>;
  getRecord(table: string, sysId: string, options?: Omit<GetRecordsOptions, 'query' | 'limit'>): Promise<SnRecord | null>;
  /** Switches the current session to `language` (a sys_language id such as "de"). */
  setSessionLanguage(language: string, signal?: AbortSignal): Promise<void>;
}

function isRecord(value: unknown): value is SnRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Pulls ServiceNow's { error: { message, detail } } out of a failed response. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.error) && typeof body.error.message === 'string') {
      return body.error.message;
    }
  } catch {
    // Not JSON (e.g. an HTML error page).
  }
  return `${response.status} ${response.statusText}`.trim();
}

export function createSnApi(token: string): SnApi {
  /** Sends one request and returns the `result` of ServiceNow's { result: … } envelope. */
  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-UserToken': token },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw new SnApiError(response.status, await errorMessage(response));
    }
    const payload: unknown = await response.json();
    return isRecord(payload) ? payload.result : undefined;
  }

  async function getRecords(
    table: string,
    { query, fields, limit, signal }: GetRecordsOptions = {},
  ): Promise<SnRecord[]> {
    const params = new URLSearchParams({ sysparm_no_count: 'true' });
    if (query) {
      params.set('sysparm_query', query);
    }
    if (fields?.length) {
      params.set('sysparm_fields', fields.join(','));
    }
    if (limit !== undefined) {
      params.set('sysparm_limit', String(limit));
    }

    const result = await request(`/api/now/table/${encodeURIComponent(table)}?${params}`, { signal });
    if (!Array.isArray(result)) {
      throw new SnApiError(200, 'Unexpected response from the Table API');
    }
    return result.filter(isRecord);
  }

  async function getRecord(
    table: string,
    sysId: string,
    options: Omit<GetRecordsOptions, 'query' | 'limit'> = {},
  ): Promise<SnRecord | null> {
    // sys_id goes into an encoded query, so only accept the real format.
    if (!/^[0-9a-f]{32}$/.test(sysId)) {
      return null;
    }
    // Query instead of /table/{sys_id}: "not found" is an empty list, not a 404.
    const [record] = await getRecords(table, { ...options, query: `sys_id=${sysId}`, limit: 1 });
    return record ?? null;
  }

  /** The same endpoint ServiceNow's own language picker calls, so it applies to the live session. */
  async function setSessionLanguage(language: string, signal?: AbortSignal): Promise<void> {
    await request('/api/now/ui/concoursepicker/language', {
      method: 'PUT',
      body: JSON.stringify({ current: language }),
      signal,
    });
  }

  return { getRecords, getRecord, setSessionLanguage };
}
