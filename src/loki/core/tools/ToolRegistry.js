export const LOKI_TOOL_EVENTS = {
  REQUESTED: 'TOOL_REQUESTED',
  RESOLVED: 'TOOL_RESOLVED',
  STARTED: 'TOOL_STARTED',
  COMPLETED: 'TOOL_COMPLETED',
  FAILED: 'TOOL_FAILED',
  DENIED: 'TOOL_DENIED',
};

export const TOOL_IDS = {
  USER_PROFILE: 'user.profile',
  USER_KEYS: 'user.keys',
  USER_POINTS: 'user.points',
  PARTNER_FIND: 'partner.find',
  PARTNER_OPEN: 'partner.open',
  EXPERT_FIND: 'expert.find',
  PROMOTION_ACTIVE: 'promotion.active',
  PROMOTION_EXPIRING: 'promotion.expiring',
  PROMOTION_EXPIRING_TODAY: 'promotion.expiringToday',
  PROMOTION_EXPIRING_TOMORROW: 'promotion.expiringTomorrow',
  PROMOTION_NEW: 'promotion.new',
  GIFT_AVAILABLE: 'gift.available',
  GIFT_NEW: 'gift.new',
  GIFT_UNVIEWED: 'gift.unviewed',
  EVENT_TODAY: 'event.today',
  EVENT_UPCOMING: 'event.upcoming',
  EVENT_MY_REGISTRATIONS: 'event.myRegistrations',
  NEWS_LATEST: 'news.latest',
  NEWS_TODAY: 'news.today',
  MEETING_LIST: 'meeting.list',
  MEETING_NEXT: 'meeting.next',
  MEETING_TOMORROW: 'meeting.tomorrow',
  JOURNEY_PROGRESS: 'journey.progress',
  JOURNEY_UNFINISHED: 'journey.unfinished',
  JOURNEY_NEXT_REWARD: 'journey.nextReward',
  WORKSPACE_SUMMARY: 'workspace.summary',
  SEARCH: 'search.query',
};

export const TOOL_REGISTRY = [
  { id: TOOL_IDS.USER_PROFILE, tool: 'user', method: 'profile', scope: 'user', cacheTtlMs: 45000 },
  { id: TOOL_IDS.USER_KEYS, tool: 'user', method: 'keys', scope: 'user', cacheTtlMs: 30000 },
  { id: TOOL_IDS.USER_POINTS, tool: 'user', method: 'points', scope: 'user', cacheTtlMs: 30000 },
  { id: TOOL_IDS.PARTNER_FIND, tool: 'partner', method: 'find', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.PARTNER_OPEN, tool: 'partner', method: 'open', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.EXPERT_FIND, tool: 'expert', method: 'find', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.PROMOTION_ACTIVE, tool: 'promotion', method: 'active', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.PROMOTION_EXPIRING, tool: 'promotion', method: 'expiring', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.PROMOTION_EXPIRING_TODAY, tool: 'promotion', method: 'expiringToday', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.PROMOTION_EXPIRING_TOMORROW, tool: 'promotion', method: 'expiringTomorrow', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.PROMOTION_NEW, tool: 'promotion', method: 'new', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.GIFT_AVAILABLE, tool: 'gift', method: 'available', scope: 'user', cacheTtlMs: 45000 },
  { id: TOOL_IDS.GIFT_NEW, tool: 'gift', method: 'new', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.GIFT_UNVIEWED, tool: 'gift', method: 'unviewed', scope: 'user', cacheTtlMs: 45000 },
  { id: TOOL_IDS.EVENT_TODAY, tool: 'event', method: 'today', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.EVENT_UPCOMING, tool: 'event', method: 'upcoming', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.EVENT_MY_REGISTRATIONS, tool: 'event', method: 'myRegistrations', scope: 'user', cacheTtlMs: 30000 },
  { id: TOOL_IDS.NEWS_LATEST, tool: 'news', method: 'latest', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.NEWS_TODAY, tool: 'news', method: 'today', scope: 'public', cacheTtlMs: 45000 },
  { id: TOOL_IDS.MEETING_LIST, tool: 'meeting', method: 'list', scope: 'user', cacheTtlMs: 30000 },
  { id: TOOL_IDS.MEETING_NEXT, tool: 'meeting', method: 'next', scope: 'user', cacheTtlMs: 30000 },
  { id: TOOL_IDS.MEETING_TOMORROW, tool: 'meeting', method: 'tomorrow', scope: 'user', cacheTtlMs: 30000 },
  { id: TOOL_IDS.JOURNEY_PROGRESS, tool: 'journey', method: 'progress', scope: 'session', cacheTtlMs: 15000 },
  { id: TOOL_IDS.JOURNEY_UNFINISHED, tool: 'journey', method: 'unfinished', scope: 'session', cacheTtlMs: 15000 },
  { id: TOOL_IDS.JOURNEY_NEXT_REWARD, tool: 'journey', method: 'nextReward', scope: 'user', cacheTtlMs: 30000 },
  { id: TOOL_IDS.WORKSPACE_SUMMARY, tool: 'workspace', method: 'summary', scope: 'workspace', cacheTtlMs: 30000, roles: ['partner', 'expert', 'owner', 'admin'] },
  { id: TOOL_IDS.SEARCH, tool: 'search', method: 'query', scope: 'public', cacheTtlMs: 45000 },
].map(item => ({ readOnly: true, safe: true, ...item }));

const BY_ID = new Map(TOOL_REGISTRY.map(item => [item.id, item]));

export function getToolRegistry() {
  return TOOL_REGISTRY.slice();
}

export function getToolDefinition(id) {
  return BY_ID.get(id) || null;
}
