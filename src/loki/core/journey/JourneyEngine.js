import { normalizeText } from '../lokiCoreUtils.js';
import { detectJourneyGoal, JOURNEY_GOALS } from './GoalDetector.js';
import { createJourneyPlan } from './JourneyPlanner.js';
import { resolveProgress } from './ProgressTracker.js';
import { resolveJourneyActions } from './ActionResolver.js';
import { completeJourney, createJourneyState, getActiveJourney, summarizeJourney } from './JourneyState.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isJourneyCandidate(goal, reasoningResult) {
  return goal && goal !== JOURNEY_GOALS.GENERAL && Boolean(reasoningResult || goal);
}

function completionText(goal) {
  if (goal === JOURNEY_GOALS.BOOK_SERVICE) return 'Готово. Дальше запись завершается в карточке партнёра или специалиста.';
  if (goal === JOURNEY_GOALS.JOIN_EVENT) return 'Готово. Регистрация продолжается в карточке мероприятия.';
  if (goal === JOURNEY_GOALS.CLAIM_GIFT) return 'Готово. Подарок открыт, дальше можно проверить условия получения.';
  return 'Готово. Мы довели путь до следующего действия.';
}

function shouldSuppressRepeat(previous, selected) {
  return previous?.selectedItem?.id && selected?.id && String(previous.selectedItem.id) === String(selected.id);
}

export function runJourneyEngine({ question = '', intent = {}, knowledge = {}, reasoningResult = null, context = {} } = {}) {
  const query = normalizeText(question);
  const previous = getActiveJourney(context);
  const goal = detectJourneyGoal({ query, intent, reasoningResult, context });
  if (goal.mode === 'summary') {
    const text = summarizeJourney(previous) || 'Пока у нас нет активного пути. Скажи, чего хочешь добиться, и я поведу дальше.';
    return { intent: 'journey.summary', preserveText: true, text, card: reasoningResult?.card || null, cards: [], journeyContext: previous, journeyHandled: true };
  }
  if (goal.mode === 'recovery') {
    const text = previous
      ? `Мы остановились на шаге: ${previous.currentStep?.title || 'выбрать следующее действие'}.\nПродолжим?`
      : 'Активного пути в этой сессии не вижу. Напиши цель, и я соберу следующий шаг.';
    return { intent: 'journey.recovery', preserveText: true, text, card: reasoningResult?.card || null, cards: [], suggestions: previous?.suggestions || [], journeyContext: previous, journeyHandled: true };
  }
  if (goal.mode === 'completion') {
    const completed = completeJourney(previous);
    return { intent: 'journey.completed', preserveText: true, text: completionText(previous?.goal || goal.id), card: reasoningResult?.card || null, cards: [], journeyContext: completed, journeyHandled: true };
  }
  if (!isJourneyCandidate(goal.id, reasoningResult)) return null;
  const selected = reasoningResult?.ranked?.[0] || reasoningResult?.card || previous?.selectedItem || null;
  const plan = createJourneyPlan(goal.id, selected);
  const progress = resolveProgress({ query, plan, reasoningResult, previous, goal: goal.id });
  const suggestions = resolveJourneyActions({ goal: goal.id, selected, reasoningResult, progress });
  const journey = createJourneyState({ goal: goal.id, plan, progress, selected, previous: previous?.goal === goal.id ? previous : null, suggestions });
  const current = journey.currentStep?.title || 'выбрать следующее действие';
  const intro = reasoningResult?.text || 'Я собрал подходящий следующий шаг по данным АПГ.';
  const repeat = shouldSuppressRepeat(previous, selected);
  const summary = summarizeJourney(journey);
  const text = [
    repeat ? 'Продолжаем тот же путь, карточку заново не пересказываю.' : intro,
    summary ? `\n${summary}` : '',
    `\nСледующее действие: ${current}.`,
  ].filter(Boolean).join('\n');
  return {
    ...reasoningResult,
    intent: `journey.${goal.id.toLowerCase()}`,
    preserveText: true,
    text,
    suggestions,
    journeyContext: journey,
    journey: { goal: goal.id, confidence: goal.confidence, currentStep: journey.currentStep, completed: list(journey.completedStepIds) },
    cards: list(reasoningResult?.cards),
    card: reasoningResult?.card || null,
  };
}
