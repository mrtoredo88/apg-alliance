import { countBy, normalizeLokiAnalyticsRows, percent } from './ConversationAnalytics.js';

function fallbackReason(row) {
  if (row.success === false) return 'Ошибка ответа';
  if (!row.intent || row.intent === 'unknown' || row.intent.includes('unknown')) return 'Intent не распознан';
  if (row.intent === 'partner.empty' || row.intent.includes('.empty')) return 'Knowledge пустой';
  if (row.confidence != null && row.confidence < 60) return 'Confidence низкий';
  if (row.resultCount === 0 && row.intent.startsWith('search.')) return 'Нет результатов';
  if (row.intent.startsWith('journey.') && !row.journeyStep && !row.journeyStatus) return 'Journey без этапа';
  return '';
}

export function buildFallbackAnalytics(rows = []) {
  const normalized = normalizeLokiAnalyticsRows(rows);
  const fallbackRows = normalized.map(row => ({ ...row, fallbackReason: fallbackReason(row) })).filter(row => row.fallbackReason);
  return {
    rows: fallbackRows,
    total: fallbackRows.length,
    rate: percent(fallbackRows.length, normalized.length),
    reasons: countBy(fallbackRows, row => row.fallbackReason, 20),
    questions: fallbackRows.filter(row => row.query).slice(0, 25),
  };
}
