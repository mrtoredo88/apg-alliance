const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const categoryHooks = {
  food: 'привлекать гостей, продвигать акции и превращать локальный трафик в повторные визиты',
  beauty: 'привлекать новых клиентов, продвигать услуги и давать жителям понятный повод записаться',
  sport: 'набирать клиентов на тренировки, продвигать пробные занятия и локальные активности',
  education: 'набирать учеников, продвигать наборы и события и усиливать рекомендации внутри города',
  entertainment: 'продвигать афишу, события и спецпредложения среди жителей города',
  health: 'повышать локальную узнаваемость и приводить жителей на услуги через полезный городской контекст',
  pets: 'привлекать владельцев животных через акции, полезный контент и локальные рекомендации',
  services: 'получать дополнительный локальный охват и понятный канал связи с жителями города',
  other: 'получать дополнительный локальный охват и понятный канал связи с жителями города',
};

export function analyzeLead(lead = {}) {
  const reasons = [];
  let score = 20;
  if (lead.local !== false) { score += 18; reasons.push('локальный бизнес'); }
  if (lead.hasOfflinePoint) { score += 15; reasons.push('есть офлайн-точка и живой трафик'); }
  if (lead.activeSocials) { score += 12; reasons.push('активные соцсети или сайт'); }
  if (lead.runsEvents) { score += 12; reasons.push('проводит события или активности'); }
  if (lead.hasRepeatCustomers) { score += 10; reasons.push('повторные визиты клиентов'); }
  if (lead.canBringAudience) { score += 10; reasons.push('может приводить аудиторию в АПГ'); }
  if (lead.decisionMakerFound) { score += 8; reasons.push('найден ЛПР'); }
  if (lead.website || lead.vk || lead.telegram) score += 3;
  const finalScore = clamp(score, 0, 100);
  return {
    score: finalScore,
    priority: finalScore >= 80 ? 'high' : finalScore >= 60 ? 'medium' : 'low',
    reasons,
  };
}

export function buildSalesOffer(lead = {}) {
  const name = lead.name || 'вашей компании';
  const hook = categoryHooks[lead.category] || categoryHooks.other;
  const signal = lead.runsEvents
    ? 'Увидел, что вы активно работаете с мероприятиями и своей аудиторией.'
    : lead.activeSocials
      ? 'Увидел вашу активность и то, как вы работаете с локальной аудиторией.'
      : 'Обратил внимание на ваш проект в Зеленограде.';
  return `Здравствуйте! ${signal}\n\nЯ развиваю АПГ — городской сервис, который объединяет жителей, локальный бизнес, афишу, акции и рекомендации в одном приложении. Для ${name} это может быть способом ${hook}.\n\nМы сейчас точечно приглашаем сильные локальные проекты, а не собираем каталог ради количества. Думаю, здесь есть нормальная почва для сотрудничества. Если интересно, я коротко покажу механику и предложу конкретный вариант именно под вас.`;
}

export function prepareLead(lead = {}) {
  const analysis = analyzeLead(lead);
  return {
    ...lead,
    ...analysis,
    stage: lead.stage || 'qualified',
    offerDraft: lead.offerDraft || buildSalesOffer({ ...lead, ...analysis }),
  };
}

function latestInbound(messages = []) {
  return [...messages].reverse().find(message => message.direction === 'inbound');
}

