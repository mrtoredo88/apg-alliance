import React, { useEffect, useMemo, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassPanel } from '../components/Apg2ProfileGlass.jsx';
import { MOTION, motionTransition } from '../motion.js';
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
import { getWorkspaceWidgetLayout } from './WorkspaceWidgets.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'content', label: 'Контент', icon: '✎' },
  { id: 'news', label: 'Новости', icon: '📰', panelId: 'news' },
  { id: 'events', label: 'Мероприятия', icon: '📅', panelId: 'events' },
  { id: 'partners', label: 'Партнёры', icon: '🤝', panelId: 'offers' },
  { id: 'experts', label: 'Эксперты', icon: '✦', panelId: 'experts' },
  { id: 'cabinet', label: 'Кабинеты', icon: '▣', panelId: 'partner-cabinet' },
  { id: 'crm', label: 'CRM', icon: '◇', placeholder: true },
  { id: 'calendar', label: 'Календарь', icon: '◷', placeholder: true },
  { id: 'loki', label: 'Локи', icon: '🦊', panelId: 'loki' },
  { id: 'settings', label: 'Настройки', icon: '⚙', panelId: 'profile' },
  { id: 'admin', label: 'Администрирование', icon: '🛡', adminOnly: true },
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

function WorkspaceHeaderBar({ user, roleState, activeRoleId, onRoleChange, onModeChange, unreadCount, query, onQueryChange, onOpenNotifications, onOpenProfile, onOpenScan }) {
  return (
    <GlassPanel style={{ borderRadius: 30, padding: '12px 14px', display: 'grid', gridTemplateColumns: 'auto minmax(260px, 1fr) auto', alignItems: 'center', gap: 14, position: 'sticky', top: 14, zIndex: 10 }}>
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
        <GlassBadge tone="gold">⌘K / Ctrl K</GlassBadge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <GlassButton onClick={onOpenScan} style={{ minHeight: 40 }}>QR</GlassButton>
        <GlassButton onClick={onOpenNotifications} style={{ minHeight: 40 }}>Уведомления {unreadCount ? `· ${unreadCount}` : ''}</GlassButton>
        {roleState.roles.length > 1 && (
          <select value={activeRoleId || ''} onChange={event => onRoleChange(event.target.value)} style={{ ...APG2_PROFILE.glass, color: APG2_PROFILE.text, minHeight: 40, borderRadius: 16, padding: '0 10px', fontFamily: 'inherit' }}>
            {roleState.roles.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}
          </select>
        )}
        <GlassButton onClick={() => onModeChange('user')} style={{ minHeight: 40 }}>Пользовательский режим</GlassButton>
        <button type="button" onClick={onOpenProfile} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 16, background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{String(user?.firstName || user?.name || 'A').slice(0, 1)}</div>
        </button>
      </div>
    </GlassPanel>
  );
}

function WorkspaceSidebar({ items, activeSection, collapsed, onToggle, onSelect }) {
  return (
    <GlassPanel style={{ borderRadius: 32, padding: 10, height: 'calc(100svh - 116px)', position: 'sticky', top: 92, display: 'flex', flexDirection: 'column', gap: 8, transition: motionTransition(['width'], 'base'), width: collapsed ? 78 : 258 }}>
      <div style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', padding: '4px 5px 8px' }}>
        {!collapsed && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11, fontWeight: 850, letterSpacing: 0.7, textTransform: 'uppercase' }}>Навигация</div>}
        <GlassButton onClick={onToggle} style={{ minHeight: 34, width: 34, padding: 0, borderRadius: 14 }}>{collapsed ? '›' : '‹'}</GlassButton>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {items.map(item => {
          const active = activeSection === item.id;
          return (
            <button key={item.id} type="button" onClick={() => onSelect(item)} title={item.label} style={{
              border: active ? '1px solid rgba(215,184,106,0.54)' : APG2_PROFILE.glass.border,
              background: active ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.07)',
              borderRadius: 20,
              minHeight: 46,
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
              transition: motionTransition(['background', 'border-color', 'transform'], 'base'),
            }}>
              <span style={{ width: 26, textAlign: 'center' }}>{item.icon}</span>
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 'auto', display: collapsed ? 'none' : 'block' }}>
        <GlassCard style={{ borderRadius: 22, padding: 12 }}>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 850 }}>Workspace 1.0</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '16px', marginTop: 4 }}>Платформа для партнёров, экспертов и команды АПГ.</div>
        </GlassCard>
      </div>
    </GlassPanel>
  );
}

