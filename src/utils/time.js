export function toDate(value) {
  if (!value) return null;
  if (value.toDate instanceof Function) {
    const d = value.toDate();
    return Number.isFinite(d?.getTime?.()) ? d : null;
  }
  if (typeof value === 'number') {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value === 'string' || value instanceof Date) {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value.seconds === 'number') {
    const d = new Date(value.seconds * 1000);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function isSameDay(date, base) {
  return date.getFullYear() === base.getFullYear()
    && date.getMonth() === base.getMonth()
    && date.getDate() === base.getDate();
}

export function formatRelativeTime(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return 'Недавно';
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return 'Вчера';
  }

  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return `${diffDays} дн назад`;

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function formatDayLabel(value, now = new Date()) {
  const date = toDate(value);
  if (!date) return '';
  if (isSameDay(date, now)) return 'Сегодня';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