export function buildCommunicatorDraft(lead = {}, messages = [], mode = 'reply') {
  const inbound = latestInbound(messages);
  const text = String(inbound?.text || '').toLowerCase();
  if (mode === 'followup' || !inbound) {
    return `Здравствуйте! Напомню о себе по поводу АПГ. Не хочу отвлекать длинным сообщением: могу буквально в двух словах показать, какую пользу это может дать ${lead.name || 'вашему проекту'} и какой формат сотрудничества вижу именно для вас. Если тема актуальна — буду рад продолжить.`;
  }
  if (/сколько|цена|стоим|тариф|оплат/.test(text)) {
    return 'Да, расскажу по условиям. Сначала хочу понять, какой формат вам реально полезен, чтобы не предлагать лишнего. Для АПГ важна не просто карточка в каталоге, а конкретная механика: привлечение жителей, акции, события, рекомендации и повторные визиты. Могу коротко предложить вариант именно под вас и сразу обозначить стоимость.';
  }
  if (/2гис|каталог|зачем|смысл|почему/.test(text)) {
    return 'Понимаю вопрос. Мы не строим ещё один справочник компаний: каталог — только один слой. Смысл АПГ в связке жителей, событий, рекомендаций, акций, геймификации и прямого взаимодействия с локальным бизнесом. То есть задача не «найти адрес», а дать человеку повод регулярно возвращаться и взаимодействовать с городом и партнёрами.';
  }
  if (/интерес|давайте|готов|встреч|встрет|созвон|обсуд/.test(text)) {
    return 'Отлично. Тогда предлагаю не растягивать переписку: я коротко покажу, как работает АПГ, и сразу обсудим, какая механика может быть полезна именно вам. Подскажите, когда удобнее созвониться или встретиться?';
  }
  if (/не интересно|неактуально|нет спасибо|откаж/.test(text)) {
    return 'Понял, спасибо, что ответили. Не буду навязываться. Если позже захотите посмотреть на АПГ уже по фактическим результатам и кейсам партнёров — буду рад вернуться к разговору.';
  }
  return `Спасибо за ответ. По ${lead.name || 'вашему проекту'} я бы предложил не общий пакет, а конкретный сценарий сотрудничества. Могу коротко расписать, что именно вижу полезного для вас, без длинной презентации.`;
}

export function inferStageFromMessage(message = {}) {
  if (message.direction === 'outbound') return 'contacted';
  const text = String(message.text || '').toLowerCase();
  if (/не интересно|неактуально|нет спасибо|откаж/.test(text)) return 'lost';
  if (/встреч|встрет|созвон|приезж|когда удобно|готов обсуд/.test(text)) return 'meeting';
  return 'replied';
}

export function buildManagerSummary(leads = [], communications = []) {
  const stages = Object.fromEntries(['discovered','qualified','offer_ready','contacted','replied','meeting','won','lost'].map(stage => [stage, 0]));
  for (const lead of leads) if (Object.prototype.hasOwnProperty.call(stages, lead.stage)) stages[lead.stage] += 1;
  const active = leads.filter(lead => !['won','lost'].includes(lead.stage));
  const needsFollowup = active.filter(lead => lead.stage === 'contacted').length;
  const highPriorityOpen = active.filter(lead => lead.priority === 'high').length;
  const replies = communications.filter(item => item.direction === 'inbound').length;
  const sent = communications.filter(item => item.direction === 'outbound').length;
  const contacted = leads.filter(lead => ['contacted','replied','meeting','won'].includes(lead.stage)).length;
  const replied = leads.filter(lead => ['replied','meeting','won'].includes(lead.stage)).length;
  return {
    total: leads.length,
    stages,
    highPriorityOpen,
    needsFollowup,
    communications: { sent, replies },
    conversion: {
      replyRate: contacted ? Number(((replied / contacted) * 100).toFixed(1)) : 0,
      meetingRate: replied ? Number(((stages.meeting + stages.won) / replied * 100).toFixed(1)) : 0,
      winRate: contacted ? Number((stages.won / contacted * 100).toFixed(1)) : 0,
    },
    priorities: [
      ...(needsFollowup ? [`${needsFollowup} лид(а) ждут follow-up`] : []),
      ...(highPriorityOpen ? [`${highPriorityOpen} приоритетных лид(а) в работе`] : []),
      ...(stages.meeting ? [`${stages.meeting} встреч(и) требуют подготовки`] : []),
    ].slice(0, 5),
  };
}