/** ServiceNow sys_ids are 32 lowercase hex characters. */
const SYS_ID = /^[0-9a-f]{32}$/;

export function isSysId(value: string): boolean {
  return SYS_ID.test(value);
}
