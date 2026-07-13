const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

function daysUntil(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

function titleOf(item, fallback = 'АПГ') {
  return item?.title || item?.name || item?.displayName || item?.specialization || fallback;
}

function totalCount(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + (Number(item) || 0), 0);
  return 0;
}

function latestDate(items = [], fields = ['publishedAt', 'createdAt', 'updatedAt']) {
  return items
    .map(item => fields.map(field => toDate(item?.[field])).find(Boolean))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

function priorityMeta(priority) {
  if (priority === 'critical') return { label: 'Критично', icon: '🔴', weight: 30 };
  if (priority === 'important') return { label: 'Важно', icon: '🟡', weight: 20 };
  return { label: 'Можно позже', icon: '🟢', weight: 10 };
}

function task({ id, title, text, priority = 'later', target = 'dashboard', action = 'Открыть', reason = '' }) {
  const meta = priorityMeta(priority);
  return { id, title, text, priority, priorityLabel: meta.label, priorityIcon: meta.icon, weight: meta.weight, target, action, reason };
}

function buildTasks({ appState, userState, analytics, recommendations, now }) {
  const events = appState.events || [];
  const news = appState.news || [];
  const partners = appState.partners || [];
  const notifications = appState.notifications || [];
  const offers = partners.filter(item => item.offer || item.promo || item.gift);
  const lastNewsDate = latestDate(news);
  const newsAge = daysSince(lastNewsDate, now);
  const nextEvent = events
    .map(item => ({ item, inDays: daysUntil(item.eventDate || item.date || item.startAt, now) }))
    .filter(row => row.inDays !== null && row.inDays >= 0)
    .sort((a, b) => a.inDays - b.inDays)[0];
  const unread = Math.max(notifications.filter(item => !item.read && !item.seen).length, Number(appState.unreadCount || 0));
  const reviewCount = partners.reduce((sum, item) => sum + Number(item.unansweredReviews || item.pendingReviews || item.reviewCount || item.reviewsCount || 0), 0);
  const registrationCount = Number(analytics.registrations || 0);
  const rec = recommendations.feed?.[0] || recommendations.events?.[0] || recommendations.partners?.[0] || null;
  const tasks = [];

  if (unread >= 6) {
    tasks.push(task({ id: 'notifications-critical', title: 'Разобрать входящие сигналы', text: `${unread} уведомлений ждут реакции`, priority: 'critical', target: 'notifications', action: 'Разобрать', reason: 'Много непрочитанных сообщений снижает скорость ответа клиентам.' }));
  } else if (unread > 0) {
    tasks.push(task({ id: 'notifications-important', title: 'Проверить новые обращения', text: `${unread} входящих событий`, priority: 'important', target: 'notifications', action: 'Открыть', reason: 'Workspace видит новые события в Notification Pipeline и Activity Timeline.' }));
  }

  if (reviewCount >= 3) {
    tasks.push(task({ id: 'reviews-critical', title: 'Ответить на отзывы', text: `${reviewCount} отзывов требуют внимания`, priority: 'critical', target: 'reviews', action: 'Ответить', reason: 'Отзывы влияют на доверие и повторные визиты.' }));
  } else if (reviewCount > 0) {
    tasks.push(task({ id: 'reviews-important', title: 'Проверить отзывы', text: 'Есть новые сигналы обратной связи', priority: 'important', target: 'reviews', action: 'Открыть', reason: 'Новые отзывы лучше закрывать в день появления.' }));
  }

  if (nextEvent?.inDays <= 1) {
    tasks.push(task({ id: 'event-tomorrow', title: 'Подтвердить ближайшее мероприятие', text: titleOf(nextEvent.item, 'Мероприятие') || 'Мероприятие уже скоро', priority: 'critical', target: 'events', action: 'Проверить', reason: 'Мероприятие сегодня или завтра, важно проверить участников и анонс.' }));
  } else if (nextEvent?.inDays <= 7) {
    tasks.push(task({ id: 'event-week', title: 'Подготовить мероприятие', text: `${titleOf(nextEvent.item, 'Мероприятие')} через ${nextEvent.inDays} дн.`, priority: 'important', target: 'events', action: 'Открыть', reason: 'Ближайшее событие входит в недельный рабочий горизонт.' }));
  } else if (!events.length) {
    tasks.push(task({ id: 'event-empty', title: 'Создать мероприятие', text: 'Афиша пока не ведёт клиентов в офлайн', priority: 'later', target: 'events', action: 'Создать', reason: 'События повышают повторные касания с аудиторией.' }));
  }

  if (newsAge === null || newsAge >= 9) {
    tasks.push(task({ id: 'content-stale', title: 'Опубликовать новость', text: newsAge === null ? 'Публикаций пока нет' : `Последняя публикация была ${newsAge} дн. назад`, priority: newsAge === null || newsAge >= 14 ? 'critical' : 'important', target: 'content', action: 'Опубликовать', reason: 'Долгая пауза в контенте снижает видимость партнёра в АПГ.' }));
  } else if (newsAge >= 5) {
    tasks.push(task({ id: 'content-plan', title: 'Подготовить публикацию', text: `Публикация была ${newsAge} дн. назад`, priority: 'later', target: 'content', action: 'Подготовить', reason: 'Регулярный контент поддерживает интерес аудитории.' }));
  }

  if (!offers.length) {
    tasks.push(task({ id: 'offer-empty', title: 'Запустить акцию', text: 'Сейчас нет активных предложений', priority: 'important', target: 'offers', action: 'Создать', reason: 'Акция даёт пользователю понятную причину прийти или вернуться.' }));
  }

  if (registrationCount > 0) {
    tasks.push(task({ id: 'registrations-check', title: 'Проверить регистрации', text: `${registrationCount} регистраций в аналитике`, priority: 'important', target: 'events', action: 'Проверить', reason: 'Analytics Collector зафиксировал регистрации, их нужно связать с рабочими действиями.' }));
  }

  if (rec) {
    tasks.push(task({ id: 'recommendation-top', title: 'Использовать рекомендацию Локи', text: titleOf(rec.item || rec, 'Рекомендация дня'), priority: 'later', target: 'loki', action: 'Спросить', reason: rec.explanation || rec.reason || 'Recommendation Engine нашёл релевантный рабочий сигнал.' }));
  }

  if (Number(userState.referralCount || 0) < 3) {
    tasks.push(task({ id: 'growth-referral', title: 'Пригласить клиентов', text: 'Запустить QR или ссылку-приглашение', priority: 'later', target: 'growth', action: 'Открыть', reason: 'Привлечение клиентов должно быть ежедневным коротким действием.' }));
  }

  return tasks
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7);
}

