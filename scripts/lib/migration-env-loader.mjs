import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_ENV_FILES = [
  'server/.env',
  '.env.local',
  '.env',
];

function parseEnvLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;
  let value = match[2] || '';
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key: match[1], value };
}

export function loadMigrationEnv({ files = DEFAULT_ENV_FILES, override = false } = {}) {
  const loaded = [];
  const skipped = [];
  const missing = [];
  const sources = {};

  for (const file of files) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) {
      missing.push(file);
      continue;
    }
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    let keyCount = 0;
    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      keyCount += 1;
      if (!override && process.env[parsed.key]) {
        skipped.push({ key: parsed.key, source: file, reason: 'already_configured' });
        continue;
      }
      process.env[parsed.key] = parsed.value;
      loaded.push({ key: parsed.key, source: file });
      sources[parsed.key] = file;
    }
    if (!keyCount) missing.push(`${file}:empty`);
  }

  return {
    ok: true,
    files,
    loaded: loaded.map(item => ({ key: item.key, source: item.source })),
    skipped,
    missing,
    sources,
    redacted: true,
  };
}

export function secretStatus(keys, sources = {}) {
  return keys.map(key => ({
    key,
    status: process.env[key] ? 'FOUND' : 'MISSING',
    source: sources[key] || (process.env[key] ? 'process.env' : 'unknown'),
  }));
}
