/** ServiceNow table and column names: a lowercase letter, then lowercase letters, digits and underscores. */
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

/**
 * True when `value` is a plain table or column name. The one definition of that shape:
 * it guards URLs, encoded queries and script source built from typed or page input.
 * A dot-walked field ("caller_id.name") is not an identifier.
 */
export function isIdentifier(value: string): boolean {
  return IDENTIFIER.test(value);
}
