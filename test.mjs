/**
 * Runs the unit tests in test/ (`npm test`).
 *
 * The sources import each other without file extensions, which Node can't resolve on its
 * own, so each test file is first bundled with esbuild (already a dev dependency) and
 * the bundles are run with Node's built-in test runner. Nothing else is needed.
 *
 * Tests are bundled, not typechecked: tsconfig.json only covers src/.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

/** Bundled tests; in .gitignore. Not under node_modules: the test runner refuses to run files from there. */
const OUT = '.test-build';

const entryPoints = readdirSync('test')
  .filter((file) => file.endsWith('.test.ts'))
  .map((file) => `test/${file}`);

await rm(OUT, { recursive: true, force: true });
await build({
  entryPoints,
  outdir: OUT,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: 'inline',
  loader: { '.css': 'text' },
  logLevel: 'warning',
});

const bundles = readdirSync(OUT)
  .filter((file) => file.endsWith('.test.mjs'))
  .map((file) => `${OUT}/${file}`);

const run = spawnSync(process.execPath, ['--test', '--enable-source-maps', ...bundles], { stdio: 'inherit' });
process.exit(run.status ?? 1);
