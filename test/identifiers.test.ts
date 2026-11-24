import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFormRowId } from '../src/content/form-rows';
import { messageOf } from '../src/shared/errors';
import { isIdentifier } from '../src/shared/identifiers';

test('isIdentifier accepts table and column names', () => {
  assert.equal(isIdentifier('incident'), true);
  assert.equal(isIdentifier('u_custom_table2'), true);
});

test('isIdentifier refuses anything else', () => {
  for (const value of ['', 'Incident', '1table', 'caller_id.name', 'a-b', 'a b', 'a"b', '../x']) {
    assert.equal(isIdentifier(value), false, value);
  }
});

test('parseFormRowId reads table and field', () => {
  assert.deepEqual(parseFormRowId('element.incident.short_description'), {
    table: 'incident',
    field: 'short_description',
  });
});

test('parseFormRowId keeps a dot-walked field whole', () => {
  assert.deepEqual(parseFormRowId('element.incident.caller_id.name'), { table: 'incident', field: 'caller_id.name' });
});

test('parseFormRowId refuses ids that are not a form row', () => {
  for (const id of ['', 'element.incident', 'label.incident.number', 'element.inc"ident.number', 'element.incident.a b']) {
    assert.equal(parseFormRowId(id), undefined, id);
  }
});

test('messageOf', () => {
  assert.equal(messageOf(new Error('boom')), 'boom');
  assert.equal(messageOf('plain'), 'plain');
});
