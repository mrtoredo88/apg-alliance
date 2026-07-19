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

export function describeLokiReturnValue(value) {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const keys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).slice(0, 24) : [];
  const text = value && typeof value === 'object' ? value.text : '';
  const cards = value && typeof value === 'object' ? value.cards : null;
  return {
    type,
    isNull: value === null,
    isUndefined: typeof value === 'undefined',
    isPromise: Boolean(value && typeof value.then === 'function'),
    isObject: Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    isEmptyObject: Boolean(value && typeof value === 'object' && !Array.isArray(value) && keys.length === 0),
    keys,
    intent: value?.intent || '',
    hasText: typeof text === 'string' ? text.trim().length > 0 : Boolean(text),
    textLength: typeof text === 'string' ? text.trim().length : 0,
    cardCount: Array.isArray(cards) ? cards.length : value?.card ? 1 : 0,
    hasDebug: Boolean(value?.debug),
    timeout: Boolean(value?.debug?.timeout),
  };
}

export function isInvalidLokiReturnValue(value) {
  const described = describeLokiReturnValue(value);
  return described.isNull || described.isUndefined || described.isPromise || described.isEmptyObject || !described.hasText;
}

export function recordLokiPipelineReturn(stage, value, detail = {}) {
  const described = describeLokiReturnValue(value);
  recordLokiMessageTrace(`${stage} RETURN VALUE`, { ...detail, ...described });
  if (isInvalidLokiReturnValue(value)) {
    recordLokiMessageTrace(`STOP ${stage} RETURNED INVALID`, { ...detail, ...described, errorCode: `${stage.replace(/\s+/g, '_').toUpperCase()}_INVALID_RETURN` });
  }
  return described;
}

export function recordLokiPipelineError(stage, error, detail = {}) {
  recordLokiMessageTrace(`STOP ${stage} ERROR`, {
    ...detail,
    error: error?.message || String(error),
    stack: error?.stack || '',
    errorName: error?.name || '',
  });
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
    error: input.error || lastStop?.detail?.error || '',
    stack: input.stack || '',
    pipelineStep: input.pipelineStep || lastStop?.step || lastCompleted?.step || '',
    pipelineTimeline: Array.isArray(input.pipelineTimeline)
      ? input.pipelineTimeline.slice(-30)
      : trace.slice(-30).map((item, index) => ({
        step: item.step || `STEP ${index + 1}`,
        at: item.at || 0,
        status: String(item.step || '').startsWith('STOP') ? 'failed' : 'ok',
        output: item.detail || {},
      })),
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
