export function generateLokiQualityInsights({ conversations, intents, fallback, journey, recommendations, proactive, quality } = {}) {
  const insights = [];
  const topIntent = intents?.intents?.[0];
  const topQuestion = intents?.topQuestions?.[0];
  const fallbackReason = fallback?.reasons?.[0];
  const topAction = recommendations?.byAction?.[0];
  const topOpportunity = proactive?.byOpportunity?.[0];
  if (!conversations?.total) {
    return ['Данных Loki Analytics пока недостаточно. Центр качества готов, но статистика появится после новых диалогов.'];
  }
  if (topQuestion) insights.push(`Чаще всего спрашивают: «${topQuestion.label}» (${topQuestion.count}).`);
  if (topIntent) insights.push(`Самый частый intent: ${topIntent.label} (${topIntent.percent}%).`);
  if (fallback?.rate > 10 && fallbackReason) insights.push(`Главная зона риска: ${fallbackReason.label} (${fallbackReason.count}).`);
  if (journey?.dropOff) insights.push(`В Journey слабее всего заполнен этап: ${journey.dropOff.step}.`);
  if (topAction) insights.push(`Самое частое действие после рекомендации: ${topAction.label}.`);
  if (topOpportunity) insights.push(`Proactive чаще всего срабатывает как ${topOpportunity.label}: принято ${topOpportunity.acceptedRate}%.`);
  if (quality?.qualityScore >= 90) insights.push('Общий Quality Score высокий: Локи стабильно отвечает по данным и редко уходит в fallback.');
  if (quality?.qualityScore < 75) insights.push('Quality Score требует внимания: стоит проверить fallback и низкую уверенность по интентам.');
  return insights.slice(0, 6);
}
