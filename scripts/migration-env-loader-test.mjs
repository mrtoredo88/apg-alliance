import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadMigrationEnv, runtimeSecretStatus } from './lib/migration-env-loader.mjs';

const TARGET_KEYS = ['APG_IDENTITY_DATABASE_URL', 'GOOGLE_APPLICATION_CREDENTIALS'];
const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
}

function clearTargetEnv() {
  for (const key of TARGET_KEYS) delete process.env[key];
}

function tempFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apg-migration-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, contents);
  return file;
}

function configuredCount(result) {
  return runtimeSecretStatus(TARGET_KEYS, result).filter(item => item.configured).length;
}

try {
  restoreEnv();
  clearTargetEnv();
  process.env.APG_IDENTITY_DATABASE_URL = 'postgresql://runtime.example/db';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/runtime/service-account.json';
  {
    const result = loadMigrationEnv({ files: [tempFile('')], override: false });
    const statuses = runtimeSecretStatus(TARGET_KEYS, result);
    assert.equal(result.loadedFromFileCount, 0);
    assert.equal(configuredCount(result), 2);
    assert.deepEqual(statuses.map(item => item.source), ['runtime', 'runtime']);
  }

  restoreEnv();
  clearTargetEnv();
  {
    const result = loadMigrationEnv({
      files: [tempFile([
        'APG_IDENTITY_DATABASE_URL=postgresql://file.example/db',
        'GOOGLE_APPLICATION_CREDENTIALS=/file/service-account.json',
      ].join('\n'))],
      override: false,
    });
    const statuses = runtimeSecretStatus(TARGET_KEYS, result);
    assert.equal(result.loadedFromFileCount, 2);
    assert.equal(configuredCount(result), 2);
    assert.deepEqual(statuses.map(item => item.source), ['file', 'file']);
  }

  restoreEnv();
  clearTargetEnv();
  process.env.APG_IDENTITY_DATABASE_URL = 'postgresql://runtime.example/db';
  {
    const result = loadMigrationEnv({
      files: [tempFile('GOOGLE_APPLICATION_CREDENTIALS=/file/service-account.json')],
      override: false,
    });
    const statuses = runtimeSecretStatus(TARGET_KEYS, result);
    assert.equal(configuredCount(result), 2);
    assert.deepEqual(statuses.map(item => item.source), ['runtime', 'file']);
  }

  restoreEnv();
  clearTargetEnv();
  {
    const result = loadMigrationEnv({ files: [tempFile('APG_IDENTITY_DATABASE_URL=postgresql://file.example/db')], override: false });
    const statuses = runtimeSecretStatus(TARGET_KEYS, result);
    assert.equal(configuredCount(result), 1);
    assert.equal(statuses.find(item => item.key === 'GOOGLE_APPLICATION_CREDENTIALS').source, 'missing');
  }

  restoreEnv();
  clearTargetEnv();
  process.env.APG_IDENTITY_DATABASE_URL = 'postgresql://runtime.example/db';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/runtime/service-account.json';
  {
    const result = loadMigrationEnv({ files: [tempFile('')], override: false });
    assert.equal(result.loadedFromFileCount, 0);
    assert.equal(configuredCount(result), 2);
  }

  console.log(JSON.stringify({
    ok: true,
    scenarios: [
      'runtime_only',
      'file_only',
      'mixed',
      'required_missing',
      'empty_file_runtime_complete',
    ],
    valuesPrinted: false,
  }, null, 2));
} finally {
  restoreEnv();
}
