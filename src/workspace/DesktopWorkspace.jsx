import React, { useEffect, useMemo, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard } from '../components/Apg2ProfileGlass.jsx';
import { BusinessHub } from '../businessHub/BusinessHub.jsx';
import { canUseBusinessHub, getBusinessHubFlag } from '../businessHub/BusinessHubCore.js';
import { getCabinetRoles } from '../cabinet/CabinetRoleEngine.js';
import { LokiIdentity } from '../loki/LokiIdentity.jsx';
import { NewsCard } from '../NewsPage.jsx';
import { EventPosterCard } from '../EventsPage.jsx';
import { PartnerCard } from '../HomePanelV2.jsx';
import { ExpertCardV2 } from '../ExpertsPage.jsx';
import { ContentGrid, SectionHeader, WorkspacePanel } from './WorkspaceComponents.jsx';
import { WORKSPACE_LAYOUT, WORKSPACE_Z, getDesktopWorkspaceLayoutPlan } from './WorkspaceLayoutEngine.js';
import { CAPABILITIES, hasCapability } from '../roleEngine.js';
import { motionTransition } from '../motion.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Сводка', icon: '🏠', hint: 'Что требует внимания сегодня', shortcut: '⌘1' },
  { id: 'events', label: 'События', icon: '📅', hint: 'Ближайшие мероприятия и календарь' },
  { id: 'news', label: 'Новости', icon: '📰', hint: 'Публикации и редакционный контекст' },
  { id: 'partners', label: 'Партнёры', icon: '🏢', hint: 'Рабочий каталог партнёров' },
  { id: 'experts', label: 'Эксперты', icon: '🎓', hint: 'Эксперты и профильные карточки' },
  { id: 'offers', label: 'Акции', icon: '🎁', hint: 'Промо и предложения партнёров' },
  { id: 'rewards', label: 'Награды', icon: '🏆', hint: 'Призы и мотивация пользователей' },
  { id: 'keys', label: 'Ключи', icon: '🔑', hint: 'Экономика ключей и QR-сценарии' },
  { id: 'messages', label: 'Сообщения', icon: '💬', hint: 'Уведомления и входящие сигналы' },
  { id: 'analytics', label: 'Аналитика', icon: '📊', hint: 'Ключевые показатели платформы' },
  { id: 'management', label: 'Управление', icon: '⚙', hint: 'Кабинет, админка и настройки', shortcut: '⌘2' },
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
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getDayGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Работаем поздно';
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
    news: { label: 'Новости', prompt: 'Какие новости стоит проверить?', next: 'открыть редакционный список' },
    partners: { label: 'Партнёры', prompt: 'Каких партнёров стоит проверить?', next: 'посмотреть карточки партнёров' },
    experts: { label: 'Эксперты', prompt: 'Каких экспертов стоит проверить?', next: 'проверить категории экспертов' },
    offers: { label: 'Акции', prompt: 'Какие акции сейчас важнее?', next: 'проверить предложения' },
    rewards: { label: 'Награды', prompt: 'Что происходит с наградами?', next: 'открыть призы' },
    keys: { label: 'Ключи', prompt: 'Что важно по ключам?', next: 'проверить QR и активность' },
    messages: { label: 'Сообщения', prompt: 'Какие сообщения требуют ответа?', next: 'разобрать уведомления' },
    analytics: { label: 'Аналитика', prompt: 'Какие показатели изменились?', next: 'посмотреть ключевые метрики' },
    management: { label: 'Управление', prompt: 'Что проверить в управлении?', next: 'открыть кабинет' },
  };
  return map[activeSection] || map.dashboard;
}

function buildReply({ activeSection, data, profileStatus, text }) {
  const context = buildWorkspaceContext(activeSection);
  const facts = [
    `${data.news.length} новостей`,
    `${data.events.length} событий`,
    `${data.partners.length} партнёров`,
    `${data.experts.length} экспертов`,
    `${data.unreadCount || 0} уведомлений`,
    `профиль ${profileStatus.value}%`,
  ];
  return `Контекст: «${context.label}». Вижу ${facts.join(' · ')}. По запросу «${text || context.prompt}» я бы начал так: ${context.next}.`;
}

function Sparkline({ tone = 'gold' }) {
  const color = tone === 'green' ? 'rgba(80,190,130,0.92)' : 'rgba(215,184,106,0.92)';
  return (
    <svg viewBox="0 0 96 28" aria-hidden="true" style={{ width: '100%', height: 28, display: 'block' }}>
      <path d="M2 22 C14 16, 18 20, 28 13 S44 17, 54 9 S70 13, 82 6 S91 7, 94 4" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M2 27 C14 20, 18 22, 28 15 S44 20, 54 12 S70 15, 82 9 S91 9, 94 6 L94 28 L2 28 Z" fill={tone === 'green' ? 'rgba(80,190,130,0.10)' : 'rgba(215,184,106,0.12)'} />
    </svg>
  );
}

