export const SALES_STAGES = [
  'discovered',
  'qualified',
  'offer_ready',
  'contacted',
  'replied',
  'meeting',
  'won',
  'lost',
];

export const SALES_STAGE_LABELS = {
  discovered: 'Найден',
  qualified: 'Оценён',
  offer_ready: 'Оффер готов',
  contacted: 'Написали',
  replied: 'Ответил',
  meeting: 'Встреча',
  won: 'Партнёр',
  lost: 'Отказ',
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function scoreLead(lead = {}) {
  const reasons = [];
  let score = 20;

  if (lead.local !== false) {
    score += 18;
    reasons.push('локальный бизнес');
  }
  if (lead.hasOfflinePoint) {
    score += 15;
    reasons.push('есть офлайн-точка и живой трафик');
  }
  if (lead.activeSocials) {
    score += 12;
    reasons.push('активные соцсети');
  }
  if (lead.runsEvents) {
    score += 12;
    reasons.push('проводит события или активности');
  }
  if (lead.hasRepeatCustomers) {
    score += 10;
    reasons.push('повторные визиты клиентов');
  }
  if (lead.canBringAudience) {
    score += 10;
    reasons.push('может приводить аудиторию в АПГ');
  }
  if (lead.decisionMakerFound) {
    score += 8;
    reasons.push('найден ЛПР');
  }
  if (lead.website || lead.vk || lead.telegram) score += 3;

  const finalScore = clamp(score, 0, 100);
  const priority = finalScore >= 80 ? 'high' : finalScore >= 60 ? 'medium' : 'low';
  return { score: finalScore, priority, reasons };
}

const categoryHooks = {
  food: 'привлекать гостей, продвигать акции и превращать локальный трафик в повторные визиты',
  beauty: 'привлекать новых клиентов, продвигать услуги и давать жителям понятный повод записаться',
  sport: 'набирать клиентов на тренировки, продвигать пробные занятия и локальные активности',
  education: 'набирать учеников, продвигать наборы и события и усиливать рекомендации внутри города',
  entertainment: 'продвигать афишу, события и спецпредложения среди жителей города',
  health: 'повышать локальную узнаваемость и приводить жителей на услуги через полезный городской контекст',
  pets: 'привлекать владельцев животных через акции, полезный контент и локальные рекомендации',
  other: 'получать дополнительный локальный охват и понятный канал связи с жителями города',
};

export function buildOfferDraft(lead = {}) {
  const name = lead.name || 'вашей компании';
  const hook = categoryHooks[lead.category] || categoryHooks.other;
  const signal = lead.runsEvents
    ? 'Увидел, что вы активно работаете с мероприятиями и своей аудиторией.'
    : lead.activeSocials
      ? 'Увидел вашу активность и то, как вы работаете с локальной аудиторией.'
      : 'Обратил внимание на ваш проект в Зеленограде.';

  return `Здравствуйте! ${signal}\n\nЯ развиваю АПГ — городской сервис, который объединяет жителей, локальный бизнес, афишу, акции и рекомендации в одном приложении. Для ${name} это может быть способом ${hook}.\n\nМы сейчас точечно приглашаем сильные локальные проекты, а не собираем каталог ради количества. Думаю, здесь есть нормальная почва для сотрудничества. Если интересно, я коротко покажу механику и предложу конкретный вариант именно под вас.`;
}

export function enrichLead(lead) {
  const analysis = scoreLead(lead);
  return {
    id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    stage: lead.stage || 'discovered',
    createdAt: lead.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...lead,
    ...analysis,
    offerDraft: lead.offerDraft || buildOfferDraft(lead),
  };
}

export function summarizePipeline(leads = []) {
  return {
    total: leads.length,
    highPriority: leads.filter(lead => lead.priority === 'high').length,
    contacted: leads.filter(lead => ['contacted', 'replied', 'meeting', 'won'].includes(lead.stage)).length,
    replied: leads.filter(lead => ['replied', 'meeting', 'won'].includes(lead.stage)).length,
    meetings: leads.filter(lead => ['meeting', 'won'].includes(lead.stage)).length,
    won: leads.filter(lead => lead.stage === 'won').length,
  };
}

export function nextBestAction(lead = {}) {
  if (lead.stage === 'discovered') return 'Проверить данные и подтвердить оценку';
  if (lead.stage === 'qualified') return 'Подготовить персональный оффер';
  if (lead.stage === 'offer_ready') return 'Проверить текст и отправить вручную';
  if (lead.stage === 'contacted') return 'Проверить ответ или подготовить follow-up';
  if (lead.stage === 'replied') return 'Разобрать ответ и предложить следующий шаг';
  if (lead.stage === 'meeting') return 'Подготовить встречу и коммерческое предложение';
  if (lead.stage === 'won') return 'Передать в онбординг партнёра';
  return 'Зафиксировать причину отказа';
}
