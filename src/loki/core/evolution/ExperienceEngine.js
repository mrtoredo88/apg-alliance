import { list } from './ConversationLearning.js';

const LIMIT = 800;

export function appendExperience(memory = {}, experience = null, feedback = null) {
  const current = list(memory.experienceMemory);
  const next = experience ? [experience, ...current].slice(0, LIMIT) : current.slice(0, LIMIT);
  return {
    experienceMemory: next,
    feedbackEvents: feedback ? [feedback, ...list(memory.feedbackEvents)].slice(0, LIMIT) : list(memory.feedbackEvents).slice(0, LIMIT),
  };
}

export function summarizeExperience(experiences = []) {
  const rows = list(experiences);
  const topAnswers = rows.filter(row => row.success).slice(0, 12);
  const worstAnswers = rows.filter(row => row.fallback || row.errors?.length).slice(0, 12);
  return {
    total: rows.length,
    successful: topAnswers.length,
    fallback: rows.filter(row => row.fallback).length,
    averageResponseTimeMs: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.responseTimeMs || 0), 0) / rows.length) : 0,
    topAnswers,
    worstAnswers,
  };
}
