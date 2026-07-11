const VALID_ROLES = new Set(['user', 'partner', 'expert', 'admin', 'automation', '*']);

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function normalizeScenario(scenario) {
  const role = scenario.role || 'user';
  const normalized = {
    id: String(scenario.id || '').trim(),
    title: String(scenario.title || '').trim(),
    role,
    category: String(scenario.category || 'general').trim(),
    priority: Number.isFinite(Number(scenario.priority)) ? Number(scenario.priority) : 0,
    intent: String(scenario.intent || scenario.id || '').trim(),
    triggerConditions: asArray(scenario.triggerConditions || scenario.utterances),
    requiredData: asArray(scenario.requiredData),
    requiredPermissions: asArray(scenario.requiredPermissions),
    quickReplies: asArray(scenario.quickReplies),
    followUpActions: asArray(scenario.followUpActions || scenario.availableActions),
    fallback: scenario.fallback || null,
    relatedScenarios: asArray(scenario.relatedScenarios),
    handler: scenario.handler || null,
    enabled: scenario.enabled !== false,
  };
  if (!normalized.id || !/^[a-z0-9][a-z0-9._-]+$/.test(normalized.id)) throw new Error('Scenario id is invalid');
  if (!normalized.title) throw new Error(`Scenario ${normalized.id} has no title`);
  if (!VALID_ROLES.has(normalized.role)) throw new Error(`Scenario ${normalized.id} has invalid role`);
  return Object.freeze(normalized);
}

export class ScenarioRegistry {
  constructor(scenarios = []) {
    this.scenarios = new Map();
    scenarios.forEach(scenario => this.register(scenario));
  }

  register(scenario) {
    const normalized = normalizeScenario(scenario);
    if (this.scenarios.has(normalized.id)) throw new Error(`Duplicate Loki scenario: ${normalized.id}`);
    this.scenarios.set(normalized.id, normalized);
    return normalized;
  }

  list({ role, category, enabled = true } = {}) {
    return [...this.scenarios.values()]
      .filter(scenario => enabled === null || scenario.enabled === enabled)
      .filter(scenario => !role || scenario.role === '*' || scenario.role === role)
      .filter(scenario => !category || scenario.category === category)
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  get(id) {
    return this.scenarios.get(id) || null;
  }

  get size() {
    return this.scenarios.size;
  }
}
