export function buildCapabilitySnapshot(capabilityContext = {}) {
  return {
    version: 'v1',
    source: 'local',
    DetectedCapability: capabilityContext.capability || '',
    Confidence: Number(capabilityContext.confidence || 0),
    Parameters: capabilityContext.required || [],
    Resolved: capabilityContext.resolved || {},
    Missing: capabilityContext.missing || [],
    Alternatives: (capabilityContext.alternatives || []).map(item => item.id || item.capability).filter(Boolean),
    RelatedTools: capabilityContext.relatedTools || [],
    RelatedScreens: capabilityContext.relatedScreens || [],
    ExecutionOrder: capabilityContext.executionOrder || [],
    category: capabilityContext.category || '',
    createdAt: capabilityContext.createdAt || new Date().toISOString(),
    empty: !capabilityContext.capability,
  };
}

export class CapabilitySnapshot {
  constructor(context = {}) {
    Object.assign(this, buildCapabilitySnapshot(context));
  }
}
