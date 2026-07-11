function ageDays(value, now) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && Number.isFinite(date.getTime()) ? Math.floor((now.getTime() - date.getTime()) / 86400000) : null;
}

export const AdminAssistant = {
  id: 'adminAssistant',
  roles: ['admin', 'editor', 'moderator', 'analyst', 'super_admin', 'owner'],
  priority: 100,
  canHandle({ context }) {
    return Boolean(context?.actor?.role && context?.admin);
  },
  handle({ context }) {
    const now = new Date();
    const partners = context.admin.partners || [];
    const events = context.admin.events || [];
    const news = context.admin.news || [];
    const users = context.admin.users || [];
    const errors = context.admin.errors || [];
    const moderation = context.admin.moderation || [];
    const findings = [
      partners.filter(item => !item.logo && !item.image).length ? `${partners.filter(item => !item.logo && !item.image).length} партнёров без логотипа.` : null,
      events.filter(item => !item.cover && !item.image).length ? `${events.filter(item => !item.cover && !item.image).length} мероприятий без обложки.` : null,
      news.length && Math.min(...news.map(item => ageDays(item.publishedAt || item.createdAt, now)).filter(Number.isFinite)) >= 4 ? 'Последняя новость опубликована четыре дня назад или раньше.' : null,
      users.filter(item => item.registrationCompleted === false).length ? `${users.filter(item => item.registrationCompleted === false).length} пользователей с незавершённой регистрацией.` : null,
      moderation.filter(item => (ageDays(item.createdAt, now) || 0) > 7).length ? 'Есть заявки на модерации старше недели.' : null,
      errors.filter(item => (ageDays(item.createdAt, now) || 99) <= 1).length >= 5 ? 'За последние сутки накопилось не менее пяти ошибок.' : null,
    ].filter(Boolean);
    return {
      intent: `admin.assist.${context.currentScreen?.id || 'overview'}`,
      text: findings.length ? findings.slice(0, 4).join('\n') : 'Критических проблем по доступным данным не вижу. Можно проверить свежесть контента и очередь модерации.',
      findings,
      cards: [],
    };
  },
};
