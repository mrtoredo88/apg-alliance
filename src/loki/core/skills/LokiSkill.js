function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function clean(value) {
  return String(value ?? '').trim();
}

export class LokiSkill {
  constructor(definition = {}) {
    this.id = definition.id || '';
    this.title = definition.title || definition.id || '';
    this.supportedCapabilities = list(definition.supportedCapabilities);
    this.supportedEntities = list(definition.supportedEntities);
    this.supportedContexts = list(definition.supportedContexts);
    this.priority = Number(definition.priority || 50);
    this.description = definition.description || '';
    this.planner = definition.planner || '';
    this.workflow = definition.workflow || '';
    this.tools = list(definition.tools);
    this.signals = list(definition.signals);
    this.prepare = typeof definition.prepare === 'function' ? definition.prepare : () => ({});
  }

  supports(capability = '') {
    return this.supportedCapabilities.includes(capability);
  }

  score(input = {}) {
    const capability = input.capabilityContext?.capability || '';
    const query = clean(input.question || input.capabilityContext?.question).toLowerCase();
    let score = this.supports(capability) ? 62 : 0;
    const matchedSignals = this.signals.filter(signal => query.includes(signal));
    score += matchedSignals.length * 6;
    if (this.supportedContexts.includes(input.context?.memory?.activeContext?.type)) score += 6;
    if (this.supportedEntities.includes(input.knowledge?.screenContext?.item?.type)) score += 8;
    score += Math.min(12, this.priority / 10);
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      matchedSignals,
    };
  }

  build(input = {}) {
    return this.prepare(input) || {};
  }
}
