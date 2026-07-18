export function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function text(value, max = 1000) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round(part / total * 100);
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000 + Math.round(number(value.nanoseconds) / 1000000);
  return 0;
}

export function normalizeLokiAnalyticsRows(rows = []) {
  return list(rows).map((row, index) => {
    const query = text(row.query || row.question || row.userText, 500);
    const intent = text(row.intent || row.intentId || row.type || 'unknown', 140);
    const source = text(row.source || row.engine || row.module || 'loki', 120);
    const actionType = text(row.actionType || row.action?.type || row.action || '', 140);
    const success = row.success !== false && !['failed', 'error', 'fallback'].includes(text(row.status).toLowerCase());
    const confidence = row.confidence ?? row.reasoningConfidence ?? row.quality?.confidence ?? null;
    return {
      ...row,
      id: row.id || `loki-row-${index}`,
      query,
      intent,
      source,
      actionType,
      panel: text(row.panel || row.screen || row.section || 'unknown', 100),
      success,
      resultCount: Math.max(0, number(row.resultCount ?? row.cardsCount ?? row.results ?? 0)),
      ms: Math.max(0, number(row.ms ?? row.durationMs ?? row.latencyMs ?? 0)),
      confidence: confidence == null ? null : Math.max(0, Math.min(100, number(confidence))),
      sessionId: text(row.sessionId || row.conversationId || row.flowId || row.userId || 'unknown-session', 160),
      createdMs: toMillis(row.createdAt || row.timestamp || row.ts || row.at),
      journeyStep: text(row.journeyStep || row.currentStep || row.step || '', 140),
      journeyStatus: text(row.journeyStatus || row.status || '', 100),
    };
  });
}

export function groupBy(rows = [], getKey = item => item) {
  return rows.reduce((acc, row) => {
    const key = text(getKey(row) || 'unknown', 180);
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});
}

export function countBy(rows = [], getKey = item => item, limit = 50) {
  return Object.entries(groupBy(rows, getKey))
    .map(([key, items]) => ({ key, label: key, count: items.length, rows: items }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function buildConversationAnalytics(rows = []) {
  const normalized = normalizeLokiAnalyticsRows(rows);
  const total = normalized.length;
  const sessions = Object.values(groupBy(normalized, row => row.sessionId));
  const answered = normalized.filter(row => row.success).length;
  const avgMs = total ? Math.round(normalized.reduce((sum, row) => sum + row.ms, 0) / total) : 0;
  const avgConversationMessages = sessions.length
    ? Math.round(sessions.reduce((sum, items) => sum + items.length, 0) / sessions.length * 10) / 10
    : 0;
  return {
    rows: normalized,
    total,
    answered,
    failed: total - answered,
    sessions: sessions.length,
    successRate: percent(answered, total),
    averageMs: avgMs,
    averageConversationMessages: avgConversationMessages,
    dataCoverage: {
      hasRows: total > 0,
      hasConfidence: normalized.some(row => row.confidence != null),
      hasSessionIds: normalized.some(row => row.sessionId !== 'unknown-session'),
      hasJourneySteps: normalized.some(row => row.journeyStep),
    },
  };
}