function WidgetShell({ widget, children }) {
  return (
    <div data-workspace-widget={widget.id} data-drag-handle={widget.dragHandleId} style={{ gridColumn: widget.size === 'wide' ? 'span 2' : 'span 1', minWidth: 0 }}>
      {children}
    </div>
  );
}

function WorkspaceDashboard({ data, actions, widgetLayout }) {
  const profileStatus = getProfileCompletion(data.activeProfile);
  const latestNews = data.news.slice(0, 4);
  const upcomingEvents = data.events.slice(0, 4);
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
          subtitle="Это рабочее пространство АПГ. Здесь собираются кабинеты, контент, задачи, Локи и будущие CRM-инструменты."
          value={data.roleLabel}
          action={<GlassButton onClick={actions.openCabinet} style={{ color: '#17120a' }}>Открыть кабинет</GlassButton>}
        />
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
        <WorkspacePanel title="Последние действия" subtitle="Живая лента Workspace">
          <div style={{ display: 'grid', gap: 8 }}>
            {data.recentActions.map(item => <ListRow key={item.id} title={item.title} text={item.text} />)}
          </div>
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
            {tasks.map(task => <ListRow key={task} title={task} text="Workspace recommendation" />)}
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
    <div style={{ display: 'grid', gap: 14 }}>
      <ContentGrid min={180} gap={10}>
        <MetricCard label="Партнёры" value={data.partners.length} />
        <MetricCard label="Эксперты" value={data.experts.length} />
        <MetricCard label="Новости" value={data.news.length} />
        <MetricCard label="События" value={data.events.length} />
      </ContentGrid>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14, alignItems: 'start' }}>
        {widgetLayout.map(widget => <WidgetShell key={widget.id} widget={widget}>{renderWidget(widget)}</WidgetShell>)}
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

