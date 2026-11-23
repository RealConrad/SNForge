import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTableShortcut, tableShortcutUrl } from '../src/commands/table-shortcut';
import { tableOfPage } from '../src/commands/table-link';
import { classicPageUrl, instanceUrl, isNextExperiencePath } from '../src/commands/urls';

const ORIGIN = 'https://dev.service-now.com';
const CLASSIC = { origin: ORIGIN, nextExperience: false };
const NEXT = { origin: ORIGIN, nextExperience: true };

test('instanceUrl builds URLs on the instance', () => {
  assert.equal(instanceUrl('/now/flow-designer', ORIGIN), `${ORIGIN}/now/flow-designer`);
});

test('instanceUrl refuses paths that lead to another host', () => {
  assert.throws(() => instanceUrl('//evil.example/x', ORIGIN));
  assert.throws(() => instanceUrl('/\\evil.example/x', ORIGIN));
  assert.throws(() => instanceUrl('https://evil.example/x', ORIGIN));
});

test('classicPageUrl wraps the page only under Next Experience', () => {
  assert.equal(classicPageUrl('/incident.do?sys_id=-1', CLASSIC), `${ORIGIN}/incident.do?sys_id=-1`);
  assert.equal(
    classicPageUrl('/incident.do?sys_id=-1', NEXT),
    `${ORIGIN}/now/nav/ui/classic/params/target/incident.do%3Fsys_id%3D-1`,
  );
});

test('isNextExperiencePath', () => {
  assert.equal(isNextExperiencePath('/now/nav/ui/home'), true);
  assert.equal(isNextExperiencePath('/incident.do'), false);
});

test('a bare table name is its list in the current tab', () => {
  assert.deepEqual(parseTableShortcut('incident'), { table: 'incident', view: 'list', query: '', newTab: false });
});

test('uppercase in the first word means new tab; the query keeps its case', () => {
  assert.deepEqual(parseTableShortcut('INCIDENT.new short_description=Hello World'), {
    table: 'incident',
    view: 'new',
    query: 'short_description=Hello World',
    newTab: true,
  });
});

test('input that is not a table shortcut', () => {
  assert.equal(parseTableShortcut(''), null);
  assert.equal(parseTableShortcut(':help'), null);
  assert.equal(parseTableShortcut('incident.bogus'), null);
  assert.equal(parseTableShortcut('incident.list.new'), null);
  assert.equal(parseTableShortcut('1table'), null);
  assert.equal(parseTableShortcut('../x'), null);
});

test('tableShortcutUrl for each view', () => {
  const url = (input: string): string => {
    const shortcut = parseTableShortcut(input);
    assert.ok(shortcut);
    return tableShortcutUrl(shortcut, CLASSIC);
  };
  assert.equal(url('incident'), `${ORIGIN}/incident_list.do`);
  assert.equal(url('incident active=true'), `${ORIGIN}/incident_list.do?sysparm_query=active%3Dtrue`);
  assert.equal(url('incident.filter'), `${ORIGIN}/incident_list.do?sysparm_filter_only=true`);
  assert.equal(url('incident.new'), `${ORIGIN}/incident.do?sys_id=-1`);
  assert.equal(url('incident.do'), `${ORIGIN}/incident.do?sys_id=-1`);
});

test('tableOfPage reads the table of a classic form or list', () => {
  assert.equal(tableOfPage('/incident.do?sys_id=abc'), 'incident');
  assert.equal(tableOfPage('/sys_script_list.do'), 'sys_script');
});

test('tableOfPage looks inside the Next Experience shell and the UI16 frame', () => {
  assert.equal(tableOfPage('/now/nav/ui/classic/params/target/incident_list.do%3Fx%3D1'), 'incident');
  assert.equal(tableOfPage('/nav_to.do?uri=%2Fincident.do%3Fsys_id%3Dabc'), 'incident');
});

test('tableOfPage is undefined on pages that are not a table', () => {
  assert.equal(tableOfPage('/now/flow-designer'), undefined);
  assert.equal(tableOfPage('/nav_to.do'), undefined);
  assert.equal(tableOfPage('/navpage.do'), undefined);
  assert.equal(tableOfPage('/home.do'), undefined);
  assert.equal(tableOfPage('/now/nav/ui/classic/params/target/%E0%A4%A'), undefined);
});
