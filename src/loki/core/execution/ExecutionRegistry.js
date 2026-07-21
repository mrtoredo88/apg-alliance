import { ACTION_IDS } from '../actions/ActionRegistry.js';
import { TOOL_IDS } from '../tools/ToolRegistry.js';
import { PLANNER_GOALS } from '../planner/GoalResolver.js';
import { LOKI_APP_ACTIONS } from '../../lokiActionTypes.js';

export const EXECUTION_MODES = {
  NAVIGATION: 'navigation',
  PLANNER: 'planner',
  WORKFLOW: 'workflow',
  TOOL: 'tool',
  ACTION_CENTER: 'actionCenter',
  EXTERNAL: 'external',
};

const route = (screen, path = '') => ({ screen, path: path || `/${screen}` });

const EXECUTIONS = [
  { capability: 'OPEN_HOME', mode: EXECUTION_MODES.NAVIGATION, navigation: route('home', '/'), actionId: null, actionType: null, requiredParameters: [] },
  { capability: 'OPEN_PROFILE', mode: EXECUTION_MODES.NAVIGATION, navigation: route('profile', '/profile'), actionId: ACTION_IDS.OPEN_PROFILE, actionType: LOKI_APP_ACTIONS.SHOW_PROFILE, requiredParameters: [] },
  { capability: 'OPEN_PARTNER', mode: EXECUTION_MODES.NAVIGATION, navigation: route('partner', '/partners/:partnerId'), actionId: ACTION_IDS.OPEN_PARTNER, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER, toolIds: [TOOL_IDS.PARTNER_OPEN], workflowId: 'partner', requiredParameters: ['partnerId'] },
  { capability: 'OPEN_EXPERT', mode: EXECUTION_MODES.NAVIGATION, navigation: route('experts', '/experts/:expertId'), actionId: ACTION_IDS.OPEN_EXPERT, actionType: LOKI_APP_ACTIONS.OPEN_EXPERTS, toolIds: [TOOL_IDS.EXPERT_FIND], requiredParameters: ['expertId'] },
  { capability: 'OPEN_EVENT', mode: EXECUTION_MODES.NAVIGATION, navigation: route('events', '/events/:eventId'), actionId: ACTION_IDS.OPEN_EVENT, actionType: LOKI_APP_ACTIONS.OPEN_EVENT, toolIds: [TOOL_IDS.EVENT_UPCOMING], workflowId: 'event', requiredParameters: ['eventId'] },
  { capability: 'OPEN_NEWS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('news', '/news/:newsId'), actionId: ACTION_IDS.OPEN_NEWS, actionType: LOKI_APP_ACTIONS.OPEN_NEWS, toolIds: [TOOL_IDS.NEWS_LATEST], requiredParameters: ['newsId'] },
  { capability: 'OPEN_PROMOTION', mode: EXECUTION_MODES.NAVIGATION, navigation: route('offers', '/offers/:promotionId'), actionId: ACTION_IDS.OPEN_PROMOTION, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER, toolIds: [TOOL_IDS.PROMOTION_ACTIVE], requiredParameters: ['promotionId'] },
  { capability: 'OPEN_GIFTS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('rewards', '/rewards'), actionId: ACTION_IDS.OPEN_GIFT, actionType: LOKI_APP_ACTIONS.OPEN_PRIZE, toolIds: [TOOL_IDS.GIFT_AVAILABLE], workflowId: 'gift', requiredParameters: [] },
  { capability: 'OPEN_REWARDS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('rewards', '/rewards'), actionId: ACTION_IDS.OPEN_GIFT, actionType: LOKI_APP_ACTIONS.OPEN_PRIZE, toolIds: [TOOL_IDS.GIFT_AVAILABLE], workflowId: 'gift', requiredParameters: [] },
  { capability: 'OPEN_KEYS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('profile', '/profile#keys'), actionId: ACTION_IDS.OPEN_PROFILE, actionType: LOKI_APP_ACTIONS.SHOW_PROFILE, toolIds: [TOOL_IDS.USER_KEYS, TOOL_IDS.JOURNEY_PROGRESS], workflowId: 'journey', plannerGoal: PLANNER_GOALS.OPTIMIZE_KEYS, requiredParameters: [] },
  { capability: 'OPEN_SETTINGS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('profile', '/profile#settings'), actionId: ACTION_IDS.OPEN_PROFILE, actionType: LOKI_APP_ACTIONS.OPEN_SETTINGS, requiredParameters: [] },
  { capability: 'OPEN_WORKSPACE', mode: EXECUTION_MODES.NAVIGATION, navigation: route('workspace', '/workspace'), actionId: ACTION_IDS.OPEN_WORKSPACE, actionType: LOKI_APP_ACTIONS.OPEN_LOKI, toolIds: [TOOL_IDS.WORKSPACE_SUMMARY], workflowId: 'workspace', plannerGoal: PLANNER_GOALS.REVIEW_WORKSPACE, requiredParameters: [] },

  { capability: 'BOOK_APPOINTMENT', mode: EXECUTION_MODES.PLANNER, navigation: route('partner', '/partners/:partnerId#booking'), actionId: ACTION_IDS.OPEN_BOOKING, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER, toolIds: [TOOL_IDS.PARTNER_FIND, TOOL_IDS.EXPERT_FIND, TOOL_IDS.MEETING_LIST], workflowId: 'booking', plannerGoal: PLANNER_GOALS.BOOK_SERVICE_WITH_CONTEXT, requiredParameters: ['partnerId', 'serviceId', 'date'] },
  { capability: 'VIEW_BOOKINGS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('profile', '/profile#bookings'), actionId: ACTION_IDS.OPEN_PROFILE, actionType: LOKI_APP_ACTIONS.SHOW_PROFILE, toolIds: [TOOL_IDS.MEETING_LIST], requiredParameters: [] },
  { capability: 'RESCHEDULE_BOOKING', mode: EXECUTION_MODES.PLANNER, navigation: route('profile', '/profile#bookings'), actionId: ACTION_IDS.OPEN_BOOKING, actionType: LOKI_APP_ACTIONS.SHOW_PROFILE, toolIds: [TOOL_IDS.MEETING_LIST], workflowId: 'booking', requiredParameters: ['bookingId', 'date'] },
  { capability: 'CANCEL_BOOKING', mode: EXECUTION_MODES.ACTION_CENTER, navigation: route('profile', '/profile#bookings'), actionId: ACTION_IDS.OPEN_BOOKING, actionType: LOKI_APP_ACTIONS.SHOW_PROFILE, toolIds: [TOOL_IDS.MEETING_LIST], requiredParameters: ['bookingId'] },

  { capability: 'OPEN_DIALOG', mode: EXECUTION_MODES.NAVIGATION, navigation: route('profile', '/profile#people'), actionId: ACTION_IDS.OPEN_DIALOG, actionType: LOKI_APP_ACTIONS.OPEN_PEOPLE, requiredParameters: ['dialogId'] },
  { capability: 'SEND_MESSAGE', mode: EXECUTION_MODES.ACTION_CENTER, navigation: route('profile', '/profile#people'), actionId: ACTION_IDS.OPEN_DIALOG, actionType: LOKI_APP_ACTIONS.OPEN_PEOPLE, requiredParameters: ['recipientId', 'messageText'] },
  { capability: 'VIEW_FRIENDS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('profile', '/profile#people'), actionId: ACTION_IDS.OPEN_PEOPLE, actionType: LOKI_APP_ACTIONS.OPEN_PEOPLE, toolIds: [TOOL_IDS.USER_PROFILE], requiredParameters: [] },
  { capability: 'SEARCH_PEOPLE', mode: EXECUTION_MODES.TOOL, navigation: route('profile', '/profile#people'), actionId: ACTION_IDS.OPEN_PEOPLE, actionType: LOKI_APP_ACTIONS.OPEN_PEOPLE, toolIds: [TOOL_IDS.SEARCH, TOOL_IDS.USER_PROFILE], requiredParameters: ['query'] },
  { capability: 'ADD_FRIEND', mode: EXECUTION_MODES.ACTION_CENTER, navigation: route('profile', '/profile#people'), actionId: ACTION_IDS.OPEN_PEOPLE, actionType: LOKI_APP_ACTIONS.OPEN_PEOPLE, toolIds: [TOOL_IDS.USER_PROFILE], requiredParameters: ['userId'] },
  { capability: 'VIEW_ACTIVITY', mode: EXECUTION_MODES.NAVIGATION, navigation: route('activity', '/activity'), actionId: ACTION_IDS.OPEN_PROFILE, actionType: LOKI_APP_ACTIONS.SHOW_PROFILE, toolIds: [TOOL_IDS.USER_PROFILE], requiredParameters: [] },
  { capability: 'OPEN_FEED', mode: EXECUTION_MODES.NAVIGATION, navigation: route('news', '/news'), actionId: ACTION_IDS.OPEN_NEWS, actionType: LOKI_APP_ACTIONS.OPEN_NEWS_FEED, toolIds: [TOOL_IDS.NEWS_LATEST], requiredParameters: [] },

  { capability: 'VIEW_PARTNER_PROFILE', mode: EXECUTION_MODES.NAVIGATION, navigation: route('partner', '/partners/:partnerId'), actionId: ACTION_IDS.OPEN_PARTNER, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER, toolIds: [TOOL_IDS.PARTNER_OPEN], workflowId: 'partner', requiredParameters: ['partnerId'] },
  { capability: 'CALL_PARTNER', mode: EXECUTION_MODES.EXTERNAL, navigation: route('partner', '/partners/:partnerId#contacts'), actionId: ACTION_IDS.CALL, actionType: 'call', toolIds: [TOOL_IDS.PARTNER_OPEN], requiredParameters: ['partnerId'] },
  { capability: 'BUILD_ROUTE', mode: EXECUTION_MODES.NAVIGATION, navigation: route('map', '/map'), actionId: ACTION_IDS.OPEN_ROUTE, actionType: LOKI_APP_ACTIONS.OPEN_MAP, toolIds: [TOOL_IDS.PARTNER_OPEN], workflowId: 'partner', requiredParameters: ['partnerId'] },
  { capability: 'OPEN_SITE', mode: EXECUTION_MODES.EXTERNAL, navigation: route('partner', '/partners/:partnerId#site'), actionId: ACTION_IDS.OPEN_PARTNER, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER, toolIds: [TOOL_IDS.PARTNER_OPEN], requiredParameters: ['partnerId'] },
  { capability: 'OPEN_WHATSAPP', mode: EXECUTION_MODES.EXTERNAL, navigation: route('partner', '/partners/:partnerId#whatsapp'), actionId: ACTION_IDS.CONTACT, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER, toolIds: [TOOL_IDS.PARTNER_OPEN], requiredParameters: ['partnerId'] },
  { capability: 'OPEN_TELEGRAM', mode: EXECUTION_MODES.EXTERNAL, navigation: route('partner', '/partners/:partnerId#telegram'), actionId: ACTION_IDS.CONTACT, actionType: LOKI_APP_ACTIONS.OPEN_PARTNER, toolIds: [TOOL_IDS.PARTNER_OPEN], requiredParameters: ['partnerId'] },

  { capability: 'OPEN_ANALYTICS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('workspace', '/workspace#analytics'), actionId: ACTION_IDS.OPEN_WORKSPACE, actionType: LOKI_APP_ACTIONS.OPEN_LOKI, toolIds: [TOOL_IDS.WORKSPACE_SUMMARY], workflowId: 'workspace', plannerGoal: PLANNER_GOALS.REVIEW_WORKSPACE, requiredParameters: [] },
  { capability: 'OPEN_DAY_PLANNER', mode: EXECUTION_MODES.PLANNER, navigation: route('workspace', '/workspace#day'), actionId: ACTION_IDS.OPEN_WORKSPACE, actionType: LOKI_APP_ACTIONS.OPEN_LOKI, toolIds: [TOOL_IDS.MEETING_TOMORROW, TOOL_IDS.EVENT_UPCOMING], workflowId: 'workspace', plannerGoal: PLANNER_GOALS.PLAN_DAY, requiredParameters: [] },
  { capability: 'OPEN_MEETINGS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('workspace', '/workspace#meetings'), actionId: ACTION_IDS.OPEN_WORKSPACE, actionType: LOKI_APP_ACTIONS.OPEN_LOKI, toolIds: [TOOL_IDS.MEETING_LIST], workflowId: 'workspace', requiredParameters: [] },
  { capability: 'OPEN_EVENTS_MANAGER', mode: EXECUTION_MODES.NAVIGATION, navigation: route('workspace', '/workspace#events'), actionId: ACTION_IDS.OPEN_WORKSPACE, actionType: LOKI_APP_ACTIONS.OPEN_LOKI, toolIds: [TOOL_IDS.EVENT_UPCOMING], workflowId: 'workspace', requiredParameters: [] },
  { capability: 'OPEN_PROMOTIONS_MANAGER', mode: EXECUTION_MODES.NAVIGATION, navigation: route('workspace', '/workspace#promotions'), actionId: ACTION_IDS.OPEN_WORKSPACE, actionType: LOKI_APP_ACTIONS.OPEN_LOKI, toolIds: [TOOL_IDS.PROMOTION_ACTIVE], workflowId: 'workspace', requiredParameters: [] },
  { capability: 'OPEN_CONTENT_MANAGER', mode: EXECUTION_MODES.NAVIGATION, navigation: route('workspace', '/workspace#content'), actionId: ACTION_IDS.OPEN_WORKSPACE, actionType: LOKI_APP_ACTIONS.OPEN_LOKI, toolIds: [TOOL_IDS.NEWS_LATEST], workflowId: 'workspace', requiredParameters: [] },

  { capability: 'OPEN_ADMIN', mode: EXECUTION_MODES.NAVIGATION, navigation: route('admin', '/admin'), actionId: null, actionType: null, requiredParameters: [] },
  { capability: 'OPEN_MODERATION', mode: EXECUTION_MODES.NAVIGATION, navigation: route('admin', '/admin#moderation'), actionId: null, actionType: null, requiredParameters: [] },
  { capability: 'OPEN_USERS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('admin', '/admin#users'), actionId: null, actionType: null, toolIds: [TOOL_IDS.USER_PROFILE], requiredParameters: [] },
  { capability: 'OPEN_STATISTICS', mode: EXECUTION_MODES.NAVIGATION, navigation: route('admin', '/admin#statistics'), actionId: null, actionType: null, toolIds: [TOOL_IDS.WORKSPACE_SUMMARY], requiredParameters: [] },

  { capability: 'SEARCH_PARTNERS', mode: EXECUTION_MODES.TOOL, navigation: route('partners', '/partners?query=:query'), platformNavigation: { mobile: route('offers', '/offers?query=:query'), tablet: route('offers', '/offers?query=:query'), embedded: route('offers', '/offers?query=:query') }, actionId: ACTION_IDS.SEARCH, actionType: LOKI_APP_ACTIONS.OPEN_PARTNERS, platformActionType: { mobile: LOKI_APP_ACTIONS.OPEN_OFFERS, tablet: LOKI_APP_ACTIONS.OPEN_OFFERS, embedded: LOKI_APP_ACTIONS.OPEN_OFFERS }, toolIds: [TOOL_IDS.SEARCH, TOOL_IDS.PARTNER_FIND], workflowId: 'partner', requiredParameters: ['query'] },
  { capability: 'SEARCH_EXPERTS', mode: EXECUTION_MODES.TOOL, navigation: route('experts', '/experts?query=:query'), actionId: ACTION_IDS.OPEN_EXPERT, actionType: LOKI_APP_ACTIONS.OPEN_EXPERTS, toolIds: [TOOL_IDS.SEARCH, TOOL_IDS.EXPERT_FIND], requiredParameters: ['query'] },
  { capability: 'SEARCH_EVENTS', mode: EXECUTION_MODES.TOOL, navigation: route('events', '/events?query=:query'), actionId: ACTION_IDS.OPEN_EVENT, actionType: LOKI_APP_ACTIONS.OPEN_EVENTS, toolIds: [TOOL_IDS.SEARCH, TOOL_IDS.EVENT_UPCOMING], workflowId: 'event', requiredParameters: ['query'] },
  { capability: 'SEARCH_PROMOTIONS', mode: EXECUTION_MODES.TOOL, navigation: route('offers', '/offers?query=:query'), actionId: ACTION_IDS.OPEN_PROMOTION, actionType: LOKI_APP_ACTIONS.OPEN_OFFERS, toolIds: [TOOL_IDS.SEARCH, TOOL_IDS.PROMOTION_ACTIVE], requiredParameters: ['query'] },
  { capability: 'SEARCH_NEWS', mode: EXECUTION_MODES.TOOL, navigation: route('news', '/news?query=:query'), actionId: ACTION_IDS.OPEN_NEWS, actionType: LOKI_APP_ACTIONS.OPEN_NEWS_FEED, toolIds: [TOOL_IDS.SEARCH, TOOL_IDS.NEWS_LATEST], requiredParameters: ['query'] },
].map(item => ({
  toolIds: [],
  requiredParameters: [],
  optionalParameters: [],
  plannerGoal: '',
  workflowId: '',
  actionId: '',
  actionType: '',
  readyPolicy: 'allRequired',
  readOnly: true,
  safe: true,
  ...item,
}));

const BY_CAPABILITY = new Map(EXECUTIONS.map(item => [item.capability, item]));

export function getExecutionRegistry() {
  return EXECUTIONS.slice();
}

export function getExecutionDefinition(capability = '') {
  return BY_CAPABILITY.get(capability) || null;
}

export class ExecutionRegistry {
  all() {
    return getExecutionRegistry();
  }

  get(capability = '') {
    return getExecutionDefinition(capability);
  }
}
