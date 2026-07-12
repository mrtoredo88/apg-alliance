import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard } from '../components/Apg2ProfileGlass.jsx';
import { motionTransition } from '../motion.js';
import { BusinessHub } from '../businessHub/BusinessHub.jsx';
import { canUseBusinessHub, getBusinessHubFlag } from '../businessHub/BusinessHubCore.js';
import { getCabinetRoles } from '../cabinet/CabinetRoleEngine.js';
import { LokiIdentity } from '../loki/LokiIdentity.jsx';
import { NewsCard } from '../NewsPage.jsx';
import { EventPosterCard } from '../EventsPage.jsx';
import { PartnerCard } from '../HomePanelV2.jsx';
import { ExpertCardV2 } from '../ExpertsPage.jsx';
import {
  ActionCard,
  ContentGrid,
  DashboardCard,
  MetricCard,
  QuickActions,
  SectionHeader,
  WorkspacePanel,
} from './WorkspaceComponents.jsx';
import { buildWorkspaceLayout, WORKSPACE_MODES } from './WorkspaceCore.js';
import { getDesktopWorkspaceLayoutPlan, WORKSPACE_LAYOUT, WORKSPACE_Z } from './WorkspaceLayoutEngine.js';
import { CAPABILITIES, hasCapability } from '../roleEngine.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦', group: 'Работа', hint: 'Главный рабочий экран', shortcut: '⌘1' },
  { id: 'business-hub', label: 'Мой бизнес', icon: '◈', group: 'Работа', businessOnly: true, hint: 'Профиль, аналитика и задачи бизнеса', shortcut: '⌘2' },
  { id: 'content', label: 'Контент', icon: '✎', group: 'Работа', hint: 'Новости и мероприятия', shortcut: '⌘3' },
  { id: 'news', label: 'Новости', icon: '📰', group: 'Контент', panelId: 'news', hint: 'Рабочий список публикаций' },
  { id: 'events', label: 'Мероприятия', icon: '📅', group: 'Контент', panelId: 'events', hint: 'События и календарный контекст' },
  { id: 'partners', label: 'Партнёры', icon: '🤝', group: 'Каталоги', panelId: 'offers', hint: 'Каталог партнёров' },
  { id: 'experts', label: 'Эксперты', icon: '✦', group: 'Каталоги', panelId: 'experts', hint: 'Каталог экспертов' },
  { id: 'crm', label: 'CRM', icon: '◇', group: 'Система', placeholder: true, hint: 'Заявки и клиенты, готовится' },
  { id: 'calendar', label: 'Календарь', icon: '◷', group: 'Система', placeholder: true, hint: 'Расписание и записи, готовится' },
  { id: 'loki', label: 'Локи', icon: '◈', group: 'Система', panelId: 'loki', hint: 'Интеллектуальная рабочая панель', shortcut: '⌘L' },
  { id: 'settings', label: 'Настройки', icon: '⚙', group: 'Система', panelId: 'profile', hint: 'Профиль и параметры' },
  { id: 'admin', label: 'Администрирование', icon: '🛡', group: 'Система', adminOnly: true, hint: 'Административная панель' },
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

function getProfileCompletion(profile) {
  if (!profile?.id) return { label: 'Профиль не выбран', value: 0, missing: ['Откройте кабинет'] };
  const checks = [
    ['name', profile.name],
    ['description', profile.description || profile.shortDescription],
    ['photo', profile.photo || profile.logoUrl],
    ['contacts', profile.phone || profile.telegramUrl || profile.vkUrl || profile.websiteUrl],
    ['offer', profile.offer || profile.gift],
  ];
  const done = checks.filter(([, value]) => Boolean(value)).length;
  return {
    label: `${done} из ${checks.length} пунктов`,
    value: Math.round(done / checks.length * 100),
    missing: checks.filter(([, value]) => !value).map(([key]) => key),
  };
}

function getDayGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Работаем поздно';
}

function getWorkspaceContext(activeSection) {
  const map = {
    dashboard: {
      label: 'Dashboard',
      focus: 'начать рабочий день с главного',
      prompt: 'Покажи, что сегодня важнее всего проверить',
      recommendations: ['Проверить задачи дня', 'Открыть профиль бизнеса', 'Посмотреть последние действия'],
    },
    'business-hub': {
      label: 'Мой бизнес',
      focus: 'улучшить карточку и рабочие показатели',
      prompt: 'Что можно улучшить в карточке бизнеса?',
      recommendations: ['Проверить заполненность профиля', 'Добавить фотографии', 'Подготовить акцию'],
    },
    content: {
      label: 'Контент',
      focus: 'собрать новости и мероприятия в один план',
      prompt: 'Помоги составить контент-план на сегодня',
      recommendations: ['Открыть новости', 'Проверить мероприятия', 'Подготовить публикацию'],
    },
    news: {
      label: 'Новости',
      focus: 'проверить публикации и подготовить новые материалы',
      prompt: 'Какие новости стоит проверить сейчас?',
      recommendations: ['Проверить последние новости', 'Подготовить публикацию', 'Найти материалы без обложек'],
    },
    events: {
      label: 'Мероприятия',
      focus: 'проверить афишу и ближайшие события',
      prompt: 'Какие мероприятия требуют внимания?',
      recommendations: ['Проверить ближайшие события', 'Подготовить уведомление', 'Проверить карточки мероприятий'],
    },
    partners: {
      label: 'Партнёры',
      focus: 'увидеть состояние партнёрского каталога',
      prompt: 'Каких партнёров стоит проверить?',
      recommendations: ['Проверить карточки партнёров', 'Найти профили без описания', 'Открыть Business Hub'],
    },
    experts: {
      label: 'Эксперты',
      focus: 'проверить экспертные карточки и рекомендации',
      prompt: 'Каких экспертов стоит проверить?',
      recommendations: ['Проверить карточки экспертов', 'Найти неполные профили', 'Проверить категории'],
    },
    crm: {
      label: 'CRM',
      focus: 'держать заявки и клиентов под контролем',
      prompt: 'Что важно проверить в CRM?',
      recommendations: ['Проверить новые заявки', 'Посмотреть историю контактов', 'Подготовить следующий шаг'],
    },
    calendar: {
      label: 'Календарь',
      focus: 'собрать расписание и записи',
      prompt: 'Что сегодня по расписанию?',
      recommendations: ['Проверить ближайшие даты', 'Найти пересечения', 'Подготовить напоминания'],
    },
    settings: {
      label: 'Настройки',
      focus: 'настроить рабочее пространство без лишнего шума',
      prompt: 'Что в настройках Workspace стоит проверить?',
      recommendations: ['Проверить роль', 'Проверить режим', 'Открыть профиль'],
    },
  };
  return map[activeSection] || map.dashboard;
}

