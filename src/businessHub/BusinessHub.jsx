import React, { useMemo, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard } from '../components/Apg2ProfileGlass.jsx';
import {
  ActionCard,
  ContentGrid,
  DashboardCard,
  InfoPanel,
  MetricCard,
  QuickActions,
  SectionHeader,
  WorkspacePanel,
} from '../workspace/WorkspaceComponents.jsx';
import { buildBusinessHubModel } from './BusinessHubCore.js';

const BUSINESS_HUB_TABS = [
  { id: 'dashboard', label: 'Обзор', icon: '▦' },
  { id: 'analytics', label: 'Аналитика', icon: '◌' },
  { id: 'profile', label: 'Профиль', icon: '◈' },
  { id: 'media', label: 'Медиа', icon: '▧' },
  { id: 'news', label: 'Новости', icon: '✎' },
  { id: 'events', label: 'События', icon: '◷' },
  { id: 'promotions', label: 'Акции', icon: '✦' },
  { id: 'reviews', label: 'Отзывы', icon: '☆' },
  { id: 'tasks', label: 'Задачи', icon: '☑' },
  { id: 'qr', label: 'QR', icon: '▣' },
  { id: 'notifications', label: 'Уведомления', icon: '•' },
  { id: 'loki', label: 'Локи', icon: '🦊' },
];

function formatDate(value) {
  if (!value) return 'дата не указана';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return 'дата не указана';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function valueOrEmpty(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value || '').trim() || 'Не заполнено';
}

function BusinessTabs({ activeTab, onChange }) {
  return (
    <GlassCard style={{ borderRadius: 32, padding: 9, display: 'flex', gap: 8, overflowX: 'auto', background: APG2_PROFILE.quietSurface }}>
      {BUSINESS_HUB_TABS.map(tab => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              border: active ? '1px solid rgba(215,184,106,0.55)' : APG2_PROFILE.glass.border,
              background: active ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.06)',
              color: active ? APG2_PROFILE.gold : APG2_PROFILE.textSoft,
              borderRadius: 20,
              minHeight: 40,
              padding: '8px 11px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 820,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </GlassCard>
  );
}

function ListItem({ title, text, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...APG2_PROFILE.glass,
        borderRadius: 24,
        padding: 13,
        background: APG2_PROFILE.quietSurface,
        color: APG2_PROFILE.text,
        fontFamily: 'inherit',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14.5, lineHeight: '19px', fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {text && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 4 }}>{text}</div>}
        </div>
        {badge && <GlassBadge>{badge}</GlassBadge>}
      </div>
    </button>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <InfoPanel
      icon="◌"
      title={title}
      text={text}
      action={action}
      style={{ minHeight: 116 }}
    />
  );
}

