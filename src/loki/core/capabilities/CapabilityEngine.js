import { nowMs } from '../tools/ToolResult.js';
import { resolveCapability } from './CapabilityResolver.js';
import { buildCapabilityContext } from './CapabilityContext.js';
import { buildCapabilitySnapshot } from './CapabilitySnapshot.js';
import { validateCapabilityContext } from './CapabilityValidator.js';

export function runLokiCapabilityEngine({
  question = '',
  intent = {},
  reasoningResult = null,
  conversationContext = null,
  decisionContext = null,
  context = {},
  memory = {},
  knowledge = {},
} = {}) {
  const started = nowMs();
  const resolution = resolveCapability({
    question,
    intent,
    reasoningResult,
    conversation: conversationContext,
    decision: decisionContext,
    context,
    memory,
    knowledge,
  });
  const capabilityContext = buildCapabilityContext({
    question,
    resolution,
    conversation: conversationContext,
    decision: decisionContext,
    context,
    memory,
  });
  const validation = validateCapabilityContext(capabilityContext);
  const capabilitySnapshot = {
    ...buildCapabilitySnapshot(capabilityContext),
    validation,
    durationMs: Math.round(nowMs() - started),
  };
  return {
    capabilityContext: {
      ...capabilityContext,
      validation,
      durationMs: capabilitySnapshot.durationMs,
    },
    capabilitySnapshot,
  };
}

export class CapabilityEngine {
  resolve(input = {}) {
    return runLokiCapabilityEngine(input);
  }
}
