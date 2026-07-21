import { createHash, createHmac } from 'crypto';
import { getDbAuth } from '../lib/firebase.js';
import { serverFoundation } from '../apg/index.js';

function verifyTelegramHash(data, botToken) {
  const { hash, ...rest } = data;
  const checkString = Object.keys(rest)
    .filter(k => rest[k] != null)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('\n');
  const secretKey = createHash('sha256').update(botToken).digest();
  const computed  = createHmac('sha256', secretKey).update(checkString).digest('hex');
  return computed === hash;
}

export default async function verifyTelegramRoutes(fastify) {
  fastify.post('/api/verify-telegram', async (request, reply) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return reply.code(500).send({ ok: false, error: 'server_misconfigured' });

    const { id, first_name, last_name, username, photo_url, auth_date, hash } = request.body ?? {};
    if (!id || !hash || !auth_date) {
      return reply.code(400).send({ ok: false, error: 'missing_fields' });
    }

    if (Date.now() / 1000 - Number(auth_date) > 86400) {
      return reply.code(400).send({ ok: false, error: 'auth_date_expired' });
    }

    const data = { id: String(id), first_name, auth_date: String(auth_date), hash };
    if (last_name)  data.last_name  = last_name;
    if (username)   data.username   = username;
    if (photo_url)  data.photo_url  = photo_url;

    if (!verifyTelegramHash(data, botToken)) {
      return reply.code(403).send({ ok: false, error: 'invalid_hash' });
    }

    const identity = await serverFoundation.identityV2.resolveTelegramIdentity({
      telegramId: String(id),
      createIfMissing: true,
      telegram: {
        firstName: first_name ?? null,
        lastName: last_name ?? null,
        username: username ?? null,
        photo: photo_url ?? null,
      },
    });
    const token = await getDbAuth().createCustomToken(identity.userId);
    const identityUser = identity.user || {};
    return {
      ok: true,
      token,
      user: {
        id: identity.userId,
        first_name: first_name || identityUser.firstName || identityUser.displayName || '',
        last_name: last_name || identityUser.lastName || '',
        photo_200: photo_url || identityUser.photo || null,
      },
    };
  });
}
