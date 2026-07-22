import { buildUnifiedDialogList } from './MessagingRouter.js';
import { buildSocialMessagingSnapshot } from './SocialMessagingSnapshot.js';

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
    archive: buildUnifiedDialogList({ ...input, filter: 'archive' }).length,
    priority: dialogs
      .filter(item => Number(item.unreadCount || 0) > 0 || item.pinned || item.type === 'booking' || item.category === 'SUPPORT')
      .sort((a, b) => Number(b.unreadCount || 0) - Number(a.unreadCount || 0) || Number(b.pinned) - Number(a.pinned) || Number(b.type === 'booking') - Number(a.type === 'booking') || b.lastActivityMs - a.lastActivityMs)
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        title: item.header?.title || item.title || 'Переписка АПГ',
        reason: Number(item.unreadCount || 0) > 0 ? 'Есть непрочитанные' : item.pinned ? 'Закреплено' : item.type === 'booking' ? 'Запись требует внимания' : 'Важный диалог',
        unreadCount: Number(item.unreadCount || 0),
        type: item.type,
      })),
    nextBestAction: unread ? 'Ответить на новые сообщения' : dialogs.some(item => item.pinned) ? 'Проверить закреплённые диалоги' : dialogs.length ? 'Продолжить активные переписки' : 'Начать первое общение',
    realtime: 'existing-context-dialogs',
    source: 'users.contextDialogs',
    byType,
    byCategory,
    socialMessaging: buildSocialMessagingSnapshot(input),
    updatedAt: new Date().toISOString(),
  };
}
