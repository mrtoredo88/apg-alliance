export function isCapabilityExplainQuery(question = '') {
  const query = String(question || '').toLowerCase();
  return query.includes('почему') && (query.includes('capability') || query.includes('возможност') || query.includes('функц'));
}

export function explainCapability(capabilityContext = {}) {
  if (!capabilityContext?.capability) return 'Пока нет сохранённой Capability: сначала нужно обработать обычный запрос Локи.';
  const rows = [
    `Выбрана Capability ${capabilityContext.capability}, потому что запрос совпал с сигналами: ${(capabilityContext.matchedAliases || []).join(', ') || 'intent/context'}.`,
    `Уверенность ${capabilityContext.confidence}%: учитывались формулировка, контекст экрана, память и приоритет возможности.`,
  ];
  if (capabilityContext.alternatives?.length) rows.push(`Ближайшие альтернативы: ${capabilityContext.alternatives.map(item => item.id).join(', ')}.`);
  if (capabilityContext.missing?.length) rows.push(`Не хватает параметров: ${capabilityContext.missing.join(', ')}.`);
  if (capabilityContext.executionOrder?.length) rows.push(`Дальше по порядку: ${capabilityContext.executionOrder.map(item => item.capability).join(' → ')}.`);
  return rows.join('\n');
}

export function explainLastCapability(memory = {}) {
  return {
    intent: 'capability.explain',
    preserveText: true,
    text: explainCapability(memory.lastCapabilityContext || memory.capabilitySnapshot || null),
    card: null,
    cards: [],
    capabilityContext: memory.lastCapabilityContext || null,
    capabilitySnapshot: memory.lastCapabilitySnapshot || memory.capabilitySnapshot || null,
  };
}

export class CapabilityExplanation {
  explain(context = {}) {
    return explainCapability(context);
  }
}
