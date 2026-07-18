import { getToolDefinition } from '../tools/ToolRegistry.js';
import { BookingWorkflow } from './workflows/BookingWorkflow.js';
import { EventWorkflow } from './workflows/EventWorkflow.js';
import { GiftWorkflow } from './workflows/GiftWorkflow.js';
import { JourneyWorkflow } from './workflows/JourneyWorkflow.js';
import { PartnerWorkflow } from './workflows/PartnerWorkflow.js';
import { ReferralWorkflow } from './workflows/ReferralWorkflow.js';
import { WorkspaceWorkflow } from './workflows/WorkspaceWorkflow.js';

export const WORKFLOW_REGISTRY = [
  BookingWorkflow,
  EventWorkflow,
  JourneyWorkflow,
  PartnerWorkflow,
  GiftWorkflow,
  WorkspaceWorkflow,
  ReferralWorkflow,
].map(item => ({
  version: 'v1',
  declarative: true,
  readOnly: true,
  safe: true,
  ...item,
}));

const BY_ID = new Map(WORKFLOW_REGISTRY.map(item => [item.id, item]));

export function getWorkflowRegistry() {
  return WORKFLOW_REGISTRY.slice();
}

export function getWorkflowDefinition(id) {
  return BY_ID.get(id) || null;
}

export function getWorkflowToolDefinitions(workflow = {}) {
  return (workflow.steps || [])
    .filter(step => step.kind === 'tool')
    .map(step => ({ stepId: step.id, toolId: step.toolId, definition: getToolDefinition(step.toolId) }));
}
