export function buildSkillContext({ question = '', capabilityContext = {}, resolution = {}, context = {} } = {}) {
  return {
    id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    version: 'v1',
    source: 'local',
    skill: resolution.skill || '',
    title: resolution.selectedSkill?.title || resolution.skill || '',
    capability: resolution.capability || capabilityContext.capability || '',
    entity: resolution.entity || '',
    confidence: Number(resolution.confidence || 0),
    contextLabel: resolution.contextLabel || '',
    planner: resolution.planner || '',
    workflow: resolution.workflow || '',
    tools: resolution.tools || [],
    alternatives: resolution.alternatives || [],
    reason: resolution.reason || '',
    description: resolution.description || '',
    normalizedQuery: resolution.normalizedQuery || question || '',
    preparedParameters: resolution.preparedParameters || {},
    recommendations: resolution.recommendations || [],
    previousSkill: context?.memory?.lastSkillContext?.skill || '',
    createdAt: new Date().toISOString(),
  };
}

export class SkillContext {
  constructor(input = {}) {
    Object.assign(this, buildSkillContext(input));
  }
}
