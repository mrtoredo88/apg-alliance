import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { userAction } from '../userApi.js';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, ScreenHeader } from '../components/Apg2ProfileGlass.jsx';
import { buildDialogAutoAnswer, buildDialogContext, getDialogObjectLabel } from '../../server-shared/context-dialogs.js';
import { BOOKING_STATUSES } from '../../server-shared/booking.js';
import { buildMessagingSnapshot, buildUnifiedDialogList } from '../messaging/index.js';

function tsMs(value) {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function timeText(value) {
  const ms = tsMs(value);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(value) {
  const ms = tsMs(value);
  if (!ms) return 'Сегодня';
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toLocaleDateString('sv') === today.toLocaleDateString('sv')) return 'Сегодня';
  if (date.toLocaleDateString('sv') === yesterday.toLocaleDateString('sv')) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function compactTime(value) {
  const ms = tsMs(value);
  if (!ms) return '';
  const date = new Date(ms);
  const today = new Date();
  if (date.toLocaleDateString('sv') === today.toLocaleDateString('sv')) return timeText(value);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function userIdOf(user) {
  return user?.id ? String(user.id) : '';
}

function useDesktopLayout() {
  const read = () => typeof window !== 'undefined' && window.innerWidth >= 920;
  const [wide, setWide] = useState(read);
  useEffect(() => {
    const onResize = () => setWide(read());
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return wide;
}

function typeChip(context = {}) {
  const type = context?.type || 'direct';
  if (type === 'partner') return { icon: '🏢', label: 'Партнёр' };
  if (type === 'event') return { icon: '📅', label: 'Мероприятие' };
  if (type === 'expert') return { icon: '⭐', label: 'Эксперт' };
  if (type === 'promotion') return { icon: '🎁', label: 'Акция' };
  if (type === 'news') return { icon: '📰', label: 'Новость' };
  if (type === 'booking') return { icon: '📅', label: 'Запись' };
  return { icon: '💬', label: 'Личный' };
}

function ContextBadge({ context }) {
  const chip = typeChip(context);
  return (
    <span data-context-chip style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 24, borderRadius: 999, padding: '4px 9px', background: context?.type === 'promotion' ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', border: context?.type === 'promotion' ? '1px solid rgba(215,184,106,0.30)' : APG2_PROFILE.glass.border, color: context?.type === 'promotion' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 11, lineHeight: '14px', fontWeight: 850, whiteSpace: 'nowrap' }}>
      <span>{chip.icon}</span>
      <span>{chip.label}</span>
    </span>
  );
}

function DialogListItem({ dialog, active, onClick }) {
  const context = dialog.header?.context || dialog.context || {};
  const preview = dialog.header?.lastMessage?.text || dialog.lastMessage?.text || 'Диалог создан. Задайте вопрос по объекту.';
  const title = dialog.header?.title || context.title || 'Диалог АПГ';
  const subtitle = dialog.header?.subtitle || context.parentTitle || context.subtitle || getDialogObjectLabel(context);
  const unread = Number(dialog.unreadCount || 0);
  const typing = Object.values(dialog.typing || {}).some(Boolean);
  const online = dialog.online === true || dialog.header?.online === true;
  return (
    <button data-dialog-list-item data-unread={unread > 0 ? 'true' : 'false'} onClick={onClick} style={{ width: '100%', border: active ? '1px solid rgba(215,184,106,0.46)' : unread ? '1px solid rgba(74,144,217,0.24)' : APG2_PROFILE.glass.border, background: unread ? 'linear-gradient(135deg, rgba(74,144,217,0.16), rgba(255,255,255,0.08))' : active ? 'rgba(215,184,106,0.12)' : 'rgba(var(--apg2-glass-a,255,255,255),0.055)', borderRadius: 20, padding: 11, display: 'grid', gridTemplateColumns: '56px minmax(0,1fr) auto', gap: 11, alignItems: 'center', boxShadow: unread ? '0 12px 32px rgba(74,144,217,0.12)' : 'none', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', transition: 'background 160ms ease, border-color 160ms ease, transform 160ms ease' }}>
      <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 22, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 23, overflow: 'hidden', flexShrink: 0 }}>
        {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (dialog.header?.avatar || (context.type === 'event' ? '🎫' : context.type === 'expert' ? '✦' : context.type === 'promotion' ? '🎁' : '🏪'))}
        <span data-presence={typing ? 'typing' : online ? 'online' : 'offline'} style={{ position: 'absolute', right: 2, bottom: 2, width: 13, height: 13, borderRadius: '50%', background: typing ? APG2_PROFILE.gold : online ? '#4BB34B' : 'rgba(160,160,160,0.75)', border: '2px solid var(--apg2-panel, rgba(20,20,24,0.92))' }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 4, minWidth: 0 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '19px', fontWeight: unread ? 930 : 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{title}</div>
        </div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typing ? 'печатает...' : subtitle}</div>
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '17px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{preview}</div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        <span style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '14px' }}>{compactTime(dialog.header?.lastActivity || dialog.lastMessageAt || dialog.updatedAt)}</span>
        <ContextBadge context={context} />
        {unread > 0 && <span style={{ minWidth: 23, height: 23, borderRadius: 999, background: APG2_PROFILE.gold, color: '#17120a', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 920 }}>{unread}</span>}
      </div>
    </button>
  );
}

function ContextHeader({ context, onOpenObject }) {
  if (!context) return null;
  const rows = [
    context.subtitle,
    context.date,
    context.hours,
    context.address,
  ].filter(Boolean).slice(0, 3);
  return (
    <GlassCard style={{ position: 'sticky', top: 'calc(var(--safe-top, 0px) + 8px)', zIndex: 6, borderRadius: 26, padding: 14, display: 'grid', gridTemplateColumns: '52px 1fr', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 20, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 24, overflow: 'hidden' }}>
        {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (context.type === 'event' ? '🎫' : context.type === 'expert' ? '✦' : context.type === 'promotion' ? '🎁' : '🏪')}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <ContextBadge context={context} />
          {context.parentTitle && <GlassBadge>{context.parentTitle}</GlassBadge>}
        </div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '21px', fontWeight: 900 }}>{context.title}</div>
        {rows.length > 0 && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 5 }}>{rows.join(' · ')}</div>}
        <GlassButton onClick={() => onOpenObject?.(context)} style={{ marginTop: 10, minHeight: 36, borderRadius: 16 }}>Открыть карточку</GlassButton>
      </div>
    </GlassCard>
  );
}

function contextIcon(type) {
  if (type === 'event') return '🎫';
  if (type === 'expert') return '✦';
  if (type === 'promotion') return '🎁';
  if (type === 'booking') return '📅';
  if (type === 'news') return '📰';
  return '🏪';
}

function responseHint(context = {}) {
  if (context.type === 'event') return 'Организатор обычно отвечает в течение дня';
  if (context.type === 'expert') return 'Обычно отвечает за 1-2 часа';
  if (context.type === 'booking') return 'Детали записи синхронизируются в этом диалоге';
  if (context.type === 'news') return 'Обсуждение публикации идет в АПГ';
  return 'Обычно отвечает за 10 минут';
}

function ConversationIntro({ context }) {
  if (!context) return null;
  return (
    <GlassCard style={{ borderRadius: 24, padding: 14, display: 'grid', gridTemplateColumns: '46px 1fr', gap: 12, alignItems: 'center', border: '1px solid rgba(215,184,106,0.24)' }}>
      <div style={{ width: 46, height: 46, borderRadius: 18, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 22, overflow: 'hidden' }}>
        {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : contextIcon(context.type)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', fontWeight: 780 }}>Вы общаетесь с</div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 920, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{context.parentTitle || context.title || 'АПГ'}</div>
        <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '17px', marginTop: 2 }}>{getDialogObjectLabel(context)} · ★★★★★ · {responseHint(context)}</div>
      </div>
    </GlassCard>
  );
}

