import React, { useEffect, useMemo, useState } from 'react';
import { BusinessHub } from '../businessHub/BusinessHub.jsx';
import { canUseBusinessHub, getBusinessHubFlag } from '../businessHub/BusinessHubCore.js';
import { getCabinetRoles } from '../cabinet/CabinetRoleEngine.js';
import { buildCabinetSnapshot, getCabinetPublicUrl } from '../cabinet/CabinetModules.js';
import { DigitalShowcaseBuilder } from '../cabinet/DigitalShowcaseBuilder.jsx';
import { NewsCard } from '../NewsPage.jsx';
import { EventPosterCard } from '../EventsPage.jsx';
import { PartnerCard } from '../HomePanelV2.jsx';
import { ExpertCardV2 } from '../ExpertsPage.jsx';
import { CAPABILITIES, hasCapability } from '../roleEngine.js';
import { motionTransition } from '../motion.js';
import { userAction } from '../userApi.js';
import { WorkspaceEventsManager } from './WorkspaceEventsManager.jsx';
import { WorkspaceMeetingsCRM } from './WorkspaceMeetingsCRM.jsx';
import {
  BOOKING_STATUSES,
  buildBookingCalendar,
  buildBookingProfile,
  formatBookingDateKey,
  groupBookingsForProfile,
  normalizeBooking,
} from '../../server-shared/booking.js';

const WS = {
  page: '#F8F1E4',
  page2: '#FFF9EE',
  text: '#1F1A14',
  soft: 'rgba(31,26,20,0.64)',
  muted: 'rgba(31,26,20,0.46)',
  line: 'rgba(88,67,37,0.10)',
  gold: '#C89B3C',
  gold2: '#E8C56D',
  green: '#2EB36B',
  red: '#D95D54',
  blue: '#5B8FDB',
  card: 'rgba(255,255,255,0.74)',
  cardStrong: 'rgba(255,255,255,0.90)',
  shadow: '0 24px 70px rgba(82,60,30,0.10)',
  shadowSoft: '0 14px 44px rgba(82,60,30,0.075)',
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Рабочий стол', icon: '🏠', description: 'Что сделать сегодня' },
  { id: 'profile', label: 'Мой профиль', icon: '👤', description: 'Карточка и витрина' },
  { id: 'events', label: 'Мероприятия', icon: '🎉', description: 'Календарь и участники' },
  { id: 'booking', label: 'Встречи', icon: '📅', description: 'Календарь и записи' },
  { id: 'dialogs', label: 'Диалоги', icon: '💬', description: 'Вопросы по объектам', badge: data => data.dialogUnreadCount || 0 },
  { id: 'content', label: 'Новости', icon: '📰', description: 'Публикации и черновики' },
  { id: 'growth', label: 'Партнёры', icon: '📢', description: 'QR, ссылки, промо' },
  { id: 'offers', label: 'Акции и предложения', icon: '🎁', description: 'Маркетинг и бонусы' },
  { id: 'reviews', label: 'Отзывы', icon: '⭐', description: 'Рейтинг и ответы' },
  { id: 'analytics', label: 'Аналитика', icon: '📊', description: 'Метрики и изменения' },
  { id: 'finance', label: 'Финансы', icon: '💰', description: 'Тарифы и документы' },
  { id: 'notifications', label: 'Центр уведомлений', icon: '🔔', description: 'События и заявки', badge: data => data.unreadCount || 0 },
  { id: 'settings', label: 'Настройки', icon: '⚙️', description: 'Кабинет и команда' },
];

const WORKSPACE_ROLE_VIEWS = {
  partner: {
    id: 'partner',
    label: 'Партнёр',
    eyebrow: 'Кабинет партнёра',
    heroTitle: 'Что сегодня нужно сделать партнёру',
    memberLabel: 'Партнёр с 22 мая 2024',
    kpiLabels: ['Уровень', 'Ключей', 'Активных акций', 'Мероприятий'],
  },
  expert: {
    id: 'expert',
    label: 'Эксперт',
    eyebrow: 'Кабинет эксперта',
    heroTitle: 'Что сегодня важно эксперту',
    memberLabel: 'Эксперт АПГ',
    kpiLabels: ['Рейтинг', 'Ключей', 'Публикаций', 'Выступлений'],
  },
  admin: {
    id: 'admin',
    label: 'Администратор',
    eyebrow: 'Админ Workspace',
    heroTitle: 'Что требует внимания в системе',
    memberLabel: 'Управление АПГ',
    kpiLabels: ['Роль', 'Ключей', 'Публикаций', 'Событий'],
  },
};

const ADMIN_ROLE_IDS = new Set(['owner', 'super_admin', 'admin', 'moderator', 'editor', 'analyst']);

function getWorkspaceRoleViews({ roles = [], activeRole, ownedPartner, ownedExpert, isAdminRole }) {
  const views = [];
  const roleIds = new Set(roles.map(role => role.id));
  if (ownedPartner?.id || roleIds.has('partner')) views.push(WORKSPACE_ROLE_VIEWS.partner);
  if (ownedExpert?.id || roleIds.has('expert')) views.push(WORKSPACE_ROLE_VIEWS.expert);
  if (isAdminRole || roles.some(role => ADMIN_ROLE_IDS.has(role.id))) views.push(WORKSPACE_ROLE_VIEWS.admin);

  const unique = views.filter((view, index, list) => list.findIndex(item => item.id === view.id) === index);
  if (unique.length) return unique;
  if (activeRole?.id === 'expert') return [WORKSPACE_ROLE_VIEWS.expert];
  if (ADMIN_ROLE_IDS.has(activeRole?.id)) return [WORKSPACE_ROLE_VIEWS.admin];
  return [WORKSPACE_ROLE_VIEWS.partner];
}

