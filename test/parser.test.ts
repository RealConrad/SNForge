import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCommand } from '../src/commands/parser';

test('splits the name from its arguments', () => {
  assert.deepEqual(parseCommand(':br incident'), { name: 'br', args: ['incident'] });
});

test('the leading colon is optional and the name is lowercased', () => {
  assert.deepEqual(parseCommand('LANG de'), { name: 'lang', args: ['de'] });
});

test('double quotes keep spaces inside one argument', () => {
  assert.deepEqual(parseCommand(':open incident "a b" c'), { name: 'open', args: ['incident', 'a b', 'c'] });
});

test('an unterminated quote runs to the end of the input', () => {
  assert.deepEqual(parseCommand(':x "a b'), { name: 'x', args: ['a b'] });
});

test('arguments keep their case', () => {
  assert.deepEqual(parseCommand(':x Active=TRUE'), { name: 'x', args: ['Active=TRUE'] });
});

test('empty input is not a command', () => {
  assert.equal(parseCommand(''), null);
  assert.equal(parseCommand('  :  '), null);
});
