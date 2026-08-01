const API_ROOT = 'https://vkpns.rustore.ru/v1/projects';

function config() {
  const projectId = String(process.env.RUSTORE_PUSH_PROJECT_ID || '').trim();
  const serviceToken = String(process.env.RUSTORE_PUSH_SERVICE_TOKEN || '').trim();
  if (!projectId || !serviceToken) throw Object.assign(new Error('RuStore Push is not configured'), { code: 'RUSTORE_PUSH_NOT_CONFIGURED' });
  return { projectId, serviceToken };
}

export function isDeadRuStoreToken(error = {}) {
  return error.status === 404 || ['NOT_FOUND', 'UNREGISTERED', 'INVALID_ARGUMENT'].includes(String(error.code || ''));
}

export async function sendRuStorePush(token, { title, body = '', deepLink = '/', channelId = 'updates', ttlSeconds = 21600, data = {} } = {}) {
  const { projectId, serviceToken } = config();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_ROOT}/${encodeURIComponent(projectId)}/messages:send`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${serviceToken}` },
      body: JSON.stringify({
        message: {
          token,
          data: Object.fromEntries(Object.entries({ ...data, deepLink }).map(([key, value]) => [key, String(value ?? '')])),
          notification: { title: String(title), body: String(body) },
          android: {
            ttl: `${Math.max(1, Number(ttlSeconds) || 21600)}s`,
            notification: { title: String(title), body: String(body), channel_id: channelId, click_action: `myapg://${String(deepLink).replace(/^\//, '')}`, click_action_type: 1 },
          },
        },
      }),
    });
    if (response.ok) return { ok: true };
    const payload = await response.json().catch(() => ({}));
    const error = Object.assign(new Error(String(payload.error?.message || response.statusText || 'RuStore push failed').slice(0, 240)), { status: response.status, code: payload.error?.status || `HTTP_${response.status}` });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
