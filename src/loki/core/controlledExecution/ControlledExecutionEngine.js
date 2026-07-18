import { detectAgentConfirmation } from '../agent/AgentConfirmation.js';
import { resolveExecutionPolicy } from './ExecutionPolicy.js';
import { guardControlledExecution } from './ExecutionGuard.js';
import { resolveControlledDispatch } from './ExecutionDispatcher.js';
import { buildExecutionPreview } from './ExecutionPreview.js';
import { buildControlledExecutionResult } from './ExecutionResult.js';
import { buildControlledExecutionSnapshot } from './ExecutionSnapshot.js';

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function buildControlledExecutionId(executionContext = {}) {
  const basis = {
    capability: executionContext.capability || '',
    resolved: executionContext.resolved || {},
    missing: executionContext.missing || [],
    order: executionContext.executionPlan?.order || executionContext.executionOrder?.map?.(item => item.capability) || [],
    actionType: executionContext.actionType || '',
    navigation: executionContext.navigation || null,
  };
  let hash = 0;
  const text = stableJson(basis);
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return `ce-${Math.abs(hash).toString(36)}`;
}

function resolveConfirmation({ question = '', executionId = '', policy = {}, confirmationInput = null, memory = {} } = {}) {
  if (!policy.confirmationRequired) {
    return { required: false, status: 'confirmed', executionId, confirmedAt: new Date().toISOString(), source: 'policy:auto' };
  }
  const base = { required: true, status: 'pending', executionId, confirmedAt: null, source: null };
  const pending = memory?.lastControlledExecutionContext?.confirmation || null;
  const explicit = confirmationInput && confirmationInput.executionId === executionId ? confirmationInput : null;
  if (explicit?.status === 'rejected') return { ...base, status: 'rejected', source: explicit.source || 'confirmationInput' };
  if (explicit?.status === 'confirmed') return { ...base, status: 'confirmed', confirmedAt: explicit.confirmedAt || new Date().toISOString(), source: explicit.source || 'confirmationInput' };
  const signal = detectAgentConfirmation(question);
  if (signal.type === 'cancel' && pending?.executionId === executionId) return { ...base, status: 'rejected', source: 'agentConfirmation' };
  if (signal.type === 'confirm' && pending?.executionId === executionId && pending?.status === 'pending') {
    return { ...base, status: 'confirmed', confirmedAt: new Date().toISOString(), source: 'agentConfirmation' };
  }
  if (pending?.executionId && pending.executionId !== executionId) return { ...base, status: 'expired', source: 'plan_changed' };
  return base;
}

export function runControlledExecutionEngine({
  question = '',
  executionContext = null,
  context = {},
  memory = {},
  appState = {},
  appActions = null,
  confirmationInput = null,
} = {}) {
  const capability = executionContext?.capability || '';
  const executionId = buildControlledExecutionId(executionContext || {});
  const policy = resolveExecutionPolicy(capability);
  const confirmation = resolveConfirmation({ question, executionId, policy, confirmationInput, memory });
  const dispatcher = resolveControlledDispatch(executionContext || {});
  const guard = guardControlledExecution({ executionContext, policy, dispatch: dispatcher, context, appState, appActions });
  const preview = buildExecutionPreview({ executionContext, policy, dispatch: dispatcher, confirmation });
  const confirmationReady = !policy.confirmationRequired || confirmation.status === 'confirmed';
  const policyAllowsDispatch = policy.autoAllowed || (policy.confirmationRequired && confirmation.status === 'confirmed');
  const executionReady = Boolean(executionContext?.ready && guard.ok && policyAllowsDispatch && confirmationReady && dispatcher.action);
  const blocked = !guard.ok || policy.policy === 'BLOCK' || (policy.confirmationRequired && confirmation.status !== 'confirmed');
  const result = buildControlledExecutionResult({
    ready: executionReady,
    blocked,
    confirmationRequired: policy.confirmationRequired && confirmation.status !== 'confirmed',
    reason: !guard.ok ? guard.reason : policy.confirmationRequired && confirmation.status !== 'confirmed' ? 'confirmation_required' : policy.reason,
    dispatch: executionReady ? dispatcher.action : null,
  });
  const controlledExecutionContext = {
    id: executionId,
    version: 'v1',
    source: 'local',
    capability,
    executionContext,
    executionReady,
    confirmationRequired: policy.confirmationRequired,
    confirmation,
    policy,
    guard,
    dispatcher,
    preview,
    result,
    createdAt: new Date().toISOString(),
  };
  return {
    controlledExecutionContext,
    controlledExecutionSnapshot: buildControlledExecutionSnapshot(controlledExecutionContext),
  };
}

export class ControlledExecutionEngine {
  run(input = {}) {
    return runControlledExecutionEngine(input);
  }
}
