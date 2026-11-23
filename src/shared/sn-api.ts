/**
 * ServiceNow REST helper. Runs in the content script with relative URLs, so requests
 * only ever go to the current instance and the browser attaches the session cookie;
 * the CSRF token goes in X-UserToken.
 *
 * Only general-purpose calls live here. What one feature does with them (the script
 * :edit runs, the endpoint :lang calls) is kept next to that feature.
 */

import { isSysId } from './sys-id';

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

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Sent as JSON. */
  body?: unknown;
  signal?: AbortSignal;
}

/** Where a record was found: the table that was asked, and the record itself. */
export interface FoundRecord {
  table: string;
  record: SnRecord;
}

export interface SnApi {
  getRecords(table: string, options?: GetRecordsOptions): Promise<SnRecord[]>;
  getRecord(table: string, sysId: string, options?: Omit<GetRecordsOptions, 'query' | 'limit'>): Promise<SnRecord | null>;
  /**
   * Looks for `sysId` in every one of `tables` with a single request (Batch API) and
   * returns the first table that has it, or null. Tables that don't exist or can't be
   * read count as "not found".
   */
  findInTables(
    tables: readonly string[],
    sysId: string,
    options?: Omit<GetRecordsOptions, 'query' | 'limit'>,
  ): Promise<FoundRecord | null>;
  /**
   * Writes one field of one record and returns the value the record has afterwards.
   * ServiceNow answers 200 even when an ACL or business rule discarded the change, so
   * callers compare the returned value with what they asked for.
   */
  updateField(table: string, sysId: string, field: string, value: string, signal?: AbortSignal): Promise<unknown>;
  /**
   * Any other JSON endpoint of the instance: sends the request and returns the `result`
   * of ServiceNow's { result: … } envelope. `path` is a path on this instance
   * ("/api/…"); anything else is refused.
   */
  request(path: string, options?: RequestOptions): Promise<unknown>;
  /**
   * Runs `script` on the server through Scripts - Background, as the user. It ignores
   * ACLs, so only call it on an explicit user action and never with source built by
   * concatenating page input. The HTML output isn't returned (its shape varies by
   * version); callers confirm the effect some other way.
   */
  runBackgroundScript(script: string, signal?: AbortSignal): Promise<void>;
}

/** Scripts - Background processor. Not a REST API, but same-origin, so the cookie + CSRF token are enough. */
const SCRIPT_ENDPOINT = '/sys.scripts.do';

/**
 * A path on this instance: one leading slash. "//host/…" and "/\host/…" would be read
 * as another host, and the request (with the session token) would go there.
 */
const INSTANCE_PATH = /^\/(?![/\\])/;

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

/** Table API path + query for a read, e.g. "/api/now/table/incident?sysparm_query=…". */
function recordsPath(table: string, { query, fields, limit }: Omit<GetRecordsOptions, 'signal'>): string {
  // Without the reference link a reference field is its plain sys_id, not { link, value }.
  const params = new URLSearchParams({ sysparm_no_count: 'true', sysparm_exclude_reference_link: 'true' });
  if (query) {
    params.set('sysparm_query', query);
  }
  if (fields?.length) {
    params.set('sysparm_fields', fields.join(','));
  }
  if (limit !== undefined) {
    params.set('sysparm_limit', String(limit));
  }
  return `/api/now/table/${encodeURIComponent(table)}?${params}`;
}

/**
 * Read options for "the record with this sys_id".
 *
 * sys_id is always fetched, because the answer must be checked: on a table where the
 * sys_id condition can't be applied, ServiceNow ignores it and returns some other row
 * instead of nothing. Callers compare record.sys_id before trusting the record.
 */
function bySysId(sysId: string, fields?: string[]): Omit<GetRecordsOptions, 'signal'> {
  return { query: `sys_id=${sysId}`, fields: fields && ['sys_id', ...fields], limit: 1 };
}

/** The records in a Table API response body ({ result: [...] }). */
function recordsIn(body: unknown): SnRecord[] {
  return isRecord(body) && Array.isArray(body.result) ? body.result.filter(isRecord) : [];
}

/**
 * The JSON in one Batch API answer's base64 body. Undefined when it isn't valid
 * base64 + JSON: one table's broken answer must not end a search across many tables.
 */
