import { build } from 'esbuild';
import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Test files are plain TypeScript exercising the pure logic modules (no
// JXA/ObjC globals involved), so they run under Node directly — unlike
// scripts/build.mjs's `platform: 'neutral'` workflow bundles, these are
// bundled for Node and never shipped to Alfred.
const testFiles = globSync('src/**/*.test.ts');

if (testFiles.length === 0) {
  console.log('No test files found (src/**/*.test.ts).');
  process.exit(0);
}

const outdir = '.test-build';

await build({
  entryPoints: testFiles,
  outdir,
  outbase: 'src',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
});

// `node --test <dir>` only auto-discovers files when no path is given at
// all; an explicit directory arg is treated as a single module to load
// (and fails). So glob the built output ourselves.
const compiledTestFiles = globSync(`${outdir}/**/*.test.mjs`);

const result = spawnSync(process.execPath, ['--test', ...compiledTestFiles], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
