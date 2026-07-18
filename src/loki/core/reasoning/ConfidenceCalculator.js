function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function completeness(item = {}) {
  const fields = [
    item.title || item.name,
    item.description || item.summary || item.text,
    item.address || item.mainLocation?.address,
    item.phone || item.mainLocation?.phone,
    item.workingHours || item.hours || item.mainLocation?.workingHours,
    item.rating || item.avgRating,
    item.bookingUrl || item.bookingEnabled,
  ];
  const filled = fields.filter(Boolean).length;
  return filled / fields.length;
}

export function calculateConfidence({ ranked = [], intent = {}, reasoningContext = {} } = {}) {
  if (!ranked.length) {
    return {
      value: 40,
      label: '40%',
      level: 'low',
      note: 'Нашёл только часть информации: подходящих объектов в загруженных данных мало.',
    };
  }
  const top = ranked[0];
  const gap = Number(top.score || 0) - Number(ranked[1]?.score || 0);
  const dataScore = completeness(top) * 28;
  const matchScore = Math.min(36, Number(top.baseScore || top.score || 0) * 2.2);
  const reasonScore = Math.min(24, list(top.reasons).length * 5);
  const gapScore = Math.min(12, Math.max(0, gap));
  const followUpPenalty = reasoningContext.followUp ? -4 : 0;
  const value = Math.max(40, Math.min(100, Math.round(40 + dataScore + matchScore + reasonScore + gapScore + followUpPenalty)));
  return {
    value,
    label: `${value}%`,
    level: value >= 90 ? 'high' : value >= 75 ? 'good' : value >= 60 ? 'medium' : 'low',
    note: value >= 80
      ? 'Данных достаточно для уверенной рекомендации.'
      : value >= 60
        ? 'Не уверен полностью: часть важных данных не заполнена.'
        : 'Информации мало, поэтому лучше открыть карточку и проверить детали.',
    intent: intent.id || '',
  };
}