function buildLokiBriefing({ data, profileStatus, attention }) {
  const briefing = [
    data.unreadCount ? `${data.unreadCount} уведомлений требуют внимания` : '',
    data.events.length ? `${data.events.length} мероприятий в рабочем контексте` : '',
    data.news.length ? `${data.news.length} новостей доступны для проверки` : '',
    profileStatus.value < 100 ? `профиль заполнен на ${profileStatus.value}%` : 'профиль выглядит заполненным',
    attention.length ? `${attention.length} рабочих рекомендаций` : '',
  ].filter(Boolean);
  return briefing.length ? briefing : ['критичных сигналов не найдено'];
}

function buildContextualReply({ activeSection, data, profileStatus, text }) {
  const context = getWorkspaceContext(activeSection);
  const safeText = text?.trim();
  const facts = [
    `${data.news.length} новостей`,
    `${data.events.length} мероприятий`,
    `${data.unreadCount || 0} уведомлений`,
    `заполненность профиля ${profileStatus.value}%`,
  ];
  const nextStep = context.recommendations[0] || 'проверить Dashboard';
  return safeText
    ? `Я вижу контекст раздела «${context.label}»: ${facts.join(' · ')}. По запросу «${safeText}» безопасный следующий шаг — ${nextStep.toLowerCase()}.`
    : `Сейчас открыт раздел «${context.label}». Я бы начал так: ${nextStep.toLowerCase()}.`;
}

function WorkspaceHeaderBar({ user, unreadCount, query, onQueryChange, onModeChange, onOpenNotifications, onOpenProfile }) {
  return (
    <div data-workspace-region="header" style={{ ...APG2_PROFILE.glass, borderRadius: 24, padding: '11px 12px', display: 'grid', gridTemplateColumns: 'auto minmax(260px, 1fr) auto', alignItems: 'center', gap: 14, minHeight: WORKSPACE_LAYOUT.headerHeight, background: APG2_PROFILE.quietSurface, position: 'relative', zIndex: WORKSPACE_Z.header }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 14, background: APG2_PROFILE.goldGradient, color: '#17120a', display: 'grid', placeItems: 'center', fontWeight: 950, fontSize: 14 }}>АПГ</div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '19px', fontWeight: 930 }}>Workspace</div>
      </div>
      <label style={{ ...APG2_PROFILE.glass, borderRadius: 16, minHeight: 38, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: APG2_PROFILE.gold, fontSize: 15 }}>⌕</span>
        <input
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder="Поиск по Workspace"
          style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', color: APG2_PROFILE.text, fontFamily: 'inherit', fontSize: 13.5 }}
        />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <GlassButton onClick={onOpenNotifications} style={{ minHeight: 36, padding: '8px 12px' }}>{unreadCount ? `Уведомления · ${unreadCount}` : 'Уведомления'}</GlassButton>
        <GlassButton onClick={() => onModeChange?.('user')} style={{ minHeight: 36, padding: '8px 12px' }}>Пользовательский режим</GlassButton>
        <button type="button" onClick={onOpenProfile} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{String(user?.firstName || user?.name || 'A').slice(0, 1)}</div>
        </button>
      </div>
    </div>
  );
}

function WorkspaceSidebar({ items, activeSection, collapsed, onToggle, onSelect }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const scrollRef = useRef(null);
  const groups = items.reduce((acc, item) => {
    const group = item.group || 'Workspace';
    if (!acc.some(entry => entry.group === group)) acc.push({ group, items: [] });
    acc.find(entry => entry.group === group).items.push(item);
    return acc;
  }, []);
  const showTooltip = (item, event) => {
    const scrollTop = scrollRef.current?.scrollTop || 0;
    setHoveredItem({ ...item, top: event.currentTarget.offsetTop - scrollTop });
  };
  return (
    <div data-workspace-region="sidebar" style={{ ...APG2_PROFILE.glass, borderRadius: 30, padding: collapsed ? '10px 8px' : 10, height: '100%', minHeight: 0, overflow: 'visible', position: 'relative', zIndex: WORKSPACE_Z.sidebar, display: 'flex', flexDirection: 'column', gap: 10, transition: motionTransition(['width', 'padding', 'background'], 'base'), width: '100%', background: 'linear-gradient(180deg, rgba(var(--apg2-glass-a,255,255,255),0.18), rgba(var(--apg2-glass-a,255,255,255),0.09))', boxShadow: '0 20px 70px rgba(0,0,0,0.14)' }}>
      <div style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', padding: collapsed ? '0 0 2px' : '2px 3px 6px' }}>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase' }}>Навигация</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', marginTop: 2 }}>Рабочие области АПГ</div>
          </div>
        )}
        <GlassButton onClick={onToggle} style={{ minHeight: collapsed ? 38 : 34, width: collapsed ? 38 : 34, padding: 0, borderRadius: 999, fontSize: 18, boxShadow: collapsed ? '0 12px 26px rgba(0,0,0,0.12)' : undefined }}>{collapsed ? '›' : '‹'}</GlassButton>
      </div>
      <div ref={scrollRef} onScroll={() => setHoveredItem(null)} style={{ display: 'grid', gap: collapsed ? 9 : 10, position: 'relative', minHeight: 0, overflowY: 'auto', overflowX: 'visible', padding: collapsed ? '1px 0 8px' : '1px 2px 8px 0', overscrollBehavior: 'contain' }}>
        {groups.map(group => (
          <div key={group.group} style={{ display: 'grid', gap: 5 }}>
            {!collapsed && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10, lineHeight: '13px', fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', padding: '0 9px' }}>{group.group}</div>}
            {collapsed && <div style={{ height: 1, margin: '3px 14px 4px', background: 'linear-gradient(90deg, transparent, rgba(215,184,106,0.24), transparent)' }} />}
            {group.items.map(item => {
          const active = activeSection === item.id;
          const hovered = hoveredItem?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              onMouseEnter={event => showTooltip(item, event)}
              onMouseLeave={() => setHoveredItem(null)}
              onFocus={event => showTooltip(item, event)}
              onBlur={() => setHoveredItem(null)}
              title={item.label}
              style={{
              border: active ? '1px solid rgba(215,184,106,0.58)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)',
              background: active ? APG2_PROFILE.goldSoft : hovered ? 'rgba(var(--apg2-glass-a,255,255,255),0.16)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)',
              borderRadius: collapsed ? 999 : 22,
              minHeight: collapsed ? 48 : 44,
              width: collapsed ? 48 : '100%',
              padding: collapsed ? 0 : '0 12px',
              margin: collapsed ? '0 auto' : 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10,
              color: active ? APG2_PROFILE.gold : APG2_PROFILE.text,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 820,
              cursor: 'pointer',
              outline: hovered ? '2px solid rgba(215,184,106,0.18)' : 'none',
              outlineOffset: 2,
              transform: hovered ? collapsed ? 'scale(1.045)' : 'translateX(2px)' : 'translateX(0) scale(1)',
              boxShadow: active ? '0 14px 34px rgba(215,184,106,0.20)' : hovered ? '0 12px 26px rgba(0,0,0,0.12)' : 'none',
              transition: motionTransition(['background', 'border-color', 'transform', 'box-shadow'], 'base'),
            }}>
              <span style={{ width: collapsed ? 32 : 27, height: collapsed ? 32 : 27, borderRadius: 999, display: 'grid', placeItems: 'center', textAlign: 'center', background: active ? APG2_PROFILE.goldGradient : 'rgba(var(--apg2-glass-a,255,255,255),0.10)', color: active ? '#17120a' : APG2_PROFILE.gold, fontSize: item.icon.length > 1 ? 15 : 16, boxShadow: active ? '0 10px 24px rgba(215,184,106,0.24)' : 'inset 0 1px 0 rgba(255,255,255,0.16)' }}>{item.icon}</span>
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.label}</span>}
              {!collapsed && item.shortcut && <span style={{ color: APG2_PROFILE.textMuted, fontSize: 10, fontWeight: 850 }}>{item.shortcut}</span>}
            </button>
          );
            })}
          </div>
        ))}
      </div>
      {collapsed && hoveredItem && (
        <div style={{ ...APG2_PROFILE.glass, position: 'absolute', left: 72, top: Math.max(54, hoveredItem.top + 54), zIndex: WORKSPACE_Z.popover, width: 230, borderRadius: 20, padding: 12, pointerEvents: 'none', boxShadow: '0 22px 54px rgba(0,0,0,0.22)', background: APG2_PROFILE.quietSurface }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 13, fontWeight: 900 }}>{hoveredItem.label}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '16px', marginTop: 3 }}>{hoveredItem.hint}</div>
        </div>
      )}
      <div style={{ marginTop: 'auto', display: collapsed ? 'none' : 'block' }}>
        <GlassCard style={{ borderRadius: 24, padding: 13, background: 'rgba(var(--apg2-glass-a,255,255,255),0.10)' }}>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 850 }}>Workspace 2.1</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '16px', marginTop: 4 }}>Рабочая среда, где Локи ведёт рабочий день.</div>
        </GlassCard>
      </div>
    </div>
  );
}

