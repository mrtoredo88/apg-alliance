export function createEmptyDiff() {
  return {
    usersModified: [],
    usersRemoved: [],
    usersMerged: [],
    telegramLinksRemapped: [],
    telegramLinksRemoved: [],
    ownershipTransferred: [],
    bookingsTransferred: [],
    friendsTransferred: [],
    keysTransferred: [],
    dialogsTransferred: [],
    notificationsTransferred: [],
    identityIndexUpdated: [],
    errors: [],
    warnings: [],
  };
}

export function diffSummary(diff = {}) {
  return {
    usersModified: diff.usersModified?.length || 0,
    usersRemoved: diff.usersRemoved?.length || 0,
    usersMerged: diff.usersMerged?.length || 0,
    telegramLinksRemapped: diff.telegramLinksRemapped?.length || 0,
    telegramLinksRemoved: diff.telegramLinksRemoved?.length || 0,
    ownershipTransferred: diff.ownershipTransferred?.length || 0,
    bookingsTransferred: diff.bookingsTransferred?.length || 0,
    friendsTransferred: diff.friendsTransferred?.length || 0,
    keysTransferred: diff.keysTransferred?.length || 0,
    dialogsTransferred: diff.dialogsTransferred?.length || 0,
    notificationsTransferred: diff.notificationsTransferred?.length || 0,
    identityIndexUpdated: diff.identityIndexUpdated?.length || 0,
    errors: diff.errors?.length || 0,
    warnings: diff.warnings?.length || 0,
  };
}

export function redactDiff(diff = {}) {
  const scrub = item => {
    if (!item || typeof item !== 'object') return item;
    return Object.fromEntries(Object.entries(item).map(([key, value]) => {
      if (/email|telegram|uid|userId|target|source|owner/i.test(key)) return [key, value ? '[redacted]' : value];
      return [key, value];
    }));
  };
  return Object.fromEntries(Object.entries(diff).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.map(scrub) : value,
  ]));
}
