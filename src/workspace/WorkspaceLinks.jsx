import React from 'react';

const LINK_INTENT_KEY = 'apg.workspace.linkIntent';

const UI = {
  text: 'var(--apg-workspace-text, #1F1A14)',
  soft: 'var(--apg-workspace-soft, rgba(31,26,20,0.64))',
  muted: 'var(--apg-workspace-muted, rgba(31,26,20,0.46))',
  line: 'var(--apg-workspace-line, rgba(88,67,37,0.12))',
  card: 'var(--apg-workspace-card, rgba(255,255,255,0.78))',
  control: 'var(--apg-workspace-control, rgba(255,255,255,0.72))',
  gold: '#C89B3C',
  green: '#2EB36B',
  red: '#D95D54',
  blue: '#5B8FDB',
};

const SECTION_BY_TARGET = {
  dashboard: 'dashboard',
  profile: 'profile',
  events: 'events',
  event: 'events',
  booking: 'booking',
  bookings: 'booking',
  meetings: 'booking',
  dialogs: 'dialogs',
  dialog: 'dialogs',
  content: 'content',
  news: 'content',
  analytics: 'analytics',
  offers: 'offers',
  promotion: 'offers',
  rewards: 'rewards',
  gifts: 'rewards',
  gift: 'rewards',
  notifications: 'notifications',
};

