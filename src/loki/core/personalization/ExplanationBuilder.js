function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function isExplainPersonalizationQuery(query = '') {
  const text = String(query || '').toLowerCase().replace(/ё/g, 'е');
  return text.includes('что ты знаешь обо мне')
    || text.includes('какие данные обо мне')
    || text.includes('почему персонал')
    || text.includes('как ты меня учитываешь')
    || text.includes('что используешь для рекомендаций');
}

export function buildPersonalizationPrivacyAnswer({ userContext = {}, preferences = {}, analysis = {} } = {}) {
  const rows = [
    userContext.role ? `роль: ${userContext.role}` : '',
    Number(userContext.level || 0) ? `уровень: ${Number(userContext.level)}` : '',
    Number(userContext.keys || 0) ? `ключи: ${Number(userContext.keys)}` : '',
    userContext.city ? `город: ${userContext.city}` : '',
    list(userContext.favoritePartners).length ? `избранные партнёры: ${list(userContext.favoritePartners).length}` : '',
    list(userContext.favoriteExperts).length ? `избранные эксперты: ${list(userContext.favoriteExperts).length}` : '',
    list(userContext.recentBookings).length ? `последние записи: ${list(userContext.recentBookings).length}` : '',
    list(userContext.recentVisits).length ? `последние посещения: ${list(userContext.recentVisits).length}` : '',
    list(userContext.activeEvents).length ? `активные мероприятия: ${list(userContext.activeEvents).length}` : '',
    list(userContext.activeBookings).length ? `активные встречи: ${list(userContext.activeBookings).length}` : '',
    preferences.categories?.length ? `частые категории: ${preferences.categories.map(item => item.value).slice(0, 3).join(', ')}` : '',
    analysis.experience ? `уровень знакомства с приложением: ${analysis.experience}` : '',
  ].filter(Boolean);
  return {
    intent: 'personalization.explain',
    preserveText: true,
    text: rows.length
      ? `Я использую только данные, которые уже загружены в АПГ для текущего пользователя:\n${rows.map(row => `• ${row}`).join('\n')}\n\nСкрытые данные, данные других пользователей и предположения о характере не использую.`
      : 'Сейчас у меня почти нет персонального контекста. Поэтому я использую обычные рекомендации АПГ без персонализации.',
    card: null,
    cards: [],
    personalizationContext: { enabled: rows.length > 0, privacyExplained: true },
  };
}

export function buildPersonalizedPrefix({ analysis = {}, reasons = [], preferences = {} } = {}) {
  const realReasons = list(reasons);
  if (realReasons.length) return `С учётом вашего контекста: ${realReasons.join('; ')}.`;
  if (analysis.shouldExplainMore) return 'Я добавлю чуть больше подсказок, потому что вы ещё только осваиваете сценарий.';
  if (analysis.shouldBeConcise) return 'Коротко, без лишнего вступления.';
  if (preferences.hasEnoughData) return 'Учёл ваши текущие данные АПГ.';
  return '';
}
