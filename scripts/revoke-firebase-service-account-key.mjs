import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

function envValue(key) {
  const line = readFileSync(process.env.APG_ENV_FILE || 'server/.env', 'utf8')
    .split(/\r?\n/)
    .find(item => item.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() || '';
}

const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || envValue('FIREBASE_SERVICE_ACCOUNT') || '{}');
if (!credentials.client_email || !credentials.private_key || !credentials.private_key_id) {
  throw new Error('Firebase service-account key is missing or invalid.');
}

const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const input = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
  iss: credentials.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 600,
})}`;
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
const token = await tokenResponse.json();
if (!tokenResponse.ok || !token.access_token) throw new Error(`OAuth failed (${tokenResponse.status}).`);

const account = encodeURIComponent(credentials.client_email);
const keyId = encodeURIComponent(credentials.private_key_id);
const endpoint = `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${account}/keys/${keyId}`;
let accessToken = token.access_token;
let response = await fetch(endpoint, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (response.status === 403 && process.env.FIREBASE_CLI_CONFIG) {
  const cli = JSON.parse(readFileSync(process.env.FIREBASE_CLI_CONFIG, 'utf8'));
  accessToken = cli.tokens?.access_token || '';
  if (!accessToken) throw new Error('Firebase CLI access token is missing.');
  response = await fetch(endpoint, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
if (!response.ok) {
  const payload = await response.json().catch(() => ({}));
  throw new Error(`Firebase key revocation failed (${response.status}): ${payload.error?.status || 'request_failed'}`);
}

console.log(JSON.stringify({
  ok: true,
  revoked: true,
  serviceAccount: credentials.client_email,
  keyIdSuffix: credentials.private_key_id.slice(-8),
}));
