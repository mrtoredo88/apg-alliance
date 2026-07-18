import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';
import { makeResultCard, titleOf } from '../lokiCoreUtils.js';

function compactText(value, fallback = '') {
  const text = String(value || fallback || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 117).trim()}...` : text;
}

function withActions(card, secondaryAction = null) {
  const primary = card?.action ? [{ label: card.label || 'Открыть', action: card.action }] : [];
  const secondary = secondaryAction ? [secondaryAction] : [];
  return { ...card, actions: [...primary, ...secondary].slice(0, 2) };
}

export function buildProactiveCard(opportunity = {}) {
  if (opportunity.card) return withActions(opportunity.card, opportunity.secondaryAction);

  if (opportunity.type === 'BOOKING_SOON') {
    return withActions({
      title: 'Запись скоро',
      text: compactText(opportunity.summary, 'До записи осталось меньше суток.'),
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_MAP),
      label: 'Открыть маршрут',
    }, opportunity.providerId ? { label: 'Карточка', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: opportunity.providerId }) } : null);
  }

  if (opportunity.type === 'JOURNEY_RESUME') {
    return withActions({
      title: 'Продолжить путь',
      text: compactText(opportunity.summary, 'Можно продолжить с того места, где остановились.'),
      action: opportunity.action || createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNERS),
      label: 'Продолжить',
    });
  }

  if (opportunity.type === 'PROMOTION_NEW') {
    return withActions(makeResultCard(opportunity.entity, 'partner', createLokiAction(LOKI_APP_ACTIONS.OPEN_PARTNER, { partnerId: opportunity.entityId })));
  }

  if (opportunity.type === 'REWARD_AVAILABLE') {
    return withActions({
      title: opportunity.entity?.title || opportunity.entity?.name || 'Подарок доступен',
      text: compactText(opportunity.summary, 'Ключей уже хватает, чтобы посмотреть подарок.'),
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_PRIZE, { prizeId: opportunity.entityId }),
      label: 'К подаркам',
    });
  }

  if (opportunity.type === 'EVENT_SOON') {
    return withActions(makeResultCard(opportunity.entity, 'event', createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENT, { eventId: opportunity.entityId })));
  }

  if (opportunity.type === 'WORKSPACE_BOOKINGS') {
    return withActions({
      title: 'Новые записи',
      text: compactText(opportunity.summary, 'В Workspace есть записи, которые стоит проверить.'),
      action: createLokiAction(LOKI_APP_ACTIONS.SHOW_PROFILE),
      label: 'Открыть профиль',
    });
  }

  if (opportunity.type === 'WORKSPACE_DIALOGS') {
    return withActions({
      title: 'Новые сообщения',
      text: compactText(opportunity.summary, 'Есть непрочитанные диалоги.'),
      action: createLokiAction(LOKI_APP_ACTIONS.SHOW_NOTIFICATIONS),
      label: 'Открыть',
    });
  }

  if (opportunity.type === 'ADMIN_ATTENTION') {
    return withActions({
      title: 'Нужно внимание',
      text: compactText(opportunity.summary, 'В админском контуре есть предупреждения.'),
      action: createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI),
      label: 'Открыть Локи',
    });
  }

  return withActions({
    title: titleOf(opportunity.entity, 'Подсказка Локи'),
    text: compactText(opportunity.summary, 'Я заметил полезный следующий шаг.'),
    action: opportunity.action || createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI),
    label: 'Открыть',
  });
}
