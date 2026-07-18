import { buildUnifiedDialogList } from './MessagingRouter.js';

export function buildMessagingSnapshot(input = {}) {
  const dialogs = buildUnifiedDialogList(input);
  const unread = dialogs.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
  const byType = dialogs.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  const byCategory = dialogs.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  return {
    total: dialogs.length,
    unread,
    pinned: dialogs.filter(item => item.pinned).length,
    realtime: 'existing-context-dialogs',
    source: 'users.contextDialogs',
    byType,
    byCategory,
    updatedAt: new Date().toISOString(),
  };
}
