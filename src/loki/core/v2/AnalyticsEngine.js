function clean(value, limit = 80) {
  return String(value || '').replace(/[^a-zA-Zа-яА-Я0-9._:-]/g, '').slice(0, limit);
}

export const AnalyticsEngine = {
  id: 'analyticsEngine',
  event(type, payload = {}) {
    return {
      type: clean(type),
      scenarioId: clean(payload.scenarioId),
      intent: clean(payload.intent),
      role: clean(payload.role || 'user'),
      success: payload.success !== false,
      durationBucket: Number(payload.durationMs) < 250 ? 'fast' : Number(payload.durationMs) < 1000 ? 'normal' : 'slow',
      recommendationUsed: Boolean(payload.recommendationUsed),
      createdAt: new Date().toISOString(),
    };
  },
};
