import { LOKI_APP_ACTIONS, createLokiAction } from '../../lokiActionTypes.js';

function value(params = {}, ...keys) {
  return keys.map(key => params[key]).find(item => item !== undefined && item !== null && String(item).trim()) || '';
}

export function resolveControlledDispatch(executionContext = {}) {
  const capability = executionContext.capability || '';
  const params = executionContext.resolved || {};
  const actionType = executionContext.actionType || '';
  if (capability === 'OPEN_HOME') return { dispatcher: 'Navigation', action: null, route: '/', reason: 'home_route_is_internal' };
  if (!actionType) return { dispatcher: '', action: null, route: executionContext.navigation?.path || '', reason: 'action_unavailable' };
  const payload = {};
  if (value(params, 'partnerId', 'id')) payload.partnerId = value(params, 'partnerId', 'id');
  if (value(params, 'expertId', 'id')) payload.expertId = value(params, 'expertId', 'id');
  if (value(params, 'eventId', 'id')) payload.eventId = value(params, 'eventId', 'id');
  if (value(params, 'newsId', 'id')) payload.newsId = value(params, 'newsId', 'id');
  if (value(params, 'promotionId')) payload.id = value(params, 'promotionId');
  if (value(params, 'locationId')) payload.locationId = value(params, 'locationId');
  if (capability === 'SEARCH_EXPERTS') return { dispatcher: 'Action Center', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EXPERTS, payload), route: executionContext.navigation?.path || '', reason: 'existing_loki_action' };
  if (capability === 'SEARCH_EVENTS') return { dispatcher: 'Action Center', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_EVENTS, payload), route: executionContext.navigation?.path || '', reason: 'existing_loki_action' };
  if (capability === 'SEARCH_NEWS') return { dispatcher: 'Action Center', action: createLokiAction(LOKI_APP_ACTIONS.OPEN_NEWS_FEED, payload), route: executionContext.navigation?.path || '', reason: 'existing_loki_action' };
  return {
    dispatcher: actionType === 'call' || actionType === 'share' || actionType === 'copyLink' ? 'External Action' : 'Action Center',
    action: createLokiAction(actionType, payload),
    route: executionContext.navigation?.path || '',
    reason: 'existing_loki_action',
  };
}

export class ExecutionDispatcher {
  resolve(context = {}) {
    return resolveControlledDispatch(context);
  }
}
