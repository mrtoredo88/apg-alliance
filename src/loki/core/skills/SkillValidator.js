import { getToolDefinition } from '../tools/ToolRegistry.js';
import { getWorkflowDefinition } from '../workflows/WorkflowRegistry.js';
import { PLANNER_GOALS } from '../planner/GoalResolver.js';
import { getSkillById } from './SkillRegistry.js';

const PLANNER_VALUES = new Set(Object.values(PLANNER_GOALS));

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validateSkillContext(skillContext = {}) {
  const errors = [];
  const warnings = [];
  if (!skillContext.skill) errors.push('skill_missing');
  if (skillContext.skill && !getSkillById(skillContext.skill)) errors.push(`skill_unknown:${skillContext.skill}`);
  if (skillContext.planner && !PLANNER_VALUES.has(skillContext.planner)) errors.push(`planner_unknown:${skillContext.planner}`);
  if (skillContext.workflow && !getWorkflowDefinition(skillContext.workflow)) errors.push(`workflow_unknown:${skillContext.workflow}`);
  list(skillContext.tools).forEach(toolId => {
    if (!getToolDefinition(toolId)) errors.push(`tool_unknown:${toolId}`);
  });
  if (!skillContext.capability) warnings.push('capability_empty');
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export class SkillValidator {
  validate(context = {}) {
    return validateSkillContext(context);
  }
}
