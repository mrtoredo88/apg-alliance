const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const ALLOWED_TELEGRAM_METHODS = new Set(['sendMessage']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function sameSecret(left, right) {
  if (!left || !right) return false;
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(left))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(right))),
  ]);
  return crypto.subtle.timingSafeEqual(leftHash, rightHash);
}

async function shortHash(value) {
  if (value == null) return null;
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function handleWebhook(request, env) {
  const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!await sameSecret(suppliedSecret, env.WEBHOOK_SECRET)) return json({ ok: false }, 401);

  const update = await request.json().catch(() => null);
  if (!update || !Number.isSafeInteger(Number(update.update_id))) return json({ ok: false }, 400);

  const updateId = Number(update.update_id);
  const correlationId = `tg-${updateId}-${crypto.randomUUID().slice(0, 8)}`;
  const chatIdHash = await shortHash(update?.message?.chat?.id);
  const startedAt = Date.now();
  console.log(JSON.stringify({ stage: 'update_received', updateId, correlationId, chatIdHash }));

  const backendResponse = await fetch(env.BACKEND_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': env.BACKEND_SECRET,
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(update),
  }).catch(error => {
    console.error(JSON.stringify({
      stage: 'backend_failed', updateId, correlationId,
      latencyMs: Date.now() - startedAt,
      errorCode: error?.name || 'FETCH_FAILED',
    }));
    return null;
  });

  if (!backendResponse?.ok) {
    console.error(JSON.stringify({
      stage: 'backend_failed', updateId, correlationId,
      latencyMs: Date.now() - startedAt,
      errorCode: backendResponse ? `HTTP_${backendResponse.status}` : 'FETCH_FAILED',
    }));
    return json({ ok: false }, 502);
  }

  console.log(JSON.stringify({
    stage: 'webhook_handled', updateId, correlationId,
    latencyMs: Date.now() - startedAt,
  }));
  return json({ ok: true });
}

async function handleTelegramProxy(request, env, method) {
  if (!await sameSecret(request.headers.get('x-apg-relay-secret'), env.RELAY_SECRET)) {
    return json({ ok: false }, 401);
  }
  if (!ALLOWED_TELEGRAM_METHODS.has(method)) return json({ ok: false }, 404);

  const upstream = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': request.headers.get('content-type') || 'application/json' },
    body: await request.arrayBuffer(),
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'apg-telegram-relay' });
    }
    if (request.method !== 'POST') return json({ ok: false }, 405);
    if (url.pathname === '/webhook') return handleWebhook(request, env);
    if (url.pathname.startsWith('/telegram/')) {
      return handleTelegramProxy(request, env, url.pathname.slice('/telegram/'.length));
    }
    return json({ ok: false }, 404);
  },
};
