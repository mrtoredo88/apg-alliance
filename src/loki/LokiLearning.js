const MAX_SIGNALS = 40;

function toKey(value) {
  return String(value ?? '').toLowerCase().replace(/ё/g, 'е').trim();
}

function clampScore(value) {
  return Math.max(-6, Math.min(12, Number(value ?? 0)));
}

function bumpMap(map, key, delta = 1) {
  if (!key) return map ?? {};
  return { ...(map ?? {}), [key]: clampScore((map?.[key] ?? 0) + delta) };
}

function categoryOf(item = {}) {
  return toKey(item.category || item.categoryName || item.type || item.kind || item.tags?.[0] || '');
}

export function normalizeLokiLearning(learning = {}) {
  const source = learning && typeof learning === 'object' ? learning : {};
  return {
    categories: source.categories && typeof source.categories === 'object' ? source.categories : {},
    acceptedAdvice: source.acceptedAdvice && typeof source.acceptedAdvice === 'object' ? source.acceptedAdvice : {},
    ignoredAdvice: source.ignoredAdvice && typeof source.ignoredAdvice === 'object' ? source.ignoredAdvice : {},
    screens: source.screens && typeof source.screens === 'object' ? source.screens : {},
    signals: Array.isArray(source.signals) ? source.signals.slice(0, MAX_SIGNALS) : [],
    updatedAt: source.updatedAt ?? null,
  };
}

export function buildLearningSnapshot({ memory = {}, userMemory = {}, appState = {} } = {}) {
  const learning = normalizeLokiLearning(memory.learning);
  const favoriteCategories = userMemory.favoriteCategories ?? {};
  const topCategories = Object.entries({ ...learning.categories, ...favoriteCategories })
    .sort((a, b) => Number(b[1] ?? 0) - Number(a[1] ?? 0))
    .slice(0, 6)
    .map(([key]) => key);
  return {
    ...learning,
    topCategories,
    activePanel: appState.activePanel,
    userKeys: Number(appState.userKeys ?? 0),
  };
}

export function learnFromPanelVisit(learning, activePanel) {
  const next = normalizeLokiLearning(learning);
  return {
    ...next,
    screens: bumpMap(next.screens, activePanel, 1),
    signals: [{ type: 'panel_visit', value: activePanel, ts: Date.now() }, ...next.signals].slice(0, MAX_SIGNALS),
    updatedAt: new Date().toISOString(),
  };
}

export function learnFromRecommendationResult(learning, advice, status) {
  const next = normalizeLokiLearning(learning);
  const adviceId = advice?.adviceId ?? advice?.id;
  const category = categoryOf(advice?.card);
  const delta = status === 'opened' ? 2 : -1;
  return {
    ...next,
    categories: bumpMap(next.categories, category, delta),
    acceptedAdvice: status === 'opened' ? bumpMap(next.acceptedAdvice, adviceId, 1) : next.acceptedAdvice,
    ignoredAdvice: status === 'ignored' ? bumpMap(next.ignoredAdvice, adviceId, 1) : next.ignoredAdvice,
    signals: [{ type: `advice_${status}`, value: adviceId, ts: Date.now() }, ...next.signals].slice(0, MAX_SIGNALS),
    updatedAt: new Date().toISOString(),
  };
}

export function getRecommendationPenalty(learning, adviceId) {
  const next = normalizeLokiLearning(learning);
  const ignored = Number(next.ignoredAdvice?.[adviceId] ?? 0);
  const accepted = Number(next.acceptedAdvice?.[adviceId] ?? 0);
  return Math.max(0, ignored - accepted) * 0.35;
}

export function scoreItemByLearning(item, learning) {
  const next = normalizeLokiLearning(learning);
  const category = categoryOf(item);
  const categoryScore = category ? Number(next.categories?.[category] ?? 0) : 0;
  const text = toKey([item?.name, item?.title, item?.description, item?.category].filter(Boolean).join(' '));
  const semanticScore = Object.entries(next.categories ?? {}).reduce((sum, [key, score]) => {
    if (!key || !text.includes(key)) return sum;
    return sum + Number(score ?? 0) * 0.4;
  }, 0);
  return categoryScore + semanticScore;
}
