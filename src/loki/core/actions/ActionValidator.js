import { LOKI_APP_ACTIONS, normalizeLokiActionRequest } from '../../lokiActionTypes.js';
import { getActionDefinition } from './ActionRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value) {
  return String(value ?? '').trim();
}

function statusOf(item = {}) {
  return text(item.status || item.lifecycleStatus || item.contentStatus || '').toLowerCase();
}

export function isEntityAvailable(item = {}) {
  if (!item || typeof item !== 'object') return false;
  const status = statusOf(item);
  return item.active !== false
    && item.catalogPublished !== false
    && item.published !== false
    && item.hidden !== true
    && item.deleted !== true
    && item.archived !== true
    && !['archived', 'deleted', 'trash', 'draft', 'rejected'].includes(status);
}

function findById(items, id) {
  const target = text(id);
  if (!target) return null;
  return list(items).find(item => text(item?.id) === target || text(item?.slug) === target || text(item?.publicId) === target) || null;
}

function resolveEntity(action = {}, appState = {}) {
  const payload = action.payload || {};
  if (action.type === LOKI_APP_ACTIONS.OPEN_PARTNER || action.type === LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER) {
    return findById(appState.partners, payload.partnerId || payload.id);
  }
  if (action.type === LOKI_APP_ACTIONS.OPEN_EXPERTS) {
    return payload.expertId || payload.id ? findById(appState.experts, payload.expertId || payload.id) : null;
  }
  if (action.type === LOKI_APP_ACTIONS.OPEN_EVENT || action.type === LOKI_APP_ACTIONS.START_EVENT_REGISTRATION) {
    return payload.eventId || payload.id ? findById(appState.events, payload.eventId || payload.id) : null;
  }
  if (action.type === LOKI_APP_ACTIONS.OPEN_NEWS) {
    return payload.newsId || payload.id ? findById(appState.news, payload.newsId || payload.id) : null;
  }
  if (action.type === LOKI_APP_ACTIONS.OPEN_PRIZE) {
    return payload.prizeId || payload.id ? findById(appState.rewards || appState.prizes || appState.gifts, payload.prizeId || payload.id) : null;
  }
  return null;
}

function requiresEntity(action = {}) {
  const payload = action.payload || {};
  if ([LOKI_APP_ACTIONS.OPEN_PARTNER, LOKI_APP_ACTIONS.ADD_FAVORITE_PARTNER].includes(action.type)) return Boolean(payload.partnerId || payload.id);
  if (action.type === LOKI_APP_ACTIONS.OPEN_EXPERTS) return Boolean(payload.expertId || payload.id);
  if ([LOKI_APP_ACTIONS.OPEN_EVENT, LOKI_APP_ACTIONS.START_EVENT_REGISTRATION].includes(action.type)) return Boolean(payload.eventId || payload.id);
  if (action.type === LOKI_APP_ACTIONS.OPEN_NEWS) return Boolean(payload.newsId || payload.id);
  if (action.type === LOKI_APP_ACTIONS.OPEN_PRIZE) return Boolean(payload.prizeId || payload.id);
  return false;
}

export function validateLokiAction(actionRequest, { appState = {}, appActions = null, actor = {} } = {}) {
  const action = normalizeLokiActionRequest(actionRequest);
  if (!action?.type) return { ok: false, reason: 'Не удалось распознать действие Локи.', action: null };
  const definition = getActionDefinition(action);
  if (!definition) return { ok: false, reason: 'Такое действие пока не поддерживается в АПГ.', action };
  if (definition.mode === 'client' && appActions && typeof appActions[action.type] !== 'function') {
    return { ok: false, reason: 'Этот переход сейчас недоступен в приложении.', action, definition };
  }
  if (definition.requiredPermissions?.length) {
    const permissions = new Set(list(actor.permissions));
    const allowed = definition.requiredPermissions.every(permission => permissions.has(permission));
    if (!allowed) return { ok: false, reason: 'Для этого действия не хватает прав доступа.', action, definition };
  }
  if (requiresEntity(action)) {
    const entity = resolveEntity(action, appState);
    if (!entity) return { ok: false, reason: 'Карточка больше недоступна. Попробуем найти похожий вариант?', action, definition };
    if (!isEntityAvailable(entity)) return { ok: false, reason: 'Карточка сейчас не опубликована или архивирована.', action, definition, entity };
    return { ok: true, action, definition, entity };
  }
  return { ok: true, action, definition, entity: null };
}

export function validateActionList(actions = [], options = {}) {
  return list(actions)
    .map(item => {
      const validation = validateLokiAction(item.action || item, options);
      return { ...item, validation, disabled: !validation.ok, reason: validation.reason };
    })
    .filter(item => item.validation.ok)
    .slice(0, 3);
}