function contextInfoRows(context = {}) {
  if (!context) return [];
  if (context.type === 'event') {
    return [
      ['Дата', context.date],
      ['Адрес', context.address],
      ['Организатор', context.parentTitle],
      ['Участники', context.participantsCount],
    ];
  }
  if (context.type === 'booking') {
    return [
      ['Услуга', context.serviceTitle],
      ['Специалист', context.specialistName],
      ['Когда', context.date],
      ['Статус', context.statusLabel || context.status],
    ];
  }
  if (context.type === 'news') {
    return [
      ['Категория', context.subtitle],
      ['Источник', context.source],
      ['Дата', context.date],
    ];
  }
  return [
    ['Активные акции', context.promotionId ? 'Есть' : 'Проверьте карточку'],
    ['Сегодня открыт', context.hours || 'График в карточке'],
    ['Онлайн-запись', context.bookingUrl || context.hasBooking ? 'Есть' : 'Уточните в диалоге'],
    ['Адрес', context.address],
    ['Позвонить', context.phone],
  ];
}

function MessagingContextInfo({ context, onOpenObject }) {
  if (!context) return null;
  const rows = contextInfoRows(context).filter(([, value]) => value != null && String(value).trim()).slice(0, 6);
  return (
    <GlassCard style={{ borderRadius: 24, padding: 13, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', fontWeight: 900 }}>{getDialogObjectLabel(context)}</div>
        <ContextBadge context={context} />
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: 8, color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '17px' }}>
            <span style={{ color: APG2_PROFILE.textMuted }}>{label}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
          </div>
        ))}
      </div>
      {context.phone && <GlassButton onClick={() => window.open(`tel:${String(context.phone).replace(/\s+/g, '')}`)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Позвонить</GlassButton>}
      <GlassButton onClick={() => onOpenObject?.(context)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Открыть карточку</GlassButton>
    </GlassCard>
  );
}