function buildChanges({ activityTimeline, analytics }) {
  const recent = Array.isArray(activityTimeline) ? activityTimeline.slice(0, 30) : [];
  const views = totalCount(analytics.views);
  const clicks = totalCount(analytics.clicks);
  return [
    recent.length ? `${recent.length} событий активности за последнее время` : null,
    analytics.registrations ? `${analytics.registrations} регистраций` : null,
    analytics.comments ? `${analytics.comments} комментариев` : null,
    analytics.publications ? `${analytics.publications} публикаций` : null,
    views ? `${views} просмотров` : null,
    clicks ? `${clicks} кликов и переходов` : null,
  ].filter(Boolean).slice(0, 5);
}

function buildOpportunities({ tasks, appState, analytics }) {
  const opportunities = [
    { title: 'Опубликовать новость', target: 'content', action: 'Опубликовать', enabled: tasks.some(item => item.target === 'content') || !(appState.news || []).length },
    { title: 'Создать мероприятие', target: 'events', action: 'Создать', enabled: tasks.some(item => item.target === 'events') || !(appState.events || []).length },
    { title: 'Запустить акцию', target: 'offers', action: 'Запустить', enabled: tasks.some(item => item.target === 'offers') || !(appState.partners || []).some(item => item.offer) },
    { title: 'Проверить встречи', target: 'booking', action: 'Открыть', enabled: totalCount(analytics.clicks) > 0 || totalCount(analytics.views) > 0 },
    { title: 'Проверить QR', target: 'growth', action: 'Проверить', enabled: true },
  ];
  return opportunities.filter(item => item.enabled).slice(0, 4);
}

