import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env, ...options });
  if (result.status !== 0) process.exit(result.status || 1);
}

const base = process.env.APG_RELEASE_BASE || 'HEAD^';
const changed = spawnSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`], { encoding: 'utf8' });
if (changed.status !== 0) process.exit(changed.status || 1);
const lintFiles = changed.stdout.split('\n').filter(file => /\.(js|jsx|mjs)$/.test(file));
if (lintFiles.length) run('npx', ['eslint', '--report-unused-disable-directives', '--max-warnings', '0', ...lintFiles]);
run('npm', ['run', 'build']);
const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4175'], {
  stdio: 'ignore',
  env: process.env,
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
    ready = await fetch('http://127.0.0.1:4175', { signal: AbortSignal.timeout(1000) }).then(response => response.ok).catch(() => false);
    if (ready) break;
  }
  if (!ready) throw new Error('Local preview did not start for browser quality scanner');
  run('npm', ['run', 'quality:browser']);
} finally {
  preview.kill('SIGTERM');
}
fs.mkdirSync('dist/quality', { recursive: true });
fs.copyFileSync('.quality/latest.json', 'dist/quality/latest.json');
console.log('APG release gate: PASS');
