export function buildKnowledgeSchedulerState({ candidates = [], unknownTopics = [], feedback = {} } = {}) {
  const queue = [
    candidates.length ? { cadence: 'daily', task: 'review_knowledge_candidates', count: candidates.length } : null,
    unknownTopics.length ? { cadence: 'daily', task: 'triage_unknown_topics', count: unknownTopics.length } : null,
    feedback.negative ? { cadence: 'weekly', task: 'inspect_bad_answers', count: feedback.negative } : null,
  ].filter(Boolean);
  return { mode: 'owner_review', autoApply: false, queue, nextReviewHint: queue[0]?.cadence || 'weekly' };
}
