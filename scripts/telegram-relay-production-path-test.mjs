import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync(new URL('../cloudflare/telegram-relay/src/index.js', import.meta.url), 'utf8');
const config = readFileSync(new URL('../cloudflare/telegram-relay/wrangler.jsonc', import.meta.url), 'utf8');

assert.match(worker, /timingSafeEqual/, 'relay compares secrets in constant time');
assert.match(worker, /stage: 'update_received'[\s\S]*stage: 'webhook_handled'/, 'relay emits a correlation trace');
assert.match(worker, /x-telegram-bot-api-secret-token[\s\S]*BACKEND_SECRET/, 'relay authenticates Telegram and backend hops');
assert.match(worker, /x-apg-relay-secret[\s\S]*RELAY_SECRET/, 'Telegram proxy requires the backend relay secret');
assert.match(worker, /ALLOWED_TELEGRAM_METHODS = new Set\(\['sendMessage'\]\)/, 'relay exposes only the required Telegram method');
assert.doesNotMatch(worker, /console\.(?:log|error)\([^\n]*(?:message\.chat\.id|TELEGRAM_BOT_TOKEN)/, 'relay logs no raw chat id or bot token');
assert.match(config, /"secrets"[\s\S]*"TELEGRAM_BOT_TOKEN"[\s\S]*"RELAY_SECRET"/, 'deployment requires all relay secrets');
assert.match(config, /"observability"[\s\S]*"head_sampling_rate": 1/, 'production Worker logs are enabled');

console.log('telegram-relay-production-path PASS');