function LokiWorkspaceHero({ data, profileStatus, attention, actions }) {
  const profileName = data.activeProfile?.name || data.activeProfile?.title || data.roleLabel || 'Workspace';
  const lokiCount = attention.length || (profileStatus.value < 100 ? 1 : 0) || 1;
  const briefing = buildLokiBriefing({ data, profileStatus, attention });
  const heroMetrics = [
    { label: 'Уведомления', value: data.unreadCount || 0 },
    { label: 'Мероприятия', value: data.events.length },
    { label: 'Новости', value: data.news.length },
    { label: 'Рекомендации Локи', value: lokiCount },
  ];
  return (
    <div style={{
      position: 'relative',
      minHeight: 282,
      overflow: 'hidden',
      borderRadius: APG2_PROFILE.radius.hero,
      padding: 24,
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.25fr) minmax(300px,0.75fr)',
      gap: 22,
      alignItems: 'stretch',
      background: APG2_PROFILE.heroSurface,
      border: '1px solid rgba(244,217,140,0.30)',
      boxShadow: '0 38px 92px rgba(0,0,0,0.24), 0 0 70px rgba(215,184,106,0.08), inset 0 1.5px 0 rgba(255,255,255,0.34), inset 0 -36px 78px rgba(255,255,255,0.055)',
    }}>
      <div style={{ position: 'absolute', left: -80, right: -80, top: 74, height: 120, background: 'linear-gradient(110deg, transparent 10%, rgba(244,217,140,0.12) 38%, rgba(255,255,255,0.08) 48%, transparent 72%)', transform: 'rotate(-8deg)', filter: 'blur(8px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
        <div>
          <GlassBadge tone="gold">Рабочий день</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 42, lineHeight: '47px', fontWeight: 940, letterSpacing: -0.8, marginTop: 16 }}>
            {getDayGreeting()}, {data.userName}.
          </div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 15, lineHeight: '23px', marginTop: 10, maxWidth: 660 }}>
            Сегодня ваш рабочий день уже собран: в приоритете неформальный шум, а только то, что нужно сделать.
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 18, maxWidth: 650 }}>
            {briefing.slice(0, 5).map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9, color: APG2_PROFILE.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 760 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: APG2_PROFILE.gold, boxShadow: '0 0 18px rgba(215,184,106,0.44)', flex: '0 0 auto' }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <QuickActions actions={[
          { id: 'start', label: 'Начать рабочий день', onClick: actions.openDashboard, tone: 'gold' },
          { id: 'business', label: 'Мой бизнес', onClick: actions.openCabinet },
          { id: 'loki', label: 'Спросить Локи', onClick: actions.openLoki },
        ]} style={{ background: 'transparent', border: 0, padding: 0, marginTop: 18 }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 12, minWidth: 0 }}>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 28, padding: 14, background: APG2_PROFILE.quietSurface }}>
          <LokiIdentity size={52} state={attention.length ? 'recommending' : 'waiting'} label="Локи на смене" sublabel={attention.length ? 'подсветил важное' : 'держит Workspace в контексте'} />
        </div>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 26, padding: 14, background: APG2_PROFILE.quietSurface }}>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.7 }}>Активный профиль</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '23px', fontWeight: 920, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileName}</div>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 820, marginTop: 5 }}>Заполненность {profileStatus.value}% · {profileStatus.label}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <div style={{ ...APG2_PROFILE.glass, borderRadius: 24, padding: 13, minWidth: 0, background: APG2_PROFILE.quietSurface }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 25, lineHeight: '28px', fontWeight: 940 }}>{data.news.length}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '15px', marginTop: 4 }}>новостей</div>
          </div>
          <div style={{ ...APG2_PROFILE.glass, borderRadius: 24, padding: 13, minWidth: 0, background: APG2_PROFILE.quietSurface }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 25, lineHeight: '28px', fontWeight: 940 }}>{data.events.length}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '15px', marginTop: 4 }}>мероприятий</div>
          </div>
        </div>
      </div>
    </div>
  );
}