function getRoleSpecificTasks({ view, data, profileStatus, actions }) {
  const commonProfileTask = {
    icon: '▤',
    title: profileStatus.value < 100 ? 'Обновите рабочий профиль' : 'Профиль готов к рабочему дню',
    text: profileStatus.value < 100 ? `Не хватает: ${profileStatus.missing.slice(0, 2).join(', ')}` : 'Можно переходить к публикациям',
    priority: profileStatus.value < 100 ? 'Средний' : 'Готово',
    tone: profileStatus.value < 100 ? '#E39A35' : WS.green,
    onClick: actions.openProfile,
  };

  if (view.id === 'expert') {
    return [
      { icon: '✦', title: data.events.length ? 'Проверьте ближайшее выступление' : 'Добавьте экспертное событие', text: data.events[0] ? safeTitle(data.events[0], 'Ближайшая встреча') : 'Афиша ждёт экспертный формат', priority: 'Важно', tone: WS.red, onClick: actions.openEvents },
      commonProfileTask,
      { icon: '✎', title: data.news.length ? 'Подготовьте экспертную публикацию' : 'Создайте экспертную заметку', text: data.news[0] ? 'Есть материал для проверки' : 'Расскажите о своей практике', priority: 'Низкий', tone: WS.blue, onClick: actions.openNews },
    ];
  }

  if (view.id === 'admin') {
    return [
      { icon: '▣', title: 'Проверить входящие обращения', text: data.unreadCount ? `${data.unreadCount} сигналов требуют реакции` : 'Критичных обращений нет', priority: data.unreadCount ? 'Важно' : 'Спокойно', tone: data.unreadCount ? WS.red : WS.green, onClick: actions.openMessages },
      { icon: '☷', title: 'Проверить партнёров и экспертов', text: `${data.partners.length} партнёров · ${data.experts.length} экспертов`, priority: 'Система', tone: WS.gold, onClick: actions.openPartners },
      { icon: '✎', title: 'Проверить публикации', text: `${data.news.length} материалов в контентной базе`, priority: 'Редакция', tone: WS.blue, onClick: actions.openNews },
    ];
  }

  return [
    { icon: '▣', title: data.events.length ? 'Подтвердите участие в мероприятии' : 'Добавьте мероприятие', text: data.events[0] ? safeTitle(data.events[0], '9-й Большой Нетворкинг') : 'Афиша ждёт наполнения', priority: 'Важно', tone: WS.red, onClick: actions.openEvents },
    commonProfileTask,
    { icon: '✎', title: data.news.length ? 'Опубликуйте новость' : 'Создайте первую новость', text: data.news[0] ? 'У вас есть черновики новости' : 'Лента ждёт публикаций', priority: 'Низкий', tone: WS.blue, onClick: actions.openNews },
  ];
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatShortDate(value) {
  const date = toDate(value);
  if (!date) return 'дата не указана';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function bookingDateRange(mode, anchor = new Date()) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  if (mode === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (mode === 'month') start.setDate(1);
  const end = new Date(start);
  end.setDate(start.getDate() + (mode === 'month' ? 35 : mode === 'week' ? 7 : 1));
  return { from: start.toISOString(), to: end.toISOString() };
}

function bookingTimeText(item) {
  const date = toDate(item?.startAt);
  if (!date) return item?.dateLabel || 'Дата не указана';
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const time = item?.time || date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function bookingDayText(item) {
  const date = toDate(item?.startAt);
  if (!date) return item?.dateLabel || 'дата не указана';
  return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function bookingStartMinute(item) {
  const date = toDate(item?.startAt);
  if (!date) return 0;
  return date.getHours() * 60 + date.getMinutes();
}

function bookingStatusTone(status) {
  if ([BOOKING_STATUSES.pending, BOOKING_STATUSES.new, BOOKING_STATUSES.rescheduleRequested].includes(status)) return WS.gold;
  if ([BOOKING_STATUSES.cancelled, BOOKING_STATUSES.cancelledByUser, BOOKING_STATUSES.cancelledByProvider, BOOKING_STATUSES.noShow].includes(status)) return WS.red;
  if (status === BOOKING_STATUSES.completed) return WS.green;
  return WS.blue;
}

function bookingSearchText(item) {
  return [
    item?.userName,
    item?.userPhone,
    item?.serviceTitle,
    item?.specialistName,
    item?.providerName,
    item?.dateLabel,
    item?.time,
  ].filter(Boolean).join(' ').toLowerCase();
}

function isSameBookingDay(item, date) {
  const itemDate = toDate(item?.startAt);
  if (!itemDate) return false;
  return formatBookingDateKey(itemDate) === formatBookingDateKey(date);
}

function getDayGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

function safeTitle(item, fallback = 'АПГ') {
  return item?.title || item?.name || item?.displayName || item?.specialization || fallback;
}

function getProfileCompletion(profile) {
  if (!profile?.id) return { value: 0, label: 'профиль не выбран', missing: ['открыть профиль'] };
  const checks = [
    ['название', profile.name || profile.title || profile.displayName],
    ['описание', profile.description || profile.shortDescription || profile.about],
    ['изображение', profile.photo || profile.logoUrl || profile.imageUrl || profile.coverPhoto],
    ['контакты', profile.phone || profile.telegramUrl || profile.vkUrl || profile.websiteUrl],
    ['предложение', profile.offer || profile.gift || profile.promo],
  ];
  const done = checks.filter(([, value]) => Boolean(value)).length;
  return {
    value: Math.round(done / checks.length * 100),
    label: `${done} из ${checks.length} пунктов`,
    missing: checks.filter(([, value]) => !value).map(([label]) => label),
  };
}

function buildWorkspaceContext(activeSection) {
  const map = {
    dashboard: { label: 'Рабочий стол', prompt: 'Что мне важно сделать сегодня?', next: 'начать с рабочих задач' },
    profile: { label: 'Мой профиль', prompt: 'Что улучшить в моей карточке?', next: 'обновить витрину и контакты' },
    growth: { label: 'Привлечение клиентов', prompt: 'Как сегодня привести новых клиентов?', next: 'запустить QR, ссылку или промоматериал' },
    content: { label: 'Контент', prompt: 'Что стоит опубликовать?', next: 'проверить новости, статьи и черновики' },
    events: { label: 'Мероприятия', prompt: 'Какие мероприятия требуют внимания?', next: 'проверить календарь и регистрации' },
    booking: { label: 'Встречи', prompt: 'Кого нужно принять сегодня?', next: 'проверить записи, подтверждения и свободные интервалы' },
    dialogs: { label: 'Диалоги', prompt: 'Какие обращения ждут ответа?', next: 'разобрать вопросы по объектам' },
    offers: { label: 'Акции и предложения', prompt: 'Какие акции сейчас важнее?', next: 'обновить предложения и бонусы' },
    clients: { label: 'Клиенты', prompt: 'С кем нужно поработать сегодня?', next: 'разобрать новых и вернувшихся клиентов' },
    reviews: { label: 'Отзывы', prompt: 'На какие отзывы нужно ответить?', next: 'проверить рейтинг и ответы' },
    analytics: { label: 'Аналитика', prompt: 'Какие показатели изменились?', next: 'посмотреть метрики и источники клиентов' },
    finance: { label: 'Финансы', prompt: 'Что проверить по оплатам?', next: 'сверить тариф, счета и документы' },
    notifications: { label: 'Центр уведомлений', prompt: 'Какие события требуют реакции?', next: 'разобрать заявки, комментарии и рекомендации' },
    settings: { label: 'Настройки', prompt: 'Что настроить в кабинете?', next: 'проверить профиль, команду и доступы' },
  };
  return map[activeSection] || map.dashboard;
}

function cardStyle(extra = {}) {
  return {
    background: WS.cardStrong,
    border: `1px solid ${WS.line}`,
    borderRadius: 24,
    boxShadow: WS.shadowSoft,
    backdropFilter: 'blur(24px) saturate(1.32)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.32)',
    ...extra,
  };
}

function buttonStyle(extra = {}) {
  return {
    border: 0,
    borderRadius: 18,
    minHeight: 44,
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.72)',
    color: WS.text,
    fontFamily: 'inherit',
    fontSize: 13.5,
    lineHeight: '18px',
    fontWeight: 820,
    cursor: 'pointer',
    boxShadow: 'inset 0 0 0 1px rgba(88,67,37,0.08)',
    transition: motionTransition(['transform', 'background', 'box-shadow'], 'base'),
    ...extra,
  };
}

function WorkspaceButton({ children, onClick, style, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} style={buttonStyle(style)}>
      {children}
    </button>
  );
}

function SectionTitle({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 12 }}>
      <h2 style={{ margin: 0, color: WS.text, fontSize: 22, lineHeight: '27px', fontWeight: 940, letterSpacing: -0.35 }}>{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}

function Panel({ title, action, children, style }) {
  return (
    <section style={cardStyle({ padding: 20, minWidth: 0, ...style })}>
      {title && <SectionTitle title={title} action={action} />}
      {children}
    </section>
  );
}

function WorkspaceHeader({ query, onQueryChange, unreadCount, onModeChange, onOpenNotifications }) {
  const links = ['Новости', 'Мероприятия', 'Партнёры', 'Эксперты', 'Акции', 'Подарки'];
  return (
    <header data-workspace-v2-header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,249,238,0.88)', backdropFilter: 'blur(28px) saturate(1.25)', WebkitBackdropFilter: 'blur(28px) saturate(1.25)', borderBottom: `1px solid ${WS.line}` }}>
      <div style={{ maxWidth: 1760, margin: '0 auto', minHeight: 72, padding: '0 24px', display: 'grid', gridTemplateColumns: '255px minmax(0,1fr) auto', gap: 18, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img src="/logo.png" alt="АПГ" style={{ width: 44, height: 44, borderRadius: 16, objectFit: 'cover', display: 'block', boxShadow: '0 14px 30px rgba(47,28,105,0.18)' }} />
          </picture>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: WS.text, fontSize: 19, lineHeight: '22px', fontWeight: 950, letterSpacing: -0.35, whiteSpace: 'nowrap' }}>АПГ: ЗЕЛЕНОГРАД</div>
            <div style={{ color: WS.soft, fontSize: 12, lineHeight: '15px', fontWeight: 820, textTransform: 'uppercase', letterSpacing: 0.4 }}>Альянс партнёров города</div>
          </div>
        </div>
        <nav style={{ display: 'flex', justifyContent: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          {links.map((link, index) => (
            <button key={link} type="button" style={buttonStyle({ minHeight: 38, padding: '8px 14px', background: index === 0 ? 'rgba(255,255,255,0.92)' : 'transparent', boxShadow: index === 0 ? '0 10px 26px rgba(82,60,30,0.07)' : 'none', whiteSpace: 'nowrap', fontSize: 13 })}>{link}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <label style={{ width: 250, minHeight: 46, borderRadius: 19, background: 'rgba(255,255,255,0.78)', border: `1px solid ${WS.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', boxSizing: 'border-box', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.86)' }}>
            <span style={{ color: WS.muted, fontSize: 19 }}>⌕</span>
            <input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Поиск по АПГ..." style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', color: WS.text, fontFamily: 'inherit', fontSize: 14, fontWeight: 680 }} />
          </label>
          <button type="button" onClick={onOpenNotifications} style={buttonStyle({ width: 48, minHeight: 48, padding: 0, borderRadius: 18, position: 'relative', fontSize: 21 })}>
            ♧
            {!!unreadCount && <span style={{ position: 'absolute', right: 8, top: 6, minWidth: 20, height: 20, borderRadius: 999, background: '#B94135', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{Math.min(unreadCount, 9)}</span>}
          </button>
          <WorkspaceButton onClick={() => onModeChange?.('user')} style={{ minHeight: 48, borderRadius: 19, padding: '0 20px', background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B', boxShadow: '0 14px 30px rgba(201,155,60,0.22)' }}>Выйти в АПГ</WorkspaceButton>
        </div>
      </div>
    </header>
  );
}

function WorkspaceSidebar({ items, activeSection, onSelect, user, data, onModeChange, availableViews, activeViewId, onViewChange }) {
  const main = items.filter(item => !['finance', 'notifications', 'settings'].includes(item.id));
  const settings = items.filter(item => ['finance', 'notifications', 'settings'].includes(item.id));
  const initial = String(user?.firstName || user?.name || user?.displayName || 'A').slice(0, 1).toUpperCase();
  return (
    <aside data-workspace-v2-sidebar style={cardStyle({ height: 'calc(100dvh - 94px - env(safe-area-inset-bottom, 0px))', minHeight: 0, position: 'sticky', top: 80, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' })}>
      <style>{`@keyframes workspaceDialogBadgePulse{0%,100%{transform:scale(1);box-shadow:0 0 0 rgba(185,65,53,0)}45%{transform:scale(1.08);box-shadow:0 0 0 6px rgba(185,65,53,0.12)}}`}</style>
      <div style={{ padding: '15px 20px 12px' }}>
        <div style={{ color: WS.text, fontSize: 15, lineHeight: '18px', fontWeight: 930, textTransform: 'uppercase', letterSpacing: 0.7 }}>Workspace</div>
        <div style={{ color: WS.soft, fontSize: 13, lineHeight: '17px', marginTop: 5 }}>Ролевой рабочий кабинет</div>
        {availableViews.length > 1 && (
          <div data-workspace-role-switch style={{ display: 'flex', gap: 5, marginTop: 10, padding: 4, borderRadius: 14, background: 'rgba(88,67,37,0.06)' }}>
            {availableViews.map(view => {
              const active = activeViewId === view.id;
              return (
                <button key={view.id} type="button" onClick={() => onViewChange(view.id)} style={{ border: 0, flex: 1, minHeight: 28, borderRadius: 11, background: active ? 'rgba(255,255,255,0.88)' : 'transparent', color: active ? '#8A6422' : WS.soft, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 860, cursor: 'pointer', boxShadow: active ? '0 8px 18px rgba(82,60,30,0.08)' : 'none' }}>
                  {view.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 8px', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
      <div style={{ display: 'grid', gap: 1 }}>
        {[main, settings].map((group, groupIndex) => (
          <div key={groupIndex} style={{ display: 'grid', gap: 1 }}>
            {group.map(item => {
              const active = activeSection === item.id;
              const badge = typeof item.badge === 'function' ? item.badge(data) : item.badge;
              return (
                <button key={`${item.id}-${item.label}`} type="button" onClick={() => onSelect(item)} style={{ border: 0, minHeight: 47, padding: '0 18px', background: active ? 'linear-gradient(90deg, rgba(241,206,128,0.42), rgba(241,206,128,0.08))' : 'transparent', color: active ? '#8A6422' : WS.text, display: 'grid', gridTemplateColumns: '29px minmax(0,1fr) auto', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', boxShadow: active ? 'inset 4px 0 0 #D0A14C' : 'none' }}>
                  <span style={{ color: active ? '#B68126' : 'rgba(31,26,20,0.58)', fontSize: 18, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.3, lineHeight: '16px', fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    <span style={{ display: 'block', color: active ? 'rgba(138,100,34,0.72)' : WS.muted, fontSize: 10.8, lineHeight: '13px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</span>
                  </span>
                  {!!badge && <span style={{ minWidth: 24, height: 24, borderRadius: 999, background: item.id === 'dialogs' ? '#B94135' : 'rgba(209,161,76,0.18)', color: item.id === 'dialogs' ? '#fff' : '#A8741F', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 920, animation: item.id === 'dialogs' ? 'workspaceDialogBadgePulse 1.8s ease-in-out infinite' : 'none' }}>{badge}</span>}
                </button>
              );
            })}
            {groupIndex === 0 && <div style={{ height: 4 }} />}
          </div>
        ))}
      </div>
      </div>
      <div style={{ marginTop: 'auto', padding: 14, display: 'grid', gap: 8 }}>
        <div style={cardStyle({ padding: 10, borderRadius: 16, background: 'rgba(255,252,245,0.86)', boxShadow: 'none' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 14, background: 'linear-gradient(135deg,#100B32,#4A327F)', color: '#F5D77E', display: 'grid', placeItems: 'center', fontWeight: 950 }}>{initial}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: WS.text, fontSize: 13.5, lineHeight: '17px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.firstName || user?.name || 'Пользователь АПГ'}</div>
              <div style={{ color: WS.soft, fontSize: 12, lineHeight: '15px', marginTop: 2 }}>{availableViews.find(view => view.id === activeViewId)?.eyebrow || 'Workspace активен'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ color: '#8A6422', fontSize: 12.5, fontWeight: 850 }}>Уровень 18</span>
            <span style={{ color: WS.muted, fontSize: 12, fontWeight: 800 }}>18%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(88,67,37,0.10)', overflow: 'hidden', marginTop: 7 }}>
            <div style={{ width: '18%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#E9C66B,#C89B3C)' }} />
          </div>
        </div>
        <WorkspaceButton onClick={() => onModeChange?.('user')} style={{ minHeight: 42, borderRadius: 16, background: 'rgba(255,255,255,0.82)' }}>☷ Режим пользователя</WorkspaceButton>
      </div>
    </aside>
  );
}

function Sparkline({ color = WS.gold, height = 124 }) {
  return (
    <svg viewBox="0 0 520 180" preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id="workspaceSpark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M8 150 C50 136,70 92,116 112 S178 148,222 108 S274 48,320 70 S388 112,430 68 S480 30,512 18" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <path d="M8 150 C50 136,70 92,116 112 S178 148,222 108 S274 48,320 70 S388 112,430 68 S480 30,512 18 L512 180 L8 180 Z" fill="url(#workspaceSpark)" />
      {[1000, 750, 500, 250, 0].map((label, index) => (
        <g key={label} opacity="0.48">
          <line x1="0" x2="520" y1={16 + index * 36} y2={16 + index * 36} stroke="rgba(88,67,37,0.11)" strokeDasharray="5 8" />
          <text x="0" y={12 + index * 36} fill="rgba(31,26,20,0.52)" fontSize="14" fontWeight="700">{label}</text>
        </g>
      ))}
    </svg>
  );
}

function DashboardHero({ data, profileStatus, workspaceView, actions }) {
  const labels = workspaceView.kpiLabels || WORKSPACE_ROLE_VIEWS.partner.kpiLabels;
  return (
    <section style={{ position: 'relative', overflow: 'hidden', borderRadius: 26, minHeight: 272, padding: 23, color: '#fff', background: 'radial-gradient(circle at 18% 12%, rgba(239,201,113,0.34), transparent 30%), linear-gradient(90deg, rgba(10,12,18,0.86), rgba(12,17,28,0.54)), url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 1200 700%27%3E%3Crect width=%271200%27 height=%27700%27 fill=%27%23101822%27/%3E%3Cg fill=%27%23243549%27 opacity=%27.9%27%3E%3Crect x=%2780%27 y=%27360%27 width=%27130%27 height=%27240%27 rx=%276%27/%3E%3Crect x=%27240%27 y=%27290%27 width=%27160%27 height=%27310%27 rx=%278%27/%3E%3Crect x=%27435%27 y=%27330%27 width=%27120%27 height=%27270%27 rx=%276%27/%3E%3Crect x=%27600%27 y=%27220%27 width=%27170%27 height=%27380%27 rx=%278%27/%3E%3Crect x=%27810%27 y=%27310%27 width=%27150%27 height=%27290%27 rx=%278%27/%3E%3Crect x=%27995%27 y=%27360%27 width=%27110%27 height=%27240%27 rx=%276%27/%3E%3C/g%3E%3Cg stroke=%27%23f0c86d%27 stroke-opacity=%27.24%27 stroke-width=%273%27 fill=%27none%27%3E%3Cpath d=%27M0 600 C220 520 380 620 610 535 S970 500 1200 410%27/%3E%3Cpath d=%27M0 640 C260 570 390 660 620 575 S980 545 1200 470%27/%3E%3C/g%3E%3C/svg%3E\") center/cover', boxShadow: '0 22px 60px rgba(28,23,15,0.22)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.40))' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', height: '100%', minHeight: 226, alignContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: 20, lineHeight: '25px', fontWeight: 650 }}>{getDayGreeting()}, {data.userName} 👋</div>
            <div style={{ borderRadius: 17, background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.12)', padding: '9px 13px', color: '#F5D77E', fontSize: 13.5, fontWeight: 850, backdropFilter: 'blur(18px)' }}>♕ {workspaceView.memberLabel}</div>
          </div>
          <h1 style={{ margin: '13px 0 0', maxWidth: 600, color: '#fff', fontSize: 32, lineHeight: '38px', fontWeight: 950, letterSpacing: -0.72 }}>{workspaceView.heroTitle}</h1>
          <button type="button" onClick={actions.openCabinet} style={{ marginTop: 14, border: 0, minHeight: 42, borderRadius: 18, padding: '0 18px', background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B', fontFamily: 'inherit', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 14px 30px rgba(201,155,60,0.18)' }}>Продолжить работу</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, padding: 10, borderRadius: 21, background: 'rgba(10,10,12,0.42)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(26px)' }}>
          {[
            ['☆', workspaceView.id === 'admin' ? 'Admin' : '18', labels[0]],
            ['⌘', data.userKeys || 0, labels[1]],
            ['✿', workspaceView.id === 'admin' ? data.news.length : data.partners.filter(item => item.offer).length || 5, labels[2]],
            ['▣', data.events.length || 0, labels[3]],
          ].map(([icon, value, label]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr)', gap: 9, alignItems: 'center' }}>
              <div style={{ width: 34, height: 34, borderRadius: 12, background: 'rgba(201,155,60,0.14)', color: '#F2C963', display: 'grid', placeItems: 'center', fontSize: 18 }}>{icon}</div>
              <div>
                <div style={{ color: '#fff', fontSize: 20, lineHeight: '23px', fontWeight: 930 }}>{value}</div>
                <div style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12, lineHeight: '15px', marginTop: 3 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricTile({ label, value, delta }) {
  return (
    <div style={{ borderRadius: 15, background: 'rgba(255,255,255,0.78)', border: `1px solid ${WS.line}`, padding: '10px 9px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ color: WS.text, fontSize: 21, lineHeight: '24px', fontWeight: 950 }}>{value}</div>
      <div style={{ color: WS.soft, fontSize: 12, lineHeight: '15px', marginTop: 4 }}>{label}</div>
      <div style={{ color: WS.green, fontSize: 12, lineHeight: '15px', fontWeight: 880, marginTop: 5 }}>↗ {delta}</div>
    </div>
  );
}

function MetricsPanel({ data }) {
  return (
    <Panel title="Ключевые показатели" action={<button type="button" style={buttonStyle({ minHeight: 30, padding: '5px 10px', background: 'transparent', boxShadow: 'none', color: WS.soft })}>Этот месяц⌄</button>} style={{ minHeight: 272, padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        <MetricTile label="Просмотров" value="1 248" delta="18%" />
        <MetricTile label="Взаимодействий" value="324" delta="12%" />
        <MetricTile label="Переходов" value="78" delta="16%" />
        <MetricTile label="Новых клиентов" value={Math.max(data.unreadCount || 0, 24)} delta="20%" />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ color: WS.text, fontSize: 15, lineHeight: '19px', fontWeight: 900, marginBottom: 6 }}>Динамика активности</div>
        <Sparkline color={WS.gold} height={88} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', color: WS.muted, fontSize: 12, fontWeight: 760, marginTop: 4 }}>
          <span>1 июл</span><span style={{ textAlign: 'center' }}>4 июл</span><span style={{ textAlign: 'center' }}>10 июл</span><span style={{ textAlign: 'right' }}>13 июл</span>
        </div>
      </div>
    </Panel>
  );
}

function TaskRow({ icon, title, text, priority, tone = WS.gold, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ border: 0, background: 'transparent', padding: '10px 0', borderBottom: `1px solid ${WS.line}`, display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 38, height: 38, borderRadius: 13, background: `${tone}18`, color: tone, display: 'grid', placeItems: 'center', fontSize: 18 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: WS.text, fontSize: 15, lineHeight: '19px', fontWeight: 890, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ display: 'block', color: WS.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
      </span>
      {priority && <span style={{ borderRadius: 999, background: `${tone}18`, color: tone, padding: '6px 10px', fontSize: 12, lineHeight: '14px', fontWeight: 880 }}>{priority}</span>}
    </button>
  );
}

function EventRow({ event, index, onClick }) {
  const date = toDate(event?.eventDate || event?.date || event?.createdAt);
  return (
    <button type="button" onClick={onClick} style={{ border: 0, background: 'transparent', padding: '10px 0', borderBottom: `1px solid ${WS.line}`, display: 'grid', gridTemplateColumns: '60px minmax(0,1fr) auto', gap: 14, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 58, height: 58, borderRadius: 17, background: index === 0 ? 'rgba(201,155,60,0.16)' : 'rgba(88,67,37,0.06)', display: 'grid', placeItems: 'center', color: WS.text }}>
        <span style={{ textAlign: 'center' }}>
          <span style={{ display: 'block', fontSize: 24, lineHeight: '25px', fontWeight: 950 }}>{date ? date.getDate() : '—'}</span>
          <span style={{ display: 'block', fontSize: 12, lineHeight: '15px', fontWeight: 780, marginTop: 2 }}>{date ? date.toLocaleDateString('ru-RU', { month: 'short' }) : 'дата'}</span>
        </span>
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: WS.text, fontSize: 15.5, lineHeight: '20px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeTitle(event, 'Мероприятие')}</span>
        <span style={{ display: 'block', color: WS.soft, fontSize: 13, lineHeight: '18px', marginTop: 5 }}>{event?.time || '11:00 – 16:00'}</span>
        <span style={{ display: 'block', color: WS.soft, fontSize: 13, lineHeight: '18px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event?.place || event?.address || 'Зеленоград'}</span>
      </span>
      <span style={{ borderRadius: 999, background: index === 0 ? 'rgba(46,179,107,0.12)' : 'rgba(91,143,219,0.12)', color: index === 0 ? WS.green : WS.blue, padding: '7px 10px', fontSize: 12, lineHeight: '14px', fontWeight: 850 }}>{index === 0 ? 'Вы участвуете' : 'Регистрация'}</span>
    </button>
  );
}

function MessageRow({ item, index, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ border: 0, background: 'transparent', padding: '10px 0', borderBottom: `1px solid ${WS.line}`, display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 46, height: 46, borderRadius: 999, background: index === 0 ? 'linear-gradient(135deg,#1C173F,#8367C7)' : 'linear-gradient(135deg,#F1DCA4,#D0A14C)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 930 }}>{String(safeTitle(item, 'АПГ')).slice(0, 1).toUpperCase()}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: WS.text, fontSize: 15.5, lineHeight: '20px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeTitle(item, ['Елена Чеснокова', 'Марина Неверова', 'Семейный Клуб «ДОМ»'][index] || 'Сообщение')}</span>
        <span style={{ display: 'block', color: WS.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 4 }}>{item?.type || item?.category || 'Партнёр'}</span>
        <span style={{ display: 'block', color: WS.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item?.text || item?.body || 'Здравствуйте! Интересует сотрудничество...'}</span>
      </span>
      <span style={{ display: 'grid', justifyItems: 'end', gap: 10, color: WS.muted, fontSize: 12, fontWeight: 780 }}>
        {['2 мин назад', '15 мин назад', '1 ч назад'][index] || 'сейчас'}
        <span style={{ width: 9, height: 9, borderRadius: 999, background: WS.gold }} />
      </span>
    </button>
  );
}

function getPriorityTone(priority) {
  if (priority === 'critical') return WS.red;
  if (priority === 'important') return WS.gold;
  return WS.green;
}

function getWorkspaceAction(actions, target) {
  const map = {
    dashboard: actions.openDashboard,
    profile: actions.openProfile,
    growth: actions.openPartners,
    content: actions.openNews,
    events: actions.openEvents,
    booking: actions.openBooking,
    dialogs: actions.openDialogs,
    offers: actions.openOffers,
    clients: actions.openExperts,
    reviews: actions.openReviews,
    analytics: actions.openAnalytics,
    finance: actions.openFinance,
    notifications: actions.openMessages,
    settings: actions.openCabinet,
    loki: actions.openLoki,
  };
  return map[target] || actions.openDashboard;
}

function profileEvents(events = [], profile = {}, roleId = '') {
  if (!profile?.id) return [];
  return events.filter(event => {
    if (roleId === 'expert') return event.expertId === profile.id || event.submittedProfileId === profile.id || event.proposalAuthorType === 'expert' && event.submittedProfileName === profile.name;
    if (roleId === 'partner') return event.partnerId === profile.id || event.submittedProfileId === profile.id || event.proposalAuthorType === 'partner' && event.submittedProfileName === profile.name;
    return false;
  });
}

function WorkspaceProfileSection({ role, profile, events = [], roleState, onRoleChange, onSaved, onOpenPanel, onToast }) {
  if (!role || !['partner', 'expert'].includes(role.id) || !profile?.id) {
    return (
      <PlaceholderSection
        title="Мой профиль"
        text="Для редактирования карточки нужен привязанный профиль партнёра или эксперта. Администраторские системные разделы остаются в админке."
        actions={[
          { label: 'Открыть админку', tone: 'gold', onClick: () => onOpenPanel?.('admin') },
        ]}
      />
    );
  }

  const snapshot = buildCabinetSnapshot({ role, profile, events, reviews: [] });
  const publicUrl = getCabinetPublicUrl(snapshot);
  const relatedEvents = profileEvents(events, profile, role.id);
  const statusText = profile.moderationStatus === 'pending_review' || profile.profileModerationStatus === 'pending_review'
    ? 'Изменения ожидают проверки.'
    : 'Изменения публикуются сразу в вашу карточку.';

  return (
    <div data-workspace-profile-editor style={{ display: 'grid', gap: 14 }}>
      <Panel title="Мой профиль" style={{ padding: 18, background: 'rgba(255,255,255,0.82)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: roleState?.hasMultipleRoles ? 'minmax(0,1fr) auto' : 'minmax(0,1fr)', gap: 14, alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: WS.gold, fontSize: 12, lineHeight: '15px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: 0.6 }}>{role.id === 'expert' ? 'Профиль эксперта' : 'Профиль партнёра'}</div>
            <div style={{ color: WS.text, fontSize: 24, lineHeight: '29px', fontWeight: 950, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name || 'Карточка АПГ'}</div>
            <div style={{ color: WS.soft, fontSize: 13.5, lineHeight: '20px', marginTop: 6 }}>{statusText}</div>
          </div>
          {roleState?.hasMultipleRoles && (
            <div style={{ display: 'flex', gap: 6, padding: 5, borderRadius: 18, background: 'rgba(88,67,37,0.06)' }}>
              {roleState.roles.filter(item => ['partner', 'expert'].includes(item.id)).map(item => (
                <button key={item.id} type="button" onClick={() => onRoleChange?.(item.id)} style={buttonStyle({ minHeight: 38, borderRadius: 15, padding: '8px 12px', background: item.id === role.id ? 'linear-gradient(135deg,#F6D891,#D0A14C)' : 'rgba(255,255,255,0.62)', color: item.id === role.id ? '#24190B' : WS.text })}>
                  {item.id === 'expert' ? 'Профиль эксперта' : 'Профиль партнёра'}
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>
      <DigitalShowcaseBuilder
        role={role}
        profile={profile}
        relatedEvents={relatedEvents}
        onSaved={updated => onSaved?.(role.id, updated)}
        onOpenModule={module => {
          if (module === 'events') onOpenPanel?.('events');
        }}
        onToast={onToast}
        publicUrl={publicUrl}
      />
    </div>
  );
}

function IntelligenceTaskRow({ item, actions }) {
  const tone = getPriorityTone(item.priority);
  const onClick = getWorkspaceAction(actions, item.target);
  return (
    <button type="button" onClick={onClick} title={item.reason} style={{ border: 0, background: 'transparent', padding: '9px 0', borderBottom: `1px solid ${WS.line}`, display: 'grid', gridTemplateColumns: '30px minmax(0,1fr) auto', gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 30, height: 30, borderRadius: 12, background: `${tone}17`, color: tone, display: 'grid', placeItems: 'center', fontSize: 13 }}>{item.priorityIcon || '●'}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: WS.text, fontSize: 14, lineHeight: '18px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
        <span style={{ display: 'block', color: WS.soft, fontSize: 12, lineHeight: '16px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
      </span>
      <span style={{ borderRadius: 999, background: `${tone}16`, color: tone, padding: '6px 9px', fontSize: 11.5, lineHeight: '13px', fontWeight: 890 }}>{item.action || item.priorityLabel}</span>
    </button>
  );
}

function WorkspaceIntelligenceDashboard({ plan, actions }) {
  if (!plan) return null;
  const counts = [
    ['🟢', plan.summary?.quickTasks || 0, 'быстрые'],
    ['🟡', plan.summary?.importantTasks || 0, 'важные'],
    ['🔴', plan.summary?.criticalProblems || 0, 'критичные'],
  ];
  const expected = [
    `${plan.summary?.expectedEvents || 0} мероприятия`,
    `${plan.summary?.forecastClients || 0} клиента прогноз`,
    plan.summary?.topNews || 'новая публикация',
  ];
  return (
    <section data-workspace-intelligence-dashboard style={cardStyle({ padding: 18, borderRadius: 26, background: 'linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,248,232,0.82))', boxShadow: '0 18px 54px rgba(82,60,30,0.10)' })}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(390px,0.95fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: WS.gold, fontSize: 12, lineHeight: '15px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: 0.6 }}>Workspace Intelligence</div>
          <h1 style={{ margin: '7px 0 0', color: WS.text, fontSize: 29, lineHeight: '34px', fontWeight: 950, letterSpacing: -0.55 }}>{plan.greeting}</h1>
          <div style={{ color: WS.soft, fontSize: 14.5, lineHeight: '21px', marginTop: 8 }}>Сегодня Workspace ведёт вас по рабочему дню: что произошло, где проблема и какое действие принесёт пользу.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 14 }}>
            {counts.map(([icon, value, label]) => (
              <div key={label} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.72)', border: `1px solid ${WS.line}`, padding: 12 }}>
                <div style={{ color: WS.text, fontSize: 22, lineHeight: '24px', fontWeight: 950 }}>{icon} {value}</div>
                <div style={{ color: WS.soft, fontSize: 12.5, lineHeight: '16px', marginTop: 5 }}>{label} задачи</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 13, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {expected.map(item => <span key={item} style={{ borderRadius: 999, padding: '7px 10px', background: 'rgba(201,155,60,0.12)', color: '#8A6422', fontSize: 12.5, fontWeight: 850 }}>{item}</span>)}
          </div>
        </div>
        <Panel title="План на сегодня" style={{ padding: 16, boxShadow: 'none', background: 'rgba(255,255,255,0.72)' }}>
          <div style={{ display: 'grid' }}>
            {(plan.tasks || []).slice(0, 5).map(item => <IntelligenceTaskRow key={item.id} item={item} actions={actions} />)}
          </div>
        </Panel>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.95fr) minmax(0,1.05fr) minmax(320px,0.72fr)', gap: 14, marginTop: 14 }}>
        <Panel title="Что изменилось" style={{ padding: 16, boxShadow: 'none' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {(plan.changes || []).slice(0, 4).map(item => <div key={item} style={{ color: WS.soft, fontSize: 13.2, lineHeight: '18px' }}>• {item}</div>)}
          </div>
        </Panel>
        <Panel title="Требует внимания" style={{ padding: 16, boxShadow: 'none' }}>
          <div style={{ display: 'grid', gap: 9 }}>
            {(plan.attention || []).slice(0, 3).map(item => {
              const tone = getPriorityTone(item.priority);
              return (
                <button key={item.title} type="button" onClick={getWorkspaceAction(actions, item.target)} title={`Мы рекомендуем это, потому что: ${item.reason}`} style={{ border: `1px solid ${tone}20`, background: `${tone}08`, borderRadius: 15, padding: 10, display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 8, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span>{item.priorityIcon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: WS.text, fontSize: 13.2, lineHeight: '17px', fontWeight: 890, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <span style={{ display: 'block', color: WS.soft, fontSize: 11.7, lineHeight: '15px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reason}</span>
                  </span>
                  <span style={{ color: tone, fontSize: 11.5, fontWeight: 900 }}>{item.action}</span>
                </button>
              );
            })}
          </div>
        </Panel>
        <Panel title="Мини-аналитика" style={{ padding: 16, boxShadow: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 6 }}>
            {(plan.miniAnalytics || []).slice(0, 5).map(item => (
              <div key={item.label} style={{ borderRadius: 13, background: 'rgba(88,67,37,0.05)', padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ color: WS.text, fontSize: 15, lineHeight: '18px', fontWeight: 950 }}>{item.value}</div>
                <div style={{ color: WS.soft, fontSize: 10.5, lineHeight: '13px', marginTop: 3 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 11, borderTop: `1px solid ${WS.line}`, paddingTop: 10 }}>
            <div style={{ color: WS.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 900 }}>💡 Совет Локи</div>
            <div style={{ color: WS.soft, fontSize: 12.3, lineHeight: '17px', marginTop: 4 }}>{plan.lokiAdvice?.text}</div>
            <button type="button" onClick={getWorkspaceAction(actions, plan.lokiAdvice?.target || 'loki')} style={buttonStyle({ minHeight: 32, borderRadius: 14, padding: '7px 11px', marginTop: 9, background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B' })}>{plan.lokiAdvice?.action || 'Открыть'}</button>
          </div>
        </Panel>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 13 }}>
        {(plan.opportunities || []).slice(0, 4).map(item => (
          <button key={item.title} type="button" onClick={getWorkspaceAction(actions, item.target)} style={buttonStyle({ minHeight: 34, borderRadius: 999, padding: '7px 11px', background: 'rgba(255,255,255,0.72)', color: WS.text, boxShadow: 'inset 0 0 0 1px rgba(88,67,37,0.08)' })}>{item.title}</button>
        ))}
      </div>
    </section>
  );
}

function WorkspaceDashboard({ data, actions, workspaceView, intelligence, dayPlan }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const tasks = getRoleSpecificTasks({ view: workspaceView, data, profileStatus, actions });
  const fallbackEvents = [
    { id: 'fallback-1', title: '9-й Большой Нетворкинг', eventDate: '2026-07-22', time: '11:00 – 16:00', place: 'Зеленоград, к1462' },
    { id: 'fallback-2', title: 'Бизнес-завтрак с экспертами', eventDate: '2026-07-25', time: '09:30 – 11:30', place: 'Онлайн' },
    { id: 'fallback-3', title: 'Мастер-класс по продвижению', eventDate: '2026-07-30', time: '14:00 – 17:00', place: 'Зеленоград, к1401' },
  ];
  const visibleTasks = tasks.slice(0, 3);
  const visibleEvents = data.events.length ? data.events.slice(0, 2) : fallbackEvents.slice(0, 2);
  const visibleMessages = data.notifications.length ? data.notifications.slice(0, 3) : [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
  const dashboardSignals = intelligence?.signals?.length ? intelligence.signals.slice(0, 3) : [
    'Локи начнёт подсказывать приоритеты после накопления активности.',
    'Workspace уже собирает события через Intelligence Platform.',
  ];

  return (
    <div data-workspace-v2-dashboard data-workspace-role-view={workspaceView.id} style={{ display: 'grid', gap: 14 }}>
      <WorkspaceIntelligenceDashboard plan={dayPlan} actions={actions} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.12fr) minmax(390px,0.88fr)', gap: 14 }}>
        <DashboardHero data={data} profileStatus={profileStatus} workspaceView={workspaceView} actions={actions} />
        <MetricsPanel data={data} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.05fr) minmax(0,1fr)', gap: 14, alignItems: 'stretch' }}>
        <Panel title="Задачи и уведомления" action={<button type="button" style={buttonStyle({ minHeight: 32, padding: '6px 10px', background: 'transparent', boxShadow: 'none', color: WS.soft })}>Все задачи⌄</button>} style={{ padding: 18 }}>
          <div style={{ display: 'grid' }}>
            {visibleTasks.map(task => <TaskRow key={task.title} {...task} />)}
          </div>
        </Panel>
        <Panel title="Ближайшие мероприятия" action={<button type="button" onClick={actions.openEvents} style={buttonStyle({ minHeight: 32, padding: '6px 10px', background: 'transparent', boxShadow: 'none', color: WS.soft })}>Все мероприятия⌄</button>} style={{ padding: 18 }}>
          <div style={{ display: 'grid' }}>
            {visibleEvents.map((event, index) => <EventRow key={event.id || index} event={event} index={index} onClick={actions.openEvents} />)}
          </div>
        </Panel>
        <Panel title="Новые сообщения" action={<button type="button" onClick={actions.openMessages} style={buttonStyle({ minHeight: 32, padding: '6px 10px', background: 'transparent', boxShadow: 'none', color: WS.soft })}>Все сообщения⌄</button>} style={{ padding: 18 }}>
          <div style={{ display: 'grid' }}>
            {visibleMessages.map((item, index) => <MessageRow key={item.id || index} item={item} index={index} onClick={actions.openMessages} />)}
          </div>
        </Panel>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(330px,0.55fr)', gap: 14, alignItems: 'stretch' }}>
        <Panel title="Рекомендации Локи" action={<button type="button" onClick={actions.openLoki} style={buttonStyle({ minHeight: 32, padding: '6px 10px', background: 'transparent', boxShadow: 'none', color: WS.soft })}>Открыть Локи⌄</button>} style={{ padding: 18 }}>
          <div style={{ display: 'grid', gap: 9 }}>
            {dashboardSignals.map((signal, index) => (
              <button key={`${signal}-${index}`} type="button" onClick={actions.openLoki} style={{ border: 0, borderBottom: index < dashboardSignals.length - 1 ? `1px solid ${WS.line}` : 0, background: 'transparent', padding: '8px 0', display: 'grid', gridTemplateColumns: '32px 1fr', gap: 10, alignItems: 'start', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ width: 32, height: 32, borderRadius: 13, background: 'rgba(201,155,60,0.14)', color: '#A8741F', display: 'grid', placeItems: 'center', fontWeight: 930 }}>✦</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', color: WS.text, fontSize: 14.5, lineHeight: '19px', fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{signal}</span>
                  <span style={{ display: 'block', color: WS.soft, fontSize: 12.5, lineHeight: '17px', marginTop: 3 }}>Из AI Context, Activity Timeline и рекомендаций</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Быстрые действия" style={{ padding: 18 }}>
          <div style={{ display: 'grid', gap: 9 }}>
            {[
              { label: 'Привлечь клиентов', onClick: actions.openPartners },
              { label: 'Создать контент', onClick: actions.openNews },
              { label: 'Проверить аналитику', onClick: actions.openAnalytics },
            ].map(item => (
              <button key={item.label} type="button" onClick={item.onClick} style={{ border: `1px solid ${WS.line}`, background: 'rgba(255,255,255,0.68)', borderRadius: 15, padding: '10px 12px', color: WS.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 860, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>{item.label}</button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function EmptyWidget({ text }) {
  return <div style={cardStyle({ padding: 18, color: WS.soft, fontSize: 14, lineHeight: '20px', boxShadow: 'none' })}>{text}</div>;
}

function PlaceholderSection({ title, text, actions = [] }) {
  return (
    <Panel title={title}>
      <div style={{ color: WS.soft, fontSize: 15, lineHeight: '22px', marginBottom: actions.length ? 18 : 0 }}>{text}</div>
      {!!actions.length && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {actions.map(action => <WorkspaceButton key={action.id || action.label} onClick={action.onClick} style={action.tone === 'gold' ? { background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B' } : null}>{action.label}</WorkspaceButton>)}
        </div>
      )}
    </Panel>
  );
}

function DataSection({ type, title, subtitle, items = [], emptyText, onOpen }) {
  const visible = items.slice(0, 8);
  return (
    <Panel title={title} action={<WorkspaceButton onClick={onOpen} style={{ minHeight: 38, borderRadius: 16, padding: '8px 13px', background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B' }}>Открыть раздел</WorkspaceButton>}>
      {subtitle && <div style={{ color: WS.soft, fontSize: 15, lineHeight: '21px', margin: '-8px 0 18px' }}>{subtitle}</div>}
      {!visible.length ? <EmptyWidget text={emptyText} /> : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${type === 'news' || type === 'events' ? 280 : 230}px, 1fr))`, gap: 14 }}>
          {visible.map((item, index) => {
            if (type === 'news') return <NewsCard key={item.id || index} item={item} index={index} onOpen={onOpen} />;
            if (type === 'events') return <EventPosterCard key={item.id || index} event={item} index={index} onClick={onOpen} compact />;
            if (type === 'partners') return <PartnerCard key={item.id || index} partner={item} onOpen={() => onOpen?.(item)} />;
            if (type === 'experts') return <ExpertCardV2 key={item.id || index} expert={item} onClick={onOpen} />;
            return <EmptyWidget key={item.id || index} text={safeTitle(item)} />;
          })}
        </div>
      )}
    </Panel>
  );
}

function BookingStatusBadge({ item }) {
  const tone = bookingStatusTone(item.status);
  return (
    <span style={{ borderRadius: 999, background: `${tone}16`, color: tone, padding: '6px 9px', fontSize: 11.5, lineHeight: '13px', fontWeight: 900, whiteSpace: 'nowrap' }}>
      {item.statusLabel || 'Статус'}
    </span>
  );
}

function MeetingMiniRow({ item, onClick, compact = false }) {
  const tone = bookingStatusTone(item.status);
  const time = item.time || toDate(item.startAt)?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) || '—';
  return (
    <button type="button" onClick={onClick} style={{ border: 0, borderBottom: `1px solid ${WS.line}`, background: 'transparent', padding: compact ? '8px 0' : '10px 0', display: 'grid', gridTemplateColumns: compact ? '50px minmax(0,1fr)' : '60px minmax(0,1fr) auto', gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ minHeight: 36, borderRadius: 14, background: `${tone}14`, color: tone, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 950 }}>{time}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: WS.text, fontSize: compact ? 13 : 14.2, lineHeight: compact ? '17px' : '18px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.userName || 'Клиент'} · {item.serviceTitle || 'Услуга'}</span>
        <span style={{ display: 'block', color: WS.soft, fontSize: compact ? 11.8 : 12.3, lineHeight: '16px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.specialistName || 'Специалист'} · {bookingDayText(item)}</span>
      </span>
      {!compact && <BookingStatusBadge item={item} />}
    </button>
  );
}

function MeetingSheet({ item, onClose, onAction, onOpenDialog }) {
  if (!item) return null;
  const canConfirm = [BOOKING_STATUSES.pending, BOOKING_STATUSES.new].includes(item.status);
  const canComplete = [BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status);
  const canCancel = item.isActive;
  return (
    <section data-workspace-meeting-sheet style={cardStyle({ padding: 18, borderRadius: 26, background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,250,239,0.88))', display: 'grid', gap: 14 })}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: WS.gold, fontSize: 12, lineHeight: '15px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: 0.6 }}>Карточка встречи</div>
          <h2 style={{ margin: '7px 0 0', color: WS.text, fontSize: 24, lineHeight: '29px', fontWeight: 950, letterSpacing: -0.35 }}>{item.userName || 'Клиент'}</h2>
          <div style={{ color: WS.soft, fontSize: 14, lineHeight: '20px', marginTop: 6 }}>{item.serviceTitle || 'Услуга'} · {bookingTimeText(item)} · {item.durationMinutes || 60} мин</div>
        </div>
        <button type="button" onClick={onClose} style={buttonStyle({ width: 38, minHeight: 38, padding: 0, borderRadius: 14, background: 'rgba(88,67,37,0.06)' })}>×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 9 }}>
        {[
          ['Статус', item.statusLabel || '—'],
          ['Специалист', item.specialistName || '—'],
          ['Телефон', item.userPhone || '—'],
          ['Диалог', item.dialogId ? 'есть' : 'нет'],
        ].map(([label, value]) => (
          <div key={label} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.72)', border: `1px solid ${WS.line}`, padding: 10, minWidth: 0 }}>
            <div style={{ color: WS.muted, fontSize: 11.5, lineHeight: '14px', fontWeight: 800 }}>{label}</div>
            <div style={{ color: WS.text, fontSize: 13.5, lineHeight: '17px', fontWeight: 900, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
          </div>
        ))}
      </div>
      {item.comment && <div style={{ borderRadius: 18, background: 'rgba(88,67,37,0.05)', color: WS.soft, fontSize: 13.2, lineHeight: '19px', padding: 12 }}>{item.comment}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canConfirm && <WorkspaceButton onClick={() => onAction('booking:confirm', item)} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px', background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B' }}>Подтвердить</WorkspaceButton>}
        {item.status === BOOKING_STATUSES.rescheduleRequested && <WorkspaceButton onClick={() => onAction('booking:respondReschedule', item, { decision: 'accept' })} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px', background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B' }}>Принять перенос</WorkspaceButton>}
        {item.status === BOOKING_STATUSES.rescheduleRequested && <WorkspaceButton onClick={() => onAction('booking:respondReschedule', item, { decision: 'reject', reason: 'Отклонено в Workspace' })} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px' }}>Отклонить</WorkspaceButton>}
        {canComplete && <WorkspaceButton onClick={() => onAction('booking:complete', item)} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px' }}>Завершить</WorkspaceButton>}
        {canComplete && <WorkspaceButton onClick={() => onAction('booking:noShow', item, { reason: 'Клиент не пришел' })} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px' }}>Неявка</WorkspaceButton>}
        {canCancel && <WorkspaceButton onClick={() => {
          const reason = prompt('Причина отмены') || '';
          if (reason.trim()) onAction('booking:cancel', item, { reason: reason.trim() });
        }} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px' }}>Отменить</WorkspaceButton>}
        <WorkspaceButton onClick={() => onOpenDialog(item)} style={{ minHeight: 36, borderRadius: 15, padding: '8px 12px' }}>Открыть диалог</WorkspaceButton>
      </div>
    </section>
  );
}

function WorkspaceMeetings({ role, profile, actions, onOpenDialog }) {
  const providerType = role?.id === 'expert' ? 'expert' : 'partner';
  const bookingProfile = useMemo(() => buildBookingProfile(profile || {}, providerType), [profile, providerType]);
  const [calendarMode, setCalendarMode] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1180 ? 'week' : 'day');
  const [statusFilter, setStatusFilter] = useState('all');
  const [specialistFilter, setSpecialistFilter] = useState('');
  const [query, setQuery] = useState('');
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadBookings = async () => {
    if (!profile?.id || loading) return;
    setLoading(true);
    setError('');
    try {
      const range = bookingDateRange(calendarMode);
      const result = await userAction('booking:calendar', {
        providerType,
        providerId: profile.id,
        from: range.from,
        to: range.to,
        specialistId: specialistFilter,
        status: '',
      });
      setBookings(Array.isArray(result.bookings) ? result.bookings.map(normalizeBooking) : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить встречи');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [profile?.id, providerType, calendarMode, specialistFilter]);

  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  }, []);
  const groups = useMemo(() => groupBookingsForProfile(bookings), [bookings]);
  const stats = useMemo(() => ({
    today: bookings.filter(item => isSameBookingDay(item, today)).length,
    pending: groups.pending.length + groups.actionRequired.length,
    confirmed: bookings.filter(item => [BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status)).length,
    cancelled: groups.cancelled.length,
    completed: groups.completed.filter(item => item.status === BOOKING_STATUSES.completed).length,
    noShow: groups.completed.filter(item => item.status === BOOKING_STATUSES.noShow).length,
  }), [bookings, groups, today]);
  const filteredBookings = useMemo(() => {
    const text = query.trim().toLowerCase();
    return bookings
      .filter(item => {
        if (statusFilter === 'today') return isSameBookingDay(item, today);
        if (statusFilter === 'tomorrow') return isSameBookingDay(item, tomorrow);
        if (statusFilter === 'pending') return [BOOKING_STATUSES.pending, BOOKING_STATUSES.new, BOOKING_STATUSES.rescheduleRequested].includes(item.status);
        if (statusFilter === 'confirmed') return [BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status);
        if (statusFilter === 'cancelled') return groups.cancelled.some(row => row.id === item.id);
        if (statusFilter === 'completed') return [BOOKING_STATUSES.completed, BOOKING_STATUSES.noShow].includes(item.status);
        return true;
      })
      .filter(item => !text || bookingSearchText(item).includes(text));
  }, [bookings, groups.cancelled, query, statusFilter, today, tomorrow]);
  const calendarItems = useMemo(() => buildBookingCalendar({ bookings: filteredBookings, ...bookingDateRange(calendarMode), specialistId: specialistFilter, status: '' }), [filteredBookings, calendarMode, specialistFilter]);
  const todayItems = useMemo(() => bookings.filter(item => isSameBookingDay(item, today)).sort((a, b) => bookingStartMinute(a) - bookingStartMinute(b)), [bookings, today]);
  const tomorrowItems = useMemo(() => bookings.filter(item => isSameBookingDay(item, tomorrow)).sort((a, b) => bookingStartMinute(a) - bookingStartMinute(b)), [bookings, tomorrow]);
  const upcomingItems = useMemo(() => groups.upcoming.slice(0, 8), [groups.upcoming]);
  const slotTimes = useMemo(() => {
    const configured = Array.isArray(profile?.bookingSlotTimes) && profile.bookingSlotTimes.length ? profile.bookingSlotTimes : ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00'];
    return configured.slice(0, 10);
  }, [profile]);

  const runLifecycle = async (action, item, payload = {}) => {
    try {
      const result = await userAction(action, { bookingId: item.id || item.bookingId, ...payload });
      if (result?.booking) {
        const next = normalizeBooking(result.booking);
        setBookings(prev => prev.map(row => String(row.id || row.bookingId) === String(next.id || next.bookingId) ? next : row));
        setSelectedBooking(next);
      } else {
        await loadBookings();
      }
    } catch (err) {
      setError(err?.message || 'Не удалось обновить встречу');
    }
  };

  const openDialog = item => {
    if (item?.dialogId) {
      onOpenDialog?.(item.dialogId);
      return;
    }
    actions.openDialogs();
  };

  if (!profile?.id || !['partner', 'expert'].includes(role?.id)) {
    return <PlaceholderSection title="Встречи" text="Раздел доступен партнёрам и экспертам после выбора рабочего профиля." actions={[{ label: 'Открыть кабинет', onClick: actions.openCabinet, tone: 'gold' }]} />;
  }

  const filterButtons = [
    ['all', 'Все'],
    ['today', 'Сегодня'],
    ['tomorrow', 'Завтра'],
    ['pending', 'Ожидают'],
    ['confirmed', 'Подтверждённые'],
    ['cancelled', 'Отменённые'],
    ['completed', 'Завершённые'],
  ];

  return (
    <div data-workspace-meetings style={{ display: 'grid', gap: 14 }}>
      <section style={cardStyle({ padding: 18, borderRadius: 28, background: 'linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,248,232,0.82))' })}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 14, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: WS.gold, fontSize: 12, lineHeight: '15px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: 0.6 }}>Встречи</div>
            <h1 style={{ margin: '7px 0 0', color: WS.text, fontSize: 28, lineHeight: '34px', fontWeight: 950, letterSpacing: -0.55 }}>Календарь ежедневной работы</h1>
            <div style={{ color: WS.soft, fontSize: 14.5, lineHeight: '21px', marginTop: 7 }}>{bookingProfile.title}: кто записан сегодня, кого подтвердить и где есть свободное время.</div>
          </div>
          <WorkspaceButton onClick={loadBookings} style={{ minHeight: 40, borderRadius: 16, padding: '8px 13px', background: loading ? 'rgba(88,67,37,0.06)' : 'linear-gradient(135deg,#F6D891,#D0A14C)', color: loading ? WS.soft : '#24190B' }}>{loading ? 'Обновляем...' : 'Обновить'}</WorkspaceButton>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10, marginTop: 16 }}>
          {[
            ['Сегодня', stats.today, WS.blue],
            ['Ожидают', stats.pending, WS.gold],
            ['Подтверждены', stats.confirmed, WS.green],
            ['Отменены', stats.cancelled, WS.red],
            ['Завершены', stats.completed, WS.green],
            ['Неявка', stats.noShow, WS.red],
          ].map(([label, value, tone]) => (
            <div key={label} style={{ borderRadius: 18, background: 'rgba(255,255,255,0.74)', border: `1px solid ${WS.line}`, padding: 12 }}>
              <div style={{ color: tone, fontSize: 22, lineHeight: '25px', fontWeight: 950 }}>{value}</div>
              <div style={{ color: WS.soft, fontSize: 12.4, lineHeight: '16px', marginTop: 4, fontWeight: 760 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {error && <div style={cardStyle({ padding: 12, borderRadius: 18, background: 'rgba(217,93,84,0.10)', color: WS.red, boxShadow: 'none', fontSize: 13.5, fontWeight: 820 })}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: 14, alignItems: 'start' }}>
        <Panel title="Календарь" action={<div style={{ display: 'flex', gap: 6 }}>{['day', 'week', 'month'].map(mode => <button key={mode} type="button" onClick={() => setCalendarMode(mode)} style={buttonStyle({ minHeight: 32, borderRadius: 13, padding: '6px 10px', background: calendarMode === mode ? 'linear-gradient(135deg,#F6D891,#D0A14C)' : 'rgba(255,255,255,0.68)', color: calendarMode === mode ? '#24190B' : WS.text })}>{mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}</button>)}</div>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 220px', gap: 10, marginBottom: 12 }}>
            <label style={{ minHeight: 42, borderRadius: 16, background: 'rgba(255,255,255,0.72)', border: `1px solid ${WS.line}`, display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px' }}>
              <span style={{ color: WS.muted, fontSize: 17 }}>⌕</span>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Клиент, телефон, услуга, дата" style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', color: WS.text, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 680 }} />
            </label>
            <select value={specialistFilter} onChange={event => setSpecialistFilter(event.target.value)} style={{ minHeight: 42, borderRadius: 16, border: `1px solid ${WS.line}`, background: 'rgba(255,255,255,0.72)', color: WS.text, padding: '0 10px', fontFamily: 'inherit', fontWeight: 780 }}>
              <option value="">Все специалисты</option>
              {bookingProfile.specialists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {filterButtons.map(([id, label]) => (
              <button key={id} type="button" onClick={() => setStatusFilter(id)} style={buttonStyle({ minHeight: 32, borderRadius: 999, padding: '6px 10px', background: statusFilter === id ? 'rgba(201,155,60,0.18)' : 'rgba(255,255,255,0.66)', color: statusFilter === id ? '#8A6422' : WS.soft, boxShadow: `inset 0 0 0 1px ${statusFilter === id ? 'rgba(201,155,60,0.18)' : 'rgba(88,67,37,0.06)'}` })}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {!calendarItems.length ? <EmptyWidget text="Встреч на выбранный период нет. Свободные интервалы остаются доступными в карточке партнёра или эксперта." /> : calendarItems.map(item => {
              const time = item.time || toDate(item.startAt)?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) || '—';
              return (
                <button key={item.id || item.bookingId} type="button" onClick={() => setSelectedBooking(item)} style={{ border: `1px solid ${WS.line}`, background: 'rgba(255,255,255,0.70)', borderRadius: 18, padding: 12, display: 'grid', gridTemplateColumns: '86px minmax(0,1fr) auto', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ minHeight: 52, borderRadius: 16, background: `${bookingStatusTone(item.status)}14`, color: bookingStatusTone(item.status), display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 950 }}>{time}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: WS.text, fontSize: 15, lineHeight: '19px', fontWeight: 920, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookingDayText(item)} · {item.userName || 'Клиент'}</span>
                    <span style={{ display: 'block', color: WS.soft, fontSize: 12.8, lineHeight: '17px', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.serviceTitle || 'Услуга'} · {item.specialistName || 'Специалист'} · {item.durationMinutes || 60} мин</span>
                  </span>
                  <BookingStatusBadge item={item} />
                </button>
              );
            })}
          </div>
          {selectedBooking && <div style={{ marginTop: 14 }}><MeetingSheet item={selectedBooking} onClose={() => setSelectedBooking(null)} onAction={runLifecycle} onOpenDialog={openDialog} /></div>}
        </Panel>

        <div style={{ display: 'grid', gap: 14 }}>
          <Panel title="Ближайшие встречи">
            <div style={{ display: 'grid' }}>
              {upcomingItems.length ? upcomingItems.map(item => <MeetingMiniRow key={item.id || item.bookingId} item={item} onClick={() => setSelectedBooking(item)} />) : <EmptyWidget text="Ближайших подтверждённых встреч пока нет." />}
            </div>
          </Panel>
          <Panel title="Сегодня">
            <div style={{ display: 'grid' }}>
              {todayItems.length ? todayItems.slice(0, 5).map(item => <MeetingMiniRow key={item.id || item.bookingId} item={item} onClick={() => setSelectedBooking(item)} compact />) : <EmptyWidget text="Сегодня свободный день." />}
            </div>
          </Panel>
          <Panel title="Завтра">
            <div style={{ display: 'grid' }}>
              {tomorrowItems.length ? tomorrowItems.slice(0, 5).map(item => <MeetingMiniRow key={item.id || item.bookingId} item={item} onClick={() => setSelectedBooking(item)} compact />) : <EmptyWidget text="На завтра записей пока нет." />}
            </div>
          </Panel>
          <Panel title="Свободные интервалы">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 7 }}>
              {slotTimes.map(time => {
                const occupied = todayItems.some(item => (item.time || toDate(item.startAt)?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })) === time);
                return <span key={time} style={{ borderRadius: 13, background: occupied ? 'rgba(217,93,84,0.10)' : 'rgba(46,179,107,0.12)', color: occupied ? WS.red : WS.green, padding: '8px 9px', fontSize: 12.5, fontWeight: 900, textAlign: 'center' }}>{time}</span>;
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function getAnalyticsCount(analytics, key, fallback = 0) {
  const value = analytics?.[key];
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') return Object.values(value).reduce((sum, item) => sum + (Number(item) || 0), 0);
  return fallback;
}

function normalizeRecommendationRows(recommendations = {}) {
  return [
    ...(recommendations.events || []),
    ...(recommendations.partners || []),
    ...(recommendations.news || []),
    ...(recommendations.experts || []),
    ...(recommendations.tasks || []),
    ...(recommendations.feed || []),
  ]
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex(row => String(row.id || row.item?.id || row.title) === String(item.id || item.item?.id || item.title)) === index)
    .slice(0, 6);
}

function buildWorkspaceIntelligence({ data, analytics, activityTimeline, recommendations, dailySummary }) {
  const recRows = normalizeRecommendationRows(recommendations);
  const recentEvents = Array.isArray(activityTimeline) ? activityTimeline.slice(0, 8) : [];
  return {
    metrics: {
      screens: getAnalyticsCount(analytics, 'screenOpenings', dailySummary?.activeSections || 0),
      views: getAnalyticsCount(analytics, 'views', data.news.length + data.events.length),
      clicks: getAnalyticsCount(analytics, 'clicks', data.unreadCount || 0),
      registrations: getAnalyticsCount(analytics, 'registrations', data.events.length),
      qr: analytics?.qrScans?.started || analytics?.qrScans?.success || 0,
      comments: getAnalyticsCount(analytics, 'comments', 0),
    },
    signals: [
      recRows[0] ? `Локи рекомендует: ${safeTitle(recRows[0].item || recRows[0], 'рабочее действие')}` : null,
      dailySummary?.topRecommendation ? `Главный сигнал дня: ${safeTitle(dailySummary.topRecommendation.item || dailySummary.topRecommendation, 'рекомендация')}` : null,
      recentEvents[0] ? `Последнее событие: ${recentEvents[0].type || recentEvents[0].action || 'активность'}` : null,
      data.unreadCount ? `${data.unreadCount} входящих сигналов требуют реакции` : null,
    ].filter(Boolean).slice(0, 4),
    recommendations: recRows,
    timeline: recentEvents,
  };
}

function WorkspaceCenterHeader({ center, context }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 18, alignItems: 'start', marginBottom: 14 }}>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 999, background: 'rgba(201,155,60,0.13)', color: '#8A6422', fontSize: 12, fontWeight: 900, marginBottom: 10 }}>
          <span>{center.icon}</span>
          <span>{context.prompt}</span>
        </div>
        <h1 style={{ margin: 0, color: WS.text, fontSize: 31, lineHeight: '36px', fontWeight: 950, letterSpacing: -0.62 }}>{center.label}</h1>
        <div style={{ color: WS.soft, fontSize: 15, lineHeight: '22px', marginTop: 7, maxWidth: 780 }}>{center.subtitle}</div>
      </div>
      <div style={cardStyle({ padding: '11px 14px', borderRadius: 18, boxShadow: 'none', minWidth: 210 })}>
        <div style={{ color: WS.muted, fontSize: 11.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.5 }}>Следующий шаг</div>
        <div style={{ color: WS.text, fontSize: 14, lineHeight: '19px', fontWeight: 880, marginTop: 5 }}>{context.next}</div>
      </div>
    </div>
  );
}

function WorkModuleCard({ title, text, meta, action, tone = WS.gold, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ ...cardStyle({ padding: 15, borderRadius: 20, boxShadow: 'none', textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }), border: `1px solid ${tone}22` }}>
      <div style={{ color: tone, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>{meta}</div>
      <div style={{ color: WS.text, fontSize: 16, lineHeight: '20px', fontWeight: 920, marginTop: 7 }}>{title}</div>
      <div style={{ color: WS.soft, fontSize: 13, lineHeight: '19px', marginTop: 6 }}>{text}</div>
      {action && <div style={{ color: tone, fontSize: 12.5, lineHeight: '16px', fontWeight: 880, marginTop: 10 }}>{action} →</div>}
    </button>
  );
}

function IntelligencePanel({ intelligence, onOpenLoki }) {
  return (
    <Panel title="Интеллект Workspace" action={<WorkspaceButton onClick={onOpenLoki} style={{ minHeight: 36, borderRadius: 16, padding: '8px 12px', background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B' }}>Открыть Локи</WorkspaceButton>}>
      <div style={{ display: 'grid', gap: 9 }}>
        {(intelligence.signals.length ? intelligence.signals : ['Локи будет подсказывать рабочие приоритеты после накопления активности.']).map((signal, index) => (
          <div key={`${signal}-${index}`} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 9, alignItems: 'start', padding: '8px 0', borderBottom: index < intelligence.signals.length - 1 ? `1px solid ${WS.line}` : 0 }}>
            <span style={{ width: 28, height: 28, borderRadius: 12, background: 'rgba(201,155,60,0.14)', color: '#A8741F', display: 'grid', placeItems: 'center', fontWeight: 930 }}>{index + 1}</span>
            <span style={{ color: WS.soft, fontSize: 13.5, lineHeight: '19px' }}>{signal}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WorkspaceCenter({ center, data, actions, intelligence }) {
  const context = buildWorkspaceContext(center.id);
  return (
    <div data-workspace-center={center.id} style={{ display: 'grid', gap: 14 }}>
      <WorkspaceCenterHeader center={center} context={context} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        {center.metrics.map(metric => (
          <MetricTile key={metric.label} label={metric.label} value={metric.value} delta={metric.delta} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(320px,0.65fr)', gap: 14, alignItems: 'start' }}>
        <Panel title="Что сделать сейчас" action={center.primaryAction ? <WorkspaceButton onClick={center.primaryAction.onClick} style={{ minHeight: 36, borderRadius: 16, padding: '8px 12px', background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B' }}>{center.primaryAction.label}</WorkspaceButton> : null}>
          <div style={{ display: 'grid', gap: 10 }}>
            {center.tasks.map(task => <TaskRow key={task.title} {...task} />)}
          </div>
        </Panel>
        <IntelligencePanel intelligence={intelligence} onOpenLoki={actions.openLoki} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 14 }}>
        {center.modules.map(module => <WorkModuleCard key={module.title} {...module} />)}
      </div>
      <Panel title="Архитектура на будущее" style={{ padding: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {center.future.map(item => (
            <span key={item} style={{ borderRadius: 999, padding: '8px 11px', background: 'rgba(88,67,37,0.06)', color: WS.soft, fontSize: 12.5, fontWeight: 820 }}>{item}</span>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function buildCenterConfig({ id, data, actions, intelligence, businessHubAvailable, isAdminRole, onOpenAdmin, onOpenPanel, onOpenScan }) {
  const offers = data.partners.filter(item => item.offer);
  const reviewsCount = data.partners.reduce((sum, item) => sum + Number(item.reviewCount || item.reviewsCount || 0), 0);
  const baseFuture = ['несколько филиалов', 'несколько сотрудников', 'командные роли', 'история изменений'];
  const openBusiness = () => businessHubAvailable ? actions.openBusinessHub() : actions.openCabinet();
  const configs = {
    growth: {
      subtitle: 'Рабочий центр для привлечения новых клиентов: QR, ссылки, промокоды, соцсети и материалы продвижения.',
      metrics: [['QR', intelligence.metrics.qr || 0, 'сегодня'], ['Переходы', intelligence.metrics.clicks || 0, 'из событий'], ['Клиенты', Math.max(data.unreadCount || 0, 24), 'поток'], ['Промо', offers.length, 'активно']],
      tasks: [
        { icon: '◎', title: 'Проверить QR-точки', text: 'Убедиться, что сотрудники знают сценарий выдачи ключей', priority: 'Сегодня', tone: WS.gold, onClick: onOpenScan },
        { icon: '↗', title: 'Поделиться ссылкой-приглашением', text: 'Запустить быстрый поток из соцсетей и мессенджеров', priority: 'Рост', tone: WS.blue, onClick: () => onOpenPanel?.('referral') },
        { icon: '✧', title: 'Обновить промо-материалы', text: 'Подготовить пост, купон или рекламную карточку', priority: 'Маркетинг', tone: WS.green, onClick: () => onOpenPanel?.('offers') },
      ],
      modules: [
        { meta: 'QR', title: 'Коды и точки входа', text: 'Сценарии сканирования, выдачи ключей и визитов.', action: 'Открыть сканер', onClick: onOpenScan },
        { meta: 'Рефералы', title: 'Ссылки-приглашения', text: 'Готовая база для партнёрских ссылок и промокодов.', action: 'Открыть рефералы', onClick: () => onOpenPanel?.('referral') },
        { meta: 'Соцсети', title: 'Материалы продвижения', text: 'Посты, баннеры, истории и будущие рекламные наборы.' },
      ],
      future: [...baseFuture, 'промокоды', 'UTM-источники', 'рекламные кампании'],
    },
    content: {
      subtitle: 'Единый центр публикаций: новости, статьи, черновики, медиа, ИИ-редактор и история публикаций.',
      metrics: [['Материалов', data.news.length, 'в базе'], ['Черновики', Math.max(1, Math.round(data.news.length / 8)), 'готовятся'], ['Просмотры', intelligence.metrics.views || data.news.length, 'контент'], ['Рекомендации', intelligence.recommendations.filter(item => item.type === 'news').length, 'Локи']],
      tasks: [
        { icon: '✎', title: 'Подготовить публикацию', text: data.news[0] ? safeTitle(data.news[0], 'Последняя новость') : 'Лента ждёт первый материал', priority: 'Контент', tone: WS.blue, onClick: () => onOpenPanel?.('news') },
        { icon: '▧', title: 'Проверить черновики', text: 'Не оставлять незавершённые публикации без даты', priority: 'Редакция', tone: WS.gold },
        { icon: '✦', title: 'Спросить Локи о теме', text: 'Получить идею публикации на основе активности', priority: 'AI', tone: WS.green, onClick: actions.openLoki },
      ],
      modules: [
        { meta: 'Новости', title: 'Новости и статьи', text: 'Публикации, категории и история материалов.', action: 'Открыть новости', onClick: () => onOpenPanel?.('news') },
        { meta: 'Медиа', title: 'Фотографии и видео', text: 'Подготовка визуалов для карточек и публикаций.' },
        { meta: 'ИИ-редактор', title: 'Редактор АПГ', text: 'Основа для генерации и согласования публикаций.', action: 'Спросить Локи', onClick: actions.openLoki },
      ],
      future: [...baseFuture, 'согласование публикаций', 'отложенный постинг', 'совместное редактирование'],
    },
    events: {
      subtitle: 'Центр управления мероприятиями: календарь, регистрации, участники, посещаемость и статистика.',
      metrics: [['Событий', data.events.length, 'активно'], ['Регистрации', intelligence.metrics.registrations || data.events.length, 'сигнал'], ['Участники', data.events.reduce((sum, item) => sum + Number(item.participants || 0), 0), 'всего'], ['Прогноз', data.events.length ? 'Средний' : 'Нет', 'Локи']],
      tasks: [
        { icon: '□', title: 'Проверить ближайшее событие', text: data.events[0] ? safeTitle(data.events[0], 'Мероприятие') : 'Создайте первое мероприятие', priority: 'Календарь', tone: WS.red, onClick: () => onOpenPanel?.('events') },
        { icon: '▣', title: 'Проверить регистрации', text: 'Участники, лимиты мест и подтверждения', priority: 'Важно', tone: WS.gold, onClick: () => onOpenPanel?.('events') },
        { icon: '✎', title: 'Подготовить анонс', text: 'Связать событие с новостью и push-сценарием', priority: 'Контент', tone: WS.blue, onClick: () => onOpenPanel?.('news') },
      ],
      modules: [
        { meta: 'Календарь', title: 'Расписание', text: 'Список, календарь, черновики и конфликты времени.', action: 'Открыть афишу', onClick: () => onOpenPanel?.('events') },
        { meta: 'Участники', title: 'Регистрации', text: 'Будущий список гостей, посещаемость и экспорт.' },
        { meta: 'Статистика', title: 'Эффективность событий', text: 'Просмотры, заявки, визиты и повторные участия.' },
      ],
      future: [...baseFuture, 'экспорт участников', 'повторяющиеся события', 'модерация событий'],
    },
    booking: {
      subtitle: 'Рабочий календарь встреч: сегодня, завтра, подтверждения, отмены, завершения и свободные интервалы.',
      metrics: [['Сегодня', 'Календарь', 'день'], ['Ожидают', 'Проверить', 'статус'], ['Диалоги', data.dialogUnreadCount || 0, 'связь'], ['Напоминания', 'on', 'push']],
      tasks: [
        { icon: '📅', title: 'Проверить сегодняшние встречи', text: 'Кто придёт, кто ждёт подтверждения и где свободное окно', priority: 'Сегодня', tone: WS.gold, onClick: actions.openBooking },
        { icon: '✓', title: 'Подтвердить новые записи', text: 'Заявки не должны висеть без ответа', priority: 'Важно', tone: WS.red, onClick: actions.openBooking },
        { icon: '💬', title: 'Ответить в контекстных диалогах', text: 'Каждая запись связана с диалогом встречи', priority: 'Связь', tone: WS.blue, onClick: actions.openDialogs },
      ],
      modules: [
        { meta: 'Календарь', title: 'День, неделя, месяц', text: 'Свободные и занятые интервалы без перехода в Cabinet.', action: 'Открыть встречи', onClick: actions.openBooking },
        { meta: 'Статусы', title: 'Подтверждение и завершение', text: 'Подтвердить, перенести, отменить, завершить или отметить неявку.' },
        { meta: 'Диалог', title: 'Контекст встречи', text: 'Открытие связанной переписки прямо из карточки встречи.' },
      ],
      future: [...baseFuture, 'рабочие часы', 'исключения', 'недельное планирование', 'несколько филиалов'],
    },
    dialogs: {
      subtitle: 'Центр контекстных коммуникаций: вопросы по партнёрам, экспертам, мероприятиям, акциям и будущим записям.',
      metrics: [['Непрочитано', data.dialogUnreadCount || 0, 'сообщения'], ['Входящие', data.dialogNotifications.length || 0, 'диалоги'], ['Контексты', 4, 'типа'], ['Push', 'on', 'доставка']],
      tasks: [
        { icon: '💬', title: 'Ответить на новые вопросы', text: data.dialogUnreadCount ? `${data.dialogUnreadCount} сообщений ждут реакции` : 'Новых вопросов пока нет', priority: data.dialogUnreadCount ? 'Важно' : 'Спокойно', tone: data.dialogUnreadCount ? WS.red : WS.green, onClick: () => onOpenPanel?.('dialogs') },
        { icon: '▣', title: 'Проверить обращения по объектам', text: 'Каждый диалог привязан к партнёру, эксперту, мероприятию или акции', priority: 'Контекст', tone: WS.gold, onClick: () => onOpenPanel?.('dialogs') },
        { icon: '✦', title: 'Подготовить ответ с Локи', text: 'Локи видит карточку объекта и помогает отвечать точнее', priority: 'AI', tone: WS.blue, onClick: actions.openLoki },
      ],
      modules: [
        { meta: 'Диалоги', title: 'Контекстные обращения', text: 'Один объект — один диалог, без обычного свободного мессенджера.', action: 'Открыть диалоги', onClick: () => onOpenPanel?.('dialogs') },
        { meta: 'Локи', title: 'Помощь с ответом', text: 'Готовые ответы по данным карточки и истории обращения.', action: 'Открыть Локи', onClick: actions.openLoki },
        { meta: 'Push', title: 'Уведомления о сообщениях', text: 'Новые сообщения отправляются получателю через существующий push-канал.' },
      ],
      future: [...baseFuture, 'SLA ответов', 'назначение сотрудника', 'документы и голосовые сообщения'],
    },
    offers: {
      subtitle: 'Маркетинговый центр для акций, специальных предложений, подарков, купонов и бонусных программ.',
      metrics: [['Акций', offers.length, 'активно'], ['Ключи', data.userKeys || 0, 'баланс'], ['Подарки', Math.max(1, offers.length), 'механики'], ['Отклики', intelligence.metrics.clicks || 0, 'сигнал']],
      tasks: [
        { icon: '✧', title: 'Проверить активные акции', text: offers[0] ? safeTitle(offers[0], 'Акция партнёра') : 'Добавьте первое предложение', priority: 'Маркетинг', tone: WS.gold, onClick: () => onOpenPanel?.('offers') },
        { icon: '🎁', title: 'Подготовить подарок или купон', text: 'Сформировать причину вернуться', priority: 'Удержание', tone: WS.green },
        { icon: '◎', title: 'Связать акцию с QR', text: 'Ключи и визиты должны вести в одну механику', priority: 'Рост', tone: WS.blue, onClick: onOpenScan },
      ],
      modules: [
        { meta: 'Акции', title: 'Спецпредложения', text: 'Карточки, сроки, условия и аудитория.', action: 'Открыть акции', onClick: () => onOpenPanel?.('offers') },
        { meta: 'Бонусы', title: 'Ключи и купоны', text: 'Будущая бонусная программа партнёра.' },
        { meta: 'Розыгрыши', title: 'Подарки и призы', text: 'Связь с призами и городскими механиками.', action: 'Открыть подарки', onClick: () => onOpenPanel?.('rewards') },
      ],
      future: [...baseFuture, 'купоны', 'сегменты клиентов', 'A/B-акции'],
    },
    clients: {
      subtitle: 'Лёгкий CRM-контур: новые, постоянные, активные и давно не возвращавшиеся клиенты.',
      metrics: [['Новые', Math.max(data.unreadCount || 0, 8), 'сигнал'], ['Постоянные', Math.max(12, data.userCount || 0), 'аудитория'], ['Повторные', Math.max(4, offers.length), 'визиты'], ['Риск', 3, 'вернуть']],
      tasks: [
        { icon: '👥', title: 'Разобрать новых клиентов', text: 'Входящие заявки, QR-визиты и обращения', priority: 'Сегодня', tone: WS.gold, onClick: () => onOpenPanel?.('notifications') },
        { icon: '↺', title: 'Вернуть тех, кто давно не приходил', text: 'Основа для будущей retention-кампании', priority: 'Удержание', tone: WS.blue },
        { icon: '✦', title: 'Попросить Локи выбрать сегмент', text: 'Рекомендации по удержанию из активности', priority: 'AI', tone: WS.green, onClick: actions.openLoki },
      ],
      modules: [
        { meta: 'Сегменты', title: 'Новые и постоянные', text: 'Готовая архитектура CRM-сегментов.' },
        { meta: 'История', title: 'Взаимодействия', text: 'QR, заявки, комментарии, визиты и ответы.' },
        { meta: 'Удержание', title: 'Рекомендации', text: 'Кого вернуть и каким предложением.' },
      ],
      future: [...baseFuture, 'история клиента', 'избранные клиенты', 'retention-кампании'],
    },
    reviews: {
      subtitle: 'Центр отзывов: рейтинг, ответы, жалобы, полезные ответы и аналитика обратной связи.',
      metrics: [['Отзывы', reviewsCount || 8, 'всего'], ['Рейтинг', data.activeProfile?.rating || data.activeProfile?.avgRating || '4.9', 'средний'], ['Ответы', Math.max(2, Math.round((reviewsCount || 8) / 3)), 'нужны'], ['Жалобы', 0, 'открыто']],
      tasks: [
        { icon: '⭐', title: 'Ответить на новые отзывы', text: 'Скорость ответа влияет на доверие', priority: 'Репутация', tone: WS.gold },
        { icon: '▣', title: 'Проверить рейтинг', text: 'Найти темы, которые повторяются в обратной связи', priority: 'Аналитика', tone: WS.blue },
        { icon: '✦', title: 'Подготовить полезный ответ', text: 'Локи может предложить тон ответа', priority: 'AI', tone: WS.green, onClick: actions.openLoki },
      ],
      modules: [
        { meta: 'Отзывы', title: 'Все отзывы', text: 'Список, ответы и история диалогов.' },
        { meta: 'Рейтинг', title: 'Репутация', text: 'Динамика оценки и причины изменений.' },
        { meta: 'Жалобы', title: 'Сложные обращения', text: 'Отдельный контур эскалации.' },
      ],
      future: [...baseFuture, 'шаблоны ответов', 'тональность отзывов', 'жалобы и модерация'],
    },
    analytics: {
      subtitle: 'Единый аналитический центр: просмотры, переходы, QR, конверсия, клиенты, мероприятия и акции.',
      metrics: [['Просмотры', intelligence.metrics.views, 'события'], ['Переходы', intelligence.metrics.clicks, 'клики'], ['QR', intelligence.metrics.qr, 'сканы'], ['Разделы', intelligence.metrics.screens, 'открытия']],
      tasks: [
        { icon: '▥', title: 'Посмотреть важные изменения', text: intelligence.signals[0] || 'Локи покажет изменения по мере накопления событий', priority: 'Insight', tone: WS.gold, onClick: actions.openLoki },
        { icon: '◎', title: 'Проверить QR-конверсию', text: 'Сравнить сканы, визиты и начисления ключей', priority: 'Воронка', tone: WS.blue },
        { icon: '🎉', title: 'Оценить эффективность событий', text: 'Просмотры, регистрации и посещаемость', priority: 'События', tone: WS.green, onClick: () => onOpenPanel?.('events') },
      ],
      modules: [
        { meta: 'Воронка', title: 'Просмотры → действия', text: 'Переходы, клики, QR и регистрации.' },
        { meta: 'Контент', title: 'Популярные публикации', text: 'Какие новости приводят интерес.' },
        { meta: 'Источники', title: 'Каналы клиентов', text: 'Готовая точка для UTM и рефералов.' },
      ],
      future: [...baseFuture, 'источники клиентов', 'эффективность акций', 'прогноз посещаемости'],
    },
    finance: {
      subtitle: 'Финансовая архитектура кабинета: тариф, оплаты, счета, документы, выплаты, баланс и подписка.',
      metrics: [['Тариф', businessHubAvailable ? 'Активен' : 'Базовый', 'статус'], ['Счета', 0, 'к оплате'], ['Баланс', data.userKeys || 0, 'ключи'], ['Документы', 0, 'новые']],
      tasks: [
        { icon: '💰', title: 'Проверить тариф', text: 'Статус подписки и доступные возможности Workspace', priority: 'Финансы', tone: WS.gold, onClick: openBusiness },
        { icon: '▤', title: 'Подготовить документы', text: 'Счета, акты и будущий документооборот', priority: 'Документы', tone: WS.blue },
        { icon: '⚙', title: 'Проверить реквизиты', text: 'Данные организации и доступы сотрудников', priority: 'Настройки', tone: WS.green, onClick: openBusiness },
      ],
      modules: [
        { meta: 'Тариф', title: 'Подписка Workspace', text: 'Уровень доступа, лимиты и возможности.', action: businessHubAvailable ? 'Открыть Business Hub' : 'Открыть кабинет', onClick: openBusiness },
        { meta: 'Оплаты', title: 'История счетов', text: 'Готовый контур оплат и документов.' },
        { meta: 'Баланс', title: 'Выплаты и ключи', text: 'Финансовые показатели будущих программ.' },
      ],
      future: [...baseFuture, 'счета', 'акты', 'выплаты', 'мультифилиальность'],
    },
    notifications: {
      subtitle: 'Единый центр событий: сообщения, заявки, комментарии, регистрации, модерация, система и рекомендации Локи.',
      metrics: [['Входящие', data.unreadCount || 0, 'новые'], ['События', intelligence.timeline.length, 'timeline'], ['Комментарии', intelligence.metrics.comments, 'новые'], ['Регистрации', intelligence.metrics.registrations, 'сигнал']],
      tasks: [
        { icon: '🔔', title: 'Разобрать входящие события', text: data.unreadCount ? `${data.unreadCount} уведомлений ждут реакции` : 'Критичных входящих нет', priority: data.unreadCount ? 'Важно' : 'Спокойно', tone: data.unreadCount ? WS.red : WS.green, onClick: () => onOpenPanel?.('notifications') },
        { icon: '▣', title: 'Проверить регистрации и комментарии', text: 'События приходят из Event Bus через Activity Timeline', priority: 'Event Bus', tone: WS.gold },
        { icon: '✦', title: 'Открыть рекомендации Локи', text: 'Локи объяснит, что важнее разобрать первым', priority: 'AI', tone: WS.blue, onClick: actions.openLoki },
      ],
      modules: [
        { meta: 'Event Bus', title: 'Activity Timeline', text: 'Экран готов принимать события из платформы.' },
        { meta: 'Модерация', title: 'Заявки и комментарии', text: 'Будущая очередь согласований.' },
        { meta: 'Система', title: 'Сервисные уведомления', text: 'Ошибки, статусы и рекомендации.' },
      ],
      future: [...baseFuture, 'очереди модерации', 'SLA ответов', 'командные назначения'],
    },
    settings: {
      subtitle: 'Реальные настройки рабочего кабинета: профиль, роли, команда, филиалы, доступы и интеграции.',
      metrics: [['Профиль', `${getProfileCompletion(data.activeProfile).value}%`, 'готов'], ['Роли', 1, 'активно'], ['Филиалы', 1, 'готово'], ['Доступы', businessHubAvailable ? 'Hub' : 'Base', 'режим']],
      tasks: [
        { icon: '⚙', title: 'Проверить профиль', text: getProfileCompletion(data.activeProfile).missing.slice(0, 2).join(', ') || 'Профиль готов', priority: 'Профиль', tone: WS.gold, onClick: openBusiness },
        { icon: '👥', title: 'Подготовить команду', text: 'Будущие сотрудники и уровни доступа', priority: 'Команда', tone: WS.blue },
        { icon: '☷', title: 'Настроить филиалы', text: 'Основа для нескольких точек бизнеса', priority: 'Филиалы', tone: WS.green },
      ],
      modules: [
        { meta: 'Профиль', title: 'Карточка организации', text: 'Название, описание, контакты и визуалы.', action: 'Открыть кабинет', onClick: openBusiness },
        { meta: 'Команда', title: 'Сотрудники и роли', text: 'Права, согласования и совместная работа.' },
        { meta: 'Интеграции', title: 'Сервисы и уведомления', text: 'Будущие подключения и каналы.' },
      ],
      future: [...baseFuture, 'несколько ролей', 'согласование публикаций', 'внутренние задачи'],
    },
  };
  const selected = configs[id] || configs.growth;
  return {
    id,
    icon: NAV_ITEMS.find(item => item.id === id)?.icon || '▧',
    label: buildWorkspaceContext(id).label,
    primaryAction: selected.tasks?.[0] ? { label: 'Начать работу', onClick: selected.tasks[0].onClick } : null,
    ...selected,
    metrics: selected.metrics.map(([label, value, delta]) => ({ label, value, delta })),
  };
}

export function DesktopWorkspace({
  user,
  ownedPartner,
  ownedExpert,
  partners = [],
  experts = [],
  events = [],
  news = [],
  notifications = [],
  unreadCount = 0,
  userKeys = 0,
  userCount = 0,
  analytics = null,
  activityTimeline = [],
  recommendations = null,
  dailySummary = null,
  homeExperience = null,
  workspaceDayPlan = null,
  onModeChange,
  onOpenPanel,
  onOpenAdmin,
  onOpenScan,
  onOpenDialog,
  onEventChanged,
  onToast,
}) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [query, setQuery] = useState('');
  const [activeWorkspaceViewId, setActiveWorkspaceViewId] = useState(null);
  const [profileOverrides, setProfileOverrides] = useState({});
  const workspacePartner = profileOverrides.partner || ownedPartner;
  const workspaceExpert = profileOverrides.expert || ownedExpert;
  const roleState = useMemo(() => getCabinetRoles({ user, partner: workspacePartner, expert: workspaceExpert, preferredRole: activeWorkspaceViewId || undefined }), [user, workspacePartner, workspaceExpert, activeWorkspaceViewId]);
  const activeRole = roleState.roles.find(role => role.id === activeWorkspaceViewId) || roleState.activeRole;
  const activeRoleIdentity = useMemo(() => ({ ...(user || {}), role: activeRole?.id || user?.role || 'user' }), [activeRole?.id, user]);
  const isAdminRole = hasCapability(activeRoleIdentity, CAPABILITIES.canOpenAdminPanel);
  const businessHubFlag = useMemo(() => getBusinessHubFlag(), []);
  const businessHubAvailable = useMemo(() => canUseBusinessHub({ user, partner: workspacePartner, expert: workspaceExpert, flag: businessHubFlag }), [user, workspacePartner, workspaceExpert, businessHubFlag]);
  const activeProfile = activeRole?.id === 'expert' ? workspaceExpert : activeRole?.id === 'partner' ? workspacePartner : user;
  const userName = user?.firstName || user?.name || user?.displayName || 'Mr. TOREDO';
  const dialogNotifications = useMemo(() => notifications.filter(item => (item?.category === 'messages' || item?.type === 'contextDialogMessage') && item?.isRead !== true), [notifications]);
  const dialogUnreadCount = dialogNotifications.length || 0;
  const workspaceData = useMemo(() => ({ userName, activeProfile, partners, experts, events, news, notifications, dialogNotifications, dialogUnreadCount, unreadCount, userKeys, userCount, homeExperience }), [userName, activeProfile, partners, experts, events, news, notifications, dialogNotifications, dialogUnreadCount, unreadCount, userKeys, userCount, homeExperience]);
  const workspaceIntelligence = useMemo(() => buildWorkspaceIntelligence({ data: workspaceData, analytics, activityTimeline, recommendations, dailySummary }), [workspaceData, analytics, activityTimeline, recommendations, dailySummary]);
  const availableWorkspaceViews = useMemo(() => getWorkspaceRoleViews({ roles: roleState.roles, activeRole, ownedPartner: workspacePartner, ownedExpert: workspaceExpert, isAdminRole }), [roleState.roles, activeRole, workspacePartner, workspaceExpert, isAdminRole]);
  const workspaceView = availableWorkspaceViews.find(view => view.id === activeWorkspaceViewId) || availableWorkspaceViews[0] || WORKSPACE_ROLE_VIEWS.partner;
  const navItems = NAV_ITEMS.filter(item => item.id !== 'finance' || businessHubAvailable || isAdminRole || activeRole?.id === 'partner' || activeRole?.id === 'expert');

  const actions = {
    openDashboard: () => setActiveSection('dashboard'),
    openProfile: () => setActiveSection('profile'),
    openCabinet: () => setActiveSection('profile'),
    openBusinessHub: () => setActiveSection('settings'),
    openNews: () => setActiveSection('content'),
    openEvents: () => setActiveSection('events'),
    openBooking: () => setActiveSection('booking'),
    openPartners: () => setActiveSection('growth'),
    openExperts: () => setActiveSection('clients'),
    openReviews: () => setActiveSection('reviews'),
    openOffers: () => setActiveSection('offers'),
    openFinance: () => setActiveSection('finance'),
    openDialogs: () => setActiveSection('dialogs'),
    openMessages: () => setActiveSection('notifications'),
    openAnalytics: () => setActiveSection('analytics'),
    openLoki: () => onOpenPanel?.('loki'),
  };

  useEffect(() => {
    if (!availableWorkspaceViews.some(view => view.id === activeWorkspaceViewId)) {
      setActiveWorkspaceViewId(availableWorkspaceViews[0]?.id || 'partner');
    }
  }, [activeWorkspaceViewId, availableWorkspaceViews]);

  useEffect(() => {
    const onKeyDown = event => {
      const key = event.key?.toLowerCase();
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        document.querySelector('[placeholder="Поиск по АПГ..."]')?.focus?.();
      }
      if ((event.metaKey || event.ctrlKey) && key === '1') {
        event.preventDefault();
        setActiveSection('dashboard');
      }
      if ((event.metaKey || event.ctrlKey) && key === '2') {
        event.preventDefault();
        setActiveSection('profile');
      }
      if ((event.metaKey || event.ctrlKey) && key === '3') {
        event.preventDefault();
        setActiveSection('growth');
      }
      if ((event.metaKey || event.ctrlKey) && key === 'l') {
        event.preventDefault();
        actions.openLoki();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [businessHubAvailable, activeRole?.id]);

  const handleSelectNav = item => {
    if (item.id === 'settings') {
      if (isAdminRole && !businessHubAvailable) {
        setActiveSection('settings');
        return;
      }
      setActiveSection('settings');
      return;
    }
    setActiveSection(item.id);
  };

  const handleProfileSaved = (roleId, updatedProfile) => {
    if (!roleId || !updatedProfile?.id) return;
    setProfileOverrides(prev => ({ ...prev, [roleId]: updatedProfile }));
  };

  const renderContent = () => {
    if (activeSection === 'dashboard') return <WorkspaceDashboard data={workspaceData} actions={actions} workspaceView={workspaceView} intelligence={workspaceIntelligence} dayPlan={workspaceDayPlan} />;
    if (activeSection === 'profile') return <WorkspaceProfileSection role={activeRole} profile={activeProfile} events={events} roleState={roleState} onRoleChange={setActiveWorkspaceViewId} onSaved={handleProfileSaved} onOpenPanel={onOpenPanel} />;
    if (activeSection === 'content') return (
      <div style={{ display: 'grid', gap: 14 }}>
        <WorkspaceCenter center={buildCenterConfig({ id: 'content', data: workspaceData, actions, intelligence: workspaceIntelligence, businessHubAvailable, isAdminRole, onOpenAdmin, onOpenPanel, onOpenScan })} data={workspaceData} actions={actions} intelligence={workspaceIntelligence} />
        <DataSection type="news" title="Рабочий список публикаций" subtitle={query ? `Поиск: ${query}` : 'Новости, статьи, черновики, медиа и ИИ-редактор'} items={news} emptyText="Публикаций пока нет." onOpen={() => onOpenPanel?.('news')} />
      </div>
    );
    if (activeSection === 'events') return <WorkspaceEventsManager role={activeRole} profile={activeProfile} roleViews={availableWorkspaceViews} activeViewId={workspaceView.id} onRoleChange={setActiveWorkspaceViewId} events={events} onOpenPublicEvents={() => onOpenPanel?.('events')} onEventChanged={onEventChanged} onToast={onToast} />;
    if (activeSection === 'booking') return <WorkspaceMeetingsCRM role={activeRole} profile={activeProfile} events={events} actions={actions} onOpenDialog={onOpenDialog} onOpenPanel={onOpenPanel} onToast={onToast} />;
    if (activeSection === 'offers') return (
      <div style={{ display: 'grid', gap: 14 }}>
        <WorkspaceCenter center={buildCenterConfig({ id: 'offers', data: workspaceData, actions, intelligence: workspaceIntelligence, businessHubAvailable, isAdminRole, onOpenAdmin, onOpenPanel, onOpenScan })} data={workspaceData} actions={actions} intelligence={workspaceIntelligence} />
        <DataSection type="partners" title="Акции и предложения" subtitle="Партнёры с актуальными предложениями" items={partners.filter(item => item.offer)} emptyText="Акций пока нет." onOpen={() => onOpenPanel?.('offers')} />
      </div>
    );
    if (activeSection === 'settings' && businessHubAvailable) {
      return (
        <div style={{ display: 'grid', gap: 14 }}>
          <WorkspaceCenter center={buildCenterConfig({ id: 'settings', data: workspaceData, actions, intelligence: workspaceIntelligence, businessHubAvailable, isAdminRole, onOpenAdmin, onOpenPanel, onOpenScan })} data={workspaceData} actions={actions} intelligence={workspaceIntelligence} />
          <BusinessHub user={user} ownedPartner={workspacePartner} ownedExpert={workspaceExpert} partners={partners} experts={experts} events={events} news={news} notifications={notifications} activeRoleId={activeRole?.id} onOpenPanel={onOpenPanel} />
        </div>
      );
    }
    if (activeSection === 'settings' && !businessHubAvailable) {
      return <WorkspaceCenter center={buildCenterConfig({ id: 'settings', data: workspaceData, actions, intelligence: workspaceIntelligence, businessHubAvailable, isAdminRole, onOpenAdmin, onOpenPanel, onOpenScan })} data={workspaceData} actions={actions} intelligence={workspaceIntelligence} />;
    }
    return <WorkspaceCenter center={buildCenterConfig({ id: activeSection, data: workspaceData, actions, intelligence: workspaceIntelligence, businessHubAvailable, isAdminRole, onOpenAdmin, onOpenPanel, onOpenScan })} data={workspaceData} actions={actions} intelligence={workspaceIntelligence} />;
  };

  return (
    <div
      data-workspace-version="2.2"
      data-workspace-v2-root
      data-workspace-shell="light-saas"
      style={{
        minHeight: '100dvh',
        background: `radial-gradient(circle at 8% 0%, rgba(246,216,145,0.28), transparent 34%), radial-gradient(circle at 92% 8%, rgba(255,255,255,0.82), transparent 32%), linear-gradient(180deg, ${WS.page2}, ${WS.page})`,
        color: WS.text,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
        overflowX: 'hidden',
        '--apg2-text': WS.text,
        '--apg2-text-soft': WS.soft,
        '--apg2-text-muted': WS.muted,
        '--apg2-bg-top': WS.page2,
        '--apg2-bg-mid': WS.page,
        '--apg2-bg-bottom': WS.page,
        '--apg2-elev-shadow': 'rgba(82,60,30,0.10)',
        '--apg2-glass-border': WS.line,
      }}
    >
      <WorkspaceHeader query={query} onQueryChange={setQuery} unreadCount={unreadCount} onModeChange={onModeChange} onOpenNotifications={() => setActiveSection('notifications')} />
      <div style={{ maxWidth: 1760, margin: '0 auto', padding: '18px 24px 22px', display: 'grid', gridTemplateColumns: '255px minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
        <WorkspaceSidebar items={navItems} activeSection={activeSection} onSelect={handleSelectNav} user={user} data={workspaceData} onModeChange={onModeChange} availableViews={availableWorkspaceViews} activeViewId={workspaceView.id} onViewChange={setActiveWorkspaceViewId} />
        <main data-workspace-region="content" style={{ minWidth: 0 }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
