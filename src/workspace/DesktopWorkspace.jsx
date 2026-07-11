import React, { useEffect, useMemo, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard } from '../components/Apg2ProfileGlass.jsx';
import { MOTION, motionTransition } from '../motion.js';
import { BusinessHub } from '../businessHub/BusinessHub.jsx';
import { canUseBusinessHub, getBusinessHubFlag } from '../businessHub/BusinessHubCore.js';
import { getCabinetRoles } from '../cabinet/CabinetRoleEngine.js';
import {
  ActionCard,
  ContentGrid,
  DashboardCard,
  MetricCard,
  QuickActions,
  SectionHeader,
  WorkspacePanel,
} from './WorkspaceComponents.jsx';
import { buildWorkspaceLayout, getWorkspaceNavigation, WORKSPACE_MODES } from './WorkspaceCore.js';

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
  { id: 'loki', label: 'Локи', icon: '🦊', group: 'Система', panelId: 'loki', hint: 'Интеллектуальная рабочая панель', shortcut: '⌘L' },
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

function WorkspaceHeaderBar({ user, roleState, activeRoleId, onRoleChange, onModeChange, unreadCount, query, onQueryChange, onOpenNotifications, onOpenProfile, onOpenScan, onOpenShortcuts }) {
  return (
    <div style={{ ...APG2_PROFILE.glass, borderRadius: 26, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'auto minmax(260px, 1fr) auto', alignItems: 'center', gap: 12, position: 'sticky', top: 14, zIndex: 10, minHeight: 64 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 17, background: APG2_PROFILE.goldGradient, color: '#17120a', display: 'grid', placeItems: 'center', fontWeight: 950, boxShadow: '0 16px 36px rgba(215,184,106,0.18)' }}>АПГ</div>
        <div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '20px', fontWeight: 930 }}>Workspace</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '15px' }}>Рабочая среда АПГ</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) auto', gap: 10, alignItems: 'center' }}>
        <label style={{ ...APG2_PROFILE.glass, borderRadius: 18, minHeight: 42, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: APG2_PROFILE.gold, fontSize: 15 }}>⌕</span>
          <input
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Глобальный поиск по Workspace"
            style={{ width: '100%', border: 0, outline: 'none', background: 'transparent', color: APG2_PROFILE.text, fontFamily: 'inherit', fontSize: 13.5 }}
          />
        </label>
        <button type="button" onClick={onOpenShortcuts} style={{ border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', cursor: 'pointer' }}>
          <GlassBadge tone="gold">⌘K · ?</GlassBadge>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <GlassButton onClick={onOpenScan} style={{ minHeight: 38, padding: '9px 12px' }}>QR</GlassButton>
        <GlassButton onClick={onOpenNotifications} style={{ minHeight: 38, padding: '9px 12px' }}>{unreadCount ? `Уведомления · ${unreadCount}` : 'Уведомления'}</GlassButton>
        {roleState.roles.length > 1 && (
          <select value={activeRoleId || ''} onChange={event => onRoleChange(event.target.value)} style={{ ...APG2_PROFILE.glass, color: APG2_PROFILE.text, minHeight: 38, borderRadius: 16, padding: '0 10px', fontFamily: 'inherit' }}>
            {roleState.roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
          </select>
        )}
        <GlassButton onClick={() => onModeChange('user')} style={{ minHeight: 38, padding: '9px 12px' }}>User Mode</GlassButton>
        <button type="button" onClick={onOpenProfile} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 16, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{String(user?.firstName || user?.name || 'A').slice(0, 1)}</div>
        </button>
      </div>
    </div>
  );
}

function WorkspaceSidebar({ items, activeSection, collapsed, onToggle, onSelect }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const groups = items.reduce((acc, item) => {
    const group = item.group || 'Workspace';
    if (!acc.some(entry => entry.group === group)) acc.push({ group, items: [] });
    acc.find(entry => entry.group === group).items.push(item);
    return acc;
  }, []);
  return (
    <div style={{ ...APG2_PROFILE.glass, borderRadius: 28, padding: 9, height: 'calc(100svh - 116px)', minHeight: 0, position: 'sticky', top: 92, display: 'flex', flexDirection: 'column', gap: 8, transition: motionTransition(['width'], 'base'), width: collapsed ? 72 : 238 }}>
      <div style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', padding: '4px 5px 8px' }}>
        {!collapsed && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11, fontWeight: 850, letterSpacing: 0.7, textTransform: 'uppercase' }}>Навигация</div>}
        <GlassButton onClick={onToggle} style={{ minHeight: 34, width: 34, padding: 0, borderRadius: 14 }}>{collapsed ? '›' : '‹'}</GlassButton>
      </div>
      <div style={{ display: 'grid', gap: 10, position: 'relative' }}>
        {groups.map(group => (
          <div key={group.group} style={{ display: 'grid', gap: 5 }}>
            {!collapsed && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10, lineHeight: '13px', fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase', padding: '0 9px' }}>{group.group}</div>}
            {group.items.map(item => {
          const active = activeSection === item.id;
          const hovered = hoveredItem?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
              onFocus={() => setHoveredItem(item)}
              onBlur={() => setHoveredItem(null)}
              title={item.label}
              style={{
              border: active ? '1px solid rgba(215,184,106,0.54)' : APG2_PROFILE.glass.border,
              background: active ? APG2_PROFILE.goldSoft : hovered ? 'rgba(var(--apg2-glass-a,255,255,255),0.12)' : 'rgba(var(--apg2-glass-a,255,255,255),0.06)',
              borderRadius: 18,
              minHeight: 42,
              padding: collapsed ? 0 : '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10,
              color: active ? APG2_PROFILE.gold : APG2_PROFILE.text,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 820,
              cursor: 'pointer',
              outline: hovered ? '1px solid rgba(215,184,106,0.18)' : 'none',
              transform: hovered && !active ? 'translateX(2px)' : 'translateX(0)',
              transition: motionTransition(['background', 'border-color', 'transform'], 'base'),
            }}>
              <span style={{ width: 26, textAlign: 'center' }}>{item.icon}</span>
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.label}</span>}
              {!collapsed && item.shortcut && <span style={{ color: APG2_PROFILE.textMuted, fontSize: 10, fontWeight: 850 }}>{item.shortcut}</span>}
            </button>
          );
            })}
          </div>
        ))}
        {collapsed && hoveredItem && (
          <div style={{ ...APG2_PROFILE.glass, position: 'absolute', left: 74, top: 48, zIndex: 20, width: 220, borderRadius: 18, padding: 12, pointerEvents: 'none' }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 13, fontWeight: 900 }}>{hoveredItem.label}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '16px', marginTop: 3 }}>{hoveredItem.hint}</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 'auto', display: collapsed ? 'none' : 'block' }}>
        <GlassCard style={{ borderRadius: 22, padding: 12 }}>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 850 }}>Workspace 1.0</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '16px', marginTop: 4 }}>Платформа для партнёров, экспертов и команды АПГ.</div>
        </GlassCard>
      </div>
    </div>
  );
}