function WorkspaceHeaderBar({ user, unreadCount, query, onQueryChange, onModeChange, onOpenNotifications, onOpenProfile }) {
  const initial = String(user?.firstName || user?.name || user?.displayName || 'A').slice(0, 1).toUpperCase();
  return (
    <div data-workspace-region="header" style={{ ...APG2_PROFILE.glass, borderRadius: 26, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'auto minmax(260px, 1fr) auto', alignItems: 'center', gap: 14, minHeight: WORKSPACE_LAYOUT.headerHeight, background: APG2_PROFILE.quietSurface, position: 'relative', zIndex: WORKSPACE_Z.header }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 15, background: APG2_PROFILE.goldGradient, color: '#17120a', display: 'grid', placeItems: 'center', fontWeight: 950, fontSize: 13 }}>АПГ</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 15.5, lineHeight: '19px', fontWeight: 940 }}>Workspace 2.0</div>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '14px', marginTop: 1 }}>что сделать сегодня</div>
        </div>
      </div>
      <label style={{ ...APG2_PROFILE.glass, borderRadius: 999, minHeight: 38, padding: '0 13px', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(var(--apg2-glass-a,255,255,255),0.12)' }}>
        <span style={{ color: APG2_PROFILE.gold, fontSize: 15 }}>⌕</span>
        <input
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder="Найти задачу, раздел или объект"
          style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', color: APG2_PROFILE.text, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 680 }}
        />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <GlassButton onClick={onOpenNotifications} style={{ minHeight: 36, padding: '8px 12px' }}>{unreadCount ? `💬 ${unreadCount}` : '💬'}</GlassButton>
        <GlassButton onClick={() => onModeChange?.('user')} style={{ minHeight: 36, padding: '8px 12px' }}>Пользовательский режим</GlassButton>
        <button type="button" onClick={onOpenProfile} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 38, height: 38, borderRadius: 15, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontWeight: 920 }}>{initial}</div>
        </button>
      </div>
    </div>
  );
}

