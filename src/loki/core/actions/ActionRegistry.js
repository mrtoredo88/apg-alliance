import { LOKI_APP_ACTIONS, LOKI_ACTION_LABELS } from '../../lokiActionTypes.js';

export const LOKI_ACTION_CENTER_EVENTS = {
  SUGGESTED: 'LOKI_ACTION_SUGGESTED',
  STARTED: 'LOKI_ACTION_STARTED',
  COMPLETED: 'LOKI_ACTION_COMPLETED',
  CANCELLED: 'LOKI_ACTION_CANCELLED',
  FAILED: 'LOKI_ACTION_FAILED',
};

export const ACTION_IDS = {
  OPEN_PARTNER: 'OPEN_PARTNER',
  OPEN_EXPERT: 'OPEN_EXPERT',
  OPEN_EVENT: 'OPEN_EVENT',
  OPEN_NEWS: 'OPEN_NEWS',
  OPEN_PROMOTION: 'OPEN_PROMOTION',
  OPEN_OFFERS: 'OPEN_OFFERS',
  OPEN_GIFT: 'OPEN_GIFT',
  OPEN_BOOKING: 'OPEN_BOOKING',
  OPEN_PROFILE: 'OPEN_PROFILE',
  OPEN_WORKSPACE: 'OPEN_WORKSPACE',
  OPEN_DIALOG: 'OPEN_DIALOG',
  OPEN_ROUTE: 'OPEN_ROUTE',
  OPEN_REVIEW: 'OPEN_REVIEW',
  OPEN_MAP: 'OPEN_MAP',
  SEARCH: 'SEARCH',
  SCAN: 'SCAN',
  CONTACT: 'CONTACT',
  CALL: 'CALL',
  SHARE: 'SHARE',
  COPY_LINK: 'COPY_LINK',
  OPEN_FAQ: 'OPEN_FAQ',
};

