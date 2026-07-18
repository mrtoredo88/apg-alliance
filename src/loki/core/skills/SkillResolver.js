import { getSkillRegistry } from './SkillRegistry.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function confidenceFrom(score = 0, capabilityConfidence = 0) {
  return Math.max(0, Math.min(99, Math.round(score * 0.72 + Number(capabilityConfidence || 0) * 0.28)));
}

export function resolveSkill(input = {}) {
  const capability = input.capabilityContext?.capability || '';
  const rows = getSkillRegistry()
    .map(skill => {
      const scored = skill.score(input);
      const prepared = scored.score ? skill.build(input) : {};
      return {
        skill,
        score: scored.score,
        confidence: confidenceFrom(scored.score, input.capabilityContext?.confidence),
        matchedSignals: scored.matchedSignals,
        prepared,
      };
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.confidence - a.confidence || b.skill.priority - a.skill.priority);
  const best = rows[0] || null;
  if (!best) {
    return {
      skill: '',
      selectedSkill: null,
      confidence: 0,
      capability,
      alternatives: [],
      reason: 'no_matching_skill',
      preparedParameters: {},
      planner: '',
      workflow: '',
      tools: [],
      recommendations: [],
    };
  }
  const prepared = best.prepared || {};
  return {
    skill: best.skill.id,
    selectedSkill: best.skill,
    confidence: best.confidence,
    capability,
    entity: prepared.entity || best.skill.supportedEntities[0] || '',
    contextLabel: input.knowledge?.screenContext?.type || input.context?.memory?.activeContext?.type || '',
    alternatives: rows.slice(1, 5).map(row => ({ id: row.skill.id, title: row.skill.title, confidence: row.confidence, reason: row.matchedSignals.join(', ') || 'capability' })),
    reason: best.matchedSignals.length ? `matched:${best.matchedSignals.join(',')}` : `capability:${capability}`,
    normalizedQuery: prepared.normalizedQuery || input.question || '',
    preparedParameters: prepared.preparedParameters || input.capabilityContext?.resolved || {},
    planner: prepared.planner || best.skill.planner || '',
    workflow: prepared.workflow || best.skill.workflow || '',
    tools: list(prepared.tools || best.skill.tools),
    recommendations: list(prepared.recommendations),
    description: best.skill.description || '',
  };
}

export class SkillResolver {
  resolve(input = {}) {
    return resolveSkill(input);
  }
}
