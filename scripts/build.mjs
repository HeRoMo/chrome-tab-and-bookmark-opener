import { context, build } from 'esbuild';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: {
    main: 'src/index.ts',
    open: 'src/index-open.ts',
    revalidate: 'src/index-revalidate.ts',
  },
  bundle: true,
  outdir: 'workflow',
  format: 'iife',
  // Each entry exports a `run` function, but osascript/JXA invokes `run`
  // as a *global* identifier — it has no idea about ES module exports.
  // globalName + footer bridges the two: esbuild assigns the module's
  // exports to `App`, and the footer promotes `App.run` to a real global.
  globalName: 'App',
  footer: { js: 'globalThis.run = App.run;' },
  // 'neutral' (not 'node') deliberately excludes Node built-in resolution,
  // so importing fs/path/child_process etc. fails at build time instead of
  // silently producing a bundle that breaks under osascript at runtime.
  platform: 'neutral',
  target: 'es2021',
  banner: { js: '#!/usr/bin/osascript -l JavaScript' },
  logOverride: { 'unsupported-require-call': 'error' },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Watching for changes... (Ctrl+C to stop)');
} else {
  await build(options);
  console.log('Build complete: workflow/main.js, workflow/open.js, workflow/revalidate.js');
}
