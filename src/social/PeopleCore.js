function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function text(value, max = 220) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function lower(value = '') {
  return text(value, 500).toLowerCase().replace(/ё/g, 'е');
}

function idOf(value = {}) {
  return text(value.id || value.userId || value.contactUserId || value.targetUserId || value.recipientId || value.senderId, 180);
}

export const PEOPLE_TABS = [
  { id: 'all', label: 'Все' },
  { id: 'friends', label: 'Друзья' },
  { id: 'requests', label: 'Заявки' },
  { id: 'dialogs', label: 'Диалоги' },
];

export const PEOPLE_RELATION_STATUS = {
  STRANGER: 'stranger',
  OUTGOING: 'outgoing',
  INCOMING: 'incoming',
  FRIEND: 'friend',
  BLOCKED: 'blocked',
};

export function peopleStatusLabel(status = '') {
  return {
    [PEOPLE_RELATION_STATUS.STRANGER]: 'Не знаком',
    [PEOPLE_RELATION_STATUS.OUTGOING]: 'Запрос отправлен',
    [PEOPLE_RELATION_STATUS.INCOMING]: 'Запрос получен',
    [PEOPLE_RELATION_STATUS.FRIEND]: 'Друзья',
    [PEOPLE_RELATION_STATUS.BLOCKED]: 'Заблокирован',
  }[status] || 'Не знаком';
}

export function peoplePresenceLabel(person = {}) {
  if (person.onlineStatus === 'online' || person.online === true) return 'онлайн';
  if (person.onlineStatus === 'recent' || person.lastSeenAt) return 'недавно был';
  return '';
}

export function publicPerson(user = {}, fallbackId = '') {
  const id = idOf(user) || text(fallbackId, 180);
  const displayName = text(user.displayName || user.name || [user.firstName || user.first_name, user.lastName || user.last_name].filter(Boolean).join(' '), 160) || 'Участник АПГ';
  return {
    id,
    displayName,
    photo: text(user.photo || user.photo_200 || user.avatar || user.avatarUrl, 1000),
    role: text(user.role || user.userRole || user.status, 80),
    company: text(user.company || user.companyName || user.organization || user.partnerName || user.expertName, 160),
    expert: text(user.expert || user.specialization || user.expertCategory, 160),
    city: text(user.city || user.town, 120),
    about: text(user.about || user.bio || user.description || user.shortDescription, 240),
    phone: text(user.phone, 80),
    interests: list(user.interests || user.tags || user.categories).map(item => text(item, 80)).filter(Boolean).slice(0, 5),
    lastActivityAt: user.lastActivityAt || user.lastMessageAt || user.updatedAt || user.connectedAt || user.createdAt || '',
    onlineStatus: user.onlineStatus || (user.online === true ? 'online' : user.lastSeenAt ? 'recent' : ''),
    searchText: lower([displayName, user.username, user.firstName, user.lastName, user.company, user.companyName, user.organization, user.role, user.partnerName, user.expertName, user.specialization, user.city].filter(Boolean).join(' ')),
  };
}

