const OPEN_ENDED_VERSION = new Set(['', '?', 'local', 'unknown']);

function text(value) {
  return String(value ?? '').trim();
}

export function errorValueTime(value) {
  if (!value) return 0;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function isErrorArchived(item) {
  return item?.archived === true || String(item?.status || '').toLowerCase() === 'archived';
}

export function isErrorResolved(item) {
  return item?.resolved === true || String(item?.status || '').toLowerCase() === 'resolved';
}

export function isErrorOpen(item) {
  return !isErrorResolved(item) && !isErrorArchived(item);
}

export function isExpectedAdminAccessNoise(item = {}) {
  const message = text(item.message || item.error).toLowerCase();
  const source = text(item.component || item.source).toLowerCase();
  const expectedMessage = message.includes('нет доступа к данным')
    || message.includes('app_data_query_failed')
    || message.includes('требуется авторизация администратора');
  return expectedMessage && (
    source.startsWith('adminpanel.fetchdata.')
    || source === 'adminpanel.loadaiimportrequests'
    || source === 'adminpanel.loadreferralaudit'
  );
}

export function isErrorActionable(item, { currentVersion = '', now = Date.now(), unversionedHours = 72 } = {}) {
  if (!isErrorOpen(item) || isExpectedAdminAccessNoise(item)) return false;
  const version = text(item.version || item.build);
  const normalizedCurrent = text(currentVersion);
  if (!OPEN_ENDED_VERSION.has(normalizedCurrent.toLowerCase())) {
    return version === normalizedCurrent;
  }
  if (!OPEN_ENDED_VERSION.has(version.toLowerCase())) return false;
  const lastSeen = errorValueTime(item.lastSeen || item.timestamp || item.updatedAt || item.createdAt);
  return lastSeen > 0 && now - lastSeen <= unversionedHours * 60 * 60 * 1000;
}