function WorkspaceSidebar({ items, activeSection, collapsed, onToggle, onSelect, user, onModeChange }) {
  const groups = collapsed ? [{ group: '', items }] : [{ group: 'Workspace', items: items.slice(0, 6) }, { group: 'Операции', items: items.slice(6) }];
  const initial = String(user?.firstName || user?.name || user?.displayName || 'A').slice(0, 1).toUpperCase();
  return (
    <div data-workspace-region="sidebar" style={{ ...APG2_PROFILE.glass, borderRadius: 30, padding: collapsed ? '10px 8px' : 10, height: '100%', minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: WORKSPACE_Z.sidebar, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', background: 'linear-gradient(180deg, rgba(var(--apg2-glass-a,255,255,255),0.19), rgba(var(--apg2-glass-a,255,255,255),0.09))', boxShadow: '0 20px 70px rgba(0,0,0,0.14)' }}>
      <div style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', padding: collapsed ? '0 0 2px' : '2px 3px 6px' }}>
        {!collapsed && (
          <div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '18px', fontWeight: 930 }}>Центр управления</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', marginTop: 2 }}>рабочие сценарии АПГ</div>
          </div>
        )}
        <GlassButton onClick={onToggle} style={{ minHeight: collapsed ? 38 : 34, width: collapsed ? 38 : 34, padding: 0, borderRadius: 999 }}>{collapsed ? '›' : '‹'}</GlassButton>
      </div>
      <div style={{ display: 'grid', gap: collapsed ? 9 : 10, minHeight: 0, overflowY: 'auto', padding: collapsed ? '1px 0 8px' : '1px 2px 8px 0', overscrollBehavior: 'contain' }}>
        {groups.map(group => (
          <div key={group.group || 'collapsed'} style={{ display: 'grid', gap: 5 }}>
            {!collapsed && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10, lineHeight: '13px', fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', padding: '0 9px' }}>{group.group}</div>}
            {group.items.map(item => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  title={item.hint}
                  style={{
                    border: active ? '1px solid rgba(215,184,106,0.58)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)',
                    background: active ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.07)',
                    borderRadius: collapsed ? 999 : 20,
                    minHeight: collapsed ? 48 : 42,
                    width: collapsed ? 48 : '100%',
                    padding: collapsed ? 0 : '0 11px',
                    margin: collapsed ? '0 auto' : 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 10,
                    color: active ? APG2_PROFILE.gold : APG2_PROFILE.text,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 830,
                    cursor: 'pointer',
                    transition: motionTransition(['background', 'border-color', 'transform'], 'base'),
                  }}
                >
                  <span style={{ width: collapsed ? 32 : 27, height: collapsed ? 32 : 27, borderRadius: 999, display: 'grid', placeItems: 'center', background: active ? APG2_PROFILE.goldGradient : 'rgba(var(--apg2-glass-a,255,255,255),0.10)', color: active ? '#17120a' : APG2_PROFILE.gold, fontSize: 15 }}>{item.icon}</span>
                  {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.label}</span>}
                  {!collapsed && item.shortcut && <span style={{ color: APG2_PROFILE.textMuted, fontSize: 10, fontWeight: 850 }}>{item.shortcut}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!collapsed && (
        <div style={{ marginTop: 'auto', display: 'grid', gap: 9 }}>
          <GlassCard style={{ borderRadius: 24, padding: 12, background: 'rgba(var(--apg2-glass-a,255,255,255),0.10)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 14, display: 'grid', placeItems: 'center', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, fontWeight: 920 }}>{initial}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 13, lineHeight: '17px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.firstName || user?.name || 'Пользователь АПГ'}</div>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '14px' }}>Workspace активен</div>
              </div>
            </div>
          </GlassCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <GlassButton onClick={() => onModeChange?.('user')} style={{ minHeight: 34, padding: '7px 8px', fontSize: 11.5 }}>User</GlassButton>
            <GlassButton tone="gold" style={{ minHeight: 34, padding: '7px 8px', fontSize: 11.5, color: '#17120a' }}>Workspace</GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardHero({ data, profileStatus, tasks, actions }) {
  const highPriority = tasks.filter(task => task.status !== 'done').slice(0, 4);
  return (
    <div style={{ ...APG2_PROFILE.glass, position: 'relative', overflow: 'hidden', borderRadius: APG2_PROFILE.radius.hero, padding: 24, minHeight: 238, background: APG2_PROFILE.heroSurface, border: '1px solid rgba(244,217,140,0.30)', boxShadow: '0 38px 92px rgba(0,0,0,0.22), inset 0 1.5px 0 rgba(255,255,255,0.34)' }}>
      <div style={{ position: 'absolute', inset: '-80px -120px auto auto', width: 360, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(215,184,106,0.22), transparent 68%)', filter: 'blur(4px)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 20, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <GlassBadge tone="gold">Рабочий день</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 40, lineHeight: '45px', fontWeight: 950, letterSpacing: -0.8, marginTop: 14 }}>
            {getDayGreeting()}, {data.userName}.
          </div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 15, lineHeight: '22px', marginTop: 9, maxWidth: 700 }}>
            Workspace собрал главное: что требует внимания, какие задачи закрыть и куда перейти дальше.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10, marginTop: 18 }}>
            {[
              ['Заявки', Math.max(data.unreadCount, 0)],
              ['Мероприятия', data.events.length],
              ['Сообщения', data.notifications.length],
              ['Профиль', `${profileStatus.value}%`],
            ].map(([label, value]) => (
              <div key={label} style={{ ...APG2_PROFILE.glass, borderRadius: 22, padding: '11px 12px', background: 'rgba(var(--apg2-glass-a,255,255,255),0.11)' }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 24, lineHeight: '27px', fontWeight: 940 }}>{value}</div>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 260, display: 'grid', gap: 10 }}>
          <GlassButton tone="gold" onClick={actions.openCabinet} style={{ minHeight: 46, color: '#17120a' }}>Продолжить работу</GlassButton>
          {highPriority.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 9, color: APG2_PROFILE.text, fontSize: 12.5, lineHeight: '17px', fontWeight: 760 }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: task.status === 'waiting' ? '#E6A23C' : APG2_PROFILE.gold, boxShadow: '0 0 18px rgba(215,184,106,0.44)', flex: '0 0 auto' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TaskColumn({ title, items, tone }) {
  return (
    <div style={{ ...APG2_PROFILE.glass, borderRadius: 26, padding: 12, minHeight: 208, background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', fontWeight: 910 }}>{title}</div>
        <span style={{ color: tone === 'gold' ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850 }}>{items.length}</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(item => (
          <button key={item.id} type="button" onClick={item.onClick} style={{ ...APG2_PROFILE.glass, borderRadius: 18, padding: 10, textAlign: 'left', cursor: 'pointer', background: item.status === 'done' ? 'rgba(80,190,130,0.08)' : item.status === 'waiting' ? 'rgba(230,162,60,0.08)' : APG2_PROFILE.quietSurface, color: APG2_PROFILE.text }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 12.8, lineHeight: '17px', fontWeight: 850 }}>{item.title}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.2, lineHeight: '15px', marginTop: 3 }}>{item.text}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ListRow({ title, text, meta, onClick, icon = '•' }) {
  const content = (
    <>
      <span style={{ width: 30, height: 30, borderRadius: 12, display: 'grid', placeItems: 'center', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, flex: '0 0 auto' }}>{icon}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', color: APG2_PROFILE.text, fontSize: 13, lineHeight: '17px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {text && <span style={{ display: 'block', color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '15px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>}
      </span>
      {meta && <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 760, flex: '0 0 auto' }}>{meta}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...APG2_PROFILE.glass, borderRadius: 18, padding: 10, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer', background: APG2_PROFILE.quietSurface }}>
        {content}
      </button>
    );
  }
  return <div style={{ ...APG2_PROFILE.glass, borderRadius: 18, padding: 10, display: 'flex', alignItems: 'center', gap: 10, background: APG2_PROFILE.quietSurface }}>{content}</div>;
}

function MetricTile({ label, value, delta, tone = 'gold' }) {
  return (
    <div style={{ ...APG2_PROFILE.glass, borderRadius: 22, padding: 12, background: APG2_PROFILE.quietSurface, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
        <div>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 26, lineHeight: '29px', fontWeight: 940, marginTop: 4 }}>{value}</div>
        </div>
        <div style={{ color: tone === 'green' ? '#50BE82' : APG2_PROFILE.gold, fontSize: 11, fontWeight: 850 }}>{delta}</div>
      </div>
      <div style={{ marginTop: 7 }}><Sparkline tone={tone} /></div>
    </div>
  );
}

function EmptyWidget({ text }) {
  return <div style={{ ...APG2_PROFILE.glass, borderRadius: 20, padding: 14, color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '18px', background: APG2_PROFILE.quietSurface }}>{text}</div>;
}

function WorkspaceDashboard({ data, actions }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const tasks = [
    { id: 'profile', title: profileStatus.value < 100 ? `Дозаполнить профиль до 100%` : 'Профиль готов к показу', text: profileStatus.value < 100 ? `Не хватает: ${profileStatus.missing.slice(0, 2).join(', ')}` : 'Можно перейти к контенту', status: profileStatus.value < 100 ? 'today' : 'done', onClick: actions.openCabinet },
    { id: 'notifications', title: data.unreadCount ? `Разобрать ${data.unreadCount} уведомлений` : 'Входящие спокойны', text: data.unreadCount ? 'Есть новые сигналы' : 'Новых сообщений нет', status: data.unreadCount ? 'today' : 'done', onClick: actions.openMessages },
    { id: 'events', title: data.events.length ? 'Проверить ближайшие мероприятия' : 'Добавить мероприятие', text: data.events[0] ? safeTitle(data.events[0], 'Ближайшее событие') : 'Афиша ждёт наполнения', status: data.events.length ? 'progress' : 'waiting', onClick: actions.openEvents },
    { id: 'news', title: data.news.length ? 'Проверить последние новости' : 'Создать первую новость', text: data.news[0] ? safeTitle(data.news[0], 'Новость') : 'Лента ждёт публикаций', status: data.news.length ? 'progress' : 'waiting', onClick: actions.openNews },
    { id: 'partners', title: 'Обновить карточки партнёров', text: `${data.partners.length} партнёров в каталоге`, status: 'waiting', onClick: actions.openPartners },
    { id: 'experts', title: 'Проверить экспертные профили', text: `${data.experts.length} экспертов в системе`, status: 'done', onClick: actions.openExperts },
  ];
  const taskGroups = {
    today: tasks.filter(task => task.status === 'today'),
    progress: tasks.filter(task => task.status === 'progress'),
    waiting: tasks.filter(task => task.status === 'waiting'),
    done: tasks.filter(task => task.status === 'done'),
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <DashboardHero data={data} profileStatus={profileStatus} tasks={tasks} actions={actions} />
      <WorkspacePanel title="Рабочие задачи" subtitle="Сначала закрываем то, что влияет на пользователей сегодня" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 }}>
          <TaskColumn title="Сегодня" items={taskGroups.today} tone="gold" />
          <TaskColumn title="В работе" items={taskGroups.progress} />
          <TaskColumn title="Ожидает" items={taskGroups.waiting} />
          <TaskColumn title="Завершено" items={taskGroups.done} />
        </div>
      </WorkspacePanel>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)', gap: 16 }}>
        <WorkspacePanel title="Ближайшие мероприятия" subtitle="Компактный рабочий список" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gap: 9 }}>
            {data.events.slice(0, 5).map((event, index) => (
              <ListRow key={event.id || index} icon="📅" title={safeTitle(event, 'Мероприятие')} text={event.place || event.address || 'Место уточняется'} meta={formatShortDate(event.eventDate || event.date || event.createdAt)} onClick={actions.openEvents} />
            ))}
            {!data.events.length && <EmptyWidget text="Ближайших мероприятий пока нет." />}
          </div>
        </WorkspacePanel>
        <WorkspacePanel title="Последние сообщения" subtitle="Входящие сигналы и действия" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gap: 9 }}>
            {data.notifications.slice(0, 5).map((item, index) => (
              <ListRow key={item.id || index} icon="💬" title={safeTitle(item, 'Уведомление')} text={item.text || item.body || 'Новое сообщение'} meta={formatShortDate(item.createdAt || item.date)} onClick={actions.openMessages} />
            ))}
            {!data.notifications.length && <EmptyWidget text="Новых сообщений нет — можно заняться задачами." />}
          </div>
        </WorkspacePanel>
      </div>
      <WorkspacePanel title="Быстрые действия" subtitle="Важные рабочие сценарии в один клик" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 10 }}>
          {[
            ['📰', 'Создать новость', 'Контент', actions.openNews],
            ['📅', 'Добавить мероприятие', 'Афиша', actions.openEvents],
            ['🏢', 'Пригласить партнёра', 'Каталог', actions.openPartners],
            ['📣', 'Запустить рассылку', 'Сообщения', actions.openMessages],
            ['🎁', 'Создать акцию', 'Предложение', actions.openOffers],
            ['🎓', 'Добавить эксперта', 'Эксперты', actions.openExperts],
          ].map(([icon, title, text, onClick]) => (
            <button key={title} type="button" onClick={onClick} style={{ ...APG2_PROFILE.glass, borderRadius: 22, padding: 12, minHeight: 104, textAlign: 'left', cursor: 'pointer', background: APG2_PROFILE.quietSurface, color: APG2_PROFILE.text }}>
              <div style={{ width: 34, height: 34, borderRadius: 14, display: 'grid', placeItems: 'center', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, fontSize: 17 }}>{icon}</div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 13.2, lineHeight: '17px', fontWeight: 880, marginTop: 10 }}>{title}</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.2, lineHeight: '15px', marginTop: 3 }}>{text}</div>
            </button>
          ))}
        </div>
      </WorkspacePanel>
    </div>
  );
}

