import { normalizeText } from '../lokiCoreUtils.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hasActionLabel(result = {}, matcher) {
  if (!result) return false;
  const labels = [
    ...list(result.suggestions).map(item => item.label),
    ...list(result.card?.actions).map(item => item.label),
    ...list(result.cards).flatMap(card => list(card.actions).map(item => item.label)),
  ].map(normalizeText);
  return labels.some(matcher);
}

export function resolveProgress({ query = '', plan = [], reasoningResult = null, previous = null, goal = '' } = {}) {
  const text = normalizeText(query);
  const selected = reasoningResult?.ranked?.[0] || reasoningResult?.card || previous?.selectedItem || null;
  let completedIds = new Set(list(previous?.completedStepIds));
  if (reasoningResult?.ranked?.length || reasoningResult?.card) {
    completedIds.add('find_options');
    completedIds.add('find_event');
    completedIds.add('find_promotion');
    completedIds.add('find_gift');
    completedIds.add('find_info');
    completedIds.add('find_place');
    completedIds.add('find_contact');
    completedIds.add('choose_provider');
  }
  if (selected) completedIds.add('compare');
  if (hasActionLabel(reasoningResult, label => label.includes('открыть') || label.includes('читать') || label.includes('посмотреть'))) {
    completedIds.add('open_profile');
    completedIds.add('open_event');
    completedIds.add('open_partner');
    completedIds.add('open_gift');
  }
  if (hasActionLabel(reasoningResult, label => label.includes('маршрут'))) completedIds.add('open_map');
  if (hasActionLabel(reasoningResult, label => label.includes('запис'))) {
    completedIds.add('choose_service');
    completedIds.add('book_or_contact');
  }
  if (hasActionLabel(reasoningResult, label => label.includes('связ'))) completedIds.add('contact');
  if (text.includes('время') || text.includes('завтра') || text.includes('свобод')) completedIds.add('choose_time');
  if (text.includes('услов')) completedIds.add('check_terms');
  if (text.includes('ключ')) completedIds.add('check_keys');
  if (text.includes('готово') || text.includes('получилось') || text.includes('записался') || text.includes('записалась') || text.includes('зарегистриров')) {
    plan.forEach(step => completedIds.add(step.id));
  }
  const decorated = plan.map(step => ({ ...step, status: completedIds.has(step.id) ? 'done' : 'pending' }));
  const currentIndex = decorated.findIndex(step => step.status !== 'done');
  const nextIndex = currentIndex >= 0 ? currentIndex : decorated.length - 1;
  return {
    goal,
    selected,
    completedStepIds: Array.from(completedIds),
    steps: decorated.map((step, index) => ({ ...step, status: index === nextIndex && step.status !== 'done' ? 'current' : step.status })),
    currentStep: decorated[nextIndex] || decorated[decorated.length - 1] || null,
    complete: decorated.length > 0 && decorated.every(step => completedIds.has(step.id)),
  };
}
