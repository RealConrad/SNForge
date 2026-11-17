/**
 * ServiceNow Table API helper. Runs in the content script with relative URLs, so the
 * browser attaches the session cookie; the CSRF token goes in X-UserToken.
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

    const response = await fetch(`/api/now/table/${encodeURIComponent(table)}?${params}`, {
      headers: { Accept: 'application/json', 'X-UserToken': token },
      credentials: 'same-origin',
      signal,
    });
    if (!response.ok) {
      throw new SnApiError(response.status, await errorMessage(response));
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.result)) {
      throw new SnApiError(response.status, 'Unexpected response from the Table API');
    }
    return payload.result.filter(isRecord);
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

  return { getRecords, getRecord };
}