function WorkspaceDashboard({ data, actions }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const latestNews = data.news.slice(0, 4);
  const latestEvents = data.events.slice(0, 4);
  const todayEvents = data.events.slice(0, 2);
  const attention = [
    data.unreadCount ? `${data.unreadCount} уведомлений ждут просмотра` : 'Уведомлений нет',
    data.news.length ? `${data.news.length} новостей в ожидании` : '',
    data.events.length ? `${data.events.length} мероприятий в календаре` : '',
    profileStatus.value < 100 ? `Профиль заполнен на ${profileStatus.value}%` : '',
  ].filter(Boolean);

  return (
    <div style={{ display: 'grid', gap: APG2_PROFILE.rhythm.section }}>
      <LokiWorkspaceHero data={data} profileStatus={profileStatus} attention={attention} actions={actions} />

      <WorkspacePanel title="Требует внимания" subtitle="Что лучше закрыть в первую очередь" style={{ minHeight: 170 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {attention.length ? attention.map(item => <ListRow key={item} title={item} text="Рекомендовано для начала" />) : <EmptyWidget text="Критичных сигналов не найдено." />}
        </div>
        <div style={{ marginTop: 12 }}><QuickActions actions={[{ id: 'loki', label: 'Что советует Локи?', onClick: actions.openLoki }, { id: 'business', label: 'Перейти в бизнес', onClick: actions.openCabinet }]} /></div>
      </WorkspacePanel>

      <WorkspacePanel title="Сегодня" subtitle="Операционный срез дня" style={{ minHeight: 170 }}>
        <ContentGrid min={170} gap={10}>
          <MetricCard label="Новости" value={data.news.length} delta="готовность публикаций" />
          <MetricCard label="Мероприятия" value={data.events.length} delta="ожидают проверки" />
          <MetricCard label="Уведомления" value={data.unreadCount || 0} delta="требуют действий" />
          <MetricCard label="Партнёры" value={data.partners.length} delta="в каталоге" />
        </ContentGrid>
      </WorkspacePanel>

      <WorkspacePanel title="Мой бизнес" subtitle="Быстрый статус профиля владельца" style={{ minHeight: 170 }}>
        <ContentGrid min={180} gap={10}>
          <MetricCard label="Заполненность профиля" value={`${profileStatus.value}%`} delta={profileStatus.label} tone={profileStatus.value >= 80 ? 'gold' : undefined} />
          <MetricCard label="Роль" value={data.roleLabel} delta="активный контур" />
        </ContentGrid>
        <div style={{ marginTop: 12 }}><GlassButton onClick={actions.openCabinet} style={{ width: '100%' }}>Открыть карточку бизнеса</GlassButton></div>
      </WorkspacePanel>

      <SectionHeader title="Контент сегодня" subtitle="Что нужно проверить прямо сейчас" />
      <WorkspacePanel title="Контент сегодня" subtitle="Новости и мероприятия для проверки" style={{ minHeight: 300 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, alignItems: 'start' }}>
          <div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, marginBottom: 8 }}>Новости</div>
            <NewsCardsGrid items={latestNews.slice(0, 2)} onOpen={actions.openNews} columns={1} compact />
            {!latestNews.length && <EmptyWidget text="Новостей не найдено" />}
          </div>
          <div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, marginBottom: 8 }}>Мероприятия</div>
            <EventCardsGrid items={latestEvents.slice(0, 2)} onOpen={actions.openEvents} columns={1} compact />
            {!latestEvents.length && <EmptyWidget text="Мероприятий не найдено" />}
          </div>
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Последние события" subtitle="Что изменилось в публичной среде" style={{ minHeight: 210 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {todayEvents.length ? todayEvents.map(event => <ListRow key={event.id || event.title || event.name} title={event.title || event.name} text={formatShortDate(event.startDate || event.date || event.createdAt)} />) : <EmptyWidget text="Событий сегодня пока нет." />}
        </div>
      </WorkspacePanel>

      <WorkspacePanel title="Быстрые действия" subtitle="Переходите сразу к рабочему фокусу" style={{ minHeight: 170 }}>
        <ContentGrid min={180} gap={10}>
          <ActionCard icon="📰" title="Новости" text="Открыть ленту и публикации" onClick={actions.openNews} />
          <ActionCard icon="📅" title="Мероприятия" text="Проверить ближайшие события" onClick={actions.openEvents} />
          <ActionCard icon="🤝" title="Партнёры" text="Каталог партнёров" onClick={actions.openPartners} />
          <ActionCard icon="✦" title="Эксперты" text="Каталог экспертов" onClick={actions.openExperts} />
        </ContentGrid>
      </WorkspacePanel>
    </div>
  );
}

function ListRow({ title, text }) {
  return (
    <div style={{ ...APG2_PROFILE.glass, borderRadius: 20, padding: '11px 13px', background: APG2_PROFILE.quietSurface }}>
      <div style={{ color: APG2_PROFILE.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 830, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
      {text && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '16px', marginTop: 2 }}>{text}</div>}
    </div>
  );
}

function EmptyWidget({ text }) {
  return <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', padding: 12 }}>{text}</div>;
}

