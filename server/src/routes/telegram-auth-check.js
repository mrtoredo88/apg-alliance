import { getDb } from '../lib/firebase.js';
import { pollTelegramUpdates } from '../lib/telegramUpdates.js';
import { serverFoundation } from '../apg/index.js';

function safeString(value, max = 220) {
  return String(value ?? '').trim().slice(0, max);
}

function buildTelegramAuthDiagnostics(source = {}) {
  return {
    stage: source.stage || 'unknown',
    state: source.state || null,
    requestId: source.requestId || null,
    loginSessionId: source.loginSessionId || null,
    telegramSessionId: source.telegramSessionId || source.state || null,
    elapsedMs: source.startAt ? Date.now() - source.startAt : null,
    note: source.note || null,
    identityV2Attempted: source.identityV2Attempted === true,
    identityResolved: source.identityResolved || null,
    identitySource: source.identitySource || null,
    identityPath: source.identityPath || null,
    apgUserId: source.apgUserId || null,
    telegramIdentityId: source.telegramIdentityId || null,
    customTokenIssued: source.customTokenIssued === true,
  };
}

function resolveTelegramOwnerForResponse(data = {}) {
  const ownerUserId = safeString(data.ownerUserId || '', 220);
  const linkedOwnerId = safeString(data.linkedOwnerId || '', 220);
  return {
    ownerUserId,
    linkedOwnerId,
    resolvedOwnerId: linkedOwnerId || ownerUserId || null,
  };
}

function buildLinkedTelegramPayload(data = {}, tgId = null) {
  return {
    tgId: tgId || null,
    firstName: safeString(data.firstName || data.first_name || '', 200) || null,
    lastName: safeString(data.lastName || data.last_name || '', 200) || null,
    username: safeString(data.username || data.telegramUsername || '', 200) || null,
    photo: safeString(data.photoUrl || data.photo_200 || data.photo || '', 280) || null,
    linkedAt: data.completedAt || null,
  };
}