function decodeBatchBody(body: string): unknown {
  try {
    return JSON.parse(atob(body));
  } catch {
    return undefined;
  }
}

export function createSnApi(token: string): SnApi {
  /** Sends one JSON request and returns the parsed JSON body. Throws SnApiError on a failed status. */
  async function send(path: string, { method, body, signal }: RequestOptions = {}): Promise<unknown> {
    if (!INSTANCE_PATH.test(path)) {
      throw new SnApiError(400, 'Refusing to send a request outside this instance');
    }
    const response = await fetch(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-UserToken': token },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw new SnApiError(response.status, await errorMessage(response));
    }
    return response.json();
  }

  /** Like send(), but returns the `result` of ServiceNow's { result: … } envelope. */
  async function request(path: string, options?: RequestOptions): Promise<unknown> {
    const payload = await send(path, options);
    return isRecord(payload) ? payload.result : undefined;
  }

  async function getRecords(table: string, { signal, ...options }: GetRecordsOptions = {}): Promise<SnRecord[]> {
    const result = await request(recordsPath(table, options), { signal });
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
    if (!isSysId(sysId)) {
      return null;
    }
    // Query instead of /table/{sys_id}: "not found" is an empty list, not a 404.
    const [record] = await getRecords(table, { ...bySysId(sysId, options.fields), signal: options.signal });
    return record?.sys_id === sysId ? record : null;
  }

  /**
   * The Batch API runs many REST calls on the server from one HTTP request. Each answer
   * comes back with its own status and a base64-encoded body.
   */
  async function findInTables(
    tables: readonly string[],
    sysId: string,
    { fields, signal }: Omit<GetRecordsOptions, 'query' | 'limit'> = {},
  ): Promise<FoundRecord | null> {
    if (!isSysId(sysId)) {
      return null;
    }

    const payload = await send('/api/now/v1/batch', {
      method: 'POST',
      body: {
        batch_request_id: 'snforge-find',
        rest_requests: tables.map((table, index) => ({
          id: String(index),
          method: 'GET',
          url: recordsPath(table, bySysId(sysId, fields)),
          headers: [{ name: 'Accept', value: 'application/json' }],
        })),
      },
      signal,
    });

    if (!isRecord(payload) || !Array.isArray(payload.serviced_requests)) {
      throw new SnApiError(200, 'Unexpected response from the Batch API');
    }
    // ServiceNow lists calls it ran out of time for here; reporting "not found" would be wrong.
    if (Array.isArray(payload.unserviced_requests) && payload.unserviced_requests.length > 0) {
      throw new SnApiError(200, 'ServiceNow did not finish the search. Try again.');
    }

    for (const answer of payload.serviced_requests) {
      // Any other status (table missing, no access) means "not found here".
      if (!isRecord(answer) || answer.status_code !== 200 || typeof answer.body !== 'string') {
        continue;
      }
      const table = tables[Number(answer.id)];
      const [record] = recordsIn(decodeBatchBody(answer.body));
      if (table && record?.sys_id === sysId) {
        return { table, record };
      }
    }
    return null;
  }

  async function updateField(
    table: string,
    sysId: string,
    field: string,
    value: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const params = new URLSearchParams({ sysparm_fields: field, sysparm_exclude_reference_link: 'true' });
    const path = `/api/now/table/${encodeURIComponent(table)}/${encodeURIComponent(sysId)}?${params}`;
    const record = await request(path, { method: 'PATCH', body: { [field]: value }, signal });
    return isRecord(record) ? record[field] : undefined;
  }

  /** Form-encoded with the CSRF token, so it is not a REST call and skips send(). */
  async function runBackgroundScript(script: string, signal?: AbortSignal): Promise<void> {
    const response = await fetch(SCRIPT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-UserToken': token },
      body: new URLSearchParams({ script, sysparm_ck: token, runscript: 'Run script' }).toString(),
      credentials: 'same-origin',
      signal,
    });
    if (!response.ok) {
      throw new SnApiError(response.status, `Could not run the background script (${response.status}).`);
    }
  }

  return { getRecords, getRecord, findInTables, updateField, request, runBackgroundScript };
}
