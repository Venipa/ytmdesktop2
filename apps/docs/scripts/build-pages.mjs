import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { loadDocsEnv } from './load-docs-env.mjs';

loadDocsEnv();

process.env.GITHUB_PAGES = 'true';
// next.config derives basePath from NEXT_PUBLIC_URL (CI) or local fallback

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const build = spawnSync(process.execPath, [nextBin, 'build'], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd(),
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

writeFileSync(join(process.cwd(), 'out', '.nojekyll'), '');
