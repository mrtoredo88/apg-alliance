import { countBy, normalizeLokiAnalyticsRows, percent, text } from './ConversationAnalytics.js';

const JOURNEY_STEPS = ['Поиск', 'Карточка', 'Выбор филиала', 'Выбор услуги', 'Выбор времени', 'Подтверждение', 'Завершение'];

function inferStep(row = {}) {
  const raw = text(`${row.journeyStep} ${row.actionType} ${row.intent} ${row.query}`).toLowerCase();
  if (raw.includes('confirm') || raw.includes('подтверж')) return 'Подтверждение';
  if (raw.includes('time') || raw.includes('время') || raw.includes('слот')) return 'Выбор времени';
  if (raw.includes('service') || raw.includes('услуг')) return 'Выбор услуги';
  if (raw.includes('location') || raw.includes('филиал')) return 'Выбор филиала';
  if (raw.includes('open_partner') || raw.includes('open_expert') || raw.includes('карточ')) return 'Карточка';
  if (raw.includes('completed') || raw.includes('success') || raw.includes('готово')) return 'Завершение';
  return 'Поиск';
}

export function buildJourneyAnalytics(rows = []) {
  const normalized = normalizeLokiAnalyticsRows(rows);
  const journeyRows = normalized.filter(row => row.intent.startsWith('journey.') || row.journeyStep || row.journeyStatus);
  const completed = journeyRows.filter(row => row.intent.includes('completed') || row.journeyStatus === 'completed').length;
  const stepRows = journeyRows.map(row => ({ ...row, stepLabel: inferStep(row) }));
  const heatMap = JOURNEY_STEPS.map(step => {
    const count = stepRows.filter(row => row.stepLabel === step).length;
    return { step, count, percent: percent(count, Math.max(1, stepRows.length)) };
  });
  return {
    total: journeyRows.length,
    completed,
    completionRate: percent(completed, journeyRows.length),
    byGoal: countBy(journeyRows, row => row.intent.replace(/^journey\./, '').split('.')[0] || 'unknown', 20),
    dropOff: heatMap.filter(item => item.count > 0).sort((a, b) => a.count - b.count)[0] || null,
    heatMap,
    rows: journeyRows.slice(0, 50),
  };
}