function WorkspaceShortcutOverlay({ open, onClose }) {
  if (!open) return null;
  const shortcuts = [
    ['⌘K / Ctrl K', 'Фокус поиска'],
    ['⌘1 / Ctrl 1', 'Dashboard'],
    ['⌘2 / Ctrl 2', 'Мой бизнес'],
    ['⌘3 / Ctrl 3', 'Контент'],
    ['⌘B / Ctrl B', 'Свернуть sidebar'],
    ['?', 'Подсказки'],
    ['Esc', 'Закрыть панели'],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: WORKSPACE_Z.modal, background: 'rgba(8,8,10,0.34)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={event => event.stopPropagation()} style={{ ...APG2_PROFILE.glass, width: 'min(520px, 100%)', borderRadius: 30, padding: 18 }}>
        <SectionHeader title="Горячие клавиши" subtitle="Desktop Workspace управляется без лишних переходов" actions={<GlassButton onClick={onClose} style={{ width: 36, minHeight: 36, padding: 0 }}>×</GlassButton>} />
        <div style={{ display: 'grid', gap: 8 }}>
          {shortcuts.map(([keys, text]) => (
            <div key={keys} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'center', color: APG2_PROFILE.text }}>
              <GlassBadge tone="gold" style={{ justifyContent: 'center' }}>{keys}</GlassBadge>
              <span style={{ color: APG2_PROFILE.textSoft, fontSize: 13 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkspaceContextMenu({ menu, actions, onClose }) {
  if (!menu) return null;
  const items = [
    ['dashboard', '▦ Dashboard', () => actions.openDashboard?.()],
    ['business', '◈ Мой бизнес', () => actions.openCabinet?.()],
    ['news', '📰 Новости', () => actions.openNews?.()],
    ['events', '📅 Мероприятия', () => actions.openEvents?.()],
    ['loki', '◈ Спросить Локи', () => actions.openLoki?.()],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: WORKSPACE_Z.popover, background: 'transparent' }}>
      <div style={{ ...APG2_PROFILE.glass, position: 'fixed', left: menu.x, top: menu.y, width: 220, borderRadius: 20, padding: 7, boxShadow: '0 22px 70px rgba(0,0,0,0.34), inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.30)' }}>
        {items.map(([id, label, action]) => (
          <button
            key={id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              action?.();
              onClose?.();
            }}
            style={{ width: '100%', minHeight: 38, border: 0, borderRadius: 14, background: 'transparent', color: APG2_PROFILE.text, fontFamily: 'inherit', fontSize: 13, fontWeight: 780, textAlign: 'left', padding: '0 10px', cursor: 'pointer' }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlaceholderSection({ title, text, actions }) {
  return (
    <WorkspacePanel title={title} subtitle={text}>
      {actions && <QuickActions actions={actions} />}
      <ContentGrid min={220} gap={12} style={{ marginTop: 12 }}>
        <DashboardCard title="Архитектура готова" subtitle="Раздел будет подключён как workspace-модуль без отдельного desktop-layout." icon="▣" />
        <DashboardCard title="Split view" subtitle="Центральная область уже поддерживает широкий рабочий сценарий." icon="⇄" />
      </ContentGrid>
    </WorkspacePanel>
  );
}

function NewsCardsGrid({ items, onOpen, columns = 2, compact = false }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: compact ? 12 : 14, alignItems: 'start' }}>
      {items.map((item, index) => (
        <NewsCard
          key={item.id || item.externalId || item.title || index}
          item={item}
          index={index + (compact ? 1 : 0)}
          onOpen={() => onOpen?.(item)}
          onShare={() => onOpen?.(item)}
        />
      ))}
    </div>
  );
}

function EventCardsGrid({ items, onOpen, columns = 2, compact = false }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: compact ? 12 : 14, alignItems: 'start' }}>
      {items.map((item, index) => (
        <EventPosterCard
          key={item.id || item.title || item.name || index}
          event={item}
          index={index}
          compact={compact}
          onClick={() => onOpen?.(item)}
        />
      ))}
    </div>
  );
}

function PartnerCardsGrid({ items, onOpen, columns = 2 }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 10, alignItems: 'start' }}>
      {items.slice(0, 12).map((partner, index) => (
        <PartnerCard
          key={partner.id || partner.title || partner.name || index}
          partner={partner}
          index={index}
          isFavorite={false}
          onOpen={(item) => onOpen?.(item)}
          onToggleFavorite={() => {}}
        />
      ))}
    </div>
  );
}

function ExpertCardsGrid({ items, onOpen, columns = 2 }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 10, alignItems: 'start' }}>
      {items.slice(0, 12).map((expert, index) => (
        <ExpertCardV2
          key={expert.id || expert.title || expert.name || index}
          expert={expert}
          onClick={(item) => onOpen?.(item)}
          isTop={false}
        />
      ))}
    </div>
  );
}

function DataSection({ title, subtitle, items, emptyText, onOpen, columns = 2, type = 'default' }) {
  const content = type === 'news'
    ? <NewsCardsGrid items={items.slice(0, 12)} onOpen={onOpen} columns={columns} />
    : type === 'events'
      ? <EventCardsGrid items={items.slice(0, 12)} onOpen={onOpen} columns={columns} />
      : type === 'partners'
        ? <PartnerCardsGrid items={items.slice(0, 12)} onOpen={onOpen} columns={columns} />
        : type === 'experts'
          ? <ExpertCardsGrid items={items.slice(0, 12)} onOpen={onOpen} columns={columns} />
      : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 10 }}>
          {items.length ? items.slice(0, 12).map(item => (
            <button key={item.id || item.title || item.name} type="button" onClick={() => onOpen?.(item)} style={{
              ...APG2_PROFILE.glass,
              borderRadius: 22,
              padding: 12,
              minHeight: 92,
              color: APG2_PROFILE.text,
              fontFamily: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
              transition: motionTransition(['transform', 'border-color', 'background'], 'base'),
            }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.name || 'Без названия'}</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.description || item.shortDescription || item.categoryLabel || item.address || formatShortDate(item.date || item.createdAt)}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <GlassBadge>{item.status || item.category || item.tariff || 'АПГ'}</GlassBadge>
              </div>
            </button>
          )) : <EmptyWidget text={emptyText} />}
        </div>
      );
  return (
    <WorkspacePanel title={title} subtitle={subtitle}>
      {items.length ? content : <EmptyWidget text={emptyText} />}
    </WorkspacePanel>
  );
}