function RightWorkspacePanel({ data, activeSection, aiDraft, aiHistory, onDraftChange, onAskLoki, actions }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const context = buildWorkspaceContext(activeSection);
  const activity = [
    data.partners[0] && { id: 'partner', title: `${safeTitle(data.partners[0], 'Партнёр')} активен`, text: 'Партнёр в рабочем каталоге', icon: '🏢' },
    data.news[0] && { id: 'news', title: safeTitle(data.news[0], 'Новость'), text: 'Последняя публикация', icon: '📰' },
    data.events[0] && { id: 'event', title: safeTitle(data.events[0], 'Мероприятие'), text: formatShortDate(data.events[0].eventDate || data.events[0].date), icon: '📅' },
    data.experts[0] && { id: 'expert', title: safeTitle(data.experts[0], 'Эксперт'), text: 'Эксперт в каталоге', icon: '🎓' },
  ].filter(Boolean);
  const reminders = [
    profileStatus.value < 100 ? `Дозаполнить профиль: ${profileStatus.missing.slice(0, 2).join(', ')}` : 'Профиль готов к рабочему дню',
    data.events.length ? 'Проверить ближайшую афишу' : 'Запланировать первое мероприятие',
    data.news.length ? 'Посмотреть свежие новости' : 'Подготовить новость',
  ];
  const handleSubmit = event => {
    event.preventDefault();
    onAskLoki?.(aiDraft || context.prompt);
  };

  return (
    <div style={{ ...APG2_PROFILE.glass, height: '100%', minHeight: 0, borderRadius: 30, padding: 14, background: 'linear-gradient(180deg, rgba(var(--apg2-glass-a,255,255,255),0.20), rgba(var(--apg2-glass-a,255,255,255),0.10))', overflowY: 'auto', display: 'grid', gap: 14, alignContent: 'start' }}>
      <div style={{ ...APG2_PROFILE.glass, borderRadius: 26, padding: 14, background: APG2_PROFILE.quietSurface }}>
        <LokiIdentity size={54} state="recommending" label="Локи" sublabel={`контекст: ${context.label}`} />
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 10 }}>Workspace показывает не всё подряд, а следующий лучший шаг.</div>
      </div>
      <WorkspacePanel title="Ключевые показатели" subtitle="Коротко о состоянии платформы" style={{ margin: 0, padding: 12 }}>
        <ContentGrid min={130} gap={8}>
          <MetricTile label="Пользователи" value={data.userCount || '—'} delta="+ сегодня" tone="green" />
          <MetricTile label="Партнёры" value={data.partners.length} delta="+2%" />
          <MetricTile label="Эксперты" value={data.experts.length} delta="+1%" />
          <MetricTile label="Ключи" value={data.userKeys || 0} delta="активно" />
          <MetricTile label="Заявки" value={data.unreadCount || 0} delta="новые" tone={data.unreadCount ? 'green' : 'gold'} />
          <MetricTile label="Отклики" value={data.notifications.length} delta="live" />
        </ContentGrid>
      </WorkspacePanel>
      <WorkspacePanel title="Живая активность" subtitle="Что изменилось недавно" style={{ margin: 0, padding: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {activity.map(item => <ListRow key={item.id} icon={item.icon} title={item.title} text={item.text} />)}
          {!activity.length && <EmptyWidget text="Активность появится после обновления данных." />}
        </div>
      </WorkspacePanel>
      <WorkspacePanel title="Напоминания" subtitle="Не потерять важное" style={{ margin: 0, padding: 12 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {reminders.map((item, index) => <ListRow key={item} icon={index === 0 ? '⚑' : '•'} title={item} text={index === 0 ? 'приоритет дня' : 'рабочая подсказка'} />)}
        </div>
      </WorkspacePanel>
      <WorkspacePanel title="Спросить Локи" subtitle="Быстрый рабочий вопрос" style={{ margin: 0, padding: 12 }}>
        {aiHistory.slice(-2).map(item => (
          <div key={item.id} style={{ ...APG2_PROFILE.glass, borderRadius: 16, padding: 10, marginTop: 8, background: item.role === 'loki' ? APG2_PROFILE.goldSoft : APG2_PROFILE.quietSurface }}>
            <div style={{ color: item.role === 'loki' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 10.5, lineHeight: '14px', fontWeight: 900, textTransform: 'uppercase' }}>{item.role === 'loki' ? 'Локи' : 'Вы'}</div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 12.2, lineHeight: '17px', marginTop: 3 }}>{item.text}</div>
          </div>
        ))}
        <form onSubmit={handleSubmit} style={{ ...APG2_PROFILE.glass, borderRadius: 18, padding: 8, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 7, alignItems: 'center', marginTop: 12 }}>
          <input value={aiDraft} onChange={event => onDraftChange(event.target.value)} placeholder={context.prompt} style={{ width: '100%', minHeight: 34, border: 0, outline: 'none', background: 'transparent', color: APG2_PROFILE.text, fontFamily: 'inherit', fontSize: 12.5 }} />
          <GlassButton type="submit" tone="gold" style={{ minHeight: 34, padding: '7px 10px', color: '#17120a' }}>Спросить</GlassButton>
        </form>
      </WorkspacePanel>
    </div>
  );
}

