const TRACE_LIMIT = 80;
const DIAGNOSTICS_LIMIT = 40;

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

export function recordLokiRequestDiagnostics(input = {}) {
  if (typeof window === 'undefined') return null;
  const trace = getLokiMessageTrace();
  const started = trace[0]?.at || now();
  const completed = now();
  const lastStop = [...trace].reverse().find(item => String(item.step || '').startsWith('STOP')) || null;
  const lastCompleted = [...trace].reverse().find(item => !String(item.step || '').startsWith('STOP')) || null;
  const diagnostic = {
    requestId: input.requestId || `loki-${Date.now()}`,
    contextType: input.contextType || '',
    inputKind: input.inputKind || 'message',
    intent: input.intent || '',
    startedAt: started,
    completedAt: completed,
    duration: Math.max(0, completed - started),
    lastCompletedStage: input.lastCompletedStage || lastCompleted?.step || '',
    failedStage: input.failedStage || lastStop?.step || '',
    resultStatus: input.resultStatus || (lastStop ? 'failed' : 'answered'),
    fallbackUsed: Boolean(input.fallbackUsed),
    timeoutUsed: Boolean(input.timeoutUsed),
    responseTextLength: Number(input.responseTextLength || 0),
    errorCode: input.errorCode || lastStop?.detail?.errorCode || '',
  };
  const history = Array.isArray(window.__APG_LOKI_REQUEST_DIAGNOSTICS__) ? window.__APG_LOKI_REQUEST_DIAGNOSTICS__ : [];
  window.__APG_LOKI_REQUEST_DIAGNOSTICS__ = [...history.slice(-(DIAGNOSTICS_LIMIT - 1)), diagnostic];
  return diagnostic;
}

export function getLokiMessageTrace() {
  if (typeof window === 'undefined') return [];
  return Array.isArray(window.__APG_LOKI_MESSAGE_TRACE__)
    ? window.__APG_LOKI_MESSAGE_TRACE__.slice()
    : [];
}

export function buildLokiMessageTimeoutFallback(text = '', timeoutMs = 10000) {
  const trace = getLokiMessageTrace();
  const last = trace[trace.length - 1] || null;
  return {
    intent: 'loki.timeout',
    text: 'Не получилось ответить с первого раза. Повторите вопрос, пожалуйста.',
    card: null,
    cards: [],
    debug: {
      provider: 'local',
      totalMs: timeoutMs,
      timeout: true,
      stoppedAt: last?.step || '',
      question: text,
      trace,
    },
  };
}