function timeMs(value) {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function recentPeopleGroups(people = [], now = Date.now()) {
  const day = 86400000;
  const groups = [
    { id: 'today', label: 'Сегодня', rows: [] },
    { id: 'yesterday', label: 'Вчера', rows: [] },
    { id: 'week', label: 'На этой неделе', rows: [] },
  ];
  list(people)
    .map(row => ({ ...row, recentAt: timeMs(row.lastActivityAt || row.connection?.connectedAt || row.connection?.updatedAt || row.dialog?.lastMessageAt || row.dialog?.updatedAt) }))
    .filter(row => row.recentAt > 0 && now - row.recentAt <= 7 * day)
    .sort((a, b) => b.recentAt - a.recentAt)
    .forEach(row => {
      if (now - row.recentAt < day) groups[0].rows.push(row);
      else if (now - row.recentAt < 2 * day) groups[1].rows.push(row);
      else groups[2].rows.push(row);
    });
  return groups.filter(group => group.rows.length);
}

export function peopleSuggestionReason(person = {}) {
  const shared = person.shared || {};
  const contacts = list(shared.contacts).length;
  const events = list(shared.events).length;
  const partners = list(shared.partners).length;
  if (contacts) return `${contacts} общих друзей`;
  if (events > 1) return `${events} общих мероприятия`;
  if (events === 1) return 'Вы оба были на одном мероприятии';
  if (partners > 1) return `${partners} общих партнёра`;
  if (partners === 1) return 'Работаете с одним партнёром';
  return '';
}

export function personInterestTags(person = {}) {
  return [
    ...list(person.interests),
    person.role,
    person.company,
    person.expert,
    person.city,
  ].map(item => text(item, 80)).filter(Boolean).slice(0, 4);
}

export function buildPeopleSections({ people = [], pinnedIds = [] } = {}) {
  const pinned = new Set(list(pinnedIds).map(String));
  const rows = list(people);
  const favorites = rows.filter(row => pinned.has(String(row.id)));
  const recentGroups = recentPeopleGroups(rows.filter(row => row.dialogId || row.relationStatus === PEOPLE_RELATION_STATUS.FRIEND));
  const friends = rows.filter(row => row.relationStatus === PEOPLE_RELATION_STATUS.FRIEND);
  const suggestions = rows
    .filter(row => row.relationStatus === PEOPLE_RELATION_STATUS.STRANGER && peopleSuggestionReason(row))
    .sort((a, b) => {
      const aScore = list(a.shared?.contacts).length * 3 + list(a.shared?.events).length * 2 + list(a.shared?.partners).length;
      const bScore = list(b.shared?.contacts).length * 3 + list(b.shared?.events).length * 2 + list(b.shared?.partners).length;
      return bScore - aScore;
    })
    .slice(0, 8);
  return { favorites, recentGroups, friends, suggestions, all: rows.filter(row => !pinned.has(String(row.id))) };
}

export function relationStatusForPerson(person = {}, { connections = [], requests = [], blocked = [], actorId = '' } = {}) {
  const id = idOf(person);
  if (!id) return PEOPLE_RELATION_STATUS.STRANGER;
  if (list(blocked).map(String).includes(String(id))) return PEOPLE_RELATION_STATUS.BLOCKED;
  const directStatus = text(person.relationStatus || person.status, 80);
  if (directStatus === 'connected' || directStatus === PEOPLE_RELATION_STATUS.FRIEND) return PEOPLE_RELATION_STATUS.FRIEND;
  if (directStatus === 'pending' && person.direction === 'incoming') return PEOPLE_RELATION_STATUS.INCOMING;
  if (directStatus === 'pending' || person.direction === 'outgoing') return PEOPLE_RELATION_STATUS.OUTGOING;
  if (list(connections).some(item => String(item.contactUserId || item.id) === String(id) && item.status === 'connected')) return PEOPLE_RELATION_STATUS.FRIEND;
  const request = list(requests).find(item => [item.senderId, item.recipientId, item.contactUserId].map(String).includes(String(id)) && item.status === 'pending');
  if (!request) return PEOPLE_RELATION_STATUS.STRANGER;
  return String(request.recipientId) === String(actorId) || request.direction === 'incoming'
    ? PEOPLE_RELATION_STATUS.INCOMING
    : PEOPLE_RELATION_STATUS.OUTGOING;
}

export function buildPeopleRows({ users = [], connections = [], requests = [], dialogs = [], blocked = [], actor = {} } = {}) {
  const actorId = idOf(actor);
  const byId = new Map();
  const upsert = (person, patch = {}) => {
    const id = idOf(person);
    if (!id || id === actorId) return;
    byId.set(id, { ...(byId.get(id) || publicPerson(person, id)), ...publicPerson(person, id), ...patch });
  };
  list(users).forEach(user => upsert(user, { status: user.status, direction: user.direction, dialogId: user.dialogId || '', shared: user.shared || null }));
  list(connections).forEach(row => upsert(row.contact || row, { connection: row, dialogId: row.dialogId || '', shared: row.shared || null, lastActivityAt: row.lastMessageAt || row.connectedAt || row.updatedAt || '' }));
  list(requests).forEach(row => {
    const person = String(row.senderId) === String(actorId) ? row.recipient : row.sender;
    upsert(person || row, { request: row, dialogId: row.dialogId || '', lastActivityAt: row.updatedAt || row.createdAt || '' });
  });
  list(dialogs).forEach(dialog => {
    const participants = list(dialog.participants || dialog.context?.participants);
    const directUser = participants.find(item => idOf(item) && idOf(item) !== actorId);
    if (dialog.type === 'direct' || dialog.context?.type === 'direct') upsert(directUser || { id: dialog.context?.targetUserId || dialog.objectId, displayName: dialog.context?.title }, { dialog, dialogId: dialog.id || dialog.dialogId, lastActivityAt: dialog.lastMessageAt || dialog.updatedAt || '' });
  });
  return [...byId.values()].map(row => ({
    ...row,
    relationStatus: relationStatusForPerson(row, { connections, requests, blocked, actorId }),
    shared: row.shared || { contacts: [], events: [], partners: [] },
  }));
}

export function searchPeopleGroups({ query = '', people = [], partners = [], experts = [], events = [] } = {}) {
  const q = lower(query);
  const match = value => !q || lower(value).includes(q);
  const peopleRows = list(people).filter(row => !q || row.searchText?.includes(q) || match([row.displayName, row.role, row.company, row.expert, row.city, row.about].join(' ')));
  const partnerRows = list(partners).filter(row => match([row.name, row.title, row.category, row.address, row.city, row.description].join(' '))).slice(0, 8);
  const expertRows = list(experts).filter(row => match([row.name, row.title, row.specialization, row.category, row.city, row.description].join(' '))).slice(0, 8);
  const eventRows = list(events).filter(row => match([row.title, row.name, row.category, row.city, row.description].join(' '))).slice(0, 8);
  return [
    { id: 'people', label: 'Люди', rows: peopleRows },
    { id: 'partners', label: 'Партнёры', rows: partnerRows },
    { id: 'experts', label: 'Эксперты', rows: expertRows },
    { id: 'events', label: 'Мероприятия', rows: eventRows },
  ].filter(group => group.rows.length);
}

export function buildSocialAnalytics({ users = [], connections = [], requests = [], dialogs = [], analyticsRows = [] } = {}) {
  const accepted = list(requests).filter(row => row.status === 'accepted' || row.connectionStatus === 'connected').length;
  const declined = list(requests).filter(row => row.status === 'declined' || row.status === 'cancelled').length;
  const totalRequests = list(requests).length;
  const messages = list(dialogs).reduce((sum, row) => sum + Number(row.messageCount || row.messagesCount || (row.lastMessage ? 1 : 0)), 0);
  const firstResponses = list(dialogs)
    .map(row => timeMs(row.firstResponseAt) - timeMs(row.createdAt))
    .filter(ms => ms > 0);
  const communities = new Map();
  list(dialogs).forEach(row => {
    const key = text(row.context?.parentTitle || row.context?.title || row.parentTitle || row.title || 'АПГ', 120);
    if (!key) return;
    communities.set(key, (communities.get(key) || 0) + Number(row.messageCount || row.messagesCount || 1));
  });
  const activeUsers = list(users)
    .map(user => ({ id: idOf(user), name: publicPerson(user).displayName, score: list(user.connectionIds).length + list(user.socialConnectionIds).length + Number(user.keys || 0) }))
    .filter(row => row.id)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  return {
    users: list(users).length,
    friends: list(connections).filter(row => row.status === 'connected').length,
    requests: totalRequests,
    messages,
    averageFriends: list(users).length ? Math.round((list(connections).length / list(users).length) * 10) / 10 : 0,
    averageMessages: list(dialogs).length ? Math.round((messages / list(dialogs).length) * 10) / 10 : 0,
    averageFirstResponseMinutes: firstResponses.length ? Math.round(firstResponses.reduce((sum, ms) => sum + ms, 0) / firstResponses.length / 6000) / 10 : 0,
    newConnections: list(requests).filter(row => row.status === 'accepted' || row.connectionStatus === 'connected').length,
    acceptedRequests: accepted,
    declinedRequests: declined,
    activeCommunities: [...communities.entries()].map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score).slice(0, 8),
    networkGrowth: list(analyticsRows).filter(row => String(row.action || row.type || '').includes('connection')).length,
    activeUsers,
    requestAcceptanceRate: totalRequests ? Math.round((accepted / totalRequests) * 100) : 0,
  };
}
