import fs from 'node:fs';
import { createSign, createHash } from 'node:crypto';

const outputPath = process.argv[2];
if (!outputPath) {
  console.error('Usage: FIREBASE_SERVICE_ACCOUNT=... node scripts/export-firestore-rest.mjs <output.json>');
  process.exit(2);
}

function envFileValue(key) {
  try {
    const line = fs.readFileSync(process.env.APG_ENV_FILE || 'server/.env', 'utf8')
      .split(/\r?\n/)
      .find(item => item.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : '';
  } catch {
    return '';
  }
}

const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || envFileValue('FIREBASE_SERVICE_ACCOUNT') || '{}');
if (!credentials.client_email || !credentials.private_key || !credentials.project_id) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is missing or invalid.');
}

const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = encode({ alg: 'RS256', typ: 'JWT' });
const claim = encode({
  iss: credentials.client_email,
  scope: 'https://www.googleapis.com/auth/datastore',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
});
const input = `${header}.${claim}`;
const signer = createSign('RSA-SHA256');
signer.update(input);
signer.end();
const assertion = `${input}.${signer.sign(credentials.private_key, 'base64url')}`;

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }),
});
const tokenPayload = await tokenResponse.json();
if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error(`OAuth failed: ${tokenPayload.error || tokenResponse.status}`);
const authorization = { Authorization: `Bearer ${tokenPayload.access_token}` };
const root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(credentials.project_id)}/databases/(default)/documents`;

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authorization, ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Firestore REST ${response.status}: ${payload.error?.message || 'request_failed'}`);
  return payload;
}

async function listCollectionIds(parentPath = '') {
  const ids = [];
  let pageToken = '';
  do {
    const endpoint = `${root}${parentPath ? `/${parentPath}` : ''}:listCollectionIds`;
    const payload = await request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageSize: 1000, ...(pageToken ? { pageToken } : {}) }),
    });
    ids.push(...(payload.collectionIds || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
  return ids.sort();
}

function decodeValue(value = {}) {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) {
    const number = Number(value.integerValue);
    return Number.isSafeInteger(number) ? number : value.integerValue;
  }
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return { __apg_timestamp__: value.timestampValue };
  if ('stringValue' in value) return value.stringValue;
  if ('bytesValue' in value) return { __apg_bytes__: value.bytesValue };
  if ('referenceValue' in value) return { __apg_reference__: value.referenceValue.split('/documents/')[1] || value.referenceValue };
  if ('geoPointValue' in value) return { __apg_geopoint__: value.geoPointValue };
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

const documents = [];
const collectionCounts = {};

async function mapLimit(items, limit, handler) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await handler(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function exportCollection(collectionPath) {
  let pageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: '1000', showMissing: 'false' });
    if (pageToken) params.set('pageToken', pageToken);
    const payload = await request(`${root}/${collectionPath}?${params}`);
    await mapLimit(payload.documents || [], 20, async document => {
      const path = document.name.split('/documents/')[1];
      documents.push({
        path,
        data: decodeFields(document.fields || {}),
        createTime: document.createTime || null,
        updateTime: document.updateTime || null,
      });
      const rootCollection = path.split('/')[0];
      collectionCounts[rootCollection] = (collectionCounts[rootCollection] || 0) + 1;
      for (const child of await listCollectionIds(path)) await exportCollection(`${path}/${child}`);
    });
    pageToken = payload.nextPageToken || '';
  } while (pageToken);
}

for (const collection of await listCollectionIds()) await exportCollection(collection);
documents.sort((left, right) => left.path.localeCompare(right.path));

const exportPayload = {
  format: 'apg-firestore-rest-export-v1',
  projectId: credentials.project_id,
  exportedAt: new Date().toISOString(),
  collectionCounts,
  documents,
};
const serialized = `${JSON.stringify(exportPayload)}\n`;
fs.writeFileSync(outputPath, serialized, { mode: 0o600 });
console.log(JSON.stringify({
  ok: true,
  outputPath,
  documents: documents.length,
  collectionCounts,
  sha256: createHash('sha256').update(serialized).digest('hex'),
}, null, 2));
