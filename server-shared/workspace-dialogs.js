function asText(value, max = 400) {
  return String(value ?? '').trim().slice(0, max);
}

function asMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function dayKey(value) {
  const ms = asMs(value);
  if (!ms) return '';
  return new Date(ms).toISOString().slice(0, 10);
}

function weekKey(value) {
  const ms = asMs(value);
  if (!ms) return '';
  const date = new Date(ms);
  const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-${Math.ceil((((date - first) / 86400000) + first.getUTCDay() + 1) / 7)}`;
}

export function sanitizeDialogWorkspaceNotes(value) {
  return asText(value, 4000);
}

export function getDialogWorkspaceState(dialog = {}) {
  const state = dialog.workspacePrivate && typeof dialog.workspacePrivate === 'object' ? dialog.workspacePrivate : {};
  return {
    pinned: state.pinned === true,
    archived: state.archived === true,
    notes: sanitizeDialogWorkspaceNotes(state.notes),
    status: asText(state.status || '', 80),
    updatedAt: state.updatedAt || dialog.updatedAt || null,
  };
}

export function buildWorkspaceDialogSearchText(dialog = {}, messages = []) {
  const context = dialog.context || {};
  const state = getDialogWorkspaceState(dialog);
  return [
    dialog.id,
    dialog.dialogId,
    dialog.type,
    dialog.objectId,
    context.title,
    context.parentTitle,
    context.subtitle,
    context.phone,
    context.address,
    context.date,
    dialog.userName,
    dialog.customerName,
    dialog.lastMessage?.text,
    state.notes,
    ...messages.slice(-12).map(message => message.text),
  ].map(value => asText(value, 700).toLowerCase()).filter(Boolean).join(' ');
}

export function enrichWorkspaceDialogs({ dialogs = [], messages = [], bookings = [], events = [], now = new Date() } = {}) {
  const today = dayKey(now);
  const currentWeek = weekKey(now);
  const byDialog = new Map();
  messages.forEach(message => {
    const id = asText(message.dialogId || '', 260);
    if (!id) return;
    if (!byDialog.has(id)) byDialog.set(id, []);
    byDialog.get(id).push(message);
  });
  const rows = dialogs.map(dialog => {
    const id = asText(dialog.dialogId || dialog.id, 260);
    const dialogMessages = (byDialog.get(id) || []).sort((a, b) => asMs(a.createdAt) - asMs(b.createdAt));
    const context = dialog.context || {};
    const state = getDialogWorkspaceState(dialog);
    const relatedBookings = bookings
      .filter(item => String(item.dialogId || '') === id || String(item.userId || '') === String(dialog.userId || ''))
      .sort((a, b) => asMs(b.startAt || b.createdAt) - asMs(a.startAt || a.createdAt));
    const upcomingBooking = relatedBookings
      .filter(item => asMs(item.startAt) >= Number(now))
      .sort((a, b) => asMs(a.startAt) - asMs(b.startAt))[0] || null;
    const relatedEvents = events.filter(event => String(event.id || '') === String(context.eventId || context.objectId || '') || String(event.partnerId || '') === String(context.partnerId || ''));
    const lastMessageAt = dialog.lastMessageAt || dialog.lastMessage?.createdAt || dialog.updatedAt;
    return {
      ...dialog,
      id,
      dialogId: id,
      context,
      messages: dialogMessages,
      messageCount: dialogMessages.length,
      relatedBookings,
      upcomingBooking,
      relatedEvents,
      workspaceState: state,
      lastMessageAt,
      lastMessageMs: asMs(lastMessageAt),
      unreadCount: Number(dialog.unreadCount || dialog.unreadByCurrentUser || 0),
      hasNotes: Boolean(state.notes),
      isToday: dayKey(lastMessageAt) === today || relatedBookings.some(item => dayKey(item.startAt) === today),
      isThisWeek: weekKey(lastMessageAt) === currentWeek || relatedBookings.some(item => weekKey(item.startAt) === currentWeek),
      awaitingReply: dialog.lastMessage?.senderRole === 'user' || Number(dialog.unreadCount || 0) > 0,
      searchText: '',
    };
  });
  return rows
    .map(row => ({ ...row, searchText: buildWorkspaceDialogSearchText(row, row.messages) }))
    .sort((a, b) => Number(b.workspaceState.pinned) - Number(a.workspaceState.pinned) || b.lastMessageMs - a.lastMessageMs);
}

export function filterWorkspaceDialogs(dialogs = [], { filter = 'active', query = '' } = {}) {
  const text = asText(query, 300).toLowerCase();
  return dialogs.filter(dialog => {
    if (filter === 'unread' && !dialog.unreadCount) return false;
    if (filter === 'today' && !dialog.isToday) return false;
    if (filter === 'week' && !dialog.isThisWeek) return false;
    if (filter === 'has-bookings' && !dialog.relatedBookings?.length) return false;
    if (filter === 'no-bookings' && dialog.relatedBookings?.length) return false;
    if (filter === 'archive' && !dialog.workspaceState?.archived) return false;
    if (filter === 'notes' && !dialog.hasNotes) return false;
    if (filter === 'awaiting' && !dialog.awaitingReply) return false;
    if (filter === 'pinned' && !dialog.workspaceState?.pinned) return false;
    if (filter === 'active' && dialog.workspaceState?.archived) return false;
    if (text && !dialog.searchText.includes(text)) return false;
    return true;
  });
}

export function buildWorkspaceDialogKpis(dialogs = []) {
  return {
    all: dialogs.length,
    unread: dialogs.filter(item => item.unreadCount > 0).length,
    awaiting: dialogs.filter(item => item.awaitingReply).length,
    today: dialogs.filter(item => item.isToday).length,
    withBookings: dialogs.filter(item => item.relatedBookings?.length).length,
    notes: dialogs.filter(item => item.hasNotes).length,
    pinned: dialogs.filter(item => item.workspaceState?.pinned).length,
    archived: dialogs.filter(item => item.workspaceState?.archived).length,
  };
}

export function buildDialogWorkspaceHistory(dialog = {}) {
  const messages = Array.isArray(dialog.messages) ? dialog.messages : [];
  const bookingEvents = (dialog.relatedBookings || []).flatMap(item => [
    ...(Array.isArray(item.statusHistory) ? item.statusHistory : []),
    ...(Array.isArray(item.workspaceHistory) ? item.workspaceHistory : []),
  ].map(event => ({ ...event, source: 'booking', bookingId: item.id || item.bookingId })));
  return [
    { id: `${dialog.id}:created`, type: 'dialog_created', text: 'Создан диалог', at: dialog.createdAt },
    ...messages.filter(item => item.senderRole === 'system' || item.isSystem).map(item => ({ id: item.id, type: 'system_message', text: item.text, at: item.createdAt })),
    ...bookingEvents.map((item, index) => ({ id: `${dialog.id}:booking:${index}`, type: item.type || item.toStatus || 'booking_event', text: item.text || item.reason || item.toStatus || 'Событие встречи', at: item.at || item.createdAt })),
  ].filter(item => item.text).sort((a, b) => asMs(b.at) - asMs(a.at));
}
