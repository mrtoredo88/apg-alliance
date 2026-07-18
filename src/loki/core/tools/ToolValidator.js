import { getToolDefinition } from './ToolRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function roleOf(context = {}) {
  return String(context.actor?.role || context.user?.role || context.appState?.user?.role || context.appState?.user?.userRole || 'user').toLowerCase();
}

export function validateToolCall(call = {}, { context = {}, knowledge = {} } = {}) {
  const definition = getToolDefinition(call.id);
  if (!definition) return { ok: false, reason: 'Такой инструмент Локи не поддерживается.', call, definition: null };
  if (!definition.readOnly) return { ok: false, reason: 'Инструмент не является read-only.', call, definition };
  if (definition.roles?.length && !definition.roles.includes(roleOf(context))) {
    return { ok: false, reason: 'Для этого инструмента не хватает прав доступа.', call, definition };
  }
  if (!knowledge?.sources) return { ok: false, reason: 'Актуальные данные АПГ ещё не готовы.', call, definition };
  if (definition.scope === 'user' && !knowledge.sources.userProfile && !context.user) {
    return { ok: false, reason: 'Для ответа нужны данные профиля пользователя.', call, definition };
  }
  return { ok: true, call, definition };
}

export function validateToolResult(result = {}) {
  if (!result || typeof result !== 'object') return { ok: false, reason: 'Инструмент не вернул результат.' };
  if (result.error) return { ok: false, reason: result.error };
  return { ok: true };
}

export function makeToolDeniedResult(validation, startedAt = Date.now()) {
  return {
    intent: 'tool.denied',
    preserveText: true,
    text: validation.reason || 'Не могу выполнить этот запрос по текущим данным.',
    card: null,
    cards: [],
    toolContext: {
      call: validation.call,
      status: 'denied',
      durationMs: Math.max(0, Date.now() - startedAt),
      events: [
        { type: 'TOOL_DENIED', toolId: validation.call?.id, status: 'denied', reason: validation.reason },
      ],
    },
  };
}

export function ensureKnownTypes(types = []) {
  const allowed = new Set(['partner', 'expert', 'news', 'event', 'promotion', 'gift', 'location']);
  return list(types).filter(type => allowed.has(type));
}
