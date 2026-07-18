import { WORKFLOW_STATES, isTerminalWorkflowState } from './WorkflowState.js';

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function buildWorkflowSnapshot(memory = {}) {
  const source = memory?.lastWorkflowContext || memory?.workflowContext || null;
  if (!source?.id) {
    return {
      empty: true,
      source: 'none',
      active: null,
      completedSteps: [],
      currentStep: null,
    };
  }
  const active = !isTerminalWorkflowState(source.status) ? source : null;
  return {
    empty: false,
    source: 'local',
    active: active ? {
      id: source.id,
      workflowId: source.workflowId,
      title: source.title,
      status: source.status || WORKFLOW_STATES.CREATED,
      currentStep: source.progress?.currentStep || null,
      progress: source.progress?.progress || 0,
      startedAt: source.progress?.startedAt || source.startedAt || '',
      updatedAt: source.progress?.updatedAt || source.updatedAt || '',
    } : null,
    completedSteps: list(source.progress?.completedSteps || source.completedSteps),
    currentStep: source.progress?.currentStep || null,
    last: {
      id: source.id,
      workflowId: source.workflowId,
      status: source.status,
      completedSteps: list(source.progress?.completedSteps),
    },
  };
}

export function summarizeWorkflowSnapshot(snapshot = null) {
  if (!snapshot || snapshot.empty) return null;
  return {
    source: snapshot.source,
    activeWorkflowId: snapshot.active?.workflowId || '',
    currentStep: snapshot.currentStep?.id || '',
    completedSteps: snapshot.completedSteps?.slice?.(0, 8) || [],
  };
}
