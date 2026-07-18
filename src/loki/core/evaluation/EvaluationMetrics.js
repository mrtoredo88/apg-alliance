function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function lower(value) {
  return String(value ?? '').toLowerCase();
}

function words(value) {
  return lower(value).split(/[\s,.;:!?()[\]«»"'-]+/).filter(Boolean);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function overlap(a = '', b = '') {
  const left = new Set(words(a).filter(item => item.length > 2));
  const right = new Set(words(b).filter(item => item.length > 2));
  if (!left.size || !right.size) return 0;
  let hits = 0;
  left.forEach(item => { if (right.has(item)) hits += 1; });
  return hits / Math.max(1, Math.min(left.size, right.size));
}

function repeatedSentenceRatio(answer = '') {
  const rows = String(answer || '').split(/[.!?\n]+/).map(item => item.trim().toLowerCase()).filter(item => item.length > 18);
  if (rows.length < 2) return 0;
  return 1 - new Set(rows).size / rows.length;
}

function hasAny(value, terms = []) {
  const source = lower(value);
  return terms.some(term => source.includes(term));
}

function scoreAnswerQuality(ctx = {}) {
  const answer = ctx.answer || '';
  const count = words(answer).length;
  const relevance = overlap(ctx.question, answer);
  let score = 68;
  if (count >= 12) score += 12;
  if (count >= 28) score += 8;
  if (count > 180) score -= 12;
  if (count > 280) score -= 18;
  if (answer.includes('\n') || answer.includes('•')) score += 5;
  if (relevance > 0.18) score += 10;
  if (relevance < 0.04 && words(ctx.question).length > 2) score -= 12;
  score -= repeatedSentenceRatio(answer) * 26;
  if (hasAny(answer, ['ничего не придумываю', 'не вижу', 'пока нет'])) score += 4;
  return {
    score: clamp(score),
    completeness: clamp(count >= 28 ? 88 : count >= 12 ? 72 : 45),
    clarity: clamp(86 - Math.max(0, count - 180) * 0.2),
    extraInformation: clamp(count > 180 ? 100 - (count - 180) * 0.4 : 94),
    repetitions: clamp(100 - repeatedSentenceRatio(answer) * 100),
    relevance: clamp(55 + relevance * 80),
  };
}

function scoreContextCoverage(ctx = {}) {
  const sources = [
    ['Conversation', ctx.conversationContext || ctx.decisionContext?.conversationContext],
    ['Memory', ctx.memoryContext || ctx.decisionContext?.memoryUsed?.length],
    ['Knowledge', ctx.knowledge],
    ['Journey', ctx.journeyContext],
    ['Partner Context', ctx.knowledge?.screenContext?.type === 'partner' || ctx.knowledge?.sources?.partners?.length],
    ['Workspace Context', ctx.appContext?.activePanel === 'workspace' || ctx.knowledge?.sources?.workspaceAnalytics],
    ['Decision', ctx.decisionContext?.decisionId],
  ];
  const used = sources.filter(([, value]) => Boolean(value)).map(([name]) => name);
  const missing = sources.filter(([, value]) => !value).map(([name]) => name);
  return {
    coverage: clamp((used.length / sources.length) * 100),
    used,
    missing,
  };
}

function scoreToolQuality(ctx = {}) {
  const question = lower(ctx.question);
  const toolNeeded = hasAny(question, ['сейчас', 'сегодня', 'рядом', 'акции', 'мероприят', 'подар', 'ключ', 'запис', 'новост', 'адрес', 'график', 'контакт']);
  const toolUsed = Boolean(ctx.toolContext || ctx.usedTools?.length || ctx.decisionContext?.trace?.toolCalls);
  const toolUseful = toolUsed && (ctx.toolContext?.status !== 'denied') && (ctx.toolContext?.status !== 'failed') && ctx.toolContext?.validation?.ok !== false;
  let score = 92;
  if (toolNeeded && !toolUsed) score = 70;
  if (!toolNeeded && toolUsed) score = 76;
  if (toolUsed && toolUseful) score = 96;
  if (ctx.toolContext?.status === 'denied' || ctx.toolContext?.toolResult?.success === false) score = 48;
  return { toolNeeded, toolUsed, toolUseful: Boolean(toolUseful), score: clamp(score) };
}

function scoreDecisionQuality(ctx = {}) {
  const decision = ctx.decisionContext || {};
  let score = 72;
  if (decision.decisionId) score += 8;
  if (decision.reason) score += 7;
  if (decision.validation?.ok) score += 6;
  if (decision.level === 'high') score += 7;
  if (decision.level === 'low') score -= 18;
  if (decision.alternatives?.length) score += 4;
  if (decision.validation?.ok === false) score -= 20;
  return {
    score: clamp(score),
    grounded: Boolean(decision.reason || decision.trace?.engines?.length),
    stable: decision.level !== 'low',
    confidence: clamp(Number(decision.confidence || 0) * 100),
    conflicts: decision.validation?.ok === false ? [decision.validation.reason] : [],
  };
}

function scoreActionQuality(ctx = {}) {
  const actions = list(ctx.actions);
  if (!actions.length) return { score: 100, relevance: 100, clarity: 100, amount: 100, logic: 100, count: 0 };
  const count = actions.length;
  const withLabels = actions.filter(item => item.label || item.action?.type).length;
  const relevance = actions.some(item => overlap(ctx.question, item.label || item.action?.type || '') > 0.1) ? 92 : 78;
  const amount = count <= 3 ? 96 : count <= 5 ? 80 : 58;
  const clarity = clamp((withLabels / count) * 100);
  return { score: clamp((relevance + amount + clarity + 88) / 4), relevance, clarity, amount, logic: 88, count };
}

function scorePersonalization(ctx = {}) {
  const answer = lower(ctx.answer);
  const facts = [
    ctx.appContext?.userName && answer.includes(lower(ctx.appContext.userName)),
    ctx.appContext?.role && answer.includes(lower(ctx.appContext.role)),
    ctx.appContext?.city && answer.includes(lower(ctx.appContext.city)),
    ctx.memoryContext?.used?.length || ctx.memoryContext?.matched?.length,
    ctx.personalizationContext?.enabled || ctx.personalizationContext?.applied,
    ctx.knowledge?.screenContext?.type || ctx.appContext?.activePanel,
  ];
  const hits = facts.filter(Boolean).length;
  return { personalizationScore: clamp(52 + hits * 8), usedSignals: hits };
}

function scoreConversationQuality(ctx = {}) {
  const count = words(ctx.answer).length;
  const relevance = overlap(ctx.question, ctx.answer);
  let score = 78 + relevance * 24;
  if (count > 220) score -= 16;
  if (count < 6) score -= 20;
  if (repeatedSentenceRatio(ctx.answer) > 0) score -= 12;
  if (ctx.conversationContext?.isContinuation || ctx.conversationContext?.resolvedReference) score += 6;
  return {
    score: clamp(score),
    direct: relevance > 0.08 || words(ctx.question).length <= 2,
    onTopic: relevance > 0.04 || Boolean(ctx.decisionContext?.intent),
    repeated: repeatedSentenceRatio(ctx.answer) > 0.25,
    tooLong: count > 220,
  };
}

function scoreHallucinationRisk(ctx = {}) {
  const answer = lower(ctx.answer);
  const uncertain = ['может быть', 'скорее всего', 'вероятно', 'возможно', 'предположительно', 'думаю, что', 'кажется'];
  const uncertaintyHits = uncertain.filter(term => answer.includes(term)).length;
  const hasKnowledge = Boolean(ctx.knowledge);
  const saysNoData = hasAny(answer, ['не вижу', 'нет данных', 'пока нет', 'ничего не придумываю']);
  let points = uncertaintyHits * 2;
  if (!hasKnowledge && words(ctx.answer).length > 16 && !saysNoData) points += 2;
  if (ctx.decisionContext?.level === 'low') points += 1;
  const risk = points >= 4 ? 'HIGH' : points >= 2 ? 'MEDIUM' : 'LOW';
  return { risk, score: risk === 'LOW' ? 94 : risk === 'MEDIUM' ? 68 : 36, uncertaintyHits, missingKnowledge: !hasKnowledge };
}

function scoreConfidence(ctx = {}, metrics = {}) {
  const values = [
    ctx.knowledge ? 90 : 68,
    metrics.decisionQuality?.score ?? 75,
    metrics.toolQuality?.score ?? 85,
    metrics.contextCoverage?.coverage ?? 70,
    ctx.planner ? 88 : 76,
  ];
  if (ctx.confidence) values.push(ctx.confidence <= 1 ? ctx.confidence * 100 : ctx.confidence);
  return clamp(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

export function computeEvaluationMetrics(ctx = {}) {
  const metrics = {
    answerQuality: scoreAnswerQuality(ctx),
    contextCoverage: scoreContextCoverage(ctx),
    toolQuality: scoreToolQuality(ctx),
    decisionQuality: scoreDecisionQuality(ctx),
    actionQuality: scoreActionQuality(ctx),
    personalization: scorePersonalization(ctx),
    conversationQuality: scoreConversationQuality(ctx),
    hallucinationRisk: scoreHallucinationRisk(ctx),
  };
  metrics.confidence = scoreConfidence(ctx, metrics);
  return metrics;
}

export class EvaluationMetrics {
  static compute(ctx = {}) {
    return computeEvaluationMetrics(ctx);
  }
}