export default async function telegramAuthCheckRoutes(fastify) {
  fastify.get('/api/telegram-auth-check', async (request, reply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');

    const { state } = request.query;
    const requestId = safeString(request.headers['x-request-id'] || request.query?.requestId, 180);
    const loginSessionId = safeString(request.query?.loginSessionId, 220);
    const telegramSessionId = safeString(request.query?.telegramSessionId, 220);
    if (!state) return reply.code(400).send({ status: 'error' });

    const db  = getDb();
    const ref = db.collection('telegramAuthSessions').doc(state);
    const startAt = Date.now();
    const trace = { state, requestId, loginSessionId, telegramSessionId, startAt };

    request.log.info?.({
      stage: 'telegram_auth_check_start',
      state,
      requestId,
      telegramSessionId,
      loginSessionId,
    }, 'telegram-auth-check-forensic');

    const deadline = Date.now() + 25_000;

    while (Date.now() < deadline) {
      // Push-доставка Telegram → Yandex ненадёжна: пока клиент ждёт авторизацию,
      // сами забираем апдейты бота — /start auth_* обрабатывается за ~1-2 секунды
      await pollTelegramUpdates(db, fastify.log).catch(() => {});

      const snap = await ref.get();

      if (!snap.exists) return {
        status: 'not_found',
        diagnostics: buildTelegramAuthDiagnostics({
          stage: 'not_found',
          ...trace,
          identityV2Attempted: false,
          note: 'telegram_auth_sessions_doc_missing',
        }),
      };

      const data = snap.data();
      const resolvedRequestId = safeString(data?.requestId || requestId, 180);
      const resolvedLoginSessionId = safeString(data?.loginSessionId || loginSessionId, 220);
      const resolvedTelegramSessionId = safeString(data?.telegramSessionId || telegramSessionId || state, 220);
      if (requestId && resolvedRequestId && requestId !== resolvedRequestId) {
        request.log.warn?.({
          stage: 'telegram_auth_check_request_id_mismatch',
          state,
          requestId,
          resolvedRequestId,
          loginSessionId,
          resolvedLoginSessionId,
        }, 'telegram-auth-check-forensic');
      }

      if (!trace._firstLogged) {
        trace._firstLogged = true;
        request.log.info?.({
          stage: 'telegram_auth_check_loop',
          state,
          requestId: resolvedRequestId,
          telegramSessionId: resolvedTelegramSessionId,
          loginSessionId: resolvedLoginSessionId,
          sessionStatus: data?.status || 'unknown',
        }, 'telegram-auth-check-forensic');
      }

      if (data.status === 'done') {
        const tgId = `tg_${data.tgUserId}`;
        if (data.linking === true) {
          const { ownerUserId, linkedOwnerId, resolvedOwnerId } = resolveTelegramOwnerForResponse(data);
          const linkedTelegram = buildLinkedTelegramPayload(data, tgId);
          const isLinked = !String(data.linkError || '').trim();
          await ref.set({ checkedAt: new Date() }, { merge: true }).catch(() => {});
          return {
            status: 'done',
            linking: true,
            linked: isLinked,
            ownerUserId: ownerUserId || null,
            linkedOwnerId: linkedOwnerId || null,
            linkedTelegram,
            tgId,
            linkError: data.linkError || null,
            user: {
              id: resolvedOwnerId || null,
              first_name: data.firstName ?? '',
              last_name: data.lastName ?? '',
              username: data.username ?? '',
              photo_200: data.photoUrl ?? null,
            },
            identityV2Attempted: true,
            diagnostics: buildTelegramAuthDiagnostics({
              stage: 'done_linking',
              state,
              requestId: resolvedRequestId,
              loginSessionId: resolvedLoginSessionId,
              telegramSessionId: resolvedTelegramSessionId,
              elapsedMs: Date.now() - startAt,
              identityV2Attempted: true,
              identitySource: 'identity_v2_pending',
              identityPath: ownerUserId ? 'telegram_auth_check_linking' : null,
              note: ownerUserId ? `linking_owner=${ownerUserId}` : 'linking_owner_missing',
            }),
          };
        }
        ref.delete().catch(() => {});
        const normalizedTelegramId = String(data.tgUserId || '').trim();
        try {
          if (!normalizedTelegramId) {
            throw Object.assign(new Error('Отсутствует Telegram ID в сессии.'), { code: 'MISSING_TG_USER_ID', statusCode: 400 });
          }
          const resolveStartedAt = Date.now();
          const identity = await serverFoundation.identityV2.resolveTelegramIdentity({
            telegramId: normalizedTelegramId,
            createIfMissing: true,
          });
          const tokenStartedAt = Date.now();
          const token = await serverFoundation.identityV2.createCustomToken(identity.userId, identity.user || {});
          return {
            status: 'done',
            tgId,
            token,
            user: {
              id: identity.userId,
              first_name: data.firstName ?? '',
              last_name: data.lastName ?? '',
              username: data.username ?? null,
              photo_200: data.photoUrl ?? null,
              email: identity.user?.email || '',
            },
            diagnostics: buildTelegramAuthDiagnostics({
              stage: 'done_custom_token_issued',
              state,
              requestId: resolvedRequestId,
              loginSessionId: resolvedLoginSessionId,
              telegramSessionId: resolvedTelegramSessionId,
              elapsedMs: Date.now() - startAt,
              identityV2Attempted: true,
              identityResolved: true,
              identitySource: identity.source || 'identity_v2',
              identityPath: 'identity_v2',
              apgUserId: identity.userId,
              telegramIdentityId: identity.identityId || `telegram:${normalizedTelegramId}`,
              customTokenIssued: true,
              note: `identity_v2_token_ms=${Date.now() - tokenStartedAt};resolve_ms=${Date.now() - resolveStartedAt}`,
            }),
          };
        } catch (error) {
          request.log.warn?.({
            stage: 'telegram_auth_check_done_custom_token_failed',
            state,
            requestId: resolvedRequestId,
            tgId,
            telegramUserId: normalizedTelegramId,
            error: error?.message || String(error),
            code: error?.code || error?.statusCode || null,
          }, 'telegram-auth-check-forensic');
          return {
            status: 'failed',
            diagnostics: buildTelegramAuthDiagnostics({
              stage: 'done_custom_token_failed',
              state,
              requestId: resolvedRequestId,
              loginSessionId: resolvedLoginSessionId,
              telegramSessionId: resolvedTelegramSessionId,
              elapsedMs: Date.now() - startAt,
              identityV2Attempted: true,
              identitySource: (error?.source || 'identity_v2'),
              note: `identity_v2_failed:${String(error?.code || error?.message || 'UNKNOWN')}`,
            }),
          };
        }
      }

      if (data.status !== 'pending') {
        return {
          status: data.status,
          linking: data.linking === true,
          linkError: data.linkError || null,
          diagnostics: buildTelegramAuthDiagnostics({
            stage: 'done_non_pending',
            state,
            requestId: resolvedRequestId,
            loginSessionId: resolvedLoginSessionId,
            telegramSessionId: resolvedTelegramSessionId,
            elapsedMs: Date.now() - startAt,
            identityV2Attempted: false,
            note: `status=${safeString(data.status, 80)}`,
          }),
        };
      }

      const expDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
      if (expDate < new Date()) {
        await ref.update({ status: 'expired' }).catch(() => {});
        return {
          status: 'expired',
          diagnostics: buildTelegramAuthDiagnostics({
            stage: 'done_expired',
            state,
            requestId: resolvedRequestId,
            loginSessionId: resolvedLoginSessionId,
            telegramSessionId: resolvedTelegramSessionId,
            elapsedMs: Date.now() - startAt,
            identityV2Attempted: false,
            note: `expiresAt=${safeString(String(expDate), 120)}`,
          }),
        };
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    return {
      status: 'pending',
      diagnostics: buildTelegramAuthDiagnostics({
        stage: 'polling_timeout',
        state,
        requestId,
        loginSessionId,
        telegramSessionId,
        elapsedMs: Date.now() - startAt,
        identityV2Attempted: false,
        note: '25s_polling_window_exhausted',
      }),
    };
  });
}
