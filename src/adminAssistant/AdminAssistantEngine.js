import { ADMIN_SECTION_TITLES } from './AdminContextEngine.js';

const DAY = 86400000;

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

function text(value) {
  return String(value || '').trim();
}

function image(item) {
  return text(item?.coverPhoto || item?.imageUrl || item?.logoUrl || item?.logo || item?.photo || item?.photoUrl || item?.image);
}

function socials(item) {
  return Boolean(text(item?.social || item?.vk || item?.vkUrl || item?.vkGroup || item?.telegram || item?.website || item?.instagram));
}

function recent(items, days, now) {
  const cutoff = now.getTime() - days * DAY;
  return items.filter(item => toMillis(item.createdAt || item.registeredAt || item.publishedAt || item.date) >= cutoff);
}

function unresolved(error) {
  return error?.resolved !== true && error?.archived !== true;
}

function severity(error) {
  const value = text(error?.severity || error?.level || error?.type).toLowerCase();
  return ['critical', 'fatal', 'error'].includes(value) || /fatal|critical|uncaught/i.test(text(error?.message || error?.error));
}

function eventStart(event) {
  return toMillis(event?.startAt || event?.startsAt || event?.eventDate || event?.date);
}

function eventEnd(event) {
  return toMillis(event?.endAt || event?.endsAt) || eventStart(event) + 2 * 60 * 60 * 1000;
}

function overlapCount(events) {
  const rows = events.map(event => ({ start: eventStart(event), end: eventEnd(event) })).filter(row => row.start);
  let count = 0;
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (rows[i].start < rows[j].end && rows[j].start < rows[i].end) count += 1;
    }
  }
  return count;
}

function item(id, label, count, tab, details, priority = 'normal') {
  return { id, label, count, tab, details, priority };
}

export function buildAdminInsights(context, now = new Date()) {
  const data = context.data || {};
  const partners = data.partners || [];
  const experts = data.experts || [];
  const events = data.events || [];
  const news = data.news || [];
  const users = data.users || [];
  const comments = data.comments || [];
  const errors = data.errors || [];
  const sectionInsights = {
    news: [
      item('news.drafts', 'Черновики', news.filter(row => ['draft', 'new'].includes(text(row.status).toLowerCase())).length, 'news'),
      item('news.moderation', 'Ожидают модерации', news.filter(row => ['pending', 'pending_review', 'moderation'].includes(text(row.status || row.moderationStatus).toLowerCase())).length, 'news'),
      item('news.no_cover', 'Без обложки', news.filter(row => !image(row)).length, 'news', 'Проверены поля обложки и изображения.'),
      item('news.stale', 'Не публиковались 4+ дня', news.length && !recent(news, 4, now).length ? 1 : 0, 'news'),
    ],
    partners: [
      item('partners.no_logo', 'Без логотипа', partners.filter(row => !image(row)).length, 'partners'),
      item('partners.no_description', 'Без описания', partners.filter(row => !text(row.description || row.shortDescription)).length, 'partners'),
      item('partners.no_socials', 'Без соцсетей и сайта', partners.filter(row => !socials(row)).length, 'partners'),
      item('partners.no_events', 'Без связанных мероприятий', partners.filter(row => !events.some(event => String(event.partnerId || '') === String(row.id))).length, 'partners'),
    ],
    experts: [
      item('experts.empty', 'Незаполненный профиль', experts.filter(row => !text(row.description) || !text(row.specialization)).length, 'experts'),
      item('experts.no_photo', 'Без фотографии', experts.filter(row => !image(row)).length, 'experts'),
      item('experts.no_events', 'Без мероприятий', experts.filter(row => !events.some(event => String(event.expertId || '') === String(row.id))).length, 'experts'),
      item('experts.no_publications', 'Без публикаций', experts.filter(row => !news.some(entry => String(entry.expertId || '') === String(row.id))).length, 'experts'),
    ],
    users: [
      item('users.incomplete', 'Незавершённая регистрация', users.filter(row => row.registrationCompleted === false || !text(row.name || row.first_name)).length, 'users'),
      item('users.email_unverified', 'Без подтверждённой почты', users.filter(row => text(row.email) && row.emailVerified !== true && row.emailConfirmed !== true).length, 'users'),
      item('users.inactive', 'Не заходили 30+ дней', users.filter(row => { const last = toMillis(row.lastSeenAt || row.lastLoginAt || row.updatedAt); return last && now.getTime() - last > 30 * DAY; }).length, 'users'),
    ],
    events: [
      item('events.no_cover', 'Без обложки или афиши', events.filter(row => !image(row)).length, 'events'),
      item('events.no_organizer', 'Без организатора', events.filter(row => !text(row.partnerId || row.expertId || row.partner || row.organizer)).length, 'events'),
      item('events.overlap', 'Пересечения по времени', overlapCount(events), 'events', 'Сравнены доступные даты начала и окончания.'),
      item('events.no_description', 'Без описания', events.filter(row => !text(row.description || row.text)).length, 'events'),
    ],
    errors: [
      item('errors.active', 'Активные ошибки', errors.filter(unresolved).length, 'errors', null, 'high'),
      item('errors.auth', 'Ошибки авторизации', errors.filter(row => unresolved(row) && /auth|login|token|авториза/i.test(text(row.message || row.error || row.source))).length, 'errors', null, 'high'),
      item('errors.repeated', 'Повторяющиеся ошибки', new Set(errors.filter(unresolved).map(row => text(row.message || row.error)).filter((message, index, list) => list.indexOf(message) !== index)).size, 'errors'),
      item('errors.critical', 'Критичные ошибки', errors.filter(row => unresolved(row) && severity(row)).length, 'errors', null, 'high'),
    ],
    comments: [item('comments.new', 'Новые комментарии', comments.filter(row => !row.hidden && (!row.moderationReviewedAt || row.status === 'pending')).length, 'comments')],
    moderation: [item('moderation.pending', 'Ожидают проверки', comments.filter(row => !row.hidden && (!row.moderationReviewedAt || row.status === 'pending')).length, 'moderation')],
  };
  const current = sectionInsights[context.section] || [];
  return {
    current,
    all: Object.values(sectionInsights).flat(),
    summary: [
      item('summary.users', 'Новые пользователи за сутки', recent(users, 1, now).length, 'users'),
      item('summary.partners', 'Новые партнёры за сутки', recent(partners, 1, now).length, 'partners'),
      item('summary.events', 'События ожидают публикации', events.filter(row => ['draft', 'pending', 'pending_review'].includes(text(row.status || row.moderationStatus).toLowerCase())).length, 'events'),
      item('summary.errors', 'Ошибки требуют внимания', errors.filter(unresolved).length, 'errors', null, 'high'),
      item('summary.news', 'Новости опубликованы за сутки', recent(news.filter(row => text(row.status).toLowerCase() !== 'draft'), 1, now).length, 'news'),
    ],
  };
}

