function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function title(item = {}) {
  return item.title || item.name || 'вариант АПГ';
}

function reasonText(reasons = []) {
  const labels = list(reasons).map(item => item.label || item).slice(0, 3);
  return labels.length ? labels.join(', ') : 'лучше совпадает с запросом';
}

function confidenceIntro(confidence = {}) {
  if (confidence.value >= 80) return '';
  return 'Показываю самые близкие варианты. ';
}

export function composeReasonedAnswer({ intent = {}, ranked = [], confidence = {}, suggestions = [], explanation = [], totalFound = 0 } = {}) {
  if (!ranked.length) {
    return {
      text: `Нашёл только часть информации. Пока данных недостаточно для уверенной рекомендации.\n\nМогу показать похожие варианты или открыть профильный раздел.`,
      card: null,
      cards: [],
    };
  }
  const top = ranked[0];
  const topReasons = reasonText(top.reasons);
  const why = explanation[0]?.reasons?.length ? explanation[0].reasons.join(', ') : topReasons;
  return {
    text: `${confidenceIntro(confidence)}Нашёл ${ranked.length} ${ranked.length === 1 ? 'вариант' : 'варианта'}.\nЛучше всего подойдёт «${title(top)}»: ${why}.`,
    card: top.card || null,
    cards: ranked.slice(0, 5).map(item => item.card).filter(Boolean),
  };
}

export function composeExplanation({ memoryContext = null } = {}) {
  const items = list(memoryContext?.items);
  const top = items[0];
  if (!top) return null;
  const reasons = list(top.reasons).slice(0, 4);
  return {
    intent: 'reasoning.explain_choice',
    preserveText: true,
    text: `Я выбрал «${title(top)}».\n${reasons.length ? `Главное: ${reasons.slice(0, 2).map(item => item.label || item).join(', ')}.` : 'Он лучше всего совпал с запросом.'}`,
    card: null,
    cards: [],
  };
}
