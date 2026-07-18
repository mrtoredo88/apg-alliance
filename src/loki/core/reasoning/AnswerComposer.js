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
  return `Не уверен полностью (${confidence.label}). ${confidence.note}\n\n`;
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
  const next = suggestions.length ? `\n\nДальше: ${suggestions.map(item => item.label).join(', ')}.` : '';
  const more = totalFound > ranked.length ? `\n\nНашёл ещё ${totalFound - ranked.length}. Могу показать, если нужно.` : '';
  const alternativeText = ranked.slice(1, 3).map((item, index) => `${index + 2}. ${title(item)} — ${reasonText(item.reasons)}.`).join('\n');
  const alternatives = alternativeText ? `\n\nЕщё варианты:\n${alternativeText}` : '';
  const why = explanation[0]?.reasons?.length ? explanation[0].reasons.join(', ') : topReasons;
  return {
    text: `${confidenceIntro(confidence)}Лучше всего подойдёт «${title(top)}».\n\nПочему: ${why}.\n\n${alternativeText ? 'Я бы рекомендовал три варианта:' : 'Краткий вывод:'}\n1. ${title(top)} — ${topReasons}.${alternatives}${more}${next}`,
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
    text: `Я выбрал «${title(top)}», потому что:\n${reasons.length ? reasons.map(item => `• ${item.label || item}`).join('\n') : '• он лучше всего совпал с предыдущим запросом'}\n\nУверенность: ${top.confidence || memoryContext.confidence || 0}%.`,
    card: null,
    cards: [],
  };
}
