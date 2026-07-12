import React, { useEffect, useMemo, useState } from 'react';
import { BusinessHub } from '../businessHub/BusinessHub.jsx';
import { canUseBusinessHub, getBusinessHubFlag } from '../businessHub/BusinessHubCore.js';
import { getCabinetRoles } from '../cabinet/CabinetRoleEngine.js';
import { NewsCard } from '../NewsPage.jsx';
import { EventPosterCard } from '../EventsPage.jsx';
import { PartnerCard } from '../HomePanelV2.jsx';
import { ExpertCardV2 } from '../ExpertsPage.jsx';
import { CAPABILITIES, hasCapability } from '../roleEngine.js';
import { motionTransition } from '../motion.js';

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
  { id: 'dashboard', label: 'Сводка', icon: '⌂' },
  { id: 'analytics', label: 'Статистика', icon: '▥' },
  { id: 'messages', label: 'Сообщения', icon: '✉', badge: data => data.unreadCount || 0 },
  { id: 'keys', label: 'Заявки и отклики', icon: '▣', badge: data => Math.max(data.unreadCount || 0, 0) + 9 },
  { id: 'events', label: 'Мероприятия', icon: '□' },
  { id: 'offers', label: 'Акции и предложения', icon: '✧' },
  { id: 'news', label: 'Публикации', icon: '✎' },
  { id: 'partners', label: 'Партнёры', icon: '☷' },
  { id: 'management', label: 'Финансы', icon: '▤' },
  { id: 'management', label: 'Настройки', icon: '⚙' },
];

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
    dashboard: { label: 'Сводка', prompt: 'Что мне важно сделать сегодня?', next: 'начать с рабочих задач' },
    events: { label: 'События', prompt: 'Какие мероприятия требуют внимания?', next: 'проверить ближайшие события' },
    news: { label: 'Публикации', prompt: 'Какие новости стоит проверить?', next: 'открыть редакционный список' },
    partners: { label: 'Партнёры', prompt: 'Каких партнёров стоит проверить?', next: 'посмотреть карточки партнёров' },
    experts: { label: 'Эксперты', prompt: 'Каких экспертов стоит проверить?', next: 'проверить категории экспертов' },
    offers: { label: 'Акции', prompt: 'Какие акции сейчас важнее?', next: 'проверить предложения' },
    messages: { label: 'Сообщения', prompt: 'Какие сообщения требуют ответа?', next: 'разобрать уведомления' },
    analytics: { label: 'Статистика', prompt: 'Какие показатели изменились?', next: 'посмотреть ключевые метрики' },
    management: { label: 'Управление', prompt: 'Что проверить в управлении?', next: 'открыть кабинет' },
    keys: { label: 'Заявки и отклики', prompt: 'Что требует ответа?', next: 'проверить входящие сигналы' },
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
  const links = ['Главная', 'Новости', 'Мероприятия', 'Партнёры', 'Эксперты', 'Акции', 'Подарки', 'О проекте'];
  return (
    <header data-workspace-v2-header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,249,238,0.88)', backdropFilter: 'blur(28px) saturate(1.25)', WebkitBackdropFilter: 'blur(28px) saturate(1.25)', borderBottom: `1px solid ${WS.line}` }}>
      <div style={{ maxWidth: 1760, margin: '0 auto', minHeight: 76, padding: '0 24px', display: 'grid', gridTemplateColumns: '270px minmax(0,1fr) auto', gap: 18, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{ width: 50, height: 50, borderRadius: 15, background: 'linear-gradient(135deg,#23145D,#0E0B28)', display: 'grid', placeItems: 'center', color: '#F3D583', fontWeight: 950, boxShadow: '0 14px 30px rgba(47,28,105,0.22)' }}>АПГ</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: WS.text, fontSize: 24, lineHeight: '26px', fontWeight: 950, letterSpacing: -0.5 }}>АПГ</div>
            <div style={{ color: WS.soft, fontSize: 12, lineHeight: '15px', fontWeight: 820, textTransform: 'uppercase', letterSpacing: 0.4 }}>Альянс партнёров города</div>
          </div>
        </div>
        <nav style={{ display: 'flex', justifyContent: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
          {links.map((link, index) => (
            <button key={link} type="button" style={buttonStyle({ minHeight: 38, padding: '8px 13px', background: index === 0 ? 'rgba(255,255,255,0.92)' : 'transparent', boxShadow: index === 0 ? '0 10px 26px rgba(82,60,30,0.07)' : 'none', whiteSpace: 'nowrap', fontSize: 13 })}>{link}</button>
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
          <WorkspaceButton onClick={() => onModeChange?.('workspace')} style={{ minHeight: 48, borderRadius: 19, padding: '0 20px', background: 'linear-gradient(135deg,#F6D891,#D0A14C)', color: '#24190B', boxShadow: '0 14px 30px rgba(201,155,60,0.22)' }}>▣ Workspace</WorkspaceButton>
        </div>
      </div>
    </header>
  );
}

function WorkspaceSidebar({ items, activeSection, onSelect, user, data, onModeChange }) {
  const main = items.slice(0, 8);
  const settings = items.slice(8);
  const initial = String(user?.firstName || user?.name || user?.displayName || 'A').slice(0, 1).toUpperCase();
  return (
    <aside data-workspace-v2-sidebar style={cardStyle({ height: 'calc(100dvh - 112px)', minHeight: 0, position: 'sticky', top: 94, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' })}>
      <div style={{ padding: '20px 22px 16px' }}>
        <div style={{ color: WS.text, fontSize: 15, lineHeight: '18px', fontWeight: 930, textTransform: 'uppercase', letterSpacing: 0.7 }}>Workspace</div>
        <div style={{ color: WS.soft, fontSize: 14, lineHeight: '19px', marginTop: 8 }}>Панель управления</div>
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        {[main, settings].map((group, groupIndex) => (
          <div key={groupIndex} style={{ display: 'grid', gap: 2 }}>
            {group.map(item => {
              const active = activeSection === item.id;
              const badge = typeof item.badge === 'function' ? item.badge(data) : item.badge;
              return (
                <button key={`${item.id}-${item.label}`} type="button" onClick={() => onSelect(item)} style={{ border: 0, minHeight: 46, padding: '0 22px', background: active ? 'linear-gradient(90deg, rgba(241,206,128,0.42), rgba(241,206,128,0.08))' : 'transparent', color: active ? '#8A6422' : WS.text, display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', boxShadow: active ? 'inset 4px 0 0 #D0A14C' : 'none' }}>
                  <span style={{ color: active ? '#B68126' : 'rgba(31,26,20,0.58)', fontSize: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ fontSize: 14.5, lineHeight: '18px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                  {!!badge && <span style={{ minWidth: 24, height: 24, borderRadius: 999, background: 'rgba(209,161,76,0.18)', color: '#A8741F', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 920 }}>{badge}</span>}
                </button>
              );
            })}
            {groupIndex === 0 && <div style={{ height: 6 }} />}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', padding: 18, display: 'grid', gap: 10 }}>
        <div style={cardStyle({ padding: 12, borderRadius: 18, background: 'rgba(255,252,245,0.86)', boxShadow: 'none' })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 15, background: 'linear-gradient(135deg,#100B32,#4A327F)', color: '#F5D77E', display: 'grid', placeItems: 'center', fontWeight: 950 }}>{initial}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: WS.text, fontSize: 14.5, lineHeight: '18px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.firstName || user?.name || 'Пользователь АПГ'}</div>
              <div style={{ color: WS.soft, fontSize: 12.5, lineHeight: '16px', marginTop: 3 }}>Партнёр АПГ</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ color: '#8A6422', fontSize: 12.5, fontWeight: 850 }}>Уровень 18</span>
            <span style={{ color: WS.muted, fontSize: 12, fontWeight: 800 }}>18%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(88,67,37,0.10)', overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: '18%', height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#E9C66B,#C89B3C)' }} />
          </div>
        </div>
        <WorkspaceButton onClick={() => onModeChange?.('user')} style={{ minHeight: 48, borderRadius: 18, background: 'rgba(255,255,255,0.82)' }}>☷ Режим пользователя</WorkspaceButton>
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

function DashboardHero({ data, profileStatus }) {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', borderRadius: 28, minHeight: 318, padding: 26, color: '#fff', background: 'radial-gradient(circle at 18% 12%, rgba(239,201,113,0.34), transparent 30%), linear-gradient(90deg, rgba(10,12,18,0.86), rgba(12,17,28,0.54)), url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 1200 700%27%3E%3Crect width=%271200%27 height=%27700%27 fill=%27%23101822%27/%3E%3Cg fill=%27%23243549%27 opacity=%27.9%27%3E%3Crect x=%2780%27 y=%27360%27 width=%27130%27 height=%27240%27 rx=%276%27/%3E%3Crect x=%27240%27 y=%27290%27 width=%27160%27 height=%27310%27 rx=%278%27/%3E%3Crect x=%27435%27 y=%27330%27 width=%27120%27 height=%27270%27 rx=%276%27/%3E%3Crect x=%27600%27 y=%27220%27 width=%27170%27 height=%27380%27 rx=%278%27/%3E%3Crect x=%27810%27 y=%27310%27 width=%27150%27 height=%27290%27 rx=%278%27/%3E%3Crect x=%27995%27 y=%27360%27 width=%27110%27 height=%27240%27 rx=%276%27/%3E%3C/g%3E%3Cg stroke=%27%23f0c86d%27 stroke-opacity=%27.24%27 stroke-width=%273%27 fill=%27none%27%3E%3Cpath d=%27M0 600 C220 520 380 620 610 535 S970 500 1200 410%27/%3E%3Cpath d=%27M0 640 C260 570 390 660 620 575 S980 545 1200 470%27/%3E%3C/g%3E%3C/svg%3E\") center/cover', boxShadow: '0 26px 70px rgba(28,23,15,0.24)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.40))' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', height: '100%', minHeight: 266, alignContent: 'space-between', gap: 18 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: 22, lineHeight: '28px', fontWeight: 650 }}>{getDayGreeting()}, {data.userName} 👋</div>
            <div style={{ borderRadius: 18, background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.12)', padding: '10px 14px', color: '#F5D77E', fontSize: 14, fontWeight: 850, backdropFilter: 'blur(18px)' }}>♕ Партнёр с 22 мая 2024</div>
          </div>
          <h1 style={{ margin: '16px 0 0', maxWidth: 620, color: '#fff', fontSize: 36, lineHeight: '43px', fontWeight: 950, letterSpacing: -0.75 }}>Ваши партнёрские возможности на сегодня</h1>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, padding: 12, borderRadius: 22, background: 'rgba(10,10,12,0.42)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(26px)' }}>
          {[
            ['☆', '18', 'Уровень'],
            ['⌘', data.userKeys || 0, 'Ключей'],
            ['✿', data.partners.filter(item => item.offer).length || 5, 'Активных акций'],
            ['▣', data.events.length || 0, 'Мероприятий'],
          ].map(([icon, value, label]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr)', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 13, background: 'rgba(201,155,60,0.14)', color: '#F2C963', display: 'grid', placeItems: 'center', fontSize: 19 }}>{icon}</div>
              <div>
                <div style={{ color: '#fff', fontSize: 22, lineHeight: '25px', fontWeight: 930 }}>{value}</div>
                <div style={{ color: 'rgba(255,255,255,0.70)', fontSize: 12.5, lineHeight: '16px', marginTop: 4 }}>{label}</div>
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
    <div style={{ borderRadius: 16, background: 'rgba(255,255,255,0.78)', border: `1px solid ${WS.line}`, padding: '12px 10px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ color: WS.text, fontSize: 24, lineHeight: '28px', fontWeight: 950 }}>{value}</div>
      <div style={{ color: WS.soft, fontSize: 12.5, lineHeight: '16px', marginTop: 5 }}>{label}</div>
      <div style={{ color: WS.green, fontSize: 12.5, lineHeight: '16px', fontWeight: 880, marginTop: 6 }}>↗ {delta}</div>
    </div>
  );
}

function MetricsPanel({ data }) {
  return (
    <Panel title="Ключевые показатели" action={<button type="button" style={buttonStyle({ minHeight: 32, padding: '6px 11px', background: 'transparent', boxShadow: 'none', color: WS.soft })}>Этот месяц⌄</button>} style={{ minHeight: 318, padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        <MetricTile label="Просмотров" value="1 248" delta="18%" />
        <MetricTile label="Взаимодействий" value="324" delta="12%" />
        <MetricTile label="Переходов" value="78" delta="16%" />
        <MetricTile label="Новых клиентов" value={Math.max(data.unreadCount || 0, 24)} delta="20%" />
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ color: WS.text, fontSize: 16, lineHeight: '20px', fontWeight: 900, marginBottom: 8 }}>Динамика активности</div>
        <Sparkline color={WS.gold} height={118} />
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

function WorkspaceDashboard({ data, actions }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const tasks = [
    { icon: '▣', title: data.events.length ? 'Подтвердите участие в мероприятии' : 'Добавьте мероприятие', text: data.events[0] ? safeTitle(data.events[0], '9-й Большой Нетворкинг') : 'Афиша ждёт наполнения', priority: 'Важно', tone: WS.red, onClick: actions.openEvents },
    { icon: '▤', title: profileStatus.value < 100 ? 'Обновите информацию о компании' : 'Профиль готов к рабочему дню', text: profileStatus.value < 100 ? 'Данные устарели на 30%' : 'Можно перейти к публикациям', priority: profileStatus.value < 100 ? 'Средний' : 'Готово', tone: profileStatus.value < 100 ? '#E39A35' : WS.green, onClick: actions.openCabinet },
    { icon: '✎', title: data.news.length ? 'Опубликуйте новость' : 'Создайте первую новость', text: data.news[0] ? 'У вас есть черновики новости' : 'Лента ждёт публикаций', priority: 'Низкий', tone: WS.blue, onClick: actions.openNews },
    { icon: '▢', title: data.unreadCount ? 'Проверьте новые отклики' : 'Входящие спокойны', text: data.unreadCount ? `${data.unreadCount} новых откликов` : 'Новых откликов нет', priority: data.unreadCount ? 'Важно' : '', tone: WS.red, onClick: actions.openMessages },
  ];
  const fallbackEvents = [
    { id: 'fallback-1', title: '9-й Большой Нетворкинг', eventDate: '2026-07-22', time: '11:00 – 16:00', place: 'Зеленоград, к1462' },
    { id: 'fallback-2', title: 'Бизнес-завтрак с экспертами', eventDate: '2026-07-25', time: '09:30 – 11:30', place: 'Онлайн' },
    { id: 'fallback-3', title: 'Мастер-класс по продвижению', eventDate: '2026-07-30', time: '14:00 – 17:00', place: 'Зеленоград, к1401' },
  ];
  const visibleTasks = tasks.slice(0, 3);
  const visibleEvents = data.events.length ? data.events.slice(0, 2) : fallbackEvents.slice(0, 2);
  const visibleMessages = data.notifications.length ? data.notifications.slice(0, 3) : [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];

  return (
    <div data-workspace-v2-dashboard style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.12fr) minmax(390px,0.88fr)', gap: 14 }}>
        <DashboardHero data={data} profileStatus={profileStatus} />
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
      <section style={cardStyle({ padding: 14, minWidth: 0 })}>
        <div style={{ display: 'grid', gridTemplateColumns: '170px repeat(5, minmax(0,1fr))', gap: 12, alignItems: 'center' }}>
          <div style={{ color: WS.text, fontSize: 20, lineHeight: '24px', fontWeight: 940, letterSpacing: -0.3 }}>Быстрые действия</div>
          {[
            ['✧', 'Акция', actions.openOffers],
            ['▤', 'Новость', actions.openNews],
            ['□', 'Мероприятие', actions.openEvents],
            ['☷', 'Партнёр', actions.openPartners],
            ['↗', 'Рассылка', actions.openMessages],
          ].map(([icon, title, onClick]) => (
            <button key={title} type="button" onClick={onClick} style={{ border: `1px solid ${WS.line}`, borderRadius: 18, background: 'rgba(255,255,255,0.68)', padding: '10px 12px', minHeight: 58, display: 'grid', gridTemplateColumns: '38px minmax(0,1fr)', gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 38, height: 38, borderRadius: 13, background: 'rgba(201,155,60,0.14)', color: WS.gold, display: 'grid', placeItems: 'center', fontSize: 18 }}>{icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: WS.text, fontSize: 14, lineHeight: '18px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
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
  onModeChange,
  onOpenPanel,
  onOpenAdmin,
}) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [query, setQuery] = useState('');
  const roleState = useMemo(() => getCabinetRoles({ user, partner: ownedPartner, expert: ownedExpert }), [user, ownedPartner, ownedExpert]);
  const activeRole = roleState.activeRole;
  const activeRoleIdentity = useMemo(() => ({ ...(user || {}), role: activeRole?.id || user?.role || 'user' }), [activeRole?.id, user]);
  const isAdminRole = hasCapability(activeRoleIdentity, CAPABILITIES.canOpenAdminPanel);
  const businessHubFlag = useMemo(() => getBusinessHubFlag(), []);
  const businessHubAvailable = useMemo(() => canUseBusinessHub({ user, partner: ownedPartner, expert: ownedExpert, flag: businessHubFlag }), [user, ownedPartner, ownedExpert, businessHubFlag]);
  const activeProfile = activeRole?.id === 'expert' ? ownedExpert : activeRole?.id === 'partner' ? ownedPartner : user;
  const userName = user?.firstName || user?.name || user?.displayName || 'Mr. TOREDO';
  const workspaceData = { userName, activeProfile, partners, experts, events, news, notifications, unreadCount, userKeys, userCount };
  const navItems = NAV_ITEMS.filter(item => item.id !== 'management' || businessHubAvailable || isAdminRole);

  const actions = {
    openDashboard: () => setActiveSection('dashboard'),
    openCabinet: () => businessHubAvailable ? setActiveSection('management') : onOpenPanel?.(activeRole?.id === 'expert' ? 'expert-cabinet' : 'partner-cabinet'),
    openNews: () => setActiveSection('news'),
    openEvents: () => setActiveSection('events'),
    openPartners: () => setActiveSection('partners'),
    openExperts: () => setActiveSection('experts'),
    openOffers: () => setActiveSection('offers'),
    openMessages: () => setActiveSection('messages'),
    openAnalytics: () => setActiveSection('analytics'),
    openLoki: () => onOpenPanel?.('loki'),
  };

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
        setActiveSection('management');
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
    if (item.id === 'management') {
      if (isAdminRole && !businessHubAvailable) {
        onOpenAdmin?.();
        return;
      }
      setActiveSection('management');
      return;
    }
    setActiveSection(item.id);
  };

  const renderContent = () => {
    if (activeSection === 'dashboard') return <WorkspaceDashboard data={workspaceData} actions={actions} />;
    if (activeSection === 'news') return <DataSection type="news" title="Публикации" subtitle={query ? `Поиск: ${query}` : 'Рабочий список публикаций'} items={news} emptyText="Новостей пока нет." onOpen={() => onOpenPanel?.('news')} />;
    if (activeSection === 'events') return <DataSection type="events" title="Мероприятия" subtitle="Ближайшие мероприятия и календарный контекст" items={events} emptyText="Мероприятий пока нет." onOpen={() => onOpenPanel?.('events')} />;
    if (activeSection === 'partners') return <DataSection type="partners" title="Партнёры" subtitle="Каталог партнёров для рабочей проверки" items={partners} emptyText="Партнёров пока нет." onOpen={() => onOpenPanel?.('offers')} />;
    if (activeSection === 'experts') return <DataSection type="experts" title="Эксперты" subtitle="Профили экспертов и категории" items={experts} emptyText="Экспертов пока нет." onOpen={() => onOpenPanel?.('experts')} />;
    if (activeSection === 'offers') return <DataSection type="partners" title="Акции и предложения" subtitle="Партнёры с актуальными предложениями" items={partners.filter(item => item.offer)} emptyText="Акций пока нет." onOpen={() => onOpenPanel?.('offers')} />;
    if (activeSection === 'messages') return <PlaceholderSection title="Сообщения" text="Входящие сигналы, уведомления и будущие диалоги." actions={[{ id: 'notifications', label: 'Открыть уведомления', onClick: () => onOpenPanel?.('notifications'), tone: 'gold' }]} />;
    if (activeSection === 'keys') return <PlaceholderSection title="Заявки и отклики" text="Рабочая очередь заявок, ключей и QR-сценариев." actions={[{ id: 'scan', label: 'Открыть сканер', onClick: () => onOpenPanel?.('scan'), tone: 'gold' }]} />;
    if (activeSection === 'analytics') return <PlaceholderSection title="Статистика" text="Ключевые показатели уже собраны в сводке; расширенная аналитика подключается без второй архитектуры." actions={[{ id: 'loki', label: 'Спросить Локи о метриках', onClick: actions.openLoki }]} />;
    if (activeSection === 'management') {
      if (businessHubAvailable) {
        return <BusinessHub user={user} ownedPartner={ownedPartner} ownedExpert={ownedExpert} partners={partners} experts={experts} events={events} news={news} notifications={notifications} activeRoleId={activeRole?.id} onOpenPanel={onOpenPanel} />;
      }
      return <PlaceholderSection title="Управление" text="Кабинет, админка и настройки Workspace." actions={[isAdminRole && { id: 'admin', label: 'Админка', onClick: onOpenAdmin, tone: 'gold' }, { id: 'profile', label: 'Профиль', onClick: () => onOpenPanel?.('profile') }].filter(Boolean)} />;
    }
    return <PlaceholderSection title={buildWorkspaceContext(activeSection).label} text={buildWorkspaceContext(activeSection).next} />;
  };

  return (
    <div
      data-workspace-version="2.0"
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
      <WorkspaceHeader query={query} onQueryChange={setQuery} unreadCount={unreadCount} onModeChange={onModeChange} onOpenNotifications={() => setActiveSection('messages')} />
      <div style={{ maxWidth: 1760, margin: '0 auto', padding: '24px 26px 42px', display: 'grid', gridTemplateColumns: '270px minmax(0,1fr)', gap: 22, alignItems: 'start' }}>
        <WorkspaceSidebar items={navItems} activeSection={activeSection} onSelect={handleSelectNav} user={user} data={workspaceData} onModeChange={onModeChange} />
        <main data-workspace-region="content" style={{ minWidth: 0 }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
