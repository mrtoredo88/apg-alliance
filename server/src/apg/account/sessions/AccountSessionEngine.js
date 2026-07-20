export function accountSessionActive(session = {}) {
  return Boolean(session?.id && session?.status === 'active' && !session?.revokedAt);
}
