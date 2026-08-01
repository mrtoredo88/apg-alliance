import { Preferences } from '@capacitor/preferences';

const PREFIX = 'apg.native.cache.v2';
const SCHEMA = 2;
const DEFAULT_TTL = { profile: 6 * 60 * 60_000, dialogs: 5 * 60_000, news: 30 * 60_000 };
const SENSITIVE = /token|secret|password|cookie|authorization|otp|session/i;

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SENSITIVE.test(key)).map(([key, item]) => [key, sanitize(item)]));
}

function key(userId, bucket) { return `${PREFIX}:${encodeURIComponent(userId)}:${bucket}`; }

export async function writeOfflineCache(bucket, userId, data, ttlMs = DEFAULT_TTL[bucket]) {
  if (!userId || !DEFAULT_TTL[bucket]) return;
  await Preferences.set({ key: key(userId, bucket), value: JSON.stringify({ schema: SCHEMA, userId, savedAt: Date.now(), ttlMs, data: sanitize(data) }) });
}

export async function readOfflineCache(bucket, userId) {
  const { value } = await Preferences.get({ key: key(userId, bucket) });
  if (!value) return null;
  try {
    const row = JSON.parse(value);
    if (row.schema !== SCHEMA || row.userId !== userId) return null;
    return { data: row.data, stale: Date.now() - row.savedAt > row.ttlMs, savedAt: row.savedAt };
  } catch { return null; }
}

export async function staleWhileRevalidate(bucket, userId, fetcher, onFresh) {
  const cached = await readOfflineCache(bucket, userId);
  const refresh = Promise.resolve().then(fetcher).then(async data => {
    await writeOfflineCache(bucket, userId, data);
    onFresh?.(data);
    return data;
  });
  if (cached) refresh.catch(() => {});
  return { cached, refresh };
}

export async function clearOfflineCache(userId) {
  await Promise.all(Object.keys(DEFAULT_TTL).map(bucket => Preferences.remove({ key: key(userId, bucket) })));
}
