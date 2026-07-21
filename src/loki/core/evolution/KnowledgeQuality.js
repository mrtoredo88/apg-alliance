import { list, text } from './ConversationLearning.js';

export function evaluateKnowledgeQuality({ result = {}, knowledgeIndexResult = {}, experience = null } = {}) {
  const answer = text(result?.text, 1000);
  const hitCount = list(result?.knowledgeIndexSearch?.entities).length || list(knowledgeIndexResult?.knowledgeIndexSearch?.entities).length;
  const hasAction = Boolean(result?.executeAction || result?.autoAction || result?.card?.action);
  const fallback = Boolean(experience?.fallback || result?.debug?.timeout || !answer);
  const confidence = fallback ? 0.22 : Math.min(0.96, 0.5 + (hitCount ? 0.22 : 0) + (hasAction ? 0.12 : 0) + (answer.length > 80 ? 0.1 : 0));
  return {
    confidence: Math.round(confidence * 100),
    usefulness: Math.round((confidence - (fallback ? 0.1 : 0)) * 100),
    knowledgeUsed: hitCount > 0,
    fallback,
    canAnswerBetter: fallback || confidence < 0.72,
    knowledgeHits: hitCount,
    actionReady: hasAction,
  };
}
