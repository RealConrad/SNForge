import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasRequiredRoles } from '../src/content/access';
import { buildUpdateScript } from '../src/content/force-update';

const SYS_ID = '6816f79cc0a8016401c5a33be04be441';

test('builds a plain GlideRecord update', () => {
  assert.equal(
    buildUpdateScript('incident', SYS_ID, 'priority', '2'),
    [
      'var gr = new GlideRecord("incident");',
      `if (gr.get("${SYS_ID}")) {`,
      '  gr.setValue("priority", "2");',
      '  gr.update();',
      '}',
    ].join('\n'),
  );
});

test('the flags add setWorkflow / autoSysFields', () => {
  const script = buildUpdateScript('incident', SYS_ID, 'priority', '2', {
    skipBusinessRules: true,
    keepSystemFields: true,
  });
  assert.match(script, /gr\.setWorkflow\(false\);/);
  assert.match(script, /gr\.autoSysFields\(false\);/);
});

test('a value cannot break out of its string literal', () => {
  const value = '"); gs.eventQueue("x"); //\nmore';
  const script = buildUpdateScript('incident', SYS_ID, 'short_description', value);
  assert.ok(script.includes(`gr.setValue("short_description", ${JSON.stringify(value)});`));
  // Still five lines: the newline in the value did not become a line of script.
  assert.equal(script.split('\n').length, 5);
});

test('refuses a table, field or sys_id that is not the expected shape', () => {
  assert.throws(() => buildUpdateScript('incident"); x(', SYS_ID, 'priority', '2'));
  assert.throws(() => buildUpdateScript('incident', SYS_ID, 'caller_id.name', '2'));
  assert.throws(() => buildUpdateScript('incident', 'not-a-sys-id', 'priority', '2'));
});

test('hasRequiredRoles: the admin role opens the gate', () => {
  assert.equal(hasRequiredRoles(['itil', 'admin']), true);
  assert.equal(hasRequiredRoles(['itil']), false);
  assert.equal(hasRequiredRoles([]), false);
});
