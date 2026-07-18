export function buildCapabilityContext({ question = '', resolution = {}, conversation = null, decision = null, context = {}, memory = {} } = {}) {
  const capability = resolution.bestCapability || null;
  return {
    version: 'v1',
    capability: resolution.capability || capability?.id || '',
    title: capability?.title || '',
    category: capability?.category || '',
    confidence: Number(resolution.confidence || 0),
    required: resolution.requiredParameters || [],
    resolved: resolution.resolvedParameters || {},
    missing: resolution.missingParameters || [],
    alternatives: resolution.alternatives || [],
    relatedTools: capability?.requiredTools || [],
    relatedScreens: capability?.relatedScreens || [],
    executionOrder: resolution.executionOrder || [],
    matchedAliases: resolution.matchedAliases || [],
    requiredRole: capability?.requiredRole || 'user',
    question: String(question || '').slice(0, 600),
    conversationId: conversation?.conversationId || conversation?.session?.conversationId || '',
    previousCapability: memory?.lastCapabilityContext?.capability || '',
    decisionId: decision?.decisionId || '',
    actorRole: context?.actor?.role || context?.user?.role || 'user',
    createdAt: new Date().toISOString(),
  };
}

export class CapabilityContext {
  constructor(input = {}) {
    Object.assign(this, buildCapabilityContext(input));
  }
}