function RightContextPanel({ notifications, events, onOpenLoki, onOpenNotifications, onOpenEvents }) {
  return (
    <div style={{ display: 'grid', gap: 12, position: 'sticky', top: 92 }}>
      <WorkspacePanel title="Локи" subtitle="Desktop context">
        <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '21px', fontWeight: 760 }}>Я теперь не плаваю поверх рабочего стола, а живу в правой колонке Workspace. Так спокойнее для интерфейса и полезнее для работы.</div>
        <GlassButton onClick={onOpenLoki} tone="gold" style={{ marginTop: 12, width: '100%', color: '#17120a' }}>Открыть Локи</GlassButton>
      </WorkspacePanel>
      <WorkspacePanel title="Быстрые действия">
        <QuickActions actions={[
          { id: 'notifications', label: 'Уведомления', onClick: onOpenNotifications },
          { id: 'events', label: 'События', onClick: onOpenEvents },
        ]} style={{ background: 'transparent', padding: 0, border: 0 }} />
      </WorkspacePanel>
      <WorkspacePanel title="Уведомления" subtitle={`${notifications.length} последних`}>
        <div style={{ display: 'grid', gap: 8 }}>
          {notifications.slice(0, 3).map(item => <ListRow key={item.id || item.title} title={item.title || item.text || 'Уведомление'} text={formatShortDate(item.createdAt)} />)}
          {!notifications.length && <EmptyWidget text="Новых уведомлений нет." />}
        </div>
      </WorkspacePanel>
      <WorkspacePanel title="Последние события">
        <div style={{ display: 'grid', gap: 8 }}>
          {events.slice(0, 3).map(item => <ListRow key={item.id || item.title} title={item.title || item.name || 'Событие'} text={formatShortDate(item.date || item.createdAt)} />)}
          {!events.length && <EmptyWidget text="Событий пока нет." />}
        </div>
      </WorkspacePanel>
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
  onOpenScan,
}) {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const roleState = useMemo(() => getCabinetRoles({ user, partner: ownedPartner, expert: ownedExpert }), [user, ownedPartner, ownedExpert]);
  const [activeRoleId, setActiveRoleId] = useState(roleState.activeRole?.id || '');
  const activeRole = roleState.roles.find(role => role.id === activeRoleId) || roleState.activeRole;
  const layout = useMemo(() => buildWorkspaceLayout({ mode: WORKSPACE_MODES.desktop, contextOpen: true, pinnedContext: true }), []);
  const workspaceNavigation = useMemo(() => getWorkspaceNavigation({ mode: WORKSPACE_MODES.desktop, role: activeRole?.id || 'user', includeSecondary: true }), [activeRole?.id]);
  const widgetLayout = useMemo(() => getWorkspaceWidgetLayout(), []);
  const activeProfile = activeRole?.id === 'expert' ? ownedExpert : activeRole?.id === 'partner' ? ownedPartner : user;
  const userName = user?.firstName || user?.name || user?.displayName || 'коллега';
  const isAdminRole = ['owner', 'admin', 'moderator', 'editor'].includes(activeRole?.id);
  const navItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdminRole);
  const recentActions = [
    { id: 'workspace-open', title: 'Workspace открыт', text: 'Рабочая среда активна без повторной авторизации' },
    { id: 'data-ready', title: 'Данные загружены', text: `${partners.length} партнёров · ${experts.length} экспертов` },
    { id: 'loki-context', title: 'Локи в контексте', text: 'Правая панель готова к AI Workspace' },
  ];

  useEffect(() => {
    setActiveRoleId(roleState.activeRole?.id || '');
  }, [roleState.activeRole?.id]);

  useEffect(() => {
    const onKeyDown = event => {
      const key = event.key?.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        const input = document.querySelector('[placeholder="Глобальный поиск по Workspace"]');
        input?.focus?.();
      }
      if ((event.metaKey || event.ctrlKey) && key === '1') {
        event.preventDefault();
        setActiveSection('dashboard');
      }
      if ((event.metaKey || event.ctrlKey) && key === 'b') {
        event.preventDefault();
        setSidebarCollapsed(value => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const actions = {
    openCabinet: () => onOpenPanel?.(activeRole?.id === 'expert' ? 'expert-cabinet' : 'partner-cabinet'),
    openNews: () => setActiveSection('news'),
    openEvents: () => setActiveSection('events'),
    openPartners: () => setActiveSection('partners'),
    openExperts: () => setActiveSection('experts'),
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
    if (item.id === 'dashboard' || item.id === 'content') {
      setActiveSection(item.id);
      return;
    }
    if (item.panelId) setActiveSection(item.id);
  };

  const renderContent = () => {
    if (activeSection === 'dashboard') {
      return (
        <WorkspaceDashboard
          data={{
            userName,
            roleLabel: activeRole?.label || 'Workspace',
            activeProfile,
            partners,
            experts,
            events,
            news,
            unreadCount,
            recentActions,
          }}
          actions={actions}
          widgetLayout={widgetLayout}
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
    if (activeSection === 'cabinet') {
      return (
        <PlaceholderSection
          title="Кабинеты"
          text="Cabinet Core уже подключён к Workspace. Полноценная рабочая версия кабинетов будет развиваться внутри этой области."
          actions={[{ id: 'open-cabinet', label: 'Открыть кабинет', onClick: actions.openCabinet, tone: 'gold' }]}
        />
      );
    }
    if (activeSection === 'loki') {
      return <PlaceholderSection title="Локи Workspace" text="Локи уже закреплён в правой колонке. Следующий этап — полноценный AI Workspace с контекстом объектов." />;
    }
    if (activeSection === 'settings') {
      return <PlaceholderSection title="Настройки Workspace" text="Здесь будут параметры рабочего пространства, виджеты, роли и персонализация." />;
    }
    if (activeSection === 'crm') return <PlaceholderSection title="CRM" text="Заготовка под заявки, клиентов и воронки партнёров." />;
    if (activeSection === 'calendar') return <PlaceholderSection title="Календарь" text="Заготовка под расписание, мероприятия, записи и занятость." />;
    return null;
  };

  return (
    <div style={{ minHeight: '100svh', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, padding: 14, boxSizing: 'border-box' }}>
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
        />
        <div style={{ display: 'grid', gridTemplateColumns: `${sidebarCollapsed ? 78 : 258}px minmax(0, 1fr) 344px`, gap: 14, alignItems: 'start' }}>
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
            <RightContextPanel
              notifications={notifications}
              events={events}
              onOpenLoki={() => onOpenPanel?.('loki')}
              onOpenNotifications={() => onOpenPanel?.('notifications')}
              onOpenEvents={() => onOpenPanel?.('events')}
            />
          </aside>
        </div>
        <GlassPanel style={{ borderRadius: 24, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: APG2_PROFILE.textSoft, fontSize: 12 }}>
          <span>Workspace status: готов · shortcuts: ⌘K поиск, ⌘1 Dashboard, ⌘B sidebar</span>
          <span>{partners.length} партнёров · {experts.length} экспертов · {news.length} новостей · {events.length} событий</span>
        </GlassPanel>
      </div>
    </div>
  );
}