function buildMiniAnalytics({ analytics }) {
  return [
    { label: 'Просмотры', value: totalCount(analytics.views), delta: 'сигнал' },
    { label: 'Переходы', value: totalCount(analytics.clicks), delta: 'действия' },
    { label: 'Клиенты', value: Number(analytics.registrations || 0), delta: 'заявки' },
    { label: 'QR', value: Number(analytics.qrScans?.success || analytics.qrScans?.started || 0), delta: 'сканы' },
    { label: 'Конверсия', value: `${Math.min(38, Math.max(4, totalCount(analytics.clicks) ? Math.round(Number(analytics.registrations || 1) / Math.max(totalCount(analytics.clicks), 1) * 100) : 4))}%`, delta: 'оценка' },
  ];
}

export function buildWorkspaceDayPlan(input = {}) {
  const now = input.now ? new Date(input.now) : new Date();
  const appState = input.appState || {};
  const userState = input.userState || {};
  const analytics = input.analytics || {};
  const recommendations = input.recommendations || {};
  const activityTimeline = input.activityTimeline || [];
  const tasks = buildTasks({ appState, userState, analytics, recommendations, now });
  const critical = tasks.filter(item => item.priority === 'critical').length;
  const important = tasks.filter(item => item.priority === 'important').length;
  const later = tasks.filter(item => item.priority === 'later').length;
  const eventsToday = (appState.events || []).filter(item => daysUntil(item.eventDate || item.date || item.startAt, now) === 0).length;
  const changes = buildChanges({ activityTimeline, analytics });
  const attention = tasks.filter(item => item.priority !== 'later').map(item => ({
    title: item.title,
    text: item.text,
    target: item.target,
    action: item.action,
    reason: item.reason,
    priority: item.priority,
    priorityLabel: item.priorityLabel,
    priorityIcon: item.priorityIcon,
  })).slice(0, 4);
  const lokiAdviceTask = tasks[0] || null;

  return {
    version: 1,
    generatedAt: now.toISOString(),
    greeting: `${now.getHours() < 12 ? 'Доброе утро' : now.getHours() < 18 ? 'Добрый день' : 'Добрый вечер'}, ${input.user?.firstName || input.user?.name || input.user?.displayName || 'партнёр'}.`,
    summary: {
      quickTasks: later,
      importantTasks: important,
      criticalProblems: critical,
      expectedEvents: eventsToday || Math.min((appState.events || []).length, 2),
      forecastClients: Math.max(Number(analytics.registrations || 0), Number(appState.unreadCount || 0), 3),
      topNews: titleOf((appState.news || [])[0], 'новая публикация'),
    },
    tasks,
    changes: changes.length ? changes : ['Новых критичных изменений нет'],
    attention: attention.length ? attention : [{
      title: 'Критичных проблем нет',
      text: 'Можно спокойно перейти к росту и контенту',
      target: 'growth',
      action: 'Открыть',
      reason: 'Workspace не нашёл срочных сигналов в аналитике и Activity Timeline.',
      priority: 'later',
      priorityLabel: 'Можно позже',
      priorityIcon: '🟢',
    }],
    opportunities: buildOpportunities({ tasks, appState, analytics }),
    miniAnalytics: buildMiniAnalytics({ analytics }),
    lokiAdvice: lokiAdviceTask ? {
      title: lokiAdviceTask.title,
      text: lokiAdviceTask.reason,
      target: lokiAdviceTask.target,
      action: lokiAdviceTask.action,
    } : {
      title: 'Спросить Локи о плане дня',
      text: 'Локи соберёт рекомендации из AI Context, памяти и активности.',
      target: 'loki',
      action: 'Открыть Локи',
    },
    future: ['AI-прогноз клиентов', 'планирование недели', 'прогноз посещаемости', 'план публикаций', 'бизнес-консультант Локи'],
  };
}
