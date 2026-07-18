import { nowMs } from '../tools/ToolResult.js';
import { resolveExecution } from './ExecutionResolver.js';
import { buildExecutionContext } from './ExecutionContext.js';
import { validateExecutionContext } from './ExecutionValidator.js';
import { buildExecutionSnapshot } from './ExecutionSnapshot.js';

export function runCapabilityExecutionBridge({
  question = '',
  capabilityContext = null,
  context = {},
  memory = {},
  knowledge = {},
  parameters = {},
} = {}) {
  const started = nowMs();
  const resolution = resolveExecution({ question, capabilityContext, context, memory, knowledge, parameters });
  const draftContext = buildExecutionContext({ question, capabilityContext, resolution, context });
  const validation = validateExecutionContext(draftContext);
  const executionContext = {
    ...draftContext,
    validation,
    ready: validation.ready,
    durationMs: Math.round(nowMs() - started),
  };
  const executionSnapshot = {
    ...buildExecutionSnapshot(executionContext),
    durationMs: executionContext.durationMs,
  };
  return {
    executionContext,
    executionSnapshot,
  };
}

export class CapabilityExecutionBridge {
  resolve(input = {}) {
    return runCapabilityExecutionBridge(input);
  }
}
