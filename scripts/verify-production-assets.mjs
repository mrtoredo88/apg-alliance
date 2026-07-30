/* global process */

const baseUrl = new URL(process.argv[2] || process.env.APG_ASSET_VERIFY_URL || 'https://myapg.ru/');
const queue = [new URL(`/index.html?asset-verify=${Date.now()}`, baseUrl).toString()];
const visited = new Set();
const failures = [];
const assetPattern = /(?:src|href)=["']([^"']+\.(?:js|css))["']|(?:from\s*|import\s*\()["']([^"']+\.js)["']/g;

async function fetchWithRetry(url) {
  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetch(url, { cache: 'no-store' }).catch(() => null);
    if (response?.ok) return response;
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 800));
  }
  return response;
}

while (queue.length) {
  const url = queue.shift();
  if (visited.has(url)) continue;
  visited.add(url);
  const response = await fetchWithRetry(url);
  if (!response?.ok) {
    failures.push({ url, status: response?.status || 0 });
    continue;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text') && !contentType.includes('javascript')) continue;
  const source = await response.text();
  for (const match of source.matchAll(assetPattern)) {
    const reference = match[1] || match[2];
    if (!reference || reference.startsWith('data:')) continue;
    const assetUrl = new URL(reference, url).toString();
    if (new URL(assetUrl).origin === baseUrl.origin && !visited.has(assetUrl)) queue.push(assetUrl);
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, checked: visited.size, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checked: visited.size, origin: baseUrl.origin }, null, 2));