function WidgetShell({ widget, children }) {
  const columns = widget.size === 'wide' ? 'span 6' : 'span 3';
  return (
    <div data-workspace-widget={widget.id} data-drag-handle={widget.dragHandleId} style={{ gridColumn: columns, minWidth: 0 }}>
      {children}
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
      minHeight: 238,
      overflow: 'hidden',
      borderRadius: 38,
      padding: 20,
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.35fr) minmax(280px,0.65fr)',
      gap: 18,
      alignItems: 'stretch',
      background: 'radial-gradient(circle at 18% 0%, rgba(255,240,184,0.28), transparent 34%), radial-gradient(circle at 88% 18%, rgba(112,92,168,0.20), transparent 32%), linear-gradient(145deg, rgba(255,255,255,0.20), rgba(255,255,255,0.075))',
      border: '1px solid rgba(244,217,140,0.26)',
      boxShadow: '0 34px 90px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -32px 72px rgba(255,255,255,0.04)',
    }}>
      <div style={{ position: 'absolute', left: -80, right: -80, top: 74, height: 120, background: 'linear-gradient(110deg, transparent 10%, rgba(244,217,140,0.12) 38%, rgba(255,255,255,0.08) 48%, transparent 72%)', transform: 'rotate(-8deg)', filter: 'blur(8px)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
        <div>
          <GlassBadge tone="gold">🦊 Локи открыл Workspace</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 38, lineHeight: '43px', fontWeight: 940, letterSpacing: -0.6, marginTop: 14 }}>
            {getDayGreeting()}, {data.userName}.
          </div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px', marginTop: 8, maxWidth: 620 }}>
            Я собрал рабочий день АПГ и подсветил то, с чего лучше начать. Workspace теперь не просто открывается — он встречает вас с контекстом.
          </div>
          <div style={{ display: 'grid', gap: 7, marginTop: 14, maxWidth: 620 }}>
            {briefing.slice(0, 5).map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9, color: APG2_PROFILE.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 760 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: APG2_PROFILE.gold, boxShadow: '0 0 18px rgba(215,184,106,0.44)', flex: '0 0 auto' }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <QuickActions actions={[
          { id: 'attention', label: attention.length ? `Начать с ${attention.length} задач` : 'Начать день', onClick: actions.openDashboard, tone: 'gold' },
          { id: 'business', label: 'Мой бизнес', onClick: actions.openCabinet },
          { id: 'loki', label: 'Спросить Локи здесь', onClick: actions.openLoki },
        ]} style={{ background: 'transparent', border: 0, padding: 0, marginTop: 18 }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateRows: 'auto 1fr', gap: 10, minWidth: 0 }}>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 24, padding: 13 }}>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.7 }}>Активный профиль</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '23px', fontWeight: 920, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileName}</div>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 820, marginTop: 5 }}>Заполненность {profileStatus.value}% · {profileStatus.label}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {heroMetrics.map(metric => (
            <div key={metric.label} style={{ ...APG2_PROFILE.glass, borderRadius: 22, padding: 12, minWidth: 0 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 25, lineHeight: '28px', fontWeight: 940 }}>{metric.value}</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '15px', marginTop: 4 }}>{metric.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkspaceDashboard({ data, actions }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const latestNews = data.news.slice(0, 4);
  const upcomingEvents = data.events.slice(0, 4);
  const todayEvents = data.events.slice(0, 3);
  const attention = [
    data.unreadCount ? `${data.unreadCount} уведомлений ждут просмотра` : '',
    profileStatus.value < 80 ? `Профиль заполнен на ${profileStatus.value}%` : '',
    !data.news.length ? 'В системе пока нет новостей' : '',
    !data.events.length ? 'Нет ближайших мероприятий' : '',
  ].filter(Boolean);
  const todaySignals = [
    `${data.news.length} новостей в системе`,
    `${data.events.length} мероприятий`,
    data.unreadCount ? `${data.unreadCount} уведомлений` : 'уведомлений нет',
    data.activeProfile?.name ? `профиль: ${data.activeProfile.name}` : 'профиль не выбран',
  ];
  const tasks = [
    profileStatus.value < 100 ? `Заполнить профиль: ${profileStatus.label}` : '',
    data.unreadCount ? `Проверить уведомления: ${data.unreadCount}` : '',
    data.news.length ? 'Проверить последние публикации' : 'Добавить первую новость',
  ].filter(Boolean);

  const renderWidget = (widget) => {
    if (widget.id === 'welcome') {
      return (
        <DashboardCard
          tone="gold"
          icon="☼"
          title={`Добро пожаловать, ${data.userName}`}
          subtitle={`Сегодня: ${todaySignals.join(' · ')}`}
          value={data.roleLabel}
          action={<GlassButton onClick={actions.openCabinet} style={{ color: '#17120a' }}>Открыть Мой бизнес</GlassButton>}
          style={{ minHeight: 156 }}
        />
      );
    }
    if (widget.id === 'today') {
      return (
        <WorkspacePanel title="Сегодня" subtitle="Сводка рабочего дня" style={{ height: '100%' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <ListRow title={`${data.news.length} новостей`} text="Материалы, доступные в Workspace" />
            <ListRow title={`${data.events.length} мероприятий`} text={todayEvents[0]?.title || todayEvents[0]?.name || 'Афиша без срочных событий'} />
            <ListRow title={`${data.unreadCount || 0} уведомлений`} text={data.unreadCount ? 'Есть что проверить' : 'Спокойный день'} />
          </div>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'attention') {
      return (
        <WorkspacePanel title="Требует внимания" subtitle="Без лишнего шума" style={{ height: '100%' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {attention.length ? attention.slice(0, 4).map(item => <ListRow key={item} title={item} text="Проверить" />) : <ListRow title="Критичных задач нет" text="Workspace выглядит спокойно" />}
          </div>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'latest-news') {
      return (
        <WorkspacePanel title="Последние новости" subtitle={`${data.news.length} материалов в системе`}>
          <div style={{ display: 'grid', gap: 8 }}>
            {latestNews.length ? latestNews.map(item => <ListRow key={item.id || item.title} title={item.title || 'Новость'} text={formatShortDate(item.publishedAt || item.createdAt)} />) : <EmptyWidget text="Новостей пока нет." />}
          </div>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'upcoming-events') {
      return (
        <WorkspacePanel title="Ближайшие мероприятия" subtitle={`${data.events.length} событий доступно`}>
          <div style={{ display: 'grid', gap: 8 }}>
            {upcomingEvents.length ? upcomingEvents.map(item => <ListRow key={item.id || item.title} title={item.title || item.name || 'Мероприятие'} text={`${formatShortDate(item.date || item.startAt)} · ${item.location || item.address || 'место уточняется'}`} />) : <EmptyWidget text="Ближайших мероприятий нет." />}
          </div>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'recent-actions') {
      return (
        <WorkspacePanel title="Последние действия" subtitle="Живая лента Workspace" style={{ height: '100%' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {data.recentActions.map(item => <ListRow key={item.id} title={item.title} text={item.text} />)}
          </div>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'stats') {
      return (
        <WorkspacePanel title="Статистика" subtitle="Быстрый срез платформы" style={{ height: '100%' }}>
          <ContentGrid min={120} gap={8}>
            <MetricCard label="Партнёры" value={data.partners.length} />
            <MetricCard label="Эксперты" value={data.experts.length} />
            <MetricCard label="Новости" value={data.news.length} />
            <MetricCard label="События" value={data.events.length} />
          </ContentGrid>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'business') {
      return (
        <WorkspacePanel title="Бизнес" subtitle={data.activeProfile?.name || 'Профиль Workspace'} style={{ height: '100%' }}>
          <ContentGrid min={120} gap={8}>
            <MetricCard label="Заполненность" value={`${profileStatus.value}%`} delta={profileStatus.label} tone={profileStatus.value >= 80 ? 'gold' : undefined} />
            <MetricCard label="Роль" value={data.roleLabel} delta="активный режим" />
          </ContentGrid>
          <GlassButton onClick={actions.openCabinet} style={{ width: '100%', marginTop: 10 }}>Мой бизнес</GlassButton>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'profile-status') {
      return (
        <WorkspacePanel title="Статус профиля" subtitle={data.activeProfile?.name || 'Профиль Workspace'}>
          <MetricCard label="Заполненность" value={`${profileStatus.value}%`} delta={profileStatus.label} tone={profileStatus.value >= 80 ? 'gold' : undefined} />
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {profileStatus.missing.slice(0, 3).map(item => <GlassBadge key={item}>{item}</GlassBadge>)}
          </div>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'tasks') {
      return (
        <WorkspacePanel title="Задачи" subtitle="Что лучше сделать дальше">
          <div style={{ display: 'grid', gap: 8 }}>
            {tasks.map(task => <ListRow key={task} title={task} text="Рекомендация Workspace" />)}
          </div>
        </WorkspacePanel>
      );
    }
    if (widget.id === 'quick-actions') {
      return (
        <WorkspacePanel title="Быстрые действия" subtitle="Главные действия без перехода по меню">
          <ContentGrid min={180} gap={10}>
            <ActionCard icon="📰" title="Новости" text="Открыть ленту и публикации" onClick={actions.openNews} />
            <ActionCard icon="📅" title="Мероприятия" text="Проверить события" onClick={actions.openEvents} />
            <ActionCard icon="🤝" title="Партнёры" text="Каталог партнёров" onClick={actions.openPartners} />
            <ActionCard icon="✦" title="Эксперты" text="Каталог экспертов" onClick={actions.openExperts} />
          </ContentGrid>
        </WorkspacePanel>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <LokiWorkspaceHero data={data} profileStatus={profileStatus} attention={attention} actions={actions} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.1fr)', gap: 14, alignItems: 'stretch' }}>
        {renderWidget({ id: 'attention' })}
        {renderWidget({ id: 'today' })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,0.95fr)', gap: 14, alignItems: 'stretch' }}>
        {renderWidget({ id: 'business' })}
        {renderWidget({ id: 'stats' })}
      </div>
      <SectionHeader title="Контент сегодня" subtitle="Новости и мероприятия, которые формируют городской контекст" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14, alignItems: 'stretch' }}>
        {renderWidget({ id: 'latest-news' })}
        {renderWidget({ id: 'upcoming-events' })}
      </div>
      <AIActionBoard actions={actions} />
      <SectionHeader title="Дальше" subtitle="Действия, история и быстрый переход к работе" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.9fr) minmax(0,1.1fr)', gap: 14, alignItems: 'stretch' }}>
        {renderWidget({ id: 'recent-actions' })}
        {renderWidget({ id: 'quick-actions' })}
      </div>
    </div>
  );
}

function ListRow({ title, text }) {
  return (
    <div style={{ ...APG2_PROFILE.glass, borderRadius: 18, padding: '10px 12px' }}>
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 14000, background: 'rgba(8,8,10,0.34)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center', padding: 20 }}>
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
    ['loki', '🦊 Спросить Локи', () => actions.openLoki?.()],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 13000, background: 'transparent' }}>
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

function DataSection({ title, subtitle, items, emptyText, onOpen, columns = 2 }) {
  return (
    <WorkspacePanel title={title} subtitle={subtitle}>
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
    </WorkspacePanel>
  );
}

function AIWorkspacePanel({ data, activeSection, aiDraft, aiHistory, aiPulse, onDraftChange, onAskLoki, actions }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const context = getWorkspaceContext(activeSection);
  const attention = [
    data.unreadCount ? `${data.unreadCount} уведомлений ждут просмотра` : '',
    profileStatus.value < 80 ? `Профиль заполнен на ${profileStatus.value}%` : '',
    !data.news.length ? 'В системе пока нет новостей' : '',
    !data.events.length ? 'Нет ближайших мероприятий' : '',
  ].filter(Boolean);
  const briefing = buildLokiBriefing({ data, profileStatus, attention });
  const recommendations = [
    ...context.recommendations,
    data.unreadCount ? `Разобрать ${data.unreadCount} уведомлений` : '',
    data.events.length ? 'Посмотреть ближайшие мероприятия' : '',
  ].filter(Boolean).slice(0, 5);
  const chatItems = aiHistory.length ? aiHistory.slice(-5) : [
    { id: 'loki-start', role: 'loki', text: `Я уже вижу раздел «${context.label}» и буду держать ответы внутри AI Workspace.` },
  ];
  const handleSubmit = event => {
    event.preventDefault();
    onAskLoki?.(aiDraft);
  };
  return (
    <div style={{ display: 'grid', gap: 10, position: 'sticky', top: 92 }}>
      <WorkspacePanel title="AI Workspace" subtitle="Локи ведёт рабочий день" style={{ border: '1px solid rgba(215,184,106,0.34)', boxShadow: aiPulse ? '0 0 0 1px rgba(215,184,106,0.16), 0 24px 70px rgba(0,0,0,0.25)' : undefined }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 11, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 18, background: APG2_PROFILE.goldGradient, color: '#17120a', display: 'grid', placeItems: 'center', fontSize: 21, boxShadow: '0 16px 36px rgba(215,184,106,0.20)' }}>🦊</div>
          <div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '19px', fontWeight: 930 }}>Локи</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px', marginTop: 2 }}>Контекст: {context.label}</div>
          </div>
        </div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 13.5, lineHeight: '19px', fontWeight: 760, marginTop: 12 }}>
          {context.focus}. Я не открываю отдельные окна — вся работа с подсказками остаётся здесь.
        </div>
        <form onSubmit={handleSubmit} style={{ ...APG2_PROFILE.glass, borderRadius: 20, padding: 8, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 7, alignItems: 'center', marginTop: 12 }}>
          <input
            value={aiDraft}
            onChange={event => onDraftChange(event.target.value)}
            placeholder={context.prompt}
            style={{ width: '100%', minHeight: 34, border: 0, outline: 'none', background: 'transparent', color: APG2_PROFILE.text, fontFamily: 'inherit', fontSize: 12.5 }}
          />
          <GlassButton type="submit" tone="gold" style={{ minHeight: 34, padding: '7px 10px', color: '#17120a' }}>Спросить</GlassButton>
        </form>
      </WorkspacePanel>
      <WorkspacePanel title="Сегодня" subtitle="Briefing Локи">
        <div style={{ display: 'grid', gap: 7 }}>
          {briefing.slice(0, 5).map(item => <ListRow key={item} title={item} text="Реальные данные Workspace" />)}
        </div>
      </WorkspacePanel>
      <WorkspacePanel title="Что требует внимания" subtitle={attention.length ? `${attention.length} сигнала` : 'Спокойный режим'}>
        <div style={{ display: 'grid', gap: 8 }}>
          {attention.length ? attention.slice(0, 4).map(item => <ListRow key={item} title={item} text="Проверить" />) : <EmptyWidget text="Критичных сигналов сейчас нет." />}
        </div>
      </WorkspacePanel>
      <WorkspacePanel title="Рекомендации" subtitle="Контекстные действия">
        <div style={{ display: 'grid', gap: 8 }}>
          {recommendations.map(item => <ListRow key={item} title={item} text={context.label} />)}
        </div>
      </WorkspacePanel>
      <WorkspacePanel title="История" subtitle="Последние рабочие события">
        <div style={{ display: 'grid', gap: 8 }}>
          {data.recentActions.slice(0, 3).map(item => <ListRow key={item.id} title={item.title} text={item.text} />)}
        </div>
      </WorkspacePanel>
      <WorkspacePanel title="Чат" subtitle="Ответы остаются в AI Workspace">
        <div style={{ display: 'grid', gap: 8 }}>
          {chatItems.map(item => (
            <div key={item.id} style={{
              ...APG2_PROFILE.glass,
              borderRadius: item.role === 'user' ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
              padding: '9px 11px',
              marginLeft: item.role === 'user' ? 18 : 0,
              marginRight: item.role === 'user' ? 0 : 18,
              border: item.role === 'loki' ? '1px solid rgba(215,184,106,0.20)' : APG2_PROFILE.glass.border,
            }}>
              <div style={{ color: item.role === 'loki' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 10.5, lineHeight: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.role === 'loki' ? 'Локи' : 'Вы'}</div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 12.5, lineHeight: '17px', marginTop: 3 }}>{item.text}</div>
            </div>
          ))}
        </div>
      </WorkspacePanel>
      <WorkspacePanel title="Быстрые действия" subtitle="Выполняются из Workspace">
        <QuickActions actions={[
          { id: 'briefing', label: 'Сводка дня', onClick: () => onAskLoki?.('Покажи сводку дня'), tone: 'gold' },
          { id: 'news', label: 'Новости', onClick: actions.openNews },
          { id: 'events', label: 'Мероприятия', onClick: actions.openEvents },
          { id: 'business', label: 'Мой бизнес', onClick: actions.openCabinet },
        ]} style={{ background: 'transparent', padding: 0, border: 0 }} />
      </WorkspacePanel>
    </div>
  );
}

function AIActionBoard({ actions }) {
  return (
    <WorkspacePanel title="AI Dashboard" subtitle="Рабочие рекомендации Локи">
      <ContentGrid min={210} gap={10}>
        <ActionCard icon="📰" title="Опубликовать новость" text="Перейти к публикациям и проверить готовые материалы" onClick={actions.openNews} />
        <ActionCard icon="⭐" title="Ответить на отзыв" text="Проверить обратную связь в рабочем контексте" onClick={actions.openLoki} />
        <ActionCard icon="📅" title="Создать мероприятие" text="Открыть события и подготовить карточку" onClick={actions.openEvents} />
        <ActionCard icon="◇" title="Проверить заявку" text="Перейти в CRM-заготовку без выхода из Workspace" onClick={actions.openCrm} />
        <ActionCard icon="🖼" title="Добавить фотографии" text="Улучшить карточку бизнеса или эксперта" onClick={actions.openCabinet} />
      </ContentGrid>
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
  onModeChange,
  onOpenPanel,
  onOpenAdmin,
  onOpenScan,
}) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [shortcutOverlayOpen, setShortcutOverlayOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [aiDraft, setAiDraft] = useState('');
  const [aiHistory, setAiHistory] = useState([]);
  const [aiPulse, setAiPulse] = useState(0);
  const roleState = useMemo(() => getCabinetRoles({ user, partner: ownedPartner, expert: ownedExpert }), [user, ownedPartner, ownedExpert]);
  const [activeRoleId, setActiveRoleId] = useState(roleState.activeRole?.id || '');
  const activeRole = roleState.roles.find(role => role.id === activeRoleId) || roleState.activeRole;
  const layout = useMemo(() => buildWorkspaceLayout({ mode: WORKSPACE_MODES.desktop, contextOpen: true, pinnedContext: true }), []);
  const workspaceNavigation = useMemo(() => getWorkspaceNavigation({ mode: WORKSPACE_MODES.desktop, role: activeRole?.id || 'user', includeSecondary: true }), [activeRole?.id]);
  const activeProfile = activeRole?.id === 'expert' ? ownedExpert : activeRole?.id === 'partner' ? ownedPartner : user;
  const userName = user?.firstName || user?.name || user?.displayName || 'коллега';
  const isAdminRole = ['owner', 'super_admin', 'admin', 'moderator', 'editor'].includes(activeRole?.id);
  const businessHubFlag = useMemo(() => getBusinessHubFlag(), []);
  const businessHubAvailable = useMemo(() => canUseBusinessHub({ user, partner: ownedPartner, expert: ownedExpert, flag: businessHubFlag }), [user, ownedPartner, ownedExpert, businessHubFlag]);
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
    setActiveRoleId(roleState.activeRole?.id || '');
  }, [roleState.activeRole?.id]);

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
        const input = document.querySelector('[placeholder="Глобальный поиск по Workspace"]');
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
    openLoki: () => handleAskLoki(getWorkspaceContext(activeSection).prompt),
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
      return <DataSection title="Новости" subtitle="Рабочий список публикаций" items={news} emptyText="Новостей пока нет." onOpen={() => onOpenPanel?.('news')} />;
    }
    if (activeSection === 'events') {
      return <DataSection title="Мероприятия" subtitle="События и будущий календарь" items={events} emptyText="Мероприятий пока нет." onOpen={() => onOpenPanel?.('events')} />;
    }
    if (activeSection === 'partners') {
      return <DataSection title="Партнёры" subtitle="Рабочий каталог партнёров" items={partners} emptyText="Партнёров пока нет." onOpen={() => onOpenPanel?.('offers')} />;
    }
    if (activeSection === 'experts') {
      return <DataSection title="Эксперты" subtitle="Рабочий каталог экспертов" items={experts} emptyText="Экспертов пока нет." onOpen={() => onOpenPanel?.('experts')} />;
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
    <div onContextMenu={handleWorkspaceContextMenu} style={{ minHeight: '100svh', background: 'radial-gradient(circle at 18% -12%, rgba(215,184,106,0.18), transparent 34%), radial-gradient(circle at 92% 8%, rgba(112,92,168,0.14), transparent 30%), linear-gradient(180deg, var(--apg2-bg-top, #17171a) 0%, var(--apg2-bg-mid, #121316) 56%, var(--apg2-bg-bottom, #101114) 100%)', color: APG2_PROFILE.text, padding: 14, boxSizing: 'border-box' }}>
      <div style={{ display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', gap: 14, minHeight: 'calc(100svh - 28px)' }}>
        <WorkspaceHeaderBar
          user={user}
          roleState={roleState}
          activeRoleId={activeRole?.id || activeRoleId}
          onRoleChange={setActiveRoleId}
          onModeChange={onModeChange}
          unreadCount={unreadCount}
          query={query}
          onQueryChange={setQuery}
          onOpenNotifications={() => onOpenPanel?.('notifications')}
          onOpenProfile={() => onOpenPanel?.('profile')}
          onOpenScan={onOpenScan}
          onOpenShortcuts={() => setShortcutOverlayOpen(true)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: `${sidebarCollapsed ? 72 : 238}px minmax(0, 1fr) 368px`, gap: 14, alignItems: 'start' }}>
          <WorkspaceSidebar
            items={navItems}
            activeSection={activeSection}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(value => !value)}
            onSelect={handleSelectNav}
          />
          <main style={{ minWidth: 0 }}>
            <SectionHeader
              title={activeSection === 'dashboard' ? 'Dashboard' : navItems.find(item => item.id === activeSection)?.label || 'Workspace'}
              subtitle={query ? `Поиск: ${query}` : `${layout.density} · ${workspaceNavigation.placement} · APG V2 Liquid Glass`}
              actions={<GlassBadge tone="gold">Desktop Workspace 1.0</GlassBadge>}
            />
            {renderContent()}
          </main>
          <aside>
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
        </div>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 20, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: APG2_PROFILE.textSoft, fontSize: 12 }}>
          <span>AI Workspace: active · shortcuts: ⌘K поиск, ⌘1 Dashboard, ⌘2 Мой бизнес, ⌘L Локи, ? помощь</span>
          <span>{partners.length} партнёров · {experts.length} экспертов · {news.length} новостей · {events.length} событий</span>
        </div>
      </div>
      <WorkspaceShortcutOverlay open={shortcutOverlayOpen} onClose={() => setShortcutOverlayOpen(false)} />
      <WorkspaceContextMenu menu={contextMenu} actions={actions} onClose={() => setContextMenu(null)} />
    </div>
  );
}
