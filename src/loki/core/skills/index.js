import { resolveSkill } from './SkillResolver.js';
import { buildSkillContext } from './SkillContext.js';
import { buildSkillSnapshot } from './SkillSnapshot.js';
import { validateSkillContext } from './SkillValidator.js';

export function runLokiSkillResolver(input = {}) {
  const resolution = resolveSkill(input);
  const draft = buildSkillContext({ question: input.question, capabilityContext: input.capabilityContext, resolution, context: input.context });
  const validation = validateSkillContext(draft);
  const skillContext = { ...draft, validation };
  const skillSnapshot = { ...buildSkillSnapshot(skillContext), validation };
  return { skillContext, skillSnapshot };
}

export { LokiSkill } from './LokiSkill.js';
export { getSkillRegistry, getSkillById, SkillRegistry } from './SkillRegistry.js';
export { resolveSkill, SkillResolver } from './SkillResolver.js';
export { buildSkillContext, SkillContext } from './SkillContext.js';
export { buildSkillHistoryPatch, addSkillHistoryItem, SkillHistory } from './SkillHistory.js';
export { buildSkillSnapshot, SkillSnapshot } from './SkillSnapshot.js';
export { explainSkill, explainLastSkill, isSkillExplainQuery, SkillExplanation } from './SkillExplanation.js';
export { validateSkillContext, SkillValidator } from './SkillValidator.js';