export const ACTION_REGISTRY = [
  { id: ACTION_IDS.OPEN_PARTNER, type: LOKI_APP_ACTIONS.OPEN_PARTNER, label: 'Открыть карточку', category: 'navigation', entity: 'partner', payloadKeys: ['partnerId', 'id'], intents: ['search.partners', 'context.card'], goals: ['FIND_PARTNER', 'BOOK_SERVICE', 'CONTACT_PARTNER', 'NAVIGATE'] },
  { id: ACTION_IDS.OPEN_EXPERT, type: LOKI_APP_ACTIONS.OPEN_EXPERTS, label: 'Открыть эксперта', category: 'navigation', entity: 'expert', payloadKeys: ['expertId', 'id'], intents: ['search.specialists'], goals: ['FIND_EXPERT'] },
  { id: ACTION_IDS.OPEN_EVENT, type: LOKI_APP_ACTIONS.OPEN_EVENT, label: 'Открыть событие', category: 'navigation', entity: 'event', payloadKeys: ['eventId', 'id'], intents: ['search.events'], goals: ['JOIN_EVENT'] },
  { id: ACTION_IDS.OPEN_NEWS, type: LOKI_APP_ACTIONS.OPEN_NEWS, label: 'Открыть статью', category: 'navigation', entity: 'news', payloadKeys: ['newsId', 'id'], intents: ['news.question'], goals: ['LEARN'] },
  { id: ACTION_IDS.OPEN_PROMOTION, type: LOKI_APP_ACTIONS.OPEN_PARTNER, label: 'Показать акцию', category: 'navigation', entity: 'promotion', payloadKeys: ['partnerId', 'id'], intents: ['search.promotions'], goals: ['GET_PROMOTION'] },
  { id: ACTION_IDS.OPEN_OFFERS, type: LOKI_APP_ACTIONS.OPEN_OFFERS, label: 'Открыть акции', category: 'navigation', entity: 'promotion', payloadKeys: ['query'], intents: ['search.promotions'], goals: ['GET_PROMOTION'] },
  { id: ACTION_IDS.OPEN_GIFT, type: LOKI_APP_ACTIONS.OPEN_PRIZE, label: 'Открыть подарок', category: 'navigation', entity: 'gift', payloadKeys: ['prizeId', 'id'], intents: ['search.gifts'], goals: ['CLAIM_GIFT'] },
  { id: ACTION_IDS.OPEN_BOOKING, type: LOKI_APP_ACTIONS.OPEN_PARTNER, label: 'Записаться', category: 'flow', entity: 'partner', payloadKeys: ['partnerId', 'expertId', 'id'], intents: ['info.booking'], goals: ['BOOK_SERVICE'] },
  { id: ACTION_IDS.OPEN_PROFILE, type: LOKI_APP_ACTIONS.SHOW_PROFILE, label: 'Открыть профиль', category: 'navigation', entity: 'profile', payloadKeys: [], intents: ['profile.question'] },
  { id: ACTION_IDS.OPEN_WORKSPACE, type: LOKI_APP_ACTIONS.OPEN_LOKI, label: 'Открыть Workspace', category: 'navigation', entity: 'workspace', payloadKeys: [], intents: ['workspace.question'] },
  { id: ACTION_IDS.OPEN_DIALOG, type: LOKI_APP_ACTIONS.OPEN_LOKI, label: 'Открыть диалог', category: 'context', entity: 'dialog', payloadKeys: ['dialogId', 'id'] },
  { id: ACTION_IDS.OPEN_ROUTE, type: LOKI_APP_ACTIONS.OPEN_MAP, label: 'Показать маршрут', category: 'navigation', entity: 'location', payloadKeys: ['partnerId', 'locationId', 'id'], goals: ['NAVIGATE'] },
  { id: ACTION_IDS.OPEN_REVIEW, type: LOKI_APP_ACTIONS.OPEN_PARTNER, label: 'Отзывы', category: 'context', entity: 'review', payloadKeys: ['partnerId', 'expertId', 'id'] },
  { id: ACTION_IDS.OPEN_MAP, type: LOKI_APP_ACTIONS.OPEN_MAP, label: 'Открыть карту', category: 'navigation', entity: 'map', payloadKeys: [] },
  { id: ACTION_IDS.SEARCH, type: LOKI_APP_ACTIONS.OPEN_PARTNERS, label: 'Искать в АПГ', category: 'navigation', entity: 'search', payloadKeys: ['query'] },
  { id: ACTION_IDS.SCAN, type: LOKI_APP_ACTIONS.START_QR_SCANNER, label: 'Сканировать QR', category: 'utility', entity: 'scanner', payloadKeys: [] },
  { id: ACTION_IDS.CONTACT, type: LOKI_APP_ACTIONS.OPEN_PARTNER, label: 'Связаться', category: 'contact', entity: 'contact', payloadKeys: ['partnerId', 'expertId', 'id'] },
  { id: ACTION_IDS.CALL, type: 'call', label: 'Позвонить', category: 'external', entity: 'phone', payloadKeys: ['phone'] },
  { id: ACTION_IDS.SHARE, type: 'share', label: 'Поделиться', category: 'external', entity: 'share', payloadKeys: ['url', 'text'] },
  { id: ACTION_IDS.COPY_LINK, type: 'copyLink', label: 'Скопировать ссылку', category: 'external', entity: 'link', payloadKeys: ['url'] },
  { id: ACTION_IDS.OPEN_FAQ, type: LOKI_APP_ACTIONS.OPEN_REFERENCE, label: 'Открыть справочник', category: 'navigation', entity: 'faq', payloadKeys: [], intents: ['knowledge.help'] },
].map(item => ({
  mode: ['call', 'share', 'copyLink'].includes(item.type) ? 'browser' : 'client',
  safe: true,
  label: LOKI_ACTION_LABELS[item.type] || item.label,
  ...item,
}));

const BY_ID = new Map(ACTION_REGISTRY.map(item => [item.id, item]));
const BY_TYPE = ACTION_REGISTRY.reduce((map, item) => {
  if (!map.has(item.type)) map.set(item.type, item);
  return map;
}, new Map());

export function getActionRegistry() {
  return ACTION_REGISTRY.slice();
}

export function getActionDefinition(action) {
  const id = typeof action === 'string' ? action : action?.id;
  const type = typeof action === 'string' ? action : action?.type;
  return BY_ID.get(id) || BY_TYPE.get(type) || null;
}

export function isKnownAction(action) {
  return Boolean(getActionDefinition(action));
}
