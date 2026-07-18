const MAX_SKILL_HISTORY = 100;

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function addSkillHistoryItem(history = [], skillContext = {}) {
  if (!skillContext?.skill) return list(history).slice(0, MAX_SKILL_HISTORY);
  const item = {
    id: skillContext.id || `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    skill: skillContext.skill,
    capability: skillContext.capability,
    confidence: Number(skillContext.confidence || 0),
    planner: skillContext.planner || '',
    workflow: skillContext.workflow || '',
    tools: list(skillContext.tools).slice(0, 5),
    createdAt: skillContext.createdAt || new Date().toISOString(),
  };
  return [item, ...list(history)].slice(0, MAX_SKILL_HISTORY);
}

export function buildSkillHistoryPatch(memory = {}, skillContext = {}) {
  return {
    skillHistory: addSkillHistoryItem(memory.skillHistory, skillContext),
  };
}

export class SkillHistory {
  constructor(history = []) {
    this.history = list(history).slice(0, MAX_SKILL_HISTORY);
  }

  add(context = {}) {
    this.history = addSkillHistoryItem(this.history, context);
    return this.history;
  }
}