function sameId(a, b) {
  return String(a || '') && String(a || '') === String(b || '');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object';
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function titleOf(item, fallback = 'Объект') {
  if (!isRecord(item)) return fallback;
  return item?.title || item?.name || item?.displayName || item?.serviceTitle || item?.context?.title || fallback;
}

function itemId(item) {
  if (!isRecord(item)) return '';
  return item?.id || item?.bookingId || item?.dialogId || item?.objectId || '';
}

function uniqLinks(rows = []) {
  const seen = new Set();
  return rows.filter(item => {
    if (!item?.target || !item?.title) return false;
    const key = `${item.target}:${item.id || item.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 7);
}

export function saveWorkspaceLinkIntent(target, payload = {}) {
  if (typeof window === 'undefined') return;
  const section = SECTION_BY_TARGET[target] || target || 'dashboard';
  sessionStorage.setItem(LINK_INTENT_KEY, JSON.stringify({ section, target, payload, createdAt: Date.now() }));
}

export function readWorkspaceLinkIntent(section) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LINK_INTENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value?.section !== section) return null;
    sessionStorage.removeItem(LINK_INTENT_KEY);
    return value.payload || {};
  } catch {
    sessionStorage.removeItem(LINK_INTENT_KEY);
    return null;
  }
}

export function openWorkspaceLink(actions, target, payload = {}) {
  const section = SECTION_BY_TARGET[target] || target || 'dashboard';
  saveWorkspaceLinkIntent(target, payload);
  const map = {
    dashboard: actions?.openDashboard,
    profile: actions?.openProfile,
    events: actions?.openEvents,
    booking: actions?.openBooking,
    dialogs: actions?.openDialogs,
    content: actions?.openNews,
    analytics: actions?.openAnalytics,
    offers: actions?.openOffers,
    rewards: actions?.openRewards,
    notifications: actions?.openMessages,
  };
  (map[section] || actions?.openDashboard)?.();
}

export function buildWorkspaceRelatedLinks({ source = '', item = {}, events = [], news = [], promotions = [], gifts = [], bookings = [], dialogs = [], profile = {}, analytics } = {}) {
  item = isRecord(item) ? item : {};
  profile = isRecord(profile) ? profile : {};
  events = asArray(events);
  news = asArray(news);
  promotions = asArray(promotions);
  gifts = asArray(gifts);
  bookings = asArray(bookings);
  dialogs = asArray(dialogs);
  const id = itemId(item);
  const eventId = item.eventId || item.sourceEventId || item.context?.eventId || (source === 'event' ? id : '');
  const newsId = item.newsId || item.sourceNewsId || (source === 'news' ? id : '');
  const promotionId = item.promotionId || item.offerId || (source === 'promotion' ? id : '');
  const bookingId = item.bookingId || (source === 'booking' ? id : '');
  const dialogId = item.dialogId || (source === 'dialog' ? id : '');
  const profileId = item.profileId || item.partnerId || item.expertId || item.providerId || profile?.id || item.context?.parentId || item.context?.objectId || '';

  const linkedEvent = events.find(event => sameId(event.id, eventId));
  const linkedNews = news.find(row => sameId(row.id, newsId));
  const linkedPromotion = promotions.find(row => sameId(row.id, promotionId) || sameId(row.eventId, eventId) || sameId(row.newsId, newsId));
  const linkedGift = gifts.find(row => sameId(row.id, item.prizeId || item.giftId) || sameId(row.promotionId, promotionId) || sameId(row.eventId, eventId) || sameId(row.newsId, newsId));
  const linkedBooking = bookings.find(row => sameId(row.id || row.bookingId, bookingId) || sameId(row.eventId || row.sourceEventId, eventId) || sameId(row.dialogId, dialogId));
  const linkedDialog = dialogs.find(row => sameId(row.id || row.dialogId, dialogId) || sameId(row.objectId || row.context?.objectId, id) || sameId(row.context?.eventId, eventId) || sameId(row.context?.bookingId, bookingId));

  const rows = [
    source === 'event' ? { id: `${id}-bookings`, target: 'booking', label: 'Встречи', title: 'Встречи по мероприятию', text: 'Открыть календарь с контекстом события', payload: { eventId: id, query: titleOf(item) }, tone: UI.green } : null,
    source === 'event' ? { id: `${id}-dialogs`, target: 'dialogs', label: 'Диалоги', title: 'Диалоги участников', text: 'Открыть обращения по событию', payload: { eventId: id, query: titleOf(item) }, tone: UI.blue } : null,
    source === 'event' ? { id: `${id}-news`, target: 'content', label: 'Новости', title: 'Анонсы и публикации', text: 'Найти новости по мероприятию', payload: { eventId: id, query: titleOf(item) }, tone: UI.gold } : null,
    source === 'event' ? { id: `${id}-offers`, target: 'offers', label: 'Акции', title: 'Акции события', text: 'Открыть предложения с контекстом', payload: { eventId: id, query: titleOf(item) }, tone: UI.gold } : null,
    source === 'booking' && !linkedDialog ? { id: `${id}-dialogs`, target: 'dialogs', label: 'Диалог', title: 'Диалог по встрече', text: 'Открыть коммуникационный центр', payload: { bookingId: id, query: item.userName || item.serviceTitle || '' }, tone: UI.blue } : null,
    source === 'dialog' && !linkedBooking ? { id: `${id}-bookings`, target: 'booking', label: 'Встречи', title: 'Встречи клиента', text: 'Открыть календарь встреч', payload: { dialogId: id, query: item.userName || item.context?.title || '' }, tone: UI.green } : null,
    source === 'news' ? { id: `${id}-comments`, target: 'content', label: 'Комментарии', title: 'Комментарии новости', text: 'Открыть обсуждение публикации', payload: { newsId: id, query: titleOf(item) }, tone: UI.blue } : null,
    source === 'promotion' ? { id: `${id}-claims`, target: 'rewards', label: 'Получения', title: 'Подарки и получения', text: 'Открыть связанные выдачи', payload: { promotionId: id, query: titleOf(item) }, tone: UI.green } : null,
    source === 'gift' ? { id: `${id}-claims`, target: 'rewards', label: 'Выдачи', title: 'История выдачи', text: 'Открыть получателей подарка', payload: { giftId: id, query: titleOf(item) }, tone: UI.green } : null,
    source !== 'event' && linkedEvent ? { id: linkedEvent.id, target: 'events', label: 'Мероприятие', title: titleOf(linkedEvent, 'Мероприятие'), text: 'Открыть связанное событие', payload: { eventId: linkedEvent.id, query: titleOf(linkedEvent) }, tone: UI.blue } : null,
    source !== 'news' && linkedNews ? { id: linkedNews.id, target: 'content', label: 'Новость', title: titleOf(linkedNews, 'Новость'), text: 'Открыть публикацию', payload: { newsId: linkedNews.id, query: titleOf(linkedNews) }, tone: UI.gold } : null,
    source !== 'promotion' && linkedPromotion ? { id: linkedPromotion.id, target: 'offers', label: 'Акция', title: titleOf(linkedPromotion, 'Акция'), text: 'Открыть предложение', payload: { promotionId: linkedPromotion.id, query: titleOf(linkedPromotion) }, tone: UI.gold } : null,
    source !== 'gift' && linkedGift ? { id: linkedGift.id, target: 'rewards', label: 'Подарок', title: titleOf(linkedGift, 'Подарок'), text: 'Открыть подарок и выдачи', payload: { giftId: linkedGift.id, query: titleOf(linkedGift) }, tone: UI.green } : null,
    source !== 'booking' && linkedBooking ? { id: linkedBooking.id || linkedBooking.bookingId, target: 'booking', label: 'Встреча', title: titleOf(linkedBooking, linkedBooking.userName || 'Встреча'), text: linkedBooking.statusLabel || linkedBooking.status || 'Открыть встречу', payload: { bookingId: linkedBooking.id || linkedBooking.bookingId, query: linkedBooking.userName || linkedBooking.serviceTitle || '' }, tone: UI.green } : null,
    source !== 'dialog' && linkedDialog ? { id: linkedDialog.id || linkedDialog.dialogId, target: 'dialogs', label: 'Диалог', title: titleOf(linkedDialog, 'Диалог'), text: linkedDialog.lastMessage?.text || 'Открыть переписку', payload: { dialogId: linkedDialog.id || linkedDialog.dialogId, query: titleOf(linkedDialog) }, tone: UI.blue } : null,
    source !== 'profile' && profileId ? { id: profileId, target: 'profile', label: 'Профиль', title: profile?.name || profile?.title || item.profileName || item.providerName || 'Рабочий профиль', text: 'Открыть карточку и витрину', payload: { profileId }, tone: UI.gold } : null,
    source !== 'analytics' ? { id: `${source || 'object'}-analytics`, target: 'analytics', label: 'Аналитика', title: 'Показатели объекта', text: analytics ? 'Открыть связанные метрики' : 'Открыть аналитический центр', payload: { source, objectId: id, eventId, newsId, promotionId, bookingId, dialogId }, tone: UI.blue } : null,
  ];

  return uniqLinks(rows);
}

export function WorkspaceRelatedLinks({ title = 'Связанные объекты', emptyText = 'Связанных объектов пока нет.', links, actions, compact = false, style }) {
  const rows = uniqLinks(links);
  return (
    <div data-workspace-related-links style={{
      border: `1px solid ${UI.line}`,
      borderRadius: 8,
      background: UI.card,
      padding: compact ? 10 : 12,
      boxShadow: compact ? 'none' : '0 12px 32px rgba(82,60,30,0.06)',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: rows.length ? 8 : 0 }}>
        <div style={{ color: UI.text, fontSize: compact ? 14 : 15, lineHeight: '19px', fontWeight: 910 }}>{title}</div>
        {!!rows.length && <div style={{ color: UI.muted, fontSize: 11, fontWeight: 820 }}>{rows.length}</div>}
      </div>
      {!rows.length ? <div style={{ color: UI.muted, fontSize: 12.5, lineHeight: '18px' }}>{emptyText}</div> : (
        <div style={{ display: 'grid', gap: 7 }}>
          {rows.map(item => (
            <button key={`${item.target}-${item.id || item.title}`} type="button" onClick={() => openWorkspaceLink(actions, item.target, item.payload || {})} style={{
              border: `1px solid ${item.tone || UI.gold}22`,
              background: `${item.tone || UI.gold}0D`,
              borderRadius: 8,
              minHeight: 44,
              padding: '8px 9px',
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) auto',
              gap: 8,
              alignItems: 'center',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: item.tone || UI.text, fontSize: 11, lineHeight: '14px', fontWeight: 870, textTransform: 'uppercase', letterSpacing: 0 }}>{item.label}</span>
                <span style={{ display: 'block', color: UI.text, fontSize: 13.2, lineHeight: '17px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                {item.text && <span style={{ display: 'block', color: UI.soft, fontSize: 11.5, lineHeight: '15px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>}
              </span>
              <span style={{ color: item.tone || UI.gold, fontSize: 15, fontWeight: 900 }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
