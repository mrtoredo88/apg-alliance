import { goalLabel } from './JourneyPlanner.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function nowIso() {
  return new Date().toISOString();
}

export function getActiveJourney(context = {}, now = Date.now()) {
  const journey = context?.memory?.lastJourneyContext || context?.memory?.journeyContext || null;
  if (!journey?.goal || !journey.updatedAt) return null;
  const updated = new Date(journey.updatedAt).getTime();
  if (!Number.isFinite(updated) || now - updated > 1000 * 60 * 60 * 3) return null;
  if (journey.status === 'completed') return null;
  return journey;
}

export function createJourneyState({ goal, plan = [], progress = {}, selected = null, previous = null, suggestions = [] } = {}) {
  const selectedItem = selected || progress.selected || previous?.selectedItem || null;
  return {
    id: previous?.id || `journey-${Date.now()}`,
    goal,
    goalLabel: goalLabel(goal),
    status: progress.complete ? 'completed' : 'active',
    steps: progress.steps?.length ? progress.steps : plan,
    completedStepIds: list(progress.completedStepIds),
    currentStep: progress.currentStep || null,
    selectedItem: selectedItem ? {
      id: selectedItem.id,
      type: selectedItem.type,
      title: selectedItem.title || selectedItem.name,
      partnerId: selectedItem.partnerId || '',
      locationId: selectedItem.type === 'location' ? selectedItem.id : '',
    } : null,
    seenItemIds: Array.from(new Set([...list(previous?.seenItemIds), ...list(selectedItem?.id ? [selectedItem.id] : [])].map(String))),
    suggestions: suggestions.map(item => ({ label: item.label, action: item.action || null, href: item.href || '' })),
    updatedAt: nowIso(),
  };
}

export function summarizeJourney(journey = null) {
  if (!journey) return null;
  const done = list(journey.steps).filter(step => step.status === 'done');
  const current = journey.currentStep || list(journey.steps).find(step => step.status === 'current');
  const lines = done.length
    ? done.slice(0, 4).map(step => `✔ ${step.title}`)
    : ['Пока только определили цель.'];
  return [
    `Идём к цели: ${journey.goalLabel || goalLabel(journey.goal)}.`,
    ...lines,
    current ? `Следующий шаг: ${current.title}.` : 'Следующий шаг: выбрать действие.',
  ].join('\n');
}

export function completeJourney(journey = null) {
  if (!journey) return null;
  return {
    ...journey,
    status: 'completed',
    steps: list(journey.steps).map(step => ({ ...step, status: 'done' })),
    currentStep: null,
    updatedAt: nowIso(),
  };
}
