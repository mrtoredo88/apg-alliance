import { MESSAGING_FILTERS } from './MessagingRegistry.js';
import { normalizeMessagingDialog } from './MessagingContext.js';

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export const MESSAGING_ROUTE = '/messages';

export function normalizeMessagingRoute(path = '', search = '') {
  const clean = String(path || '').replace(/\/+$/, '') || '/';
  if (clean === '/messages') return { panel: 'dialogs', route: MESSAGING_ROUTE, dialogId: new URLSearchParams(String(search || '').replace(/^\?/, '')).get('dialogId') || '' };
  if (clean === '/dialogs') return { panel: 'dialogs', route: '/dialogs', dialogId: new URLSearchParams(String(search || '').replace(/^\?/, '')).get('dialogId') || '' };
  return null;
}

export function buildMessagingDeepLink(dialogId = '') {
  const id = String(dialogId || '').trim();
  return id ? `${MESSAGING_ROUTE}?dialogId=${encodeURIComponent(id)}` : MESSAGING_ROUTE;
}

export function buildUnifiedDialogList({ dialogs = [], messages = [], actor = {}, filter = 'all', query = '' } = {}) {
  const byDialog = new Map();
  asList(messages).forEach(message => {
    const id = String(message.dialogId || '').trim();
    if (!id) return;
    if (!byDialog.has(id)) byDialog.set(id, []);
    byDialog.get(id).push(message);
  });
  const normalized = asList(dialogs).map(dialog => {
    const id = String(dialog.dialogId || dialog.id || '').trim();
    return normalizeMessagingDialog(dialog, { actor, messages: byDialog.get(id) || [] });
  });
  const text = String(query || '').trim().toLowerCase();
  return normalized
    .filter(dialog => dialog.permissions.canRead)
    .filter(dialog => {
      if (filter === 'unread') return dialog.unreadCount > 0;
      const category = MESSAGING_FILTERS.find(item => item.id === filter)?.category;
      return !category || dialog.category === category;
    })
    .filter(dialog => !text || dialog.searchText.includes(text))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.unreadCount > 0) - Number(a.unreadCount > 0) || b.lastActivityMs - a.lastActivityMs);
}
