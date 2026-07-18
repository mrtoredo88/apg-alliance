import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { userAction } from '../userApi.js';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, ScreenHeader } from '../components/Apg2ProfileGlass.jsx';
import { buildDialogAutoAnswer, buildDialogContext, getDialogObjectLabel } from '../../server-shared/context-dialogs.js';
import { BOOKING_STATUSES } from '../../server-shared/booking.js';
import { MESSAGING_FILTERS, buildMessagingSnapshot, buildUnifiedDialogList } from '../messaging/index.js';

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

function userIdOf(user) {
  return user?.id ? String(user.id) : '';
}

function ContextBadge({ context }) {
  return <GlassBadge tone={context?.type === 'promotion' ? 'gold' : 'glass'}>{getDialogObjectLabel(context)}</GlassBadge>;
}

function DialogListItem({ dialog, active, onClick }) {
  const context = dialog.header?.context || dialog.context || {};
  const preview = dialog.header?.lastMessage?.text || dialog.lastMessage?.text || 'Диалог создан. Задайте вопрос по объекту.';
  return (
    <GlassCard onClick={onClick} style={{ borderRadius: 22, padding: 12, display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 10, alignItems: 'center', border: active ? '1px solid rgba(215,184,106,0.44)' : APG2_PROFILE.glass.border }}>
      <div style={{ width: 42, height: 42, borderRadius: 16, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 20, overflow: 'hidden' }}>
        {context.image ? <img src={context.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (dialog.header?.avatar || (context.type === 'event' ? '🎫' : context.type === 'expert' ? '✦' : context.type === 'promotion' ? '🎁' : '🏪'))}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 870, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dialog.header?.title || context.title || 'Диалог АПГ'}</div>
        </div>
        <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 780, marginBottom: 3 }}>{dialog.header?.subtitle || context.parentTitle || context.subtitle || getDialogObjectLabel(context)}</div>
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
      </div>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
        <ContextBadge context={context} />
        {dialog.unreadCount > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: APG2_PROFILE.gold, color: '#17120a', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{dialog.unreadCount}</span>}
      </div>
    </GlassCard>
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
    <div style={{ display: 'flex', justifyContent: own ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '82%', borderRadius: own ? '22px 22px 6px 22px' : '22px 22px 22px 6px', padding: 12, background: loki ? APG2_PROFILE.goldSoft : own ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', border: loki ? '1px solid rgba(215,184,106,0.36)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', color: APG2_PROFILE.text }}>
        <div style={{ color: loki ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{loki ? 'Локи' : message.senderName || 'Участник'}</div>
        {message.text && <div style={{ fontSize: 14, lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{message.text}</div>}
        {message.attachments?.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {message.attachments.map((file, index) => file.type === 'image'
              ? <img key={file.url || index} src={file.url} alt={file.name || ''} style={{ maxWidth: 220, borderRadius: 16, border: '1px solid rgba(255,255,255,0.14)' }} />
              : <a key={file.url || index} href={file.url} target="_blank" rel="noreferrer" style={{ color: APG2_PROFILE.gold }}>{file.name || 'Файл'}</a>)}
          </div>
        )}
        <div style={{ marginTop: 5, color: APG2_PROFILE.textMuted, fontSize: 10.5, textAlign: 'right' }}>{timeText(message.createdAt)} · {message.status || 'delivered'}</div>
      </div>
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
  const [contextCollapsed, setContextCollapsed] = useState(false);
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

  const activeDialog = useMemo(() => dialogs.find(dialog => dialog.id === activeDialogId) || dialogs[0] || null, [dialogs, activeDialogId]);
  const activeMessages = useMemo(() => messages.filter(message => message.dialogId === activeDialog?.dialogId || message.dialogId === activeDialog?.id), [messages, activeDialog]);
  const unifiedDialogs = useMemo(() => buildUnifiedDialogList({ dialogs, messages, actor: user, filter, query }), [dialogs, messages, user, filter, query]);
  const messagingSnapshot = useMemo(() => buildMessagingSnapshot({ dialogs, messages, actor: user }), [dialogs, messages, user]);
  const activeContext = activeDialog?.context || null;
  const isOwner = activeDialog?.ownerUserIds?.includes?.(uid);
  const lastQuestion = [...activeMessages].reverse().find(message => message.senderRole === 'user')?.text || '';
  const typingUsers = Object.entries(activeDialog?.typing || {}).filter(([id, value]) => id !== uid && value).length;

  const sendText = async (overrideText = '', senderRole = '') => {
    const body = String(overrideText || text || '').trim();
    if ((!body && !attachment) || !activeDialog || pending) return;
    const autoAnswer = !senderRole && !isOwner ? buildDialogAutoAnswer(activeContext, body) : null;
    setPending(true);
    setError('');
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
    return <GlassPanel><ScreenHeader title="Диалоги" subtitle="Войдите, чтобы задавать вопросы по объектам АПГ" onBack={onBack} /><EmptyStateV2 icon="💬" title="Нужна авторизация" text="Контекстные диалоги доступны участникам АПГ." /></GlassPanel>;
  }

  return (
    <GlassPanel>
      <ScreenHeader title="Сообщения" subtitle="Единая система диалогов АПГ" kicker="Messaging" onBack={onBack} />
      {error && <GlassCard style={{ borderRadius: 20, padding: 12, marginBottom: 12, color: '#ff8e8e' }}>{error}</GlassCard>}
      {pending && !dialogs.length && <GlassCard style={{ borderRadius: 22, padding: 18, color: APG2_PROFILE.textSoft }}>Открываем диалог...</GlassCard>}
      {!activeDialog ? (
        <EmptyStateV2 icon="💬" title="Диалогов пока нет" text="Откройте партнера, эксперта, мероприятие или акцию и нажмите «Задать вопрос»." />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <GlassCard data-messaging-dev-panel style={{ borderRadius: 22, padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по имени, объекту или сообщению" style={{ width: '100%', minHeight: 38, borderRadius: 16, border: APG2_PROFILE.glass.border, background: 'rgba(var(--apg2-glass-a,255,255,255),0.10)', color: APG2_PROFILE.text, padding: '0 12px', outline: 'none', fontFamily: 'inherit', fontSize: 13 }} />
              <GlassBadge tone="gold">{messagingSnapshot.unread} unread</GlassBadge>
            </div>
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
              {MESSAGING_FILTERS.map(item => (
                <button key={item.id} type="button" onClick={() => setFilter(item.id)} style={{ border: filter === item.id ? '1px solid rgba(215,184,106,0.48)' : APG2_PROFILE.glass.border, background: filter === item.id ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: filter === item.id ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, borderRadius: 999, minHeight: 32, padding: '6px 10px', fontFamily: 'inherit', fontSize: 12, fontWeight: 820, whiteSpace: 'nowrap' }}>{item.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px' }}>
              <span>Messaging · Realtime: {messagingSnapshot.realtime}</span>
              <span>Dialog Type: {activeDialog?.context?.type || activeDialog?.type || 'direct'}</span>
              <span>Permissions: {unifiedDialogs.find(item => item.id === activeDialog?.id)?.permissions?.reason || 'participant'}</span>
              <span>Participants: {(activeDialog?.participantIds || activeDialog?.ownerUserIds || []).length || 1}</span>
              <span>Context: {activeDialog?.context?.title || 'АПГ'}</span>
            </div>
          </GlassCard>
          {dialogs.length > 1 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {unifiedDialogs.length ? unifiedDialogs.slice(0, 8).map(dialog => <DialogListItem key={dialog.id} dialog={dialog} active={dialog.id === activeDialog.id} onClick={() => setActiveDialogId(dialog.id)} />) : (
                <GlassCard style={{ borderRadius: 22, padding: 14, color: APG2_PROFILE.textSoft }}>По этому фильтру диалогов нет.</GlassCard>
              )}
            </div>
          )}
          <SmartConversationHeader context={activeContext} isOwner={isOwner} collapsed={contextCollapsed} onOpenObject={onOpenObject} onAction={runBookingAction} />
          {isOwner && <OwnerAssist enabled={aiAssist} onToggle={toggleAiAssist} context={activeContext} lastQuestion={lastQuestion} onUse={value => setText(value)} />}
          <div style={{ display: 'grid', gap: 9, minHeight: 220 }}>
            {activeMessages.length ? activeMessages.map(message => <MessageBubble key={message.id} message={message} own={message.senderId === uid && message.senderRole !== 'loki'} />) : (
              <ConversationIntro context={activeContext} />
            )}
            {typingUsers > 0 && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12 }}>Собеседник печатает...</div>}
            <div ref={messagesEndRef} />
          </div>
          {attachment && (
            <GlassCard style={{ borderRadius: 18, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={attachment.url} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
              <div style={{ flex: 1, minWidth: 0, color: APG2_PROFILE.textSoft, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</div>
              <button onClick={() => setAttachment(null)} style={{ border: 0, background: 'transparent', color: APG2_PROFILE.textSoft, fontSize: 18 }}>×</button>
            </GlassCard>
          )}
          <GlassCard style={{ borderRadius: 26, padding: 10, display: 'grid', gap: 8 }}>
            <QuickReplyChips context={activeContext} onPick={value => setText(current => current.trim() ? current : value)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'end' }}>
              <label style={{ width: 42, height: 42, borderRadius: 17, display: 'grid', placeItems: 'center', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, cursor: 'pointer' }}>
                📷
                <input type="file" accept="image/*" onChange={e => handlePhoto(e.target.files?.[0])} style={{ display: 'none' }} />
              </label>
              <textarea
                value={text}
                onFocus={() => activeDialog && userAction('dialog:typing', { dialogId: activeDialog.id, typing: true }).catch(() => {})}
                onBlur={() => activeDialog && userAction('dialog:typing', { dialogId: activeDialog.id, typing: false }).catch(() => {})}
                onChange={e => setText(e.target.value)}
                placeholder={isOwner ? 'Ответить по этому объекту...' : 'Задать вопрос по этому объекту...'}
                style={{ minHeight: 42, maxHeight: 110, resize: 'vertical', border: 0, outline: 0, background: 'transparent', color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontFamily: 'inherit', padding: '10px 0' }}
              />
              <GlassButton onClick={() => sendText()} tone="gold" style={{ minHeight: 42, borderRadius: 17, color: '#17120a', opacity: pending ? 0.6 : 1 }}>Отправить</GlassButton>
            </div>
          </GlassCard>
        </div>
      )}
    </GlassPanel>
  );
}

export default ContextDialogsPage;