function PlaceholderSection({ title, text, actions = [] }) {
  return (
    <WorkspacePanel title={title} subtitle={text}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {actions.map(action => (
          <GlassButton key={action.id || action.label} onClick={action.onClick} tone={action.tone} style={{ minHeight: 44 }}>{action.label}</GlassButton>
        ))}
        {!actions.length && <EmptyWidget text="Раздел подготовлен в Workspace Core и будет наполнен рабочими сценариями без отдельной архитектуры." />}
      </div>
    </WorkspacePanel>
  );
}

function DataSection({ type, title, subtitle, items = [], emptyText, onOpen }) {
  const visible = items.slice(0, 8);
  return (
    <WorkspacePanel title={title} subtitle={subtitle} actions={<GlassButton onClick={onOpen} tone="gold" style={{ color: '#17120a' }}>Открыть раздел</GlassButton>}>
      {!visible.length ? <EmptyWidget text={emptyText} /> : (
        <ContentGrid min={type === 'news' || type === 'events' ? 260 : 220} gap={12}>
          {visible.map((item, index) => {
            if (type === 'news') return <NewsCard key={item.id || index} item={item} index={index} onOpen={onOpen} />;
            if (type === 'events') return <EventPosterCard key={item.id || index} event={item} index={index} onClick={onOpen} compact />;
            if (type === 'partners') return <PartnerCard key={item.id || index} partner={item} onOpen={() => onOpen?.(item)} />;
            if (type === 'experts') return <ExpertCardV2 key={item.id || index} expert={item} onClick={onOpen} />;
            return <ListRow key={item.id || index} title={safeTitle(item)} text={item.description || item.shortDescription || ''} onClick={onOpen} />;
          })}
        </ContentGrid>
      )}
    </WorkspacePanel>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [shortcutOverlayOpen, setShortcutOverlayOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [aiDraft, setAiDraft] = useState('');
  const [aiHistory, setAiHistory] = useState([]);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1440 : window.innerWidth);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const roleState = useMemo(() => getCabinetRoles({ user, partner: ownedPartner, expert: ownedExpert }), [user, ownedPartner, ownedExpert]);
  const activeRole = roleState.activeRole;
  const activeRoleIdentity = useMemo(() => ({ ...(user || {}), role: activeRole?.id || user?.role || 'user' }), [activeRole?.id, user]);
  const isAdminRole = hasCapability(activeRoleIdentity, CAPABILITIES.canOpenAdminPanel);
  const businessHubFlag = useMemo(() => getBusinessHubFlag(), []);
  const businessHubAvailable = useMemo(() => canUseBusinessHub({ user, partner: ownedPartner, expert: ownedExpert, flag: businessHubFlag }), [user, ownedPartner, ownedExpert, businessHubFlag]);
  const activeProfile = activeRole?.id === 'expert' ? ownedExpert : activeRole?.id === 'partner' ? ownedPartner : user;
  const userName = user?.firstName || user?.name || user?.displayName || 'коллега';
  const layoutPlan = useMemo(() => getDesktopWorkspaceLayoutPlan(viewportWidth, typeof window === 'undefined' ? 900 : window.innerHeight, sidebarCollapsed), [viewportWidth, sidebarCollapsed]);
  const { aiAsDrawer, effectiveSidebarCollapsed, gridTemplateColumns: workspaceColumns } = layoutPlan;
  const navItems = NAV_ITEMS.filter(item => item.id !== 'management' || businessHubAvailable || isAdminRole);
  const workspaceData = { userName, activeProfile, partners, experts, events, news, notifications, unreadCount, userKeys, userCount };

  const handleAskLoki = (text) => {
    const prompt = text?.trim() || buildWorkspaceContext(activeSection).prompt;
    const profileStatus = getProfileCompletion(activeProfile);
    const stamp = Date.now();
    setAiHistory(prev => [
      ...prev,
      { id: `user-${stamp}`, role: 'user', text: prompt },
      { id: `loki-${stamp}`, role: 'loki', text: buildReply({ activeSection, data: workspaceData, profileStatus, text: prompt }) },
    ].slice(-8));
    setAiDraft('');
  };

  const actions = {
    openDashboard: () => setActiveSection('dashboard'),
    openCabinet: () => businessHubAvailable ? setActiveSection('management') : onOpenPanel?.(activeRole?.id === 'expert' ? 'expert-cabinet' : 'partner-cabinet'),
    openNews: () => setActiveSection('news'),
    openEvents: () => setActiveSection('events'),
    openPartners: () => setActiveSection('partners'),
    openExperts: () => setActiveSection('experts'),
    openOffers: () => setActiveSection('offers'),
    openRewards: () => setActiveSection('rewards'),
    openMessages: () => setActiveSection('messages'),
    openAnalytics: () => setActiveSection('analytics'),
    openLoki: () => {
      if (aiAsDrawer) setAiDrawerOpen(true);
      handleAskLoki(buildWorkspaceContext(activeSection).prompt);
    },
  };

  useEffect(() => {
    if (aiHistory.length) return;
    const context = buildWorkspaceContext(activeSection);
    setAiHistory([{ id: `loki-start-${Date.now()}`, role: 'loki', text: `${getDayGreeting()}. Я собрал Workspace вокруг раздела «${context.label}». Начать лучше так: ${context.next}.` }]);
  }, [activeSection, aiHistory.length]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!aiAsDrawer) setAiDrawerOpen(false);
  }, [aiAsDrawer]);

  useEffect(() => {
    const onKeyDown = event => {
      const key = event.key?.toLowerCase();
      if (key === 'escape') {
        setShortcutOverlayOpen(false);
        setContextMenu(null);
      }
      if (key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (!['input', 'textarea', 'select'].includes(tag)) {
          event.preventDefault();
          setShortcutOverlayOpen(value => !value);
        }
      }
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        document.querySelector('[placeholder="Найти задачу, раздел или объект"]')?.focus?.();
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
      if ((event.metaKey || event.ctrlKey) && key === 'b') {
        event.preventDefault();
        setSidebarCollapsed(value => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSection, aiAsDrawer]);

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

  const handleWorkspaceContextMenu = event => {
    const tag = event.target?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag) || event.target?.closest?.('button,input,textarea,select')) return;
    event.preventDefault();
    const x = Math.min(event.clientX, window.innerWidth - 240);
    const y = Math.min(event.clientY, window.innerHeight - 260);
    setContextMenu({ x, y });
  };

  const renderContent = () => {
    if (activeSection === 'dashboard') return <WorkspaceDashboard data={workspaceData} actions={actions} />;
    if (activeSection === 'news') return <DataSection type="news" title="Новости" subtitle="Рабочий список публикаций" items={news} emptyText="Новостей пока нет." onOpen={() => onOpenPanel?.('news')} />;
    if (activeSection === 'events') return <DataSection type="events" title="События" subtitle="Ближайшие мероприятия и календарный контекст" items={events} emptyText="Мероприятий пока нет." onOpen={() => onOpenPanel?.('events')} />;
    if (activeSection === 'partners') return <DataSection type="partners" title="Партнёры" subtitle="Каталог партнёров для рабочей проверки" items={partners} emptyText="Партнёров пока нет." onOpen={() => onOpenPanel?.('offers')} />;
    if (activeSection === 'experts') return <DataSection type="experts" title="Эксперты" subtitle="Профили экспертов и категории" items={experts} emptyText="Экспертов пока нет." onOpen={() => onOpenPanel?.('experts')} />;
    if (activeSection === 'offers') return <DataSection type="partners" title="Акции" subtitle="Партнёры с актуальными предложениями" items={partners.filter(item => item.offer)} emptyText="Акций пока нет." onOpen={() => onOpenPanel?.('offers')} />;
    if (activeSection === 'messages') return <PlaceholderSection title="Сообщения" text="Входящие сигналы, уведомления и будущие диалоги." actions={[{ id: 'notifications', label: 'Открыть уведомления', onClick: () => onOpenPanel?.('notifications'), tone: 'gold' }]} />;
    if (activeSection === 'rewards') return <PlaceholderSection title="Награды" text="Призы, мотивация и пользовательские достижения." actions={[{ id: 'rewards', label: 'Открыть награды', onClick: () => onOpenPanel?.('rewards'), tone: 'gold' }]} />;
    if (activeSection === 'keys') return <PlaceholderSection title="Ключи" text="Экономика ключей, QR и активность пользователей." actions={[{ id: 'scan', label: 'Открыть сканер', onClick: () => onOpenPanel?.('scan'), tone: 'gold' }]} />;
    if (activeSection === 'analytics') return <PlaceholderSection title="Аналитика" text="Ключевые показатели уже собраны справа; расширенный раздел подключится без новой архитектуры." actions={[{ id: 'loki', label: 'Спросить Локи о метриках', onClick: actions.openLoki }]} />;
    if (activeSection === 'management') {
      if (businessHubAvailable) {
        return <BusinessHub user={user} ownedPartner={ownedPartner} ownedExpert={ownedExpert} partners={partners} experts={experts} events={events} news={news} notifications={notifications} activeRoleId={activeRole?.id} onOpenPanel={onOpenPanel} />;
      }
      return <PlaceholderSection title="Управление" text="Кабинет, админка и настройки Workspace." actions={[isAdminRole && { id: 'admin', label: 'Админка', onClick: onOpenAdmin, tone: 'gold' }, { id: 'profile', label: 'Профиль', onClick: () => onOpenPanel?.('profile') }].filter(Boolean)} />;
    }
    return null;
  };

  const activeLabel = navItems.find(item => item.id === activeSection)?.label || 'Workspace';

  return (
    <div onContextMenu={handleWorkspaceContextMenu} style={{ minHeight: '100dvh', background: APG2_PROFILE.workspaceBg, color: APG2_PROFILE.text, padding: WORKSPACE_LAYOUT.pagePadding, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', gap: WORKSPACE_LAYOUT.gap, height: `calc(100dvh - ${WORKSPACE_LAYOUT.pagePadding * 2}px)`, minHeight: 0 }}>
        <WorkspaceHeaderBar user={user} onModeChange={onModeChange} unreadCount={unreadCount} query={query} onQueryChange={setQuery} onOpenNotifications={() => setActiveSection('messages')} onOpenProfile={() => onOpenPanel?.('profile')} />
        <div data-workspace-layout="desktop-grid" style={{ display: 'grid', gridTemplateColumns: workspaceColumns, gap: WORKSPACE_LAYOUT.gap, alignItems: 'stretch', minHeight: 0, height: '100%', overflow: 'hidden' }}>
          <WorkspaceSidebar items={navItems} activeSection={activeSection} collapsed={effectiveSidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} onSelect={handleSelectNav} user={user} onModeChange={onModeChange} />
          <main data-workspace-region="content" style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', display: 'block', position: 'relative', zIndex: WORKSPACE_Z.content, paddingRight: 2 }}>
            <SectionHeader title={activeLabel} subtitle={query ? `Поиск: ${query}` : 'профессиональная рабочая панель АПГ'} actions={<GlassBadge tone="gold">Workspace 2.0</GlassBadge>} />
            {renderContent()}
          </main>
          {!aiAsDrawer && (
            <aside data-workspace-region="ai-column" style={{ minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: WORKSPACE_Z.content }}>
              <RightWorkspacePanel data={workspaceData} activeSection={activeSection} aiDraft={aiDraft} aiHistory={aiHistory} onDraftChange={setAiDraft} onAskLoki={handleAskLoki} actions={actions} />
            </aside>
          )}
        </div>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 24, padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: APG2_PROFILE.textSoft, fontSize: 12, background: APG2_PROFILE.quietSurface }}>
          <span>Workspace 2.0 · ⌘K поиск · ⌘1 сводка · ⌘2 управление · ⌘L Локи · ? помощь</span>
          <span>{partners.length} партнёров · {experts.length} экспертов · {news.length} новостей · {events.length} событий</span>
        </div>
      </div>
      {aiAsDrawer && aiDrawerOpen && (
        <div data-workspace-region="ai-drawer" onClick={() => setAiDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: WORKSPACE_Z.drawer, background: 'rgba(12,12,14,0.34)', display: 'flex', justifyContent: 'flex-end', padding: 14, boxSizing: 'border-box' }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 'min(420px, 100%)', height: '100%', minHeight: 0, position: 'relative' }}>
            <GlassButton onClick={() => setAiDrawerOpen(false)} style={{ position: 'absolute', right: 12, top: 12, zIndex: WORKSPACE_Z.popover, width: 38, minHeight: 38, padding: 0, borderRadius: 16 }}>×</GlassButton>
            <RightWorkspacePanel data={workspaceData} activeSection={activeSection} aiDraft={aiDraft} aiHistory={aiHistory} onDraftChange={setAiDraft} onAskLoki={handleAskLoki} actions={actions} />
          </div>
        </div>
      )}
      {shortcutOverlayOpen && <WorkspaceShortcutOverlay onClose={() => setShortcutOverlayOpen(false)} />}
      {contextMenu && <WorkspaceContextMenu menu={contextMenu} actions={actions} onClose={() => setContextMenu(null)} />}
    </div>
  );
}

