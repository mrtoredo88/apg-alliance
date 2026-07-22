function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value = '') {
  return String(value ?? '').trim();
}

function tsMs(value) {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function notificationCategory(notification = {}) {
  if (notification.type === 'contextDialogMessage') return 'messages';
  return text(notification.category || notification.kind || 'important') || 'important';
}

export function notificationPriority(notification = {}) {
  const explicit = text(notification.priority).toLowerCase();
  if (['critical', 'important', 'high'].includes(explicit)) return 'high';
  if (notification.type === 'contextDialogMessage' || notificationCategory(notification) === 'messages') return 'high';
  if (notification.actionUrl || notification.deepLink || notification.dialogId) return 'action';
  if (['events', 'offers', 'prizes', 'keys', 'invites'].includes(notificationCategory(notification))) return 'action';
  return 'normal';
}

export function notificationActionLabel(notification = {}) {
  const category = notificationCategory(notification);
  if (notification.type === 'contextDialogMessage' || category === 'messages') return 'Открыть чат';
  if (category === 'events') return 'Открыть событие';
  if (category === 'offers') return 'Смотреть акцию';
  if (category === 'partners') return 'Открыть партнёра';
  if (category === 'experts') return 'Открыть эксперта';
  if (category === 'news') return 'Читать';
  if (notification.deepLink || notification.url || notification.actionUrl) return 'Открыть';
  return '';
}

export function buildNotificationCenter({ notifications = [], isUnread = () => false } = {}) {
  const rows = list(notifications)
    .map(notification => ({
      ...notification,
      smartCategory: notificationCategory(notification),
      smartPriority: notificationPriority(notification),
      actionLabel: notificationActionLabel(notification),
      unread: isUnread(notification),
      ts: tsMs(notification.createdAt || notification.updatedAt),
    }))
    .sort((a, b) => Number(b.unread) - Number(a.unread) || (b.smartPriority === 'high') - (a.smartPriority === 'high') || b.ts - a.ts);
  const urgent = rows.filter(row => row.smartPriority === 'high' || row.unread).slice(0, 5);
  const actionable = rows.filter(row => row.actionLabel && !urgent.some(item => item.id === row.id)).slice(0, 5);
  const byCategory = rows.reduce((acc, row) => {
    acc[row.smartCategory] = (acc[row.smartCategory] || 0) + 1;
    return acc;
  }, {});
  return {
    rows,
    urgent,
    actionable,
    byCategory,
    unread: rows.filter(row => row.unread).length,
    high: rows.filter(row => row.smartPriority === 'high').length,
    nextBestAction: urgent.length ? 'Разобрать важное' : actionable.length ? 'Открыть действия' : rows.length ? 'Просмотреть обновления' : 'Пока ничего срочного',
  };
}
