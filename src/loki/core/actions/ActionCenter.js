import { LOKI_ACTION_CENTER_EVENTS } from './ActionRegistry.js';
import { resolveLokiActions } from './ActionResolver.js';
import { validateActionList, validateLokiAction } from './ActionValidator.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function actionKey(item = {}) {
  const action = item.action || item;
  return `${action?.type || ''}:${JSON.stringify(action?.payload || {})}`;
}

function mergeActions(existing = [], additions = []) {
  const seen = new Set();
  return [...list(existing), ...list(additions)].filter(item => {
    const key = actionKey(item);
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}

function augmentCard(card, actions = []) {
  if (!card) return card;
  const ownActions = mergeActions(card.actions, card.action ? [{ label: card.label || 'Открыть', action: card.action }] : []);
  const merged = mergeActions(ownActions, actions);
  return {
    ...card,
    action: card.action || merged[0]?.action || null,
    label: card.label || merged[0]?.label || 'Открыть',
    actions: merged,
  };
}

export function runLokiActionCenter({ result = null, context = {}, appState = {}, appActions = null } = {}) {
  if (!result) return result;
  const intent = result.intent ? { id: result.intent } : result.reasoningContext?.intent || {};
  const suggested = resolveLokiActions({ result, intent, context });
  const validated = validateActionList(suggested, { appState, appActions, actor: context.actor });
  const primary = validated[0] || null;
  const cards = list(result.cards).map(card => augmentCard(card, validated));
  const actionCard = validated.length ? {
    id: `loki-action-${validated[0].action.type}`,
    type: 'loki_action',
    title: 'Следующее действие',
    text: 'Можно продолжить прямо отсюда.',
    label: validated[0].label || 'Открыть',
    action: validated[0].action,
    actions: validated,
  } : null;
  const card = augmentCard(result.card || cards[0] || actionCard, validated);
  return {
    ...result,
    card,
    cards: cards.length ? cards : actionCard ? [actionCard] : result.cards,
    suggestions: mergeActions(result.suggestions, validated),
    actionCenter: {
      version: 'v1',
      suggested: validated.map(item => ({
        label: item.label,
        action: item.action,
        actionId: item.actionId || item.validation?.definition?.id || item.action?.type,
      })),
      rejected: suggested.length - validated.length,
      primaryAction: primary?.action || null,
      eventType: LOKI_ACTION_CENTER_EVENTS.SUGGESTED,
    },
  };
}

export function explainLokiActionChoice(actionRequest, options = {}) {
  const validation = validateLokiAction(actionRequest, options);
  if (!validation.ok) return validation.reason;
  const definition = validation.definition;
  const label = definition?.label || validation.action?.type || 'действие';
  if (validation.entity) {
    const title = validation.entity.title || validation.entity.name || validation.entity.displayName || 'карточка';
    return `Я выбрал действие «${label}», потому что оно ведёт к актуальной карточке «${title}» и доступно в текущем контексте.`;
  }
  return `Я выбрал действие «${label}», потому что оно соответствует текущей цели и уже поддерживается приложением АПГ.`;
}
