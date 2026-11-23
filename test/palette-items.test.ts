import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerBuiltins } from '../src/commands/builtin';
import { MAX_SUGGESTIONS, SUGGESTED_INPUTS } from '../src/config';
import { buildItems, type ItemActions } from '../src/content/ui/palette-items';

registerBuiltins();

/** Actions that record what was called, e.g. "run :find abc". */
function recorder(): { actions: ItemActions; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    actions: {
      runCommand: (input) => calls.push(`run ${input}`),
      completeCommand: (command) => calls.push(`complete ${command.name}`),
      runTableShortcut: (shortcut) => calls.push(`table ${shortcut.table}${shortcut.newTab ? ' (new tab)' : ''}`),
    },
  };
}

const titles = (input: string): string[] => buildItems(input, recorder().actions).map((item) => item.title);

test('empty input lists the suggested inputs', () => {
  assert.deepEqual(titles(''), SUGGESTED_INPUTS.slice(0, MAX_SUGGESTIONS));
});

test('a command prefix lists the command first and the table shortcut last', () => {
  const items = titles('nam');
  assert.equal(items[0], ':names');
  assert.equal(items.at(-1), 'Open list: nam');
});

test('an alias finds its command', () => {
  assert.equal(titles('studio')[0], ':st');
});

test('an exact command name runs on accept; a partial one completes', () => {
  const exact = recorder();
  buildItems(':help', exact.actions)[0]?.accept();
  assert.deepEqual(exact.calls, ['run :help']);

  const partial = recorder();
  buildItems('hel', partial.actions)[0]?.accept();
  assert.deepEqual(partial.calls, ['complete help']);
});

test('a sys_id is the only item and runs :find', () => {
  const { actions, calls } = recorder();
  const items = buildItems(' 6816F79CC0A8016401C5A33BE04BE441 ', actions);
  assert.equal(items.length, 1);
  items[0]?.accept();
  assert.deepEqual(calls, ['run :find 6816f79cc0a8016401c5a33be04be441']);
});

test('an uppercase table name opens in a new tab', () => {
  const { actions, calls } = recorder();
  const item = buildItems('INCIDENT', actions).at(-1);
  assert.equal(item?.hint, 'new tab');
  item?.accept();
  assert.deepEqual(calls, ['table incident (new tab)']);
});

test('the list is capped, and the table shortcut keeps its place at the end', () => {
  const items = titles('s');
  assert.ok(items.length <= MAX_SUGGESTIONS);
  assert.equal(items.at(-1), 'Open list: s');
});

test('no duplicate titles', () => {
  const items = titles('n');
  assert.equal(new Set(items).size, items.length);
});

test('an unknown :command has no items', () => {
  assert.deepEqual(titles(':nope'), []);
});
