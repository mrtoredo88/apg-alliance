export function buildSkillSnapshot(skillContext = {}) {
  return {
    version: 'v1',
    source: 'local',
    SelectedSkill: skillContext.skill || '',
    Confidence: Number(skillContext.confidence || 0),
    Capability: skillContext.capability || '',
    Entity: skillContext.entity || '',
    Context: skillContext.contextLabel || '',
    Planner: skillContext.planner || '',
    Workflow: skillContext.workflow || '',
    RelatedTools: skillContext.tools || [],
    Alternatives: (skillContext.alternatives || []).map(item => item.id).filter(Boolean),
    Reason: skillContext.reason || '',
    createdAt: skillContext.createdAt || new Date().toISOString(),
    empty: !skillContext.skill,
  };
}

export class SkillSnapshot {
  constructor(context = {}) {
    Object.assign(this, buildSkillSnapshot(context));
  }
}
