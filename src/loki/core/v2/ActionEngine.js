import { assertActionAllowed } from './PermissionEngine.js';

const SAFE_CLIENT_ACTIONS = new Set([
  'openPartner', 'openEvent', 'openNews', 'openPrize', 'openPartners', 'openExperts',
  'openEvents', 'openNewsFeed', 'openTasks', 'openMap', 'showNearestPartners',
  'showProfile', 'showAchievements', 'showFavorites', 'showNotifications',
  'startQrScanner', 'openSettings', 'openReference', 'openLoki',
]);

export class ActionEngine {
  constructor({ clientActions = {}, backendExecutor = null } = {}) {
    this.clientActions = clientActions;
    this.backendExecutor = backendExecutor;
  }

  async execute(request, actor = {}) {
    if (!request?.type) throw new Error('Loki action type is required');
    assertActionAllowed({
      role: actor.role || 'user',
      requiredPermissions: request.requiredPermissions || [],
      permissions: actor.permissions || [],
    });
    if (SAFE_CLIENT_ACTIONS.has(request.type)) {
      const handler = this.clientActions[request.type];
      if (typeof handler !== 'function') throw new Error(`Loki client action is unavailable: ${request.type}`);
      return handler(request.payload || {});
    }
    if (request.mode !== 'backend' || typeof this.backendExecutor !== 'function') {
      throw new Error(`Loki privileged action requires backend execution: ${request.type}`);
    }
    return this.backendExecutor(request, actor);
  }
}
