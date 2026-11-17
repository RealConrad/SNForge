import { watch as watchFile } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');

/** Files copied verbatim into dist/ (source → destination). */
const STATIC_FILES = [
  ['manifest.json', 'dist/manifest.json'],
  ['src/popup/popup.html', 'dist/popup.html'],
  ['src/popup/popup.css', 'dist/popup.css'],
  ['src/shared/themes.css', 'dist/themes.css'],
];

const common = {
  bundle: true,
  target: 'chrome120',
  sourcemap: watch,
  logLevel: 'info',
  loader: { '.css': 'text' },
};

const builds = [
  { ...common, entryPoints: ['src/background/service-worker.ts'], outfile: 'dist/background.js', format: 'esm' },
  { ...common, entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js', format: 'iife' },
  { ...common, entryPoints: ['src/page/bridge.ts'], outfile: 'dist/bridge.js', format: 'iife' },
  { ...common, entryPoints: ['src/popup/popup.ts'], outfile: 'dist/popup.js', format: 'iife' },
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await Promise.all(STATIC_FILES.map(([from, to]) => cp(from, to)));

if (watch) {
  // esbuild only watches bundled sources, so watch static files separately.
  for (const [from, to] of STATIC_FILES) {
    watchFile(from, () => {
      cp(from, to).catch((error) => console.error(`Failed to copy ${from}:`, error));
    });
  }
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((buildContext) => buildContext.watch()));
} else {
  await Promise.all(builds.map((options) => build(options)));
}
