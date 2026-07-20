export function accountProfileComplete(profile = {}) {
  return Boolean(profile?.displayName || profile?.firstName || profile?.email || profile?.telegramId);
}