function DashboardView({ model, actions }) {
  const profileName = model.profile?.name || model.profile?.title || model.profile?.companyName || 'Профиль не подключён';
  return (
    <div style={{ display: 'grid', gap: APG2_PROFILE.rhythm.section }}>
      <ContentGrid min={340} gap={16}>
        <DashboardCard
          tone="gold"
          icon="◈"
          title={profileName}
          subtitle={`${model.business.label} · единый Business Hub АПГ`}
          value={model.profile?.status || model.profile?.tariff || 'АПГ'}
          action={<GlassButton onClick={actions.openEditor} style={{ color: '#17120a' }}>Редактировать</GlassButton>}
          style={{ minHeight: 176, borderRadius: APG2_PROFILE.radius.hero }}
        />
        <WorkspacePanel title="Следующие шаги" subtitle="Локи использует эти сигналы для рекомендаций" style={{ minHeight: 176 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {model.tasks.length ? model.tasks.map(task => <ListItem key={task} title={task} text="Рекомендация Business Hub" />) : <EmptyState title="Критичных задач нет" text="Профиль выглядит готовым к работе." />}
          </div>
        </WorkspacePanel>
      </ContentGrid>
      <ContentGrid min={170} gap={12}>
        <MetricCard label="Заполненность" value={`${model.completion.value}%`} delta={model.completion.label} tone={model.completion.value >= 80 ? 'gold' : undefined} />
        <MetricCard label="Новости" value={model.totals.news} delta="Связанные публикации" tone="quiet" />
        <MetricCard label="Мероприятия" value={model.totals.events} delta="Связанные события" tone="quiet" />
        <MetricCard label="Акции" value={model.totals.promotions} delta="Активные предложения" tone="quiet" />
        <MetricCard label="Отзывы" value={model.totals.reviews} delta="Доступные оценки" tone="quiet" />
        <MetricCard label="QR" value={model.stats.qr} delta="Сканы и переходы" tone="quiet" />
      </ContentGrid>
      <ContentGrid min={300} gap={16}>
        <WorkspacePanel title="Последние новости" subtitle={`${model.relatedNews.length} материалов`}>
          <div style={{ display: 'grid', gap: 8 }}>
            {model.relatedNews.slice(0, 4).map(item => <ListItem key={item.id || item.title} title={item.title || 'Новость'} text={formatDate(item.publishedAt || item.createdAt)} badge={item.status || 'news'} onClick={actions.openNews} />)}
            {!model.relatedNews.length && <EmptyState title="Новостей нет" text="Пока нет публикаций, связанных с этим профилем." action={<GlassButton onClick={actions.openNews}>Открыть новости</GlassButton>} />}
          </div>
        </WorkspacePanel>
        <WorkspacePanel title="Ближайшие события" subtitle={`${model.relatedEvents.length} мероприятий`}>
          <div style={{ display: 'grid', gap: 8 }}>
            {model.relatedEvents.slice(0, 4).map(item => <ListItem key={item.id || item.title || item.name} title={item.title || item.name || 'Мероприятие'} text={`${formatDate(item.date || item.startAt)} · ${item.address || item.location || 'место уточняется'}`} badge={item.status || 'event'} onClick={actions.openEvents} />)}
            {!model.relatedEvents.length && <EmptyState title="Событий нет" text="Пока нет мероприятий, связанных с профилем." action={<GlassButton onClick={actions.openEvents}>Открыть события</GlassButton>} />}
          </div>
        </WorkspacePanel>
      </ContentGrid>
    </div>
  );
}

function AnalyticsView({ model }) {
  const metrics = [
    ['Просмотры', model.stats.views, 'Карточка и профиль'],
    ['Звонки', model.stats.calls, 'Нажатия на телефон'],
    ['Сайт', model.stats.website, 'Переходы на сайт'],
    ['Соцсети', model.stats.socials, 'Telegram, VK, WhatsApp и другие'],
    ['Маршрут', model.stats.routes, 'Построение пути'],
    ['Избранное', model.stats.favorites, 'Добавления пользователями'],
  ];
  return (
    <WorkspacePanel title="Аналитика" subtitle="Показатели строятся только на сохранённых данных профиля. Графики подключаются поверх этого слоя без смены модели.">
      <ContentGrid min={170} gap={10}>
        {metrics.map(([label, value, delta]) => <MetricCard key={label} label={label} value={value} delta={delta} />)}
      </ContentGrid>
    </WorkspacePanel>
  );
}

function ProfileView({ model, actions }) {
  const p = model.profile || {};
  const rows = [
    ['Описание', p.description || p.shortDescription || p.about],
    ['Категория', p.categoryLabel || p.category || p.categoryId || p.categories],
    ['Телефон', p.phone],
    ['Сайт', p.website || p.websiteUrl],
    ['Telegram', p.telegram || p.telegramUrl],
    ['VK', p.vk || p.vkUrl],
    ['Адрес', p.address || p.location],
    ['Часы работы', p.hours || p.workingHours || p.schedule],
    ['Услуги', p.services || p.serviceDescription],
    ['Стоимость', p.price || p.pricing || p.serviceCost],
  ];
  return (
    <WorkspacePanel title="Профиль бизнеса" subtitle="Единая точка управления публичной карточкой партнёра или эксперта." actions={<GlassButton tone="gold" onClick={actions.openEditor} style={{ color: '#17120a' }}>Открыть редактор</GlassButton>}>
      <ContentGrid min={250} gap={10}>
        {rows.map(([label, value]) => <ListItem key={label} title={label} text={valueOrEmpty(value)} badge={value ? 'заполнено' : 'пусто'} />)}
      </ContentGrid>
    </WorkspacePanel>
  );
}

function MediaView({ model, actions }) {
  const p = model.profile || {};
  const gallery = [...(Array.isArray(p.photos) ? p.photos : []), ...(Array.isArray(p.gallery) ? p.gallery : [])].filter(Boolean);
  return (
    <WorkspacePanel title="Media Manager" subtitle="Использует существующую модель медиа и готов к Media Validator: предпросмотр, порядок, удаление и видео.">
      <ContentGrid min={220} gap={10}>
        <DashboardCard title="Аватар / логотип" subtitle={p.photo || p.avatar || p.logoUrl ? 'Добавлен' : 'Не добавлен'} icon="◉" action={<GlassButton onClick={actions.openEditor}>Редактор</GlassButton>} />
        <DashboardCard title="Обложка" subtitle={p.cover || p.coverPhoto ? 'Добавлена' : 'Не добавлена'} icon="▭" />
        <DashboardCard title="Галерея" subtitle={`${gallery.length} фото`} icon="▧" />
        <DashboardCard title="Видео" subtitle={`${Array.isArray(p.videos) ? p.videos.length : p.video ? 1 : 0} ссылок`} icon="▶" />
      </ContentGrid>
    </WorkspacePanel>
  );
}

function CollectionView({ title, subtitle, items, emptyTitle, emptyText, openAction }) {
  return (
    <WorkspacePanel title={title} subtitle={subtitle} actions={openAction ? <GlassButton onClick={openAction}>Открыть раздел</GlassButton> : null}>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.slice(0, 10).map(item => <ListItem key={item.id || item.title || item.name} title={item.title || item.name || 'Без названия'} text={item.description || item.shortDescription || formatDate(item.createdAt || item.date)} badge={item.status || 'АПГ'} onClick={openAction} />)}
        {!items.length && <EmptyState title={emptyTitle} text={emptyText} action={openAction ? <GlassButton onClick={openAction}>Перейти</GlassButton> : null} />}
      </div>
    </WorkspacePanel>
  );
}

function LokiView({ model, actions }) {
  const prompts = [
    'Что улучшить в моей карточке?',
    'Какую акцию запустить на этой неделе?',
    'Какая новость подойдёт моему профилю?',
    'Почему пользователи могут не звонить?',
    'Какие поля стоит заполнить первыми?',
  ];
  return (
    <WorkspacePanel title="Локи для бизнеса" subtitle="Контекстный помощник будет опираться на профиль, аналитику, контент и статусы заявок.">
      <QuickActions actions={prompts.map(prompt => ({ id: prompt, label: prompt, onClick: actions.openLoki }))} style={{ marginBottom: 12 }} />
      <InfoPanel icon="🦊" title="Готов к бизнес-контексту" text={`Локи видит тип профиля: ${model.business.label}, заполненность ${model.completion.value}%, новости, события, акции и задачи.`} action={<GlassButton tone="gold" onClick={actions.openLoki} style={{ color: '#17120a' }}>Спросить Локи</GlassButton>} />
    </WorkspacePanel>
  );
}

export function BusinessHub({
  user,
  ownedPartner,
  ownedExpert,
  partners = [],
  experts = [],
  events = [],
  news = [],
  notifications = [],
  activeRoleId,
  onOpenPanel,
}) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const model = useMemo(() => buildBusinessHubModel({
    user,
    partner: ownedPartner,
    expert: ownedExpert,
    preferredRole: activeRoleId,
    partners,
    experts,
    events,
    news,
    notifications,
  }), [user, ownedPartner, ownedExpert, activeRoleId, partners, experts, events, news, notifications]);

  const editorPanel = model.business.kind === 'expert' ? 'expert-cabinet' : 'partner-cabinet';
  const actions = {
    openEditor: () => onOpenPanel?.(editorPanel),
    openNews: () => onOpenPanel?.('news'),
    openEvents: () => onOpenPanel?.('events'),
    openLoki: () => onOpenPanel?.('loki'),
    openQr: () => onOpenPanel?.('qr'),
    openNotifications: () => onOpenPanel?.('notifications'),
  };

  const renderTab = () => {
    if (activeTab === 'dashboard') return <DashboardView model={model} actions={actions} />;
    if (activeTab === 'analytics') return <AnalyticsView model={model} />;
    if (activeTab === 'profile') return <ProfileView model={model} actions={actions} />;
    if (activeTab === 'media') return <MediaView model={model} actions={actions} />;
    if (activeTab === 'news') return <CollectionView title="News Center" subtitle="Публикации, связанные с профилем" items={model.relatedNews} emptyTitle="Связанных новостей нет" emptyText="Создайте или привяжите публикацию к профилю." openAction={actions.openNews} />;
    if (activeTab === 'events') return <CollectionView title="Events Center" subtitle="Мероприятия профиля" items={model.relatedEvents} emptyTitle="Связанных мероприятий нет" emptyText="Добавьте событие или организатора." openAction={actions.openEvents} />;
    if (activeTab === 'promotions') return <CollectionView title="Promotions" subtitle="Акции и специальные предложения" items={model.promotions} emptyTitle="Акций нет" emptyText="Добавьте предложение для пользователей АПГ в редакторе профиля." openAction={actions.openEditor} />;
    if (activeTab === 'reviews') return <CollectionView title="Отзывы и комментарии" subtitle={`${model.totals.reviews} записей`} items={model.reviews} emptyTitle="Отзывов нет" emptyText="Когда появятся отзывы, они соберутся здесь." />;
    if (activeTab === 'tasks') return <CollectionView title="Задачи" subtitle="Автоматические рекомендации по заполнению" items={model.tasks.map(task => ({ id: task, title: task, status: 'todo' }))} emptyTitle="Задач нет" emptyText="Профиль выглядит заполненным." openAction={actions.openEditor} />;
    if (activeTab === 'qr') return <CollectionView title="QR Center" subtitle="Готово для QR, ключей и офлайн-точек" items={[{ id: 'qr', title: 'QR профиля', description: `${model.stats.qr} сканов`, status: 'ready' }]} emptyTitle="QR пока нет" emptyText="QR будет подключён к бизнес-профилю." openAction={actions.openQr} />;
    if (activeTab === 'notifications') return <CollectionView title="Уведомления" subtitle="События Business Hub" items={model.notifications} emptyTitle="Уведомлений нет" emptyText="Новые бизнес-события появятся здесь." openAction={actions.openNotifications} />;
    if (activeTab === 'loki') return <LokiView model={model} actions={actions} />;
    return null;
  };

  return (
    <div style={{ display: 'grid', gap: APG2_PROFILE.rhythm.section }}>
      <SectionHeader
        title="Мой бизнес"
        subtitle="Единый Business Hub для партнёра и эксперта внутри Desktop Workspace."
        actions={<GlassBadge tone="gold">Business Hub 1.0</GlassBadge>}
      />
      <InfoPanel
        icon="◈"
        title={model.profile?.name || model.profile?.title || 'Профиль бизнеса не найден'}
        text={model.profile?.id ? `${model.business.label} · заполненность ${model.completion.value}% · данные берутся из существующих коллекций АПГ` : 'Business Hub доступен по роли, но связанный профиль партнёра или эксперта пока не найден.'}
        style={{ borderRadius: APG2_PROFILE.radius.hero, padding: 18, background: APG2_PROFILE.heroSurface }}
        action={<QuickActions actions={[
          { id: 'edit', label: 'Редактировать профиль', onClick: actions.openEditor, tone: 'gold' },
          { id: 'loki', label: 'Спросить Локи', onClick: actions.openLoki },
          { id: 'news', label: 'Новости', onClick: actions.openNews },
        ]} style={{ background: 'transparent', padding: 0, border: 0 }} />}
      />
      <BusinessTabs activeTab={activeTab} onChange={setActiveTab} />
      {renderTab()}
      <ContentGrid min={220} gap={12}>
        <ActionCard tone="gold" icon="✎" title="Создать новость" text="Через существующий центр контента" onClick={actions.openNews} />
        <ActionCard icon="◷" title="Добавить событие" text="Через существующие мероприятия" onClick={actions.openEvents} />
        <ActionCard tone="quiet" icon="✦" title="Запустить акцию" text="Через профиль и предложения" onClick={actions.openEditor} />
        <ActionCard tone="quiet" icon="🦊" title="Попросить Локи" text="Получить рекомендацию по развитию" onClick={actions.openLoki} />
      </ContentGrid>
    </div>
  );
}