function WorkspaceShortcutOverlay({ onClose }) {
  const shortcuts = [
    ['⌘K / Ctrl K', 'поиск'],
    ['⌘1 / Ctrl 1', 'сводка'],
    ['⌘2 / Ctrl 2', 'управление'],
    ['⌘L / Ctrl L', 'Локи'],
    ['⌘B / Ctrl B', 'свернуть меню'],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: WORKSPACE_Z.modal, background: 'rgba(12,12,14,0.32)', display: 'grid', placeItems: 'center', padding: 18 }}>
      <div onClick={event => event.stopPropagation()} style={{ ...APG2_PROFILE.glass, borderRadius: 30, padding: 18, width: 'min(440px, 100%)', background: APG2_PROFILE.quietSurface }}>
        <SectionHeader title="Горячие клавиши" subtitle="Workspace управляется без лишних переходов" actions={<GlassButton onClick={onClose} style={{ width: 36, minHeight: 36, padding: 0 }}>×</GlassButton>} />
        <div style={{ display: 'grid', gap: 8 }}>
          {shortcuts.map(([key, text]) => <ListRow key={key} title={key} text={text} icon="⌘" />)}
        </div>
      </div>
    </div>
  );
}

function WorkspaceContextMenu({ menu, actions, onClose }) {
  if (!menu) return null;
  const items = [
    ['Сводка', actions.openDashboard],
    ['Новости', actions.openNews],
    ['События', actions.openEvents],
    ['Партнёры', actions.openPartners],
    ['Эксперты', actions.openExperts],
    ['Локи', actions.openLoki],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: WORKSPACE_Z.popover }}>
      <div style={{ ...APG2_PROFILE.glass, position: 'fixed', left: menu.x, top: menu.y, width: 220, borderRadius: 22, padding: 8, display: 'grid', gap: 5, background: APG2_PROFILE.quietSurface, boxShadow: '0 24px 64px rgba(0,0,0,0.24)' }}>
        {items.map(([label, onClick]) => (
          <button key={label} type="button" onClick={() => { onClick?.(); onClose?.(); }} style={{ border: 0, borderRadius: 16, padding: '10px 12px', background: 'transparent', color: APG2_PROFILE.text, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 820 }}>{label}</button>
        ))}
      </div>
    </div>
  );
}
