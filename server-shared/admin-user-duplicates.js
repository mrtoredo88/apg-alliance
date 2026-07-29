const clean = value => String(value ?? '').trim();

export const normalizeUserEmail = value => clean(value).toLowerCase();
export const normalizeUserPhone = value => clean(value).replace(/\D/g, '').replace(/^8(?=\d{10}$)/, '7');
export const normalizeUserTelegram = value => clean(value).toLowerCase().replace(/^@/, '');
export const normalizeUserName = value => clean(value).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').replace(/\s+/g, ' ').trim();

const levenshtein = (left, right) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[right.length];
};

export const userIdentityValues = user => {
  const linkedTelegram = typeof user?.linkedTelegram === 'object' ? user.linkedTelegram : {};
  return {
    email: normalizeUserEmail(user?.email || user?.linkedEmail),
    phone: normalizeUserPhone(user?.phone || user?.phoneNumber),
    telegramId: clean(user?.telegramId || user?.tgId || linkedTelegram.id),
    telegram: normalizeUserTelegram(user?.telegramUsername || user?.tgUsername || linkedTelegram.username),
    firebaseUid: clean(user?.firebaseUid || user?.authUid),
    name: normalizeUserName(user?.displayName || user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ')),
  };
};

export const compareUsersForDuplicates = (left, right) => {
  const a = userIdentityValues(left);
  const b = userIdentityValues(right);
  const reasons = [];
  let score = 0;
  const exact = [
    ['email', 100, 'Email'],
    ['telegramId', 100, 'Telegram ID'],
    ['firebaseUid', 100, 'Firebase UID'],
    ['phone', 95, 'Телефон'],
    ['telegram', 90, 'Telegram username'],
  ];
  exact.forEach(([key, weight, label]) => {
    if (a[key] && a[key] === b[key]) {
      score = Math.max(score, weight);
      reasons.push({ field: key, label, type: 'exact', value: a[key] });
    }
  });
  if (a.name && b.name) {
    const distance = levenshtein(a.name, b.name);
    const similarity = 1 - distance / Math.max(a.name.length, b.name.length, 1);
    if (similarity >= 0.82) {
      const nameScore = Math.round(55 + similarity * 25);
      score = Math.max(score, nameScore);
      reasons.push({ field: 'name', label: 'Имя', type: similarity === 1 ? 'exact' : 'similar', similarity: Math.round(similarity * 100) });
    }
  }
  if (reasons.length > 1) score = Math.min(100, score + Math.min(10, (reasons.length - 1) * 4));
  return { score, reasons };
};

const duplicatePairKey = (leftId, rightId) => [String(leftId), String(rightId)].sort().join('|');

export const buildDuplicateGroups = (users, minimumScore = 70, excludedPairs = new Set()) => {
  const rows = (Array.isArray(users) ? users : []).filter(user => user && !user.mergedInto && user.identityStatus !== 'legacy_linked');
  const parent = rows.map((_, index) => index);
  const find = index => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  const comparisons = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (excludedPairs.has(duplicatePairKey(rows[i].id, rows[j].id))) continue;
      const comparison = compareUsersForDuplicates(rows[i], rows[j]);
      if (comparison.score < minimumScore) continue;
      union(i, j);
      comparisons.set(`${i}:${j}`, comparison);
    }
  }
  const grouped = new Map();
  rows.forEach((user, index) => {
    const root = find(index);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root).push({ user, index });
  });
  return [...grouped.values()].filter(group => group.length > 1).map((group, groupIndex) => {
    const pairMatches = [];
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const left = Math.min(group[i].index, group[j].index);
        const right = Math.max(group[i].index, group[j].index);
        const comparison = comparisons.get(`${left}:${right}`) || compareUsersForDuplicates(group[i].user, group[j].user);
        if (comparison.score >= minimumScore) pairMatches.push({ leftId: group[i].user.id, rightId: group[j].user.id, ...comparison });
      }
    }
    const maxScore = Math.max(...pairMatches.map(item => item.score), 0);
    const reasons = [...new Map(pairMatches.flatMap(item => item.reasons).map(reason => [`${reason.field}:${reason.value || reason.similarity}`, reason])).values()];
    return {
      id: `duplicate-group-${groupIndex + 1}`,
      score: maxScore,
      confidence: maxScore >= 95 ? 'high' : maxScore >= 82 ? 'medium' : 'low',
      reasons,
      users: group.map(item => item.user),
    };
  }).sort((a, b) => b.score - a.score || b.users.length - a.users.length);
};

export const mergeUserProfiles = (target, sources) => {
  const all = [target, ...(Array.isArray(sources) ? sources : [])].filter(Boolean);
  const arrays = ['completedTasks', 'favorites', 'registeredEvents', 'roles', 'identityAliases', 'fcmTokens', 'friendIds', 'connectionIds'];
  const counters = ['keys', 'tickets', 'reputation', 'referralCount'];
  const maps = ['scannedPartners', 'scannedExperts', 'visitCounts'];
  const patch = {};
  arrays.forEach(key => {
    patch[key] = [...new Set(all.flatMap(user => Array.isArray(user[key]) ? user[key] : []).filter(Boolean))];
  });
  counters.forEach(key => {
    patch[key] = all.reduce((sum, user) => sum + (Number(user[key]) || 0), 0);
  });
  maps.forEach(key => {
    patch[key] = all.reduce((result, user) => {
      Object.entries(user[key] || {}).forEach(([id, value]) => {
        result[id] = (Number(result[id]) || 0) + (Number(value) || 0);
      });
      return result;
    }, {});
  });
  ['email', 'linkedEmail', 'phone', 'telegramId', 'tgId', 'telegramUsername', 'firebaseUid', 'authUid', 'displayName', 'name', 'photo', 'city'].forEach(key => {
    patch[key] = target?.[key] || all.find(user => user?.[key])?.[key] || null;
  });
  patch.canonicalUserId = target.id;
  patch.identityStatus = 'canonical';
  patch.identityAliases = [...new Set([...patch.identityAliases, ...all.map(user => user.id).filter(id => id && id !== target.id)])];
  return patch;
};
