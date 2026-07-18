function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function isSkillExplainQuery(question = '') {
  const query = String(question || '').toLowerCase();
  return query.includes('почему') && (query.includes('skill') || query.includes('скилл') || query.includes('сценар') || query.includes('навык'));
}

export function explainSkill(skillContext = {}) {
  if (!skillContext?.skill) return 'Пока нет выбранного Skill: сначала нужно обработать обычный запрос Локи.';
  const rows = [
    `Выбран Skill ${skillContext.skill}, потому что capability ${skillContext.capability} соответствует его специализации.`,
    `Уверенность ${skillContext.confidence}%: учитывались capability, контекст, сигналы запроса и приоритет Skill.`,
  ];
  if (skillContext.alternatives?.length) rows.push(`Альтернативы: ${skillContext.alternatives.map(item => item.id).join(', ')}.`);
  if (skillContext.description) rows.push(`Возможности: ${skillContext.description}`);
  if (skillContext.planner) rows.push(`Planner: ${skillContext.planner}.`);
  if (skillContext.workflow) rows.push(`Workflow: ${skillContext.workflow}.`);
  if (list(skillContext.tools).length) rows.push(`Tools: ${skillContext.tools.join(', ')}.`);
  return rows.join('\n');
}

export function explainLastSkill(memory = {}) {
  return {
    intent: 'skill.explain',
    preserveText: true,
    text: explainSkill(memory.lastSkillContext || null),
    card: null,
    cards: [],
    skillContext: memory.lastSkillContext || null,
    skillSnapshot: memory.lastSkillSnapshot || null,
  };
}

export class SkillExplanation {
  explain(context = {}) {
    return explainSkill(context);
  }
}
