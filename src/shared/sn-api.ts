/**
 * ServiceNow REST helper. Runs in the content script with relative URLs, so requests
 * only ever go to the current instance and the browser attaches the session cookie;
 * the CSRF token goes in X-UserToken.
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

/** GlideRecord flags for a forced update. Both default to false (normal behaviour). */
export interface ForceUpdateOptions {
  /** setWorkflow(false): skip business rules, flows and notifications. */
  skipBusinessRules?: boolean;
  /** autoSysFields(false): leave sys_updated_on / sys_updated_by as they are. */
  keepSystemFields?: boolean;
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
   * Writes one field by running a GlideRecord update as a background script, which
   * ignores ACLs and read-only, so it can set fields the Table API refuses. Returns the
   * value the record has afterwards (read back over REST), for the caller to compare.
   * This runs server-side script as the user; only call it on an explicit user action.
   */
  forceUpdateField(
    table: string,
    sysId: string,
    field: string,
    value: string,
    options?: ForceUpdateOptions,
    signal?: AbortSignal,
  ): Promise<unknown>;
  /** Switches the current session to `language` (a sys_language id such as "de"). */
  setSessionLanguage(language: string, signal?: AbortSignal): Promise<void>;
}

/** Scripts - Background processor. Not a REST API, but same-origin, so the cookie + CSRF token are enough. */
const SCRIPT_ENDPOINT = '/sys.scripts.do';

/** Table and field names in script source must be plain identifiers. */
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

/**
 * A GlideRecord update, as background-script source. Every value goes in through
 * JSON.stringify, so a value with quotes or newlines is a safe JS string literal and
 * can't extend the script.
 */
function buildUpdateScript(table: string, sysId: string, field: string, value: string, options: ForceUpdateOptions): string {
  const lines = [`var gr = new GlideRecord(${JSON.stringify(table)});`, `if (gr.get(${JSON.stringify(sysId)})) {`];
  if (options.skipBusinessRules) {
    lines.push('  gr.setWorkflow(false);');
  }
  if (options.keepSystemFields) {
    lines.push('  gr.autoSysFields(false);');
  }
  lines.push(`  gr.setValue(${JSON.stringify(field)}, ${JSON.stringify(value)});`, '  gr.update();', '}');
  return lines.join('\n');
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
  /** Sends one request and returns the parsed JSON body. Throws SnApiError on a failed status. */
  async function send(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-UserToken': token },
      credentials: 'same-origin',
    });
    if (!response.ok) {
      throw new SnApiError(response.status, await errorMessage(response));
    }
    return response.json();
  }

  /** Like send(), but returns the `result` of ServiceNow's { result: … } envelope. */
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const payload = await send(path, init);
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
      body: JSON.stringify({
        batch_request_id: 'snforge-find',
        rest_requests: tables.map((table, index) => ({
          id: String(index),
          method: 'GET',
          url: recordsPath(table, bySysId(sysId, fields)),
          headers: [{ name: 'Accept', value: 'application/json' }],
        })),
      }),
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
    const record = await request(path, { method: 'PATCH', body: JSON.stringify({ [field]: value }), signal });
    return isRecord(record) ? record[field] : undefined;
  }

  /**
   * Runs `script` through Scripts - Background and returns the raw HTML response. The
   * output isn't parsed (its shape varies by version); callers confirm the effect some
   * other way. Form-encoded with the CSRF token, so it is not a REST call and skips send().
   */
  async function runBackgroundScript(script: string, signal?: AbortSignal): Promise<string> {
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
    return response.text();
  }

  async function forceUpdateField(
    table: string,
    sysId: string,
    field: string,
    value: string,
    options: ForceUpdateOptions = {},
    signal?: AbortSignal,
  ): Promise<unknown> {
    // table and field are built into script source, so only accept the identifier shape.
    if (!IDENTIFIER.test(table) || !IDENTIFIER.test(field) || !isSysId(sysId)) {
      throw new SnApiError(400, 'Invalid table, field or sys_id');
    }
    await runBackgroundScript(buildUpdateScript(table, sysId, field, value, options), signal);
    // The script's HTML output is unreliable; read the field back to see what stuck.
    const record = await getRecord(table, sysId, { fields: [field], signal });
    return record ? record[field] : undefined;
  }

  /** The same endpoint ServiceNow's own language picker calls, so it applies to the live session. */
  async function setSessionLanguage(language: string, signal?: AbortSignal): Promise<void> {
    await request('/api/now/ui/concoursepicker/language', {
      method: 'PUT',
      body: JSON.stringify({ current: language }),
      signal,
    });
  }

  return { getRecords, getRecord, findInTables, updateField, forceUpdateField, setSessionLanguage };
}
