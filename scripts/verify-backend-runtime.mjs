import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

function readArg(name, fallback = '') {
  const key = `--${name}=`;
  const fromArg = process.argv.find((item) => item.startsWith(key));
  if (fromArg) return fromArg.slice(key.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function sha256(filePath) {
  const data = fs.readFileSync(filePath);
  return createHash('sha256').update(data).digest('hex');
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  return { ok: response.ok, status: response.status, payload, text };
}

function shellJson(cmd, args) {
  try {
    const raw = execFileSync(cmd, args, { encoding: 'utf8' });
    return JSON.parse(raw || '[]');
  } catch {
    return null;
  }
}

function normalizeDigest(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('sha256:')) return raw.slice(7);
  return raw;
}

const apiBase = readArg('api-base', process.env.APG_API_BASE_URL || process.env.APG_BACKEND_API_BASE || 'https://bbangqkf2d4pa9855lu0.containers.yandexcloud.net');
const expectedGit = readArg('expected-git', '').trim();
const containerName = readArg('container-name', 'apg-api');

const headGitLong = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const headGitShort = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
const expected = expectedGit || headGitLong;

const localTelegramPath = 'server/src/lib/telegramUpdates.js';
if (!fs.existsSync(localTelegramPath)) {
  console.log(JSON.stringify({
    ok: false,
    reason: `Local telegramUpdates file missing: ${localTelegramPath}`,
    headGit: headGitLong,
    headGitShort,
  }, null, 2));
  process.exit(1);
}
const localTelegramSha = sha256(localTelegramPath);

const runtimeUrl = `${apiBase.replace(/\/$/, '')}/version`;
const runtime = await fetchJson(runtimeUrl);

const containerRevisions = shellJson('yc', ['serverless', 'container', 'revision', 'list', '--container-name', containerName, '--format', 'json']) || [];
const latest = containerRevisions[0] || {};
const latestImage = latest.image || '';
const latestDigest = latest.environment?.IMAGE_DIGEST || '';

const runtimeImage = String(runtime.payload.image || '').trim();
const runtimeImageDigestNorm = normalizeDigest(runtimeImage.includes('@') ? runtimeImage.split('@').pop() : runtimeImage);
const revisionImageDigest = latestImage.includes('@sha256:') ? latestImage.split('@sha256:')[1] : '';

const checks = {
  headShaMatch: false,
  imageDigestMatch: false,
  telegramUpdatesMatch: false,
  runtimeImageMatch: false,
  runtimeGitMatch: false,
  revisionImageTagMatch: false,
};

if (!runtime.ok || !runtime.payload) {
  console.log(JSON.stringify({
    ok: false,
    headSha: headGitLong,
    headGitShort,
    runtime,
    checks,
    container: {
      name: containerName,
      latestImage,
      latestRevision: latest.id || '',
    },
    telegram: {
      localSha256: localTelegramSha,
      runtimeSha256: '',
    },
    reason: '/version endpoint not available',
  }, null, 2));
  process.exit(1);
}

const runtimeGit = String(runtime.payload.git || runtime.payload.appVersion || '').trim();
const runtimeTelegramSha = String(runtime.payload.telegramUpdatesSha256 || '').trim();

checks.headShaMatch = [headGitLong, headGitShort].includes(runtimeGit) || runtimeGit === expected;
checks.runtimeImageMatch = Boolean(
  latestImage && runtimeImage && (
    latestImage === runtimeImage || latestImage.includes(runtimeImage) || runtimeImage.includes(latestImage)
  )
);
checks.runtimeGitMatch = Boolean(
  expected && String(latest?.environment?.GIT_SHA || '').includes(expected.slice(0, 8))
);
checks.revisionImageTagMatch = Boolean(expected && latestImage.includes(expected.slice(0, 8)));
checks.telegramUpdatesMatch = Boolean(runtimeTelegramSha && runtimeTelegramSha === localTelegramSha);
checks.imageDigestMatch = Boolean(
  runtimeImageDigestNorm && normalizeDigest(latestDigest)
    ? runtimeImageDigestNorm === normalizeDigest(latestDigest)
    : revisionImageDigest === runtimeImageDigestNorm
);
if (!checks.imageDigestMatch && runtimeImageDigestNorm && latestImage.includes('@sha256:')) {
  checks.imageDigestMatch = runtimeImageDigestNorm === normalizeDigest(latestImage.split('@sha256:')[1] || '');
}

const summary = {
  ok: checks.headShaMatch && checks.telegramUpdatesMatch && checks.imageDigestMatch && checks.runtimeImageMatch && checks.runtimeGitMatch && checks.revisionImageTagMatch,
  head: {
    expectedGitLong: expected,
    expectedGitShort: headGitShort,
    runtimeGit,
  },
  runtime: {
    url: runtimeUrl,
    git: runtimeGit,
    image: runtimeImage,
    build: runtime.payload.build || '',
    appVersion: runtime.payload.appVersion || '',
    telegramUpdatesSha256: runtimeTelegramSha,
  },
  local: {
    git: headGitLong,
    gitShort: headGitShort,
    telegramUpdatesSha256: localTelegramSha,
  },
  checks,
  container: {
    name: containerName,
    latestId: latest.id || '',
    latestImage,
    latestStatus: latest.status || '',
    runningGit: latest?.environment?.GIT_SHA || '',
    runningAppVersion: latest?.environment?.APP_VERSION || '',
    runningImageDigest: latest?.environment?.IMAGE_DIGEST || '',
  },
  mismatch: {
    headSha: checks.headShaMatch ? '' : 'runtime git did not match HEAD',
    revisionGit: checks.runtimeGitMatch ? '' : 'container revision GIT_SHA does not match runtime expected git',
    revisionTag: checks.revisionImageTagMatch ? '' : 'container image tag does not include expected commit',
    telegram: checks.telegramUpdatesMatch ? '' : 'telegramUpdates.js sha mismatch',
    runtimeImage: checks.runtimeImageMatch ? '' : 'runtime image did not report current sha/digest',
    imageDigest: checks.imageDigestMatch ? '' : 'runtime image digest not found in latest revision image field',
  },
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) process.exit(1);
