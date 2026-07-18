import { nowMs } from '../tools/ToolResult.js';
import { buildDecisionTrace } from './DecisionTrace.js';
import { resolveDecisionAlternatives, resolveDecisionReason } from './DecisionResolver.js';
import { scoreDecision } from './DecisionScorer.js';
import { composeDecisionExplanation } from './DecisionExplanation.js';
import { buildDecisionEvents } from './DecisionHistory.js';
import { buildDecisionSnapshot } from './DecisionSnapshot.js';
import { validateDecision } from './DecisionValidator.js';

function decisionId() {
  return `decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function targetOf(result = {}) {
  const card = result.card || result.cards?.[0] || result.ranked?.[0] || null;
  return card ? {
    id: card.id || '',
    type: card.type || '',
    title: card.title || card.name || '',
  } : null;
}

export function runLokiDecisionEngine({ question = '', result = {}, context = {} } = {}) {
  const started = nowMs();
  const previousSnapshot = buildDecisionSnapshot(context?.memory || {});
  const trace = buildDecisionTrace({ result, context });
  const alternatives = resolveDecisionAlternatives({ result, context });
  const score = scoreDecision({ result, trace, alternatives });
  const decision = {
    version: 'v1',
    decisionId: decisionId(),
    question: String(question || '').slice(0, 500),
    goal: trace.goal,
    intent: result.intent || trace.intent || 'unknown',
    conversationContext: result.conversationContext?.snapshot || null,
    memoryUsed: result.memoryContext?.used || [],
    plannerUsed: trace.plannerUsed,
    workflowUsed: trace.workflowUsed,
    agentDecision: trace.agentDecision,
    toolCalls: result.workflowContext?.toolCalls || (result.toolContext?.call ? [result.toolContext.call] : []),
    actions: result.actionCenter?.suggested || result.suggestions || result.card?.actions || [],
    confidence: score.confidence,
    level: score.level,
    confidenceReasons: score.reasons,
    reason: resolveDecisionReason({ result, alternatives }),
    alternatives,
    duration: trace.duration + Math.round(nowMs() - started),
    trace,
    previousSnapshot,
    target: targetOf(result),
    status: score.level === 'low' ? 'low_confidence' : 'completed',
    createdAt: new Date().toISOString(),
  };
  const validation = validateDecision(decision);
  const withExplanation = {
    ...decision,
    validation,
  };
  return {
    ...withExplanation,
    explanation: composeDecisionExplanation({ decision: withExplanation, result }),
    events: buildDecisionEvents(withExplanation),
  };
}
