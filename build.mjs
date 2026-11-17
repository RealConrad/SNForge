import { cp, mkdir, rm } from 'node:fs/promises';
import { context } from 'esbuild';

const watch = process.argv.includes('--watch');

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('manifest.json', 'dist/manifest.json');
await cp('src/popup/popup.html', 'dist/popup.html');

const common = {
  bundle: true,
  target: 'chrome120',
  sourcemap: watch,
  logLevel: 'info',
};

const builds = [
  {
    ...common,
    entryPoints: ['src/background/service-worker.ts'],
    outfile: 'dist/background.js',
    format: 'esm',
  },
  {
    ...common,
    entryPoints: ['src/content/index.ts'],
    outfile: 'dist/content.js',
    format: 'iife',
    loader: { '.css': 'text' },
  },
  {
    ...common,
    entryPoints: ['src/page/bridge.ts'],
    outfile: 'dist/bridge.js',
    format: 'iife',
  },
  {
    ...common,
    entryPoints: ['src/popup/popup.ts'],
    outfile: 'dist/popup.js',
    format: 'iife',
    loader: { '.css': 'text' },
  },
];

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((buildContext) => buildContext.watch()));
} else {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((buildContext) => buildContext.rebuild()));
  await Promise.all(contexts.map((buildContext) => buildContext.dispose()));
}
