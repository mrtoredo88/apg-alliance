import { getMessagingCategory, getMessagingTypeMeta, normalizeMessagingType } from './MessagingRegistry.js';
import { buildMessagingPermissions } from './MessagingPermissions.js';

export function messagingTime(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function text(value, fallback = '') {
  const result = String(value ?? '').trim();
  return result || fallback;
}

function avatarFor(type, context = {}) {
  if (context.image) return context.image;
  if (type === 'event') return '🎉';
  if (type === 'expert') return '✦';
  if (type === 'promotion') return '🎁';
  if (type === 'booking') return '📅';
  if (type === 'support') return '🛟';
  if (type === 'group') return '👥';
  if (type === 'news') return '📰';
  return type === 'partner' ? '🏪' : '💬';
}

export function buildConversationHeader(dialog = {}, messages = []) {
  const context = dialog.context || {};
  const type = normalizeMessagingType(dialog.type || context.type);
  const meta = getMessagingTypeMeta(type);
  const lastMessage = dialog.lastMessage || [...messages].reverse().find(Boolean) || null;
  const title = text(dialog.title || context.title || context.parentTitle || dialog.userName || dialog.customerName, meta.label);
  const subtitle = text(dialog.subtitle || context.subtitle || context.parentTitle || meta.label);
  const lastActivity = dialog.lastMessageAt || lastMessage?.createdAt || dialog.updatedAt || dialog.createdAt || null;
  return {
    avatar: avatarFor(type, context),
    title,
    subtitle,
    context,
    lastMessage,
    lastActivity,
    unreadCount: Number(dialog.unreadCount || dialog.unreadByCurrentUser || 0),
  };
}

export function normalizeMessagingDialog(dialog = {}, { messages = [], actor = {} } = {}) {
  const type = normalizeMessagingType(dialog.type || dialog.context?.type);
  const category = getMessagingCategory(type, dialog.context || {});
  const header = buildConversationHeader(dialog, messages);
  const lastActivityMs = messagingTime(header.lastActivity);
  const permissions = buildMessagingPermissions(actor, dialog);
  return {
    ...dialog,
    id: String(dialog.id || dialog.dialogId || ''),
    dialogId: String(dialog.dialogId || dialog.id || ''),
    type,
    category,
    header,
    lastActivityMs,
    pinned: dialog.pinned === true || dialog.workspaceState?.pinned === true || dialog.workspacePrivate?.pinned === true,
    unreadCount: header.unreadCount,
    permissions,
    searchText: buildMessagingSearchText({ ...dialog, type, category, header }, messages),
  };
}

export function buildMessagingSearchText(dialog = {}, messages = []) {
  const header = dialog.header || buildConversationHeader(dialog, messages);
  const context = header.context || dialog.context || {};
  return [
    dialog.id,
    dialog.dialogId,
    dialog.type,
    dialog.category,
    header.title,
    header.subtitle,
    context.title,
    context.parentTitle,
    context.subtitle,
    dialog.userName,
    dialog.customerName,
    header.lastMessage?.text,
    ...(Array.isArray(dialog.participants) ? dialog.participants.map(item => item.name || item.title || item.id) : []),
    ...messages.slice(-8).map(item => item.text),
  ].map(item => text(item).toLowerCase()).filter(Boolean).join(' ');
}