const COMMANDS = [
  { words: ['партнер', 'партнёр'], issue: 'partners.no_logo', extra: ['без логотип'] },
  { words: ['мероприят', 'событ'], issue: 'events.no_cover', extra: ['без фото', 'без фотограф', 'без афиш', 'без облож'] },
  { words: ['ошиб'], issue: 'errors.auth', extra: ['авториза'] },
  { words: ['новост'], issue: 'news.drafts', extra: ['не опублик', 'чернов'] },
  { words: ['пользовател'], issue: 'users.inactive', extra: ['давно не заход'] },
  { words: ['последн'], issue: 'errors.active', extra: ['ошиб'] },
  { words: ['регистрац'], issue: 'users.incomplete', extra: ['незаверш'] },
  { words: ['комментар'], issue: 'comments.new', extra: ['нов'] },
];

export function answerAdminCommand(query, context, insights) {
  const normalized = text(query).toLowerCase().replace(/ё/g, 'е');
  const help = /что (здесь|находится)|что можно|как (добавить|удалить)|что означает|объясни (раздел|интерфейс)/.test(normalized);
  if (help) {
    const title = ADMIN_SECTION_TITLES[context.section] || context.page;
    const facts = insights.current.filter(row => row.count > 0);
    return {
      text: `${title} — рабочий раздел административной панели. Здесь доступны операции, разрешённые вашей роли «${context.role}».${facts.length ? ` По текущим данным вижу: ${facts.slice(0, 3).map(row => `${row.label.toLowerCase()} — ${row.count}`).join('; ')}.` : ' Проблем по доступным данным не обнаружено.'}`,
      actions: [{ label: 'Проверить раздел', tab: context.section }],
    };
  }
  const match = COMMANDS.find(command => command.words.some(word => normalized.includes(word)) && command.extra.some(word => normalized.includes(word)));
  const issue = match ? insights.all.find(row => row.id === match.issue) : null;
  if (issue) return { text: issue.count ? `${issue.label}: ${issue.count}. Результат построен по данным, уже загруженным в админке.` : `${issue.label}: не найдено по доступным данным.`, actions: [{ label: 'Перейти', tab: issue.tab }] };
  if (/что исправ|проблем|требует вниман|что делать/.test(normalized)) {
    const problems = insights.current.filter(row => row.count > 0).sort((a, b) => b.count - a.count);
    return problems.length
      ? { text: problems.slice(0, 4).map(row => `${row.label}: ${row.count}`).join('\n'), actions: [{ label: 'Проверить', tab: problems[0].tab }] }
      : { text: 'По данным текущего раздела проблем не найдено. Если часть данных ещё не загружена, вывод может быть неполным.', actions: [] };
  }
  return { text: 'Не могу подтвердить ответ по доступным данным. Уточните объект и признак, например: «Покажи партнёров без логотипов».', actions: [] };
}

export function sectionKnowledge(section) {
  const title = ADMIN_SECTION_TITLES[section] || section;
  return {
    title,
    description: `Раздел «${title}». Локи анализирует только уже загруженные данные и не изменяет записи без явного действия администратора.`,
  };
}