function AIWorkspacePanel({ data, activeSection, aiDraft, aiHistory, aiPulse, onDraftChange, onAskLoki, actions }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const context = getWorkspaceContext(activeSection);
  const attention = [
    data.unreadCount ? `${data.unreadCount} уведомлений ждут внимания` : 'Уведомлений нет',
    profileStatus.value < 80 ? `Профиль заполнен на ${profileStatus.value}%` : '',
    !data.news.length ? 'Нет новых новостей в рабочем контексте' : '',
    !data.events.length ? 'Нет активных мероприятий' : '',
  ].filter(Boolean);

  const briefing = buildLokiBriefing({ data, profileStatus, attention });
  const recommendations = [
    ...context.recommendations,
    data.unreadCount ? `Разобрать ${data.unreadCount} уведомлений` : '',
    data.events.length ? 'Посмотреть ближайшие мероприятия' : '',
    data.news.length ? 'Проверить свежие публикации' : '',
  ].filter(Boolean).slice(0, 5);

  const memoryItems = [
    `Раздел: ${context.label}`,
    data.activeProfile?.name ? `Профиль: ${data.activeProfile.name}` : 'Профиль не выбран',
    `Событий: ${data.events.length}`,
    `Новостей: ${data.news.length}`,
  ];

  const latestAction = data.recentActions?.[0];
  const chatItems = aiHistory.length ? aiHistory.slice(-6) : [
    { id: 'loki-start', role: 'loki', text: `Доброе утро, я собрал рабочий день по разделу «${context.label}». Две новости, одно мероприятие и регистрация пользователя уже ждут решения.` },
  ];

  const lokiState = aiPulse ? 'answering' : aiDraft ? 'listening' : attention.length ? 'recommending' : 'waiting';

  const handleSubmit = event => {
    event.preventDefault();
    onAskLoki?.(aiDraft);
  };

  return (
    <div data-workspace-region="ai" style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', paddingRight: 1 }}>
      <div style={{ ...APG2_PROFILE.glass, borderRadius: 34, padding: 18, display: 'grid', gap: 12, border: '1px solid rgba(215,184,106,0.28)' }}>
        <div style={{ minWidth: 0, ...APG2_PROFILE.glass, borderRadius: 24, padding: 12 }}>
          <LokiIdentity size={56} state={lokiState} label="Локи" sublabel={`${context.label} · ${context.focus}`} />
          <div style={{ marginTop: 10, color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '16px' }}>Локи всегда в этой колонке и не уходит в модальные окна.</div>
        </div>

        <WorkspacePanel title="Briefing" subtitle="Короткий срез дня" style={{ margin: 0, padding: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {briefing.slice(0, 4).map(item => <ListRow key={item} title={item} text="Из данных Workspace" />)}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="История" subtitle="Последние рабочие события" style={{ margin: 0, padding: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.recentActions.map(item => <ListRow key={item.id} title={item.title} text={item.text} />)}
            {!data.recentActions.length && <EmptyWidget text="История пока пустая" />}
          </div>
        </WorkspacePanel>

        <WorkspacePanel title="Контекст" subtitle="Что сейчас важно для этого раздела" style={{ margin: 0, padding: 12 }}>
          <ContentGrid min={150} gap={8}>
            <MetricCard label="Контекст" value={context.label} delta={context.focus} />
            <MetricCard label="Профиль" value={`${profileStatus.value}%`} delta={profileStatus.label} tone={profileStatus.value >= 80 ? 'quiet' : 'gold'} />
            <MetricCard label="Последнее действие" value={latestAction?.title || '—'} delta={latestAction?.text || 'Ждём действий'} />
            <MetricCard label="Последняя память" value={memoryItems.join(' · ')} delta="актуальный срез" />
          </ContentGrid>
        </WorkspacePanel>

        <WorkspacePanel title="Рекомендации" subtitle="Чем лучше продолжить" style={{ margin: 0, padding: 12 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {recommendations.slice(0, 4).map((item, index) => (
              <button key={item} type="button" onClick={() => onAskLoki?.(item)} style={{ ...APG2_PROFILE.glass, borderRadius: 18, padding: 10, display: 'grid', gridTemplateColumns: '24px minmax(0,1fr)', gap: 9, alignItems: 'center', background: index === 0 ? APG2_PROFILE.goldSoft : APG2_PROFILE.quietSurface, border: '1px solid rgba(215,184,106,0.22)', textAlign: 'left', cursor: 'pointer', color: APG2_PROFILE.text }}>
                <span style={{ width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', background: index === 0 ? APG2_PROFILE.goldGradient : 'rgba(var(--apg2-glass-a,255,255,255),0.16)', color: index === 0 ? '#17120a' : APG2_PROFILE.gold, fontWeight: 900 }}>{index + 1}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, lineHeight: '18px' }}>{item}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}><GlassButton tone="gold" onClick={() => onAskLoki?.(context.prompt)} style={{ width: '100%', color: '#17120a' }}>Проверить сегодня с Локи</GlassButton></div>
        </WorkspacePanel>

        <WorkspacePanel title="Чат" subtitle="Диалог с рабочими рекомендациями" style={{ margin: 0, padding: 12 }}>
          {chatItems.slice(-4).map(item => (
            <div key={item.id} style={{ ...APG2_PROFILE.glass, borderRadius: item.role === 'user' ? '16px 16px 6px 16px' : '16px 16px 16px 6px', padding: '9px 10px', marginLeft: item.role === 'user' ? 18 : 0, marginRight: item.role === 'user' ? 0 : 18, marginTop: 8, border: item.role === 'loki' ? '1px solid rgba(215,184,106,0.2)' : APG2_PROFILE.glass.border }}>
              <div style={{ color: item.role === 'loki' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 10.5, lineHeight: '14px', fontWeight: 900, textTransform: 'uppercase' }}>{item.role === 'loki' ? 'Локи' : 'Вы'}</div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 12.5, lineHeight: '17px', marginTop: 3, overflowWrap: 'anywhere' }}>{item.text}</div>
            </div>
          ))}
          <form onSubmit={handleSubmit} style={{ ...APG2_PROFILE.glass, borderRadius: 18, padding: 8, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 7, alignItems: 'center', marginTop: 12 }}>
            <input
              value={aiDraft}
              onChange={event => onDraftChange(event.target.value)}
              placeholder={context.prompt}
              style={{ width: '100%', minHeight: 34, border: 0, outline: 'none', background: 'transparent', color: APG2_PROFILE.text, fontFamily: 'inherit', fontSize: 12.5 }}
            />
            <GlassButton type="submit" tone="gold" style={{ minHeight: 34, padding: '7px 10px', color: '#17120a' }}>Спросить</GlassButton>
          </form>
        </WorkspacePanel>

        <WorkspacePanel title="Быстрые действия" subtitle="Переходите без потери контекста" style={{ margin: 0, padding: 12 }}>
          <ContentGrid min={150} gap={8}>
            <ActionCard icon="📰" title="Новости" text="Открыть ленту" onClick={actions.openNews} />
            <ActionCard icon="📅" title="Мероприятия" text="Открыть события" onClick={actions.openEvents} />
            <ActionCard icon="◈" title="Мой бизнес" text="Проверить профиль и карточки" onClick={actions.openCabinet} />
          </ContentGrid>
        </WorkspacePanel>
      </div>
    </div>
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
  const [aiPulse, setAiPulse] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1440 : window.innerWidth);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const roleState = useMemo(() => getCabinetRoles({ user, partner: ownedPartner, expert: ownedExpert }), [user, ownedPartner, ownedExpert]);
  const activeRole = roleState.activeRole;
  const layout = useMemo(() => buildWorkspaceLayout({ mode: WORKSPACE_MODES.desktop, contextOpen: true, pinnedContext: true }), []);
  const activeRoleIdentity = useMemo(() => ({ ...(user || {}), role: activeRole?.id || user?.role || 'user' }), [activeRole?.id, user]);
  const activeProfile = activeRole?.id === 'expert' ? ownedExpert : activeRole?.id === 'partner' ? ownedPartner : user;
  const userName = user?.firstName || user?.name || user?.displayName || 'коллега';
  const isAdminRole = hasCapability(activeRoleIdentity, CAPABILITIES.canOpenAdminPanel);
  const businessHubFlag = useMemo(() => getBusinessHubFlag(), []);
  const businessHubAvailable = useMemo(() => canUseBusinessHub({ user, partner: ownedPartner, expert: ownedExpert, flag: businessHubFlag }), [user, ownedPartner, ownedExpert, businessHubFlag]);
  const layoutPlan = useMemo(() => getDesktopWorkspaceLayoutPlan(viewportWidth, typeof window === 'undefined' ? 900 : window.innerHeight, sidebarCollapsed), [viewportWidth, sidebarCollapsed]);
  const { aiAsDrawer, effectiveSidebarCollapsed, gridTemplateColumns: workspaceColumns } = layoutPlan;
  const navItems = NAV_ITEMS.filter(item => {
    if (item.adminOnly && !isAdminRole) return false;
    if (item.businessOnly && !businessHubAvailable) return false;
    return true;
  });
  const recentActions = [
    { id: 'workspace-open', title: 'Workspace открыт', text: 'Рабочая среда активна без повторной авторизации' },
    { id: 'data-ready', title: 'Данные загружены', text: `${partners.length} партнёров · ${experts.length} экспертов` },
    { id: 'loki-context', title: 'Локи ведёт день', text: 'AI Workspace активен в правой рабочей области' },
  ];
  const workspaceData = {
    userName,
    roleLabel: activeRole?.label || 'Workspace',
    activeProfile,
    partners,
    experts,
    events,
    news,
    notifications,
    unreadCount,
    recentActions,
  };

  const handleAskLoki = (text) => {
    const safeText = text?.trim();
    const prompt = safeText || getWorkspaceContext(activeSection).prompt;
    const profileStatus = getProfileCompletion(activeProfile);
    const reply = buildContextualReply({ activeSection, data: workspaceData, profileStatus, text: prompt });
    const stamp = Date.now();
    setAiHistory(prev => [
      ...prev,
      { id: `user-${stamp}`, role: 'user', text: prompt },
      { id: `loki-${stamp}`, role: 'loki', text: reply },
    ].slice(-12));
    setAiDraft('');
    setAiPulse(stamp);
  };

  useEffect(() => {
    if (aiHistory.length) return;
    const startSection = getWorkspaceContext(activeSection);
    const startProfile = getProfileCompletion(activeProfile);
    const greeting = `Доброе утро. В рабочем контексте «${startSection.label}» есть ${startProfile.value < 100 ? `${startProfile.value}% заполненности профиля` : 'подготовленная рабочая среда'}.`;
    const startup = buildLokiBriefing({ data: workspaceData, profileStatus: startProfile, attention: [startSection.prompt || startSection.focus] });
    setAiHistory([{
      id: `loki-start-${Date.now()}`,
      role: 'loki',
      text: `${greeting} ${startup.join(' · ')}`,
    }]);
  }, [aiHistory.length, activeProfile?.id, activeSection, news.length, events.length, unreadCount]);

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
    if (activeSection === 'business-hub' && !businessHubAvailable) setActiveSection('dashboard');
  }, [activeSection, businessHubAvailable]);

  useEffect(() => {
    const onKeyDown = event => {
      const key = event.key?.toLowerCase();
      if (key === 'escape') {
        setShortcutOverlayOpen(false);
        setContextMenu(null);
      }
      if (key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          event.preventDefault();
          setShortcutOverlayOpen(value => !value);
        }
      }
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
      const input = document.querySelector('[placeholder="Поиск по Workspace"]');
        input?.focus?.();
      }
      if ((event.metaKey || event.ctrlKey) && key === '1') {
        event.preventDefault();
        setActiveSection('dashboard');
      }
      if ((event.metaKey || event.ctrlKey) && key === '2') {
        event.preventDefault();
        if (businessHubAvailable) setActiveSection('business-hub');
      }
      if ((event.metaKey || event.ctrlKey) && key === '3') {
        event.preventDefault();
        setActiveSection('content');
      }
      if ((event.metaKey || event.ctrlKey) && key === 'l') {
        event.preventDefault();
        handleAskLoki(getWorkspaceContext(activeSection).prompt);
      }
      if ((event.metaKey || event.ctrlKey) && key === 'b') {
        event.preventDefault();
        setSidebarCollapsed(value => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSection, businessHubAvailable]);

  const actions = {
    openDashboard: () => setActiveSection('dashboard'),
    openCabinet: () => businessHubAvailable ? setActiveSection('business-hub') : onOpenPanel?.(activeRole?.id === 'expert' ? 'expert-cabinet' : 'partner-cabinet'),
    openNews: () => setActiveSection('news'),
    openEvents: () => setActiveSection('events'),
    openPartners: () => setActiveSection('partners'),
    openExperts: () => setActiveSection('experts'),
    openCrm: () => setActiveSection('crm'),
    openLoki: () => {
      if (aiAsDrawer) setAiDrawerOpen(true);
      handleAskLoki(getWorkspaceContext(activeSection).prompt);
    },
  };

  const handleWorkspaceContextMenu = event => {
    const tag = event.target?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select', 'button'].includes(tag) || event.target?.closest?.('button,input,textarea,select')) return;
    event.preventDefault();
    const x = Math.min(event.clientX, window.innerWidth - 240);
    const y = Math.min(event.clientY, window.innerHeight - 260);
    setContextMenu({ x, y });
  };

  const handleSelectNav = item => {
    if (item.id === 'admin') {
      onOpenAdmin?.();
      return;
    }
    if (item.placeholder) {
      setActiveSection(item.id);
      return;
    }
    if (item.id === 'loki') {
      actions.openLoki();
      return;
    }
    if (item.id === 'dashboard' || item.id === 'content' || item.id === 'business-hub') {
      setActiveSection(item.id);
      return;
    }
    if (item.panelId) setActiveSection(item.id);
  };

  const renderContent = () => {
    if (activeSection === 'dashboard') {
      return (
        <WorkspaceDashboard
          data={workspaceData}
          actions={actions}
        />
      );
    }
    if (activeSection === 'content') {
      return (
        <PlaceholderSection
          title="Контент"
          text="Единый рабочий центр для новостей, мероприятий и будущего Content Lifecycle."
          actions={[
            { id: 'news', label: 'Новости', onClick: actions.openNews },
            { id: 'events', label: 'Мероприятия', onClick: actions.openEvents },
          ]}
        />
      );
    }
    if (activeSection === 'news') {
      return <DataSection type="news" title="Новости" subtitle="Те же карточки, что и в User Mode, адаптированные широкой сеткой" items={news} emptyText="Новостей пока нет." onOpen={() => onOpenPanel?.('news')} />;
    }
    if (activeSection === 'events') {
      return <DataSection type="events" title="Мероприятия" subtitle="Единые карточки событий без отдельной workspace-версии" items={events} emptyText="Мероприятий пока нет." onOpen={() => onOpenPanel?.('events')} />;
    }
    if (activeSection === 'partners') {
      return <DataSection type="partners" title="Партнёры" subtitle="Рабочий каталог партнёров" items={partners} emptyText="Партнёров пока нет." onOpen={() => onOpenPanel?.('offers')} />;
    }
    if (activeSection === 'experts') {
      return <DataSection type="experts" title="Эксперты" subtitle="Рабочий каталог экспертов" items={experts} emptyText="Экспертов пока нет." onOpen={() => onOpenPanel?.('experts')} />;
    }
    if (activeSection === 'business-hub') {
      return (
        <BusinessHub
          user={user}
          ownedPartner={ownedPartner}
          ownedExpert={ownedExpert}
          partners={partners}
          experts={experts}
          events={events}
          news={news}
          notifications={notifications}
          activeRoleId={activeRole?.id}
          onOpenPanel={onOpenPanel}
        />
      );
    }
    if (activeSection === 'loki') {
      return <PlaceholderSection title="AI Workspace" text="Локи закреплён справа и работает без отдельного экрана. Используйте правую панель, чтобы спросить, проверить день или перейти к действиям." />;
    }
    if (activeSection === 'settings') {
      return <PlaceholderSection title="Настройки Workspace" text="Здесь будут параметры рабочего пространства, виджеты, роли и персонализация." />;
    }
    if (activeSection === 'crm') return <PlaceholderSection title="CRM" text="Заготовка под заявки, клиентов и воронки партнёров." />;
    if (activeSection === 'calendar') return <PlaceholderSection title="Календарь" text="Заготовка под расписание, мероприятия, записи и занятость." />;
    return null;
  };

  return (
    <div onContextMenu={handleWorkspaceContextMenu} style={{ minHeight: '100dvh', background: APG2_PROFILE.workspaceBg, color: APG2_PROFILE.text, padding: WORKSPACE_LAYOUT.pagePadding, boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', gap: WORKSPACE_LAYOUT.gap, height: `calc(100dvh - ${WORKSPACE_LAYOUT.pagePadding * 2}px)`, minHeight: 0 }}>
        <WorkspaceHeaderBar
          user={user}
          onModeChange={onModeChange}
          unreadCount={unreadCount}
          query={query}
          onQueryChange={setQuery}
          onOpenNotifications={() => onOpenPanel?.('notifications')}
          onOpenProfile={() => onOpenPanel?.('profile')}
        />
        <div data-workspace-layout="desktop-grid" style={{ display: 'grid', gridTemplateColumns: workspaceColumns, gap: WORKSPACE_LAYOUT.gap, alignItems: 'stretch', minHeight: 0, height: '100%', overflow: 'hidden' }}>
          <WorkspaceSidebar
            items={navItems}
            activeSection={activeSection}
            collapsed={effectiveSidebarCollapsed}
            onToggle={() => setSidebarCollapsed(value => !value)}
            onSelect={handleSelectNav}
          />
          <main data-workspace-region="content" style={{ minWidth: 0, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', display: 'block', position: 'relative', zIndex: WORKSPACE_Z.content, paddingRight: 2 }}>
            <SectionHeader
              title={activeSection === 'dashboard' ? 'Dashboard' : navItems.find(item => item.id === activeSection)?.label || 'Workspace'}
              subtitle={query ? `Поиск: ${query}` : `${layout.density} · APG V2 Liquid Glass`}
              actions={<GlassBadge tone="gold">Desktop Workspace 2.1</GlassBadge>}
            />
            {renderContent()}
          </main>
          {!aiAsDrawer && (
            <aside data-workspace-region="ai-column" style={{ minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: WORKSPACE_Z.content }}>
              <AIWorkspacePanel
                data={workspaceData}
                activeSection={activeSection}
                aiDraft={aiDraft}
                aiHistory={aiHistory}
                aiPulse={aiPulse}
                onDraftChange={setAiDraft}
                onAskLoki={handleAskLoki}
                actions={actions}
              />
            </aside>
          )}
        </div>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 24, padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: APG2_PROFILE.textSoft, fontSize: 12, background: APG2_PROFILE.quietSurface }}>
          <span>AI Workspace: active · shortcuts: ⌘K поиск, ⌘1 Dashboard, ⌘2 Мой бизнес, ⌘L Локи, ? помощь</span>
          <span>{partners.length} партнёров · {experts.length} экспертов · {news.length} новостей · {events.length} событий</span>
        </div>
      </div>
      {aiAsDrawer && aiDrawerOpen && (
        <div data-workspace-region="ai-drawer" onClick={() => setAiDrawerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: WORKSPACE_Z.drawer, background: 'rgba(12,12,14,0.34)', display: 'flex', justifyContent: 'flex-end', padding: 14, boxSizing: 'border-box' }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 'min(420px, 100%)', height: '100%', minHeight: 0, position: 'relative' }}>
            <GlassButton onClick={() => setAiDrawerOpen(false)} style={{ position: 'absolute', right: 12, top: 12, zIndex: WORKSPACE_Z.popover, width: 38, minHeight: 38, padding: 0, borderRadius: 16 }}>×</GlassButton>
            <AIWorkspacePanel
              data={workspaceData}
              activeSection={activeSection}
              aiDraft={aiDraft}
              aiHistory={aiHistory}
              aiPulse={aiPulse}
              onDraftChange={setAiDraft}
              onAskLoki={handleAskLoki}
              actions={actions}
            />
          </div>
        </div>
      )}
      <WorkspaceShortcutOverlay open={shortcutOverlayOpen} onClose={() => setShortcutOverlayOpen(false)} />
      <WorkspaceContextMenu menu={contextMenu} actions={actions} onClose={() => setContextMenu(null)} />
    </div>
  );
}
