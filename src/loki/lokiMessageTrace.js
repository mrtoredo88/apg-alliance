const TRACE_LIMIT = 80;

function now() {
  return typeof performance !== 'undefined' ? Math.round(performance.now()) : Date.now();
}

function isMessageDebugEnabled() {
  try {
    return localStorage.getItem('apg_loki_message_debug') === '1';
  } catch {
    return false;
  }
}

export function resetLokiMessageTrace(meta = {}) {
  if (typeof window === 'undefined') return;
  window.__APG_LOKI_MESSAGE_TRACE__ = [{
    step: 'message_trace_start',
    at: now(),
    detail: meta,
  }];
}

export function recordLokiMessageTrace(step, detail = {}) {
  if (typeof window === 'undefined') return;
  const entry = { step, at: now(), detail };
  const trace = Array.isArray(window.__APG_LOKI_MESSAGE_TRACE__)
    ? window.__APG_LOKI_MESSAGE_TRACE__
    : [];
  trace.push(entry);
  window.__APG_LOKI_MESSAGE_TRACE__ = trace.slice(-TRACE_LIMIT);
  if (isMessageDebugEnabled()) console.info('[APG Loki Message]', step, detail);
}

export function getLokiMessageTrace() {
  if (typeof window === 'undefined') return [];
  return Array.isArray(window.__APG_LOKI_MESSAGE_TRACE__)
    ? window.__APG_LOKI_MESSAGE_TRACE__.slice()
    : [];
}

export function buildLokiMessageTimeoutFallback(text = '') {
  const trace = getLokiMessageTrace();
  const last = trace[trace.length - 1] || null;
  return {
    intent: 'loki.timeout',
    text: 'Я получил сообщение, но один из внутренних этапов не вернул ответ вовремя. Попробуйте ещё раз коротко, а я уже сохранил диагностический след для проверки.',
    card: null,
    cards: [],
    debug: {
      provider: 'local',
      totalMs: 5000,
      timeout: true,
      stoppedAt: last?.step || '',
      question: text,
      trace,
    },
  };
}
