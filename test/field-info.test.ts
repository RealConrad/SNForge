import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aclNames,
  fieldUrls,
  hierarchyOf,
  nearestEntry,
  typeText,
  type FieldInfo,
  type FieldUrls,
} from '../src/content/field-info';

const SYS_ID = '6816f79cc0a8016401c5a33be04be441';
const USER_ID = '5137153cc611227c000bbd1bd8cd2005';
const URLS = { origin: 'https://dev.service-now.com', nextExperience: false };

const info = (overrides: Partial<FieldInfo> = {}): FieldInfo => ({
  table: 'incident',
  field: 'priority',
  sysId: SYS_ID,
  hierarchy: ['incident', 'task'],
  mandatory: false,
  readOnly: false,
  ...overrides,
});

/** Which pages exist for the field, e.g. ['acls', 'history']. */
const pages = (overrides?: Partial<FieldInfo>): string[] => Object.keys(fieldUrls(info(overrides), URLS)).sort();
const urlOf = (page: keyof FieldUrls, overrides?: Partial<FieldInfo>): string =>
  decodeURIComponent(fieldUrls(info(overrides), URLS)[page] ?? '');

test('hierarchyOf lists the table, then its parents nearest first', () => {
  const record = { 'super_class.name': 'cmdb_ci_computer', 'super_class.super_class.name': 'cmdb_ci', 'super_class.super_class.super_class.name': '' };
  assert.deepEqual(hierarchyOf('cmdb_ci_server', record), ['cmdb_ci_server', 'cmdb_ci_computer', 'cmdb_ci']);
});

test('hierarchyOf is just the table when nothing is known or a name looks wrong', () => {
  assert.deepEqual(hierarchyOf('incident', undefined), ['incident']);
  assert.deepEqual(hierarchyOf('incident', { 'super_class.name': 'task^x=1' }), ['incident']);
});

test('nearestEntry prefers the entry on the nearest table', () => {
  const onTask = { name: 'task', sys_id: 'a' };
  const onIncident = { name: 'incident', sys_id: 'b' };
  assert.equal(nearestEntry([onTask, onIncident], ['incident', 'task']), onIncident);
  assert.equal(nearestEntry([onTask], ['incident', 'task']), onTask);
  assert.equal(nearestEntry([], ['incident', 'task']), undefined);
});

test('typeText', () => {
  assert.equal(typeText(info({ type: 'string', maxLength: '160' })), 'string (160)');
  assert.equal(typeText(info({ type: 'reference', reference: 'sys_user', maxLength: '32' })), 'reference → sys_user');
  assert.equal(typeText(info()), undefined);
});

test('aclNames covers the field, the table wildcards and the row rules, along the hierarchy', () => {
  assert.deepEqual(aclNames(['incident', 'task'], 'category'), [
    'incident.category',
    'task.category',
    '*.category',
    'incident.*',
    'task.*',
    '*.*',
    'incident',
    'task',
    '*',
  ]);
});

test('a plain saved field has ACLs and history', () => {
  assert.deepEqual(pages(), ['acls', 'history']);
  assert.ok(urlOf('acls').includes('sys_security_acl_list.do?sysparm_query=nameINincident.priority,task.priority,*.priority,incident.*'));
  assert.ok(urlOf('history').includes('tablename=incident^documentkey=' + SYS_ID + '^fieldname=priority'));
});

test('dictionary, choices and the referenced record have pages when known', () => {
  assert.deepEqual(pages({ dictionaryId: SYS_ID, choices: 'dropdown' }), ['acls', 'choices', 'dictionary', 'history']);
  assert.equal(urlOf('dictionary', { dictionaryId: SYS_ID }), `${URLS.origin}/sys_dictionary.do?sys_id=${SYS_ID}`);
  assert.ok(urlOf('choices', { choices: 'suggestion' }).includes('nameINincident,task^element=priority'));
  assert.equal(
    urlOf('record', { field: 'caller_id', reference: 'sys_user', value: USER_ID }),
    `${URLS.origin}/sys_user.do?sys_id=${USER_ID}`,
  );
});

test('an empty reference has no record to open', () => {
  assert.ok(!pages({ reference: 'sys_user', value: '' }).includes('record'));
});

test('a new record has no history', () => {
  assert.deepEqual(pages({ sysId: undefined }), ['acls']);
});

test('a dot-walked field has no per-column pages', () => {
  assert.deepEqual(pages({ field: 'caller_id.name' }), []);
});