function CompactContextCard({ context, isOwner, collapsed, onToggle, onOpenObject, onAction }) {
  if (!context) return null;
  const rows = buildSmartContextRows(context).filter(([, value]) => value).slice(0, collapsed ? 1 : 6);
  const actions = buildSmartActions({ context, isOwner, onOpenObject, onAction }).slice(0, collapsed ? 2 : 5);
  const title = context.type === 'booking' ? smartValue(context.parentTitle, context.title, 'Запись АПГ') : smartValue(context.title, context.parentTitle, 'АПГ');
  return (
    <div data-compact-context-card data-collapsed={collapsed ? 'true' : 'false'} style={{ borderRadius: 22, padding: collapsed ? 10 : 13, minHeight: collapsed ? 70 : 0, background: 'rgba(var(--apg2-glass-a,255,255,255),0.075)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', display: 'grid', gap: collapsed ? 6 : 10, transition: 'padding 160ms ease, min-height 160ms ease' }}>
      <button type="button" onClick={onToggle} style={{ border: 0, background: 'transparent', padding: 0, display: 'grid', gridTemplateColumns: '42px minmax(0,1fr) auto', gap: 10, alignItems: 'center', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
        <div style={{ width: 42, height: 42, borderRadius: 17, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 20, overflow: 'hidden' }}>
          {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : contextIcon(context.type)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3 }}>
            <ContextBadge context={context} />
          </div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 14.5, lineHeight: '18px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {rows[0] && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rows.map(([label, value]) => `${label}: ${value}`).join(' · ')}</div>}
        </div>
        <span style={{ color: APG2_PROFILE.textMuted, fontSize: 16 }}>{collapsed ? '⌄' : '⌃'}</span>
      </button>
      {!collapsed && (
        <>
          <div style={{ display: 'grid', gap: 7 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '104px 1fr', gap: 8, color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '17px' }}>
                <span style={{ color: APG2_PROFILE.textMuted }}>{label}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
              </div>
            ))}
          </div>
          {actions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {actions.map(action => <GlassButton key={action.id} tone={action.tone} onClick={action.onClick} style={{ flex: '0 0 auto', minHeight: 32, borderRadius: 15, padding: '6px 10px', color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, fontSize: 12 }}>{action.label}</GlassButton>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function quickMessagesFor(context = {}) {
  if (context?.type === 'event') return ['Где проходит?', 'Буду участвовать', 'Есть места?', 'Во сколько начало?'];
  if (context?.type === 'expert') return ['Хочу консультацию', 'Стоимость', 'Когда удобно?', 'Есть запись?'];
  if (context?.type === 'booking') return ['Здравствуйте', 'Хочу уточнить запись', 'Можно перенести?', 'Свободное время'];
  if (context?.type === 'news') return ['Интересная новость', 'Есть вопрос', 'Где подробнее?', 'Спасибо'];
  return ['Здравствуйте', 'Хочу записаться', 'Есть вопрос', 'Стоимость', 'Свободное время'];
}

function QuickReplyChips({ context, onPick }) {
  const items = quickMessagesFor(context);
  return (
    <div style={{ display: 'flex', gap: 7, overflowX: 'auto', padding: '1px 1px 3px' }}>
      {items.map(item => (
        <button key={item} type="button" onClick={() => onPick(item)} style={{ flex: '0 0 auto', minHeight: 32, borderRadius: 999, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: APG2_PROFILE.textSoft, padding: '6px 10px', fontFamily: 'inherit', fontSize: 12, fontWeight: 780 }}>{item}</button>
      ))}
    </div>
  );
}

function smartValue(...values) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function buildSmartContextRows(context = {}) {
  if (!context) return [];
  if (context.type === 'booking') {
    return [
      ['Статус', smartValue(context.statusLabel, context.status, 'Уточняется')],
      ['Дата', smartValue(context.date, context.startAt)],
      ['Время', smartValue(context.time)],
      ['Специалист', smartValue(context.specialistName)],
      ['Услуга', smartValue(context.serviceTitle, context.title)],
    ];
  }
  if (context.type === 'event') {
    return [
      ['Дата', smartValue(context.date, context.startAt)],
      ['Место', smartValue(context.address, context.place)],
      ['Организатор', smartValue(context.parentTitle, context.organizer)],
      ['Свободные места', smartValue(context.freePlaces, context.availableSeats, context.capacity)],
    ];
  }
  if (context.type === 'expert') {
    return [
      ['Специализация', smartValue(context.subtitle, context.specialization)],
      ['Стоимость', smartValue(context.price, context.cost)],
      ['Ближайшее время', smartValue(context.nextSlot, context.date)],
      ['Запись', smartValue(context.bookingUrl, context.hasBooking ? 'Доступна' : '')],
      ['Контакты', smartValue(context.phone)],
    ];
  }
  if (context.type === 'promotion') {
    return [
      ['Скидка', smartValue(context.discount, context.offer, context.title)],
      ['Срок', smartValue(context.validUntil, context.date, context.status)],
      ['Партнёр', smartValue(context.parentTitle)],
    ];
  }
  if (context.type === 'news') {
    return [
      ['Заголовок', smartValue(context.title)],
      ['Автор', smartValue(context.author, context.source, 'АПГ')],
      ['Дата', smartValue(context.date)],
    ];
  }
  return [
    ['Рейтинг', smartValue(context.rating, context.stars, '★★★★★')],
    ['Открыт/закрыт', smartValue(context.openNow, context.hours, 'График в карточке')],
    ['Адрес', smartValue(context.address)],
    ['Ближайший филиал', smartValue(context.locationTitle, context.nearestLocation, context.address)],
    ['Акции', smartValue(context.promotionTitle, context.offer, context.promotionId ? 'Есть активная акция' : '')],
  ];
}

function buildSmartActions({ context, isOwner, onOpenObject, onAction }) {
  if (!context) return [];
  const openRoute = context.address ? () => window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(context.address)}`, '_blank', 'noopener,noreferrer') : null;
  const call = context.phone ? () => window.open(`tel:${String(context.phone).replace(/\s+/g, '')}`) : null;
  const openObject = () => onOpenObject?.(context);
  if (context.type === 'booking') {
    const inactive = [BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider, BOOKING_STATUSES.completed, BOOKING_STATUSES.noShow].includes(context.status);
    return [
      !inactive && { id: 'reschedule', label: 'Перенести', onClick: () => {
        const startAt = prompt('Новая дата и время в формате YYYY-MM-DD HH:mm');
        if (!startAt) return;
        const start = new Date(String(startAt).trim().replace(' ', 'T'));
        if (Number.isNaN(start.getTime())) return alert('Не удалось распознать дату.');
        const duration = Number(context.durationMinutes || 60);
        onAction?.('booking:requestReschedule', { slot: { startAt: start.toISOString(), endAt: new Date(start.getTime() + duration * 60000).toISOString() }, reason: 'Запрос из диалога' });
      } },
      !inactive && { id: 'cancel', label: 'Отменить', onClick: () => onAction?.('booking:cancel', { reason: prompt('Причина отмены, если хотите указать') || '' }) },
      openRoute && { id: 'route', label: 'Маршрут', onClick: openRoute },
      isOwner && [BOOKING_STATUSES.pending, BOOKING_STATUSES.new].includes(context.status) && { id: 'confirm', label: 'Подтвердить', tone: 'gold', onClick: () => onAction?.('booking:confirm') },
    ].filter(Boolean);
  }
  if (context.type === 'event') return [
    { id: 'open', label: 'Открыть', onClick: openObject },
    openRoute && { id: 'route', label: 'Маршрут', onClick: openRoute },
    { id: 'register', label: 'Записаться', tone: 'gold', onClick: openObject },
  ].filter(Boolean);
  if (context.type === 'expert') return [
    { id: 'book', label: 'Запись', tone: 'gold', onClick: openObject },
    call && { id: 'call', label: 'Позвонить', onClick: call },
    openRoute && { id: 'route', label: 'Маршрут', onClick: openRoute },
  ].filter(Boolean);
  if (context.type === 'promotion') return [{ id: 'use', label: 'Использовать', tone: 'gold', onClick: openObject }];
  if (context.type === 'news') return [{ id: 'open', label: 'Открыть статью', tone: 'gold', onClick: openObject }];
  return [
    call && { id: 'call', label: 'Позвонить', onClick: call },
    openRoute && { id: 'route', label: 'Маршрут', onClick: openRoute },
    { id: 'booking', label: 'Запись', tone: 'gold', onClick: openObject },
  ].filter(Boolean);
}

function SmartConversationHeader({ context, isOwner, collapsed, onOpenObject, onAction }) {
  if (!context) return null;
  const rows = buildSmartContextRows(context).filter(([, value]) => value).slice(0, collapsed ? 2 : 6);
  const actions = buildSmartActions({ context, isOwner, onOpenObject, onAction }).slice(0, collapsed ? 2 : 5);
  const title = context.type === 'booking' ? smartValue(context.parentTitle, context.title, 'Запись АПГ') : smartValue(context.title, context.parentTitle, 'АПГ');
  return (
    <GlassCard data-smart-conversation-header data-collapsed={collapsed ? 'true' : 'false'} style={{ position: 'sticky', top: 'calc(var(--safe-top, 0px) + 8px)', zIndex: 8, borderRadius: collapsed ? 22 : 28, padding: collapsed ? 10 : 14, display: 'grid', gap: collapsed ? 8 : 12, border: '1px solid rgba(215,184,106,0.30)', boxShadow: '0 16px 42px var(--apg2-elev-shadow, rgba(0,0,0,0.18))', transition: 'padding 180ms ease, border-radius 180ms ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: collapsed ? '38px 1fr auto' : '54px 1fr auto', gap: 11, alignItems: 'center' }}>
        <div style={{ width: collapsed ? 38 : 54, height: collapsed ? 38 : 54, borderRadius: collapsed ? 15 : 20, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: collapsed ? 18 : 24, overflow: 'hidden', transition: 'width 180ms ease, height 180ms ease' }}>
          {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : contextIcon(context.type)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: collapsed ? 2 : 5 }}>
            <ContextBadge context={context} />
            {context.type === 'booking' && <GlassBadge tone="gold">📅 Запись</GlassBadge>}
          </div>
          <div style={{ color: APG2_PROFILE.text, fontSize: collapsed ? 15 : 18, lineHeight: collapsed ? '19px' : '23px', fontWeight: 930, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {collapsed && rows[0] && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rows.map(([, value]) => value).join(' · ')}</div>}
        </div>
        <GlassButton onClick={() => onOpenObject?.(context)} style={{ minHeight: collapsed ? 32 : 36, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Открыть</GlassButton>
      </div>
      {!collapsed && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ borderRadius: 18, padding: '9px 10px', background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)' }}>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '14px', fontWeight: 820 }}>{label}</div>
                <div style={{ color: APG2_PROFILE.text, fontSize: 13, lineHeight: '17px', fontWeight: 850, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
              </div>
            ))}
          </div>
          {actions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {actions.map(action => <GlassButton key={action.id} tone={action.tone} onClick={action.onClick} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, fontSize: 12 }}>{action.label}</GlassButton>)}
            </div>
          )}
        </>
      )}
      {collapsed && actions.length > 0 && (
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto' }}>
          {actions.map(action => <GlassButton key={action.id} tone={action.tone} onClick={action.onClick} style={{ flex: '0 0 auto', minHeight: 30, borderRadius: 14, padding: '6px 9px', color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, fontSize: 11.5 }}>{action.label}</GlassButton>)}
        </div>
      )}
    </GlassCard>
  );
}

function BookingContextCard({ context, isOwner, onOpenObject, onAction }) {
  if (context?.type !== 'booking') return null;
  const bookingId = context.bookingId || context.objectId;
  return (
    <GlassCard style={{ position: 'sticky', top: 'calc(var(--safe-top, 0px) + 8px)', zIndex: 7, borderRadius: 26, padding: 14, display: 'grid', gap: 10, border: '1px solid rgba(215,184,106,0.34)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <GlassBadge tone="gold">📅 Встреча</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '22px', fontWeight: 900, marginTop: 8 }}>{context.parentTitle || context.title || 'Встреча АПГ'}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 5 }}>
            {[context.serviceTitle, context.specialistName, context.date, context.durationMinutes ? `${context.durationMinutes} мин` : '', context.price].filter(Boolean).join(' · ')}
          </div>
        </div>
        <GlassBadge>{context.statusLabel || context.status || 'Статус'}</GlassBadge>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <GlassButton onClick={() => onOpenObject?.(context)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Открыть карточку</GlassButton>
        {!isOwner && context.address && <GlassButton onClick={() => window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(context.address)}`, '_blank', 'noopener,noreferrer')} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Маршрут</GlassButton>}
        {!isOwner && ![BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider, BOOKING_STATUSES.completed, BOOKING_STATUSES.noShow].includes(context.status) && <GlassButton onClick={() => onAction('booking:cancel', { reason: prompt('Причина отмены, если хотите указать') || '' })} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Отменить</GlassButton>}
        {isOwner && [BOOKING_STATUSES.pending, BOOKING_STATUSES.new].includes(context.status) && <GlassButton tone="gold" onClick={() => onAction('booking:confirm')} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', color: '#17120a', fontSize: 12 }}>Подтвердить</GlassButton>}
        {isOwner && context.status === BOOKING_STATUSES.rescheduleRequested && <GlassButton tone="gold" onClick={() => onAction('booking:respondReschedule', { decision: 'accept' })} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', color: '#17120a', fontSize: 12 }}>Принять перенос</GlassButton>}
        {isOwner && [BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(context.status) && <GlassButton onClick={() => onAction('booking:complete')} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Завершить</GlassButton>}
        {isOwner && ![BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider, BOOKING_STATUSES.completed, BOOKING_STATUSES.noShow].includes(context.status) && <GlassButton onClick={() => {
          const reason = prompt('Причина отмены');
          if (reason) onAction('booking:cancel', { reason });
        }} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px', fontSize: 12 }}>Отменить</GlassButton>}
      </div>
      {context.journeySummary && (
        <div style={{ borderRadius: 18, padding: '9px 11px', background: 'rgba(215,184,106,0.10)', border: '1px solid rgba(215,184,106,0.22)', color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '17px', fontWeight: 760 }}>
          {context.journeySummary}
        </div>
      )}
      {!bookingId && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12 }}>Карточка встречи откроется после синхронизации контекста.</div>}
    </GlassCard>
  );
}

function MessageBubble({ message, own }) {
  const loki = message.senderRole === 'loki';
  if (message.isSystem || message.senderRole === 'system') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '88%', borderRadius: 18, padding: '9px 12px', background: 'rgba(215,184,106,0.12)', border: '1px solid rgba(215,184,106,0.24)', color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', textAlign: 'center', whiteSpace: 'pre-wrap' }}>
          {message.text}
          <div style={{ marginTop: 4, color: APG2_PROFILE.textMuted, fontSize: 10.5 }}>{timeText(message.createdAt)}</div>
        </div>
      </div>
    );
  }
  return (
    <div data-message-bubble style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start', padding: '2px 0' }}>
      <div style={{ maxWidth: 'min(74%, 620px)', borderRadius: own ? '22px 22px 7px 22px' : '22px 22px 22px 7px', padding: '10px 12px 8px', background: loki ? APG2_PROFILE.goldSoft : own ? 'linear-gradient(135deg, rgba(215,184,106,0.34), rgba(215,184,106,0.18))' : 'rgba(var(--apg2-glass-a,255,255,255),0.09)', border: loki ? '1px solid rgba(215,184,106,0.36)' : own ? '1px solid rgba(215,184,106,0.22)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', color: APG2_PROFILE.text, boxShadow: own ? '0 10px 24px rgba(215,184,106,0.10)' : '0 10px 26px rgba(0,0,0,0.06)' }}>
        {!own && <div style={{ color: loki ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 10.5, fontWeight: 850, marginBottom: 4 }}>{loki ? 'Локи' : message.senderName || 'Участник'}</div>}
        {message.text && <div style={{ fontSize: 14, lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{message.text}</div>}
        {message.attachments?.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {message.attachments.map((file, index) => file.type === 'image'
              ? <img key={file.url || index} src={file.url} alt={file.name || ''} style={{ maxWidth: 220, borderRadius: 16, border: '1px solid rgba(255,255,255,0.14)' }} />
              : <a key={file.url || index} href={file.url} target="_blank" rel="noreferrer" style={{ color: APG2_PROFILE.gold }}>{file.name || 'Файл'}</a>)}
          </div>
        )}
        <div style={{ marginTop: 5, color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '14px', textAlign: 'right' }}>{timeText(message.createdAt)}</div>
      </div>
    </div>
  );
}

function MessageDayGroup({ label }) {
  return (
    <div data-message-day-group style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', margin: '10px 0 6px' }}>
      <div style={{ height: 1, background: 'rgba(var(--apg2-glass-a,255,255,255),0.10)' }} />
      <span style={{ minHeight: 24, borderRadius: 999, padding: '4px 10px', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '15px', fontWeight: 820 }}>{label}</span>
      <div style={{ height: 1, background: 'rgba(var(--apg2-glass-a,255,255,255),0.10)' }} />
    </div>
  );
}

function OwnerAssist({ enabled, onToggle, context, lastQuestion, onUse }) {
  const suggestion = enabled && lastQuestion ? `Можно ответить так: «Спасибо за вопрос по ${context?.title || 'объекту'}. Да, уточним детали и вернемся с точной информацией.»` : '';
  return (
    <GlassCard style={{ borderRadius: 22, padding: 12, display: 'grid', gap: 9 }}>
      <button onClick={() => onToggle(!enabled)} style={{ border: 0, background: 'transparent', color: APG2_PROFILE.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', fontWeight: 850, cursor: 'pointer', padding: 0 }}>
        <span>ИИ помогает отвечать</span>
        <span style={{ width: 40, height: 24, borderRadius: 999, background: enabled ? APG2_PROFILE.gold : 'rgba(var(--apg2-glass-a,255,255,255),0.14)', display: 'grid', placeItems: 'center', color: enabled ? '#17120a' : APG2_PROFILE.textMuted, fontSize: 11 }}>{enabled ? 'on' : 'off'}</span>
      </button>
      {suggestion && (
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px' }}>
          {suggestion}
          <GlassButton onClick={() => onUse(suggestion.replace(/^Можно ответить так: «|»$/g, ''))} tone="gold" style={{ marginTop: 9, color: '#17120a' }}>Вставить ответ</GlassButton>
        </div>
      )}
    </GlassCard>
  );
}

export function ContextDialogsPage({ user, initialRequest, initialDialogId = '', onBack, onOpenObject }) {
  const uid = userIdOf(user);
  const [dialogs, setDialogs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeDialogId, setActiveDialogId] = useState('');
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [aiAssist, setAiAssist] = useState(Boolean(user?.contextDialogAiAssist));
  const [attachment, setAttachment] = useState(null);
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);
  const desktopLayout = useDesktopLayout();
  const messagesEndRef = useRef(null);
  const lastRequestRef = useRef(0);

  useEffect(() => setAiAssist(Boolean(user?.contextDialogAiAssist)), [user?.contextDialogAiAssist]);

  useEffect(() => {
    if (!uid) return undefined;
    const unsubDialogs = onSnapshot(collection(db, 'users', uid, 'contextDialogs'), snap => {
      setDialogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => tsMs(b.lastMessageAt || b.updatedAt) - tsMs(a.lastMessageAt || a.updatedAt)));
    });
    const unsubMessages = onSnapshot(collection(db, 'users', uid, 'contextDialogMessages'), snap => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => tsMs(a.createdAt) - tsMs(b.createdAt)));
    });
    return () => { unsubDialogs(); unsubMessages(); };
  }, [uid]);

  useEffect(() => {
    const req = initialRequest;
    if (!uid || !req?.type || !req?.item || lastRequestRef.current === req.nonce) return;
    lastRequestRef.current = req.nonce;
    const context = buildDialogContext(req.type, req.item, { source: req.source || 'ui' });
    if (!context) return;
    setPending(true);
    setError('');
    userAction('dialog:open', { type: context.type, objectId: context.objectId, context })
      .then(result => setActiveDialogId(result.dialogId))
      .catch(err => setError(err?.message || 'Не удалось открыть диалог.'))
      .finally(() => setPending(false));
  }, [initialRequest, uid]);

  useEffect(() => {
    if (!activeDialogId) return;
    userAction('dialog:read', { dialogId: activeDialogId }).catch(() => {});
    const timer = setInterval(() => {
      userAction('dialog:read', { dialogId: activeDialogId }).catch(() => {});
    }, 25000);
    return () => clearInterval(timer);
  }, [activeDialogId]);

  useEffect(() => {
    const targetId = String(initialDialogId || '').trim();
    if (!targetId || activeDialogId === targetId) return;
    if (dialogs.some(dialog => dialog.id === targetId || dialog.dialogId === targetId)) setActiveDialogId(targetId);
  }, [initialDialogId, dialogs, activeDialogId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeDialogId, messages.length]);

  useEffect(() => {
    const update = () => {
      const root = document.querySelector('[data-apg-scroll-root]') || document.scrollingElement || document.documentElement;
      setContextCollapsed(Number(root?.scrollTop || window.scrollY || 0) > 120);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    document.querySelector('[data-apg-scroll-root]')?.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      document.querySelector('[data-apg-scroll-root]')?.removeEventListener('scroll', update);
    };
  }, [activeDialogId]);

  const activeDialog = useMemo(() => dialogs.find(dialog => dialog.id === activeDialogId) || (desktopLayout ? dialogs[0] : null), [desktopLayout, dialogs, activeDialogId]);
  const activeMessages = useMemo(() => messages.filter(message => message.dialogId === activeDialog?.dialogId || message.dialogId === activeDialog?.id), [messages, activeDialog]);
  const unifiedDialogs = useMemo(() => buildUnifiedDialogList({ dialogs, messages, actor: user, filter, query }), [dialogs, messages, user, filter, query]);
  const messagingSnapshot = useMemo(() => buildMessagingSnapshot({ dialogs, messages, actor: user }), [dialogs, messages, user]);
  const activeContext = activeDialog?.context || null;
  const isOwner = activeDialog?.ownerUserIds?.includes?.(uid);
  const lastQuestion = [...activeMessages].reverse().find(message => message.senderRole === 'user')?.text || '';
  const typingUsers = Object.entries(activeDialog?.typing || {}).filter(([id, value]) => id !== uid && value).length;
  const activeHeader = activeDialog?.header || {};
  const activePinned = activeDialog?.pinned === true || activeDialog?.workspacePrivate?.pinned === true || activeDialog?.workspaceState?.pinned === true;
  const activeArchived = activeDialog?.archived === true || activeDialog?.workspacePrivate?.archived === true || activeDialog?.workspaceState?.archived === true;
  const groupedMessages = useMemo(() => {
    const rows = [];
    let currentDay = '';
    activeMessages.forEach(message => {
      const label = dayLabel(message.createdAt);
      if (label !== currentDay) {
        currentDay = label;
        rows.push({ kind: 'day', id: `day-${label}-${message.id}`, label });
      }
      rows.push({ kind: 'message', id: message.id, message });
    });
    return rows;
  }, [activeMessages]);

  const sendText = async (overrideText = '', senderRole = '') => {
    const body = String(overrideText || text || '').trim();
    if ((!body && !attachment) || !activeDialog || pending) return;
    const autoAnswer = !senderRole && !isOwner ? buildDialogAutoAnswer(activeContext, body) : null;
    setPending(true);
    setError('');
    setLastFailedMessage('');
    try {
      if (autoAnswer) {
        await userAction('dialog:message', { dialogId: activeDialog.id, text: body });
        await userAction('dialog:message', { dialogId: activeDialog.id, text: autoAnswer, senderRole: 'loki' });
      } else {
        await userAction('dialog:message', { dialogId: activeDialog.id, text: body, senderRole: senderRole || undefined, attachments: attachment ? [attachment] : [] });
      }
      setText('');
      setAttachment(null);
    } catch (err) {
      setLastFailedMessage(body);
      setError(err?.message || 'Не удалось отправить сообщение.');
    } finally {
      setPending(false);
    }
  };

  const runBookingAction = async (action, payload = {}) => {
    const bookingId = activeContext?.bookingId || activeContext?.objectId;
    if (!bookingId || pending) return;
    setPending(true);
    setError('');
    try {
      await userAction(action, { bookingId, ...payload });
    } catch (err) {
      setError(err?.message || 'Не удалось обновить встречу.');
    } finally {
      setPending(false);
    }
  };

  const toggleAiAssist = async (enabled) => {
    setAiAssist(enabled);
    await userAction('dialog:aiAssist', { enabled }).catch(() => {});
  };

  const patchActiveDialog = async (patch = {}) => {
    if (!activeDialog?.id) return;
    const optimistic = { workspacePrivate: { ...(activeDialog.workspacePrivate || activeDialog.workspaceState || {}), ...patch }, workspaceState: { ...(activeDialog.workspaceState || {}), ...patch } };
    setDialogs(prev => prev.map(item => String(item.id || item.dialogId) === String(activeDialog.id) ? { ...item, ...optimistic } : item));
    await userAction('dialog:workspaceUpdate', { dialogId: activeDialog.id, patch }).catch(err => setError(err?.message || 'Не удалось обновить переписку.'));
  };

  const handlePhoto = (file) => {
    if (!file) return;
    if (file.size > 450 * 1024) {
      setError('Фото должно быть меньше 450 КБ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment({ type: 'image', url: String(reader.result || ''), name: file.name || 'photo.jpg' });
    reader.readAsDataURL(file);
  };

  if (!uid) {
    return <GlassPanel><ScreenHeader title="Люди" subtitle="Войдите, чтобы общаться с участниками АПГ" onBack={onBack} /><EmptyStateV2 icon="💬" title="Нужна авторизация" text="Диалоги доступны участникам АПГ." /></GlassPanel>;
  }

  const dialogList = (
    <div data-dialog-list-panel style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      {desktopLayout && (
        <div style={{ borderRadius: 24, padding: 14, background: 'radial-gradient(circle at 14% 0%, rgba(74,144,217,0.18), transparent 34%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.12), rgba(var(--apg2-glass-a,255,255,255),0.055))', border: APG2_PROFILE.glass.border, display: 'grid', gap: 5 }}>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 11, lineHeight: '14px', fontWeight: 920, textTransform: 'uppercase', letterSpacing: 0.8 }}>People Inbox</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '23px', fontWeight: 940 }}>Переписки</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px' }}>Личные чаты, вопросы по объектам, записи и обсуждения — в одном списке.</div>
        </div>
      )}
      <div data-messaging-search-sticky style={{ position: 'sticky', top: 'calc(var(--safe-top, 0px) + 6px)', zIndex: 12, display: 'grid', gap: 9, padding: '2px 0 8px', background: 'linear-gradient(180deg, var(--apg2-bg, rgba(14,14,18,0.92)) 72%, transparent)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
          <input data-messaging-search value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск людей и сообщений..." style={{ width: '100%', minHeight: 44, borderRadius: 18, border: APG2_PROFILE.glass.border, background: 'rgba(var(--apg2-glass-a,255,255,255),0.09)', color: APG2_PROFILE.text, padding: '0 14px', outline: 'none', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }} />
          <span style={{ minWidth: 34, height: 34, borderRadius: 999, background: messagingSnapshot.unread ? APG2_PROFILE.gold : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: messagingSnapshot.unread ? '#17120a' : APG2_PROFILE.textMuted, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>{messagingSnapshot.unread}</span>
        </div>
        <div data-messaging-filter-chips style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
          {[
            { id: 'all', label: 'Все' },
            { id: 'partners', label: 'Партнёры' },
            { id: 'personal', label: 'Друзья' },
            { id: 'events', label: 'Мероприятия' },
            { id: 'groups', label: 'Группы' },
            { id: 'unread', label: 'Непрочитанные' },
            { id: 'pinned', label: 'Закреплённые' },
            { id: 'archive', label: 'Архив' },
          ].map(item => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} style={{ flex: '0 0 auto', border: filter === item.id ? '1px solid rgba(215,184,106,0.48)' : APG2_PROFILE.glass.border, background: filter === item.id ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: filter === item.id ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, borderRadius: 999, minHeight: 34, padding: '7px 12px', fontFamily: 'inherit', fontSize: 12, fontWeight: 840, whiteSpace: 'nowrap', cursor: 'pointer' }}>{item.label}</button>
          ))}
        </div>
        {desktopLayout && <div data-messaging-priority-inbox style={{ borderRadius: 18, padding: 10, background: 'linear-gradient(145deg, rgba(215,184,106,0.10), rgba(var(--apg2-glass-a,255,255,255),0.045))', border: '1px solid rgba(215,184,106,0.20)', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 11, lineHeight: '14px', fontWeight: 920, textTransform: 'uppercase', letterSpacing: 0.7 }}>Важное сейчас</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px', marginTop: 1 }}>{messagingSnapshot.nextBestAction}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ minWidth: 26, height: 26, borderRadius: 999, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{messagingSnapshot.pinned || 0}</span>
              <span style={{ minWidth: 26, height: 26, borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.textMuted, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{messagingSnapshot.archive || 0}</span>
            </div>
          </div>
          {messagingSnapshot.priority?.length > 0 && (
            <div style={{ display: 'grid', gap: 6 }}>
              {messagingSnapshot.priority.slice(0, 2).map(item => (
                <button key={`priority:${item.id}`} type="button" onClick={() => setActiveDialogId(item.id)} style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 14, padding: '8px 9px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: APG2_PROFILE.text, fontSize: 12.5, lineHeight: '16px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <span style={{ display: 'block', color: APG2_PROFILE.textMuted, fontSize: 10.8, lineHeight: '14px', marginTop: 1 }}>{item.reason}</span>
                  </span>
                  {item.unreadCount > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: APG2_PROFILE.gold, color: '#17120a', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 920 }}>{item.unreadCount}</span>}
                </button>
              ))}
            </div>
          )}
        </div>}
      </div>
      {pending && !dialogs.length ? (
        <div data-messaging-skeleton style={{ display: 'grid', gap: 9 }}>
          {[0, 1, 2, 3].map(item => <div key={item} style={{ height: 78, borderRadius: 20, background: 'linear-gradient(90deg, rgba(var(--apg2-glass-a,255,255,255),0.06), rgba(var(--apg2-glass-a,255,255,255),0.12), rgba(var(--apg2-glass-a,255,255,255),0.06))' }} />)}
        </div>
      ) : unifiedDialogs.length ? (
        <div style={{ display: 'grid', gap: 9 }}>
          {unifiedDialogs.map(dialog => <DialogListItem key={dialog.id} dialog={dialog} active={dialog.id === activeDialog?.id} onClick={() => setActiveDialogId(dialog.id)} />)}
        </div>
      ) : (
        <GlassCard style={{ borderRadius: 22, padding: 16, color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>По этому фильтру диалогов нет.</GlassCard>
      )}
    </div>
  );

  const chatHeader = activeDialog ? (
    <div data-messaging-chat-header style={{ position: 'sticky', top: 'calc(var(--safe-top, 0px) + 4px)', zIndex: 14, minHeight: 64, borderRadius: desktopLayout ? 24 : 0, background: desktopLayout ? 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.12), rgba(var(--apg2-glass-a,255,255,255),0.055))' : 'var(--apg2-bg, rgba(14,14,18,0.96))', border: desktopLayout ? APG2_PROFILE.glass.border : 'none', padding: desktopLayout ? 11 : '8px 0 10px', boxShadow: desktopLayout ? '0 12px 32px rgba(0,0,0,0.10)' : 'none', display: 'grid', gridTemplateColumns: desktopLayout ? '50px minmax(0,1fr) auto' : '36px 48px minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
      {!desktopLayout && <button type="button" onClick={() => setActiveDialogId('')} aria-label="К списку диалогов" style={{ width: 36, height: 36, borderRadius: '50%', border: APG2_PROFILE.glass.border, background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 18, cursor: 'pointer' }}>‹</button>}
      <div style={{ width: 48, height: 48, borderRadius: 19, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 22, overflow: 'hidden' }}>
        {activeContext?.image ? <img src={activeContext.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : contextIcon(activeContext?.type)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '20px', fontWeight: 930, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeHeader.title || activeContext?.title || 'Переписка АПГ'}</div>
        <div style={{ color: typingUsers ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', marginTop: 2 }}>{typingUsers ? 'печатает...' : responseHint(activeContext)}</div>
      </div>
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <ContextBadge context={activeContext} />
        {desktopLayout && (
          <>
            <button type="button" onClick={() => patchActiveDialog({ pinned: !activePinned })} title={activePinned ? 'Открепить' : 'Закрепить'} style={{ width: 34, height: 34, borderRadius: '50%', border: activePinned ? '1px solid rgba(215,184,106,0.36)' : APG2_PROFILE.glass.border, background: activePinned ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: activePinned ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, cursor: 'pointer' }}>📌</button>
            <button type="button" onClick={() => patchActiveDialog({ archived: !activeArchived })} title={activeArchived ? 'Вернуть из архива' : 'Архивировать'} style={{ width: 34, height: 34, borderRadius: '50%', border: APG2_PROFILE.glass.border, background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.textSoft, cursor: 'pointer' }}>{activeArchived ? '↩' : '🗄️'}</button>
          </>
        )}
      </div>
    </div>
  ) : null;

  const chatPane = activeDialog ? (
    <div data-chat-pane style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', gap: desktopLayout ? 12 : 8, height: desktopLayout ? 'auto' : '100%', minHeight: desktopLayout ? 'calc(100svh - 154px)' : 0, minWidth: 0, overflow: 'hidden' }}>
      {chatHeader}
      <div data-message-thread style={{ display: 'grid', alignContent: 'end', gap: 7, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', padding: desktopLayout ? '2px 2px 8px' : '0 2px 8px' }}>
        {!desktopLayout && <CompactContextCard context={activeContext} isOwner={isOwner} collapsed={!contextExpanded} onToggle={() => setContextExpanded(value => !value)} onOpenObject={onOpenObject} onAction={runBookingAction} />}
        {groupedMessages.length ? groupedMessages.map(item => item.kind === 'day'
          ? <MessageDayGroup key={item.id} label={item.label} />
          : <MessageBubble key={item.id} message={item.message} own={item.message.senderId === uid && item.message.senderRole !== 'loki'} />) : (
          <div data-messaging-empty-state style={{ minHeight: 220, display: 'grid', placeItems: 'center', textAlign: 'center', color: APG2_PROFILE.textSoft }}>
            <div>
              <div style={{ width: 70, height: 70, borderRadius: 26, margin: '0 auto 14px', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 30 }}>💬</div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '23px', fontWeight: 920 }}>Сообщений пока нет.</div>
              <div style={{ marginTop: 6, fontSize: 13, lineHeight: '20px' }}>Начните общение с партнёром,<br />экспертом или новым знакомым.</div>
            </div>
          </div>
        )}
        {typingUsers > 0 && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, paddingLeft: 4 }}>Собеседник печатает...</div>}
        <div ref={messagesEndRef} />
      </div>
      <div data-message-composer style={{ position: desktopLayout ? 'sticky' : 'relative', bottom: desktopLayout ? 'calc(var(--safe-bottom, 0px) + 8px)' : 'auto', zIndex: 15, borderRadius: 24, padding: desktopLayout ? 10 : '9px 9px calc(9px + env(safe-area-inset-bottom, 0px))', background: 'rgba(var(--apg2-glass-a,255,255,255),0.10)', border: APG2_PROFILE.glass.border, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'grid', gap: 8 }}>
        <QuickReplyChips context={activeContext} onPick={value => setText(current => current.trim() ? current : value)} />
        {lastFailedMessage && (
          <div data-message-send-error style={{ borderRadius: 16, padding: 10, background: 'rgba(230,70,70,0.10)', border: '1px solid rgba(230,70,70,0.22)', color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', display: 'flex', gap: 9, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>Сообщение не отправилось. Можно повторить.</span>
            <GlassButton onClick={() => sendText(lastFailedMessage)} tone="gold" style={{ minHeight: 30, borderRadius: 14, padding: '6px 9px', fontSize: 11.5 }}>Повторить</GlassButton>
          </div>
        )}
        {attachment && (
          <div style={{ borderRadius: 16, padding: 8, display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)' }}>
            <img src={attachment.url} alt="" style={{ width: 38, height: 38, borderRadius: 12, objectFit: 'cover' }} />
            <div style={{ flex: 1, minWidth: 0, color: APG2_PROFILE.textSoft, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</div>
            <button onClick={() => setAttachment(null)} style={{ border: 0, background: 'transparent', color: APG2_PROFILE.textSoft, fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 44px', gap: 8, alignItems: 'end' }}>
          <label style={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, cursor: 'pointer' }}>
            📷
            <input type="file" accept="image/*" onChange={e => handlePhoto(e.target.files?.[0])} style={{ display: 'none' }} />
          </label>
          <textarea
            value={text}
            onFocus={() => activeDialog && userAction('dialog:typing', { dialogId: activeDialog.id, typing: true }).catch(() => {})}
            onBlur={() => activeDialog && userAction('dialog:typing', { dialogId: activeDialog.id, typing: false }).catch(() => {})}
            onChange={e => setText(e.target.value)}
            placeholder="Напишите сообщение..."
            style={{ minHeight: 44, maxHeight: 112, resize: 'vertical', border: 0, outline: 0, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', borderRadius: 20, color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontFamily: 'inherit', padding: '12px 14px', boxSizing: 'border-box' }}
          />
          <button type="button" onClick={() => sendText()} disabled={pending || (!text.trim() && !attachment)} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(215,184,106,0.34)', background: APG2_PROFILE.gold, color: '#17120a', display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 920, cursor: pending ? 'default' : 'pointer', opacity: pending || (!text.trim() && !attachment) ? 0.54 : 1, transition: 'opacity 160ms ease, transform 160ms ease' }}>↑</button>
        </div>
      </div>
    </div>
  ) : (
    <div data-messaging-empty-state style={{ minHeight: 420, display: 'grid', placeItems: 'center', textAlign: 'center', color: APG2_PROFILE.textSoft }}>
      <div>
        <div style={{ width: 76, height: 76, borderRadius: 28, margin: '0 auto 14px', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 32 }}>💬</div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 19, lineHeight: '24px', fontWeight: 930 }}>Сообщений пока нет.</div>
        <div style={{ marginTop: 7, fontSize: 13.5, lineHeight: '21px' }}>Начните общение с партнёром,<br />экспертом или новым знакомым.</div>
      </div>
    </div>
  );

  const contextPane = desktopLayout ? (
    <aside data-context-side-panel style={{ display: 'grid', gap: 12, alignContent: 'start', minWidth: 0 }}>
      <CompactContextCard context={activeContext} isOwner={isOwner} collapsed={false} onToggle={() => {}} onOpenObject={onOpenObject} onAction={runBookingAction} />
      <MessagingContextInfo context={activeContext} onOpenObject={onOpenObject} />
      {isOwner && <OwnerAssist enabled={aiAssist} onToggle={toggleAiAssist} context={activeContext} lastQuestion={lastQuestion} onUse={value => setText(value)} />}
    </aside>
  ) : null;

  return (
    <GlassPanel style={!desktopLayout && activeDialog ? { position: 'fixed', inset: 0, zIndex: 12500, width: '100%', height: '100dvh', minHeight: 0, padding: 'calc(6px + env(safe-area-inset-top, 0px)) 10px 0', overflow: 'hidden' } : undefined}>
      {(desktopLayout || !activeDialog) && <ScreenHeader title="Диалоги" subtitle="Сообщения АПГ" onBack={onBack} />}
      {error && <GlassCard style={{ borderRadius: 20, padding: 12, marginBottom: 12, color: '#ff8e8e' }}>{error}</GlassCard>}
      {desktopLayout && <div data-people-messaging-hero style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) repeat(3, minmax(96px,0.34fr))', gap: 10, alignItems: 'stretch', marginBottom: 14 }}>
        <div style={{ borderRadius: 30, padding: 16, background: 'radial-gradient(circle at 12% 0%, rgba(74,144,217,0.20), transparent 34%), radial-gradient(circle at 92% 0%, rgba(215,184,106,0.20), transparent 34%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.13), rgba(var(--apg2-glass-a,255,255,255),0.055))', border: APG2_PROFILE.glass.border, boxShadow: '0 16px 42px var(--apg2-elev-shadow, rgba(0,0,0,0.12))' }}>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 11, lineHeight: '14px', fontWeight: 930, textTransform: 'uppercase', letterSpacing: 0.9 }}>People Hub</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '27px', fontWeight: 950, marginTop: 5 }}>Чаты и переписки</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '20px', marginTop: 6 }}>Общение с людьми, партнёрами, экспертами и организаторами собрано в одном аккуратном рабочем пространстве.</div>
        </div>
        {[
          ['Диалоги', messagingSnapshot.total || dialogs.length],
          ['Новые', messagingSnapshot.unread || 0],
          ['Активные', unifiedDialogs.length],
        ].map(([label, value]) => (
          <div key={label} style={{ borderRadius: 24, padding: 13, background: 'rgba(var(--apg2-glass-a,255,255,255),0.075)', border: APG2_PROFILE.glass.border, display: 'grid', alignContent: 'center', textAlign: desktopLayout ? 'center' : 'left' }}>
            <div style={{ color: value ? APG2_PROFILE.gold : APG2_PROFILE.text, fontSize: 22, lineHeight: '26px', fontWeight: 950 }}>{value}</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', fontWeight: 820, marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>}
      <div data-messaging-premium-layout data-layout={desktopLayout ? 'desktop-three-pane' : 'mobile-native'} style={{ display: 'grid', gridTemplateColumns: desktopLayout ? 'minmax(290px, 0.78fr) minmax(430px, 1.42fr) minmax(260px, 0.7fr)' : 'minmax(0,1fr)', gap: desktopLayout ? 14 : 12, alignItems: activeDialog && !desktopLayout ? 'stretch' : 'start', height: activeDialog && !desktopLayout ? '100%' : 'auto', minHeight: 0 }}>
        {(desktopLayout || !activeDialog) && dialogList}
        {chatPane}
        {contextPane}
      </div>
    </GlassPanel>
  );
}

export default ContextDialogsPage;
