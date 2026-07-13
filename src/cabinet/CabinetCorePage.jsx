import React, { useEffect, useMemo, useState } from 'react';
import { Panel } from '@vkontakte/vkui';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel, GlassSection, ProfileHero, ScreenHeader, StatPill } from '../components/Apg2ProfileGlass.jsx';
import { PartnerQRSection, ExpertQRSection } from '../PartnerQRSection.jsx';
import { CabinetEventsBlock } from '../EventProposalTools.jsx';
import { AiProfileSection, Stars } from '../PartnerCabinetPage.jsx';
import { userAction } from '../userApi.js';
import { normalizeExternalUrl, validateExternalUrl } from '../utils/externalUrls.js';
import { shareLink } from '../utils/shareLink.js';
import { ContentGrid } from '../workspace/WorkspaceComponents.jsx';
import { LokiIdentity } from '../loki/LokiIdentity.jsx';
import { getCabinetRoles, getRoleModuleIds } from './CabinetRoleEngine.js';
import { buildCabinetHistory, buildCabinetNotifications, buildCabinetSnapshot, buildCabinetTasks, getCabinetPublicUrl } from './CabinetModules.js';
import { DigitalShowcaseBuilder } from './DigitalShowcaseBuilder.jsx';
import { BOOKING_STATUSES, buildBookingCalendar, buildBookingProfile, groupBookingsForProfile, normalizeBooking } from '../../server-shared/booking.js';

const MODULES = [
  ['showcase-builder', 'Витрина'],
  ['dashboard', 'Дашборд'],
  ['dialogs', 'Диалоги'],
  ['tasks', 'Задачи'],
  ['analytics', 'Аналитика'],
  ['media', 'Галерея'],
  ['contacts', 'Контакты'],
  ['content', 'Контент'],
  ['reviews', 'Отзывы'],
  ['notifications', 'Уведомления'],
  ['loki', 'Локи'],
  ['subscription', 'Подписка'],
  ['settings', 'Настройки'],
  ['history', 'История'],
  ['services', 'Услуги'],
  ['experience', 'Опыт'],
  ['booking', 'Запись'],
  ['promotions', 'Акции'],
  ['events', 'События'],
  ['products', 'Товары'],
];

const MODULE_LABELS = Object.fromEntries(MODULES);

function dateText(value) {
  if (!value) return 'Дата не указана';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function contactFields(profile = {}) {
  return [
    ['phone', 'Телефон', profile.phone || ''],
    ['whatsappUrl', 'WhatsApp', profile.whatsappUrl || profile.whatsapp || ''],
    ['telegramUrl', 'Telegram', profile.telegramUrl || profile.telegram || ''],
    ['vkUrl', 'VK', profile.vkUrl || profile.socialUrl || profile.vkGroupUrl || ''],
    ['maxUrl', 'MAX', profile.maxUrl || ''],
    ['websiteUrl', 'Сайт', profile.websiteUrl || profile.website || ''],
    ['email', 'Email', profile.email || ''],
    ['address', 'Адрес', profile.address || ''],
    ['hours', 'Часы работы', profile.hours || profile.workingHours || ''],
    ['bookingUrl', 'Онлайн-запись', profile.bookingUrl || ''],
  ];
}

function SectionCard({ title, text, action, tone }) {
  return (
    <GlassCard tone={tone} style={{ borderRadius: 26 }}>
      <div style={{ color: tone === 'gold' ? '#17120a' : APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 870 }}>{title}</div>
      {text && <div style={{ color: tone === 'gold' ? 'rgba(23,18,10,0.62)' : APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 5 }}>{text}</div>}
      {action}
    </GlassCard>
  );
}

function MetricGrid({ metrics }) {
  const rows = [
    ['просмотры', metrics.views],
    ['уникальные', metrics.uniqueVisitors || '—'],
    ['переходы', metrics.website + metrics.vk + metrics.telegram + metrics.whatsapp + metrics.calls + metrics.map],
    ['звонки', metrics.calls],
    ['Telegram', metrics.telegram],
    ['WhatsApp', metrics.whatsapp],
    ['VK', metrics.vk],
    ['сайт', metrics.website],
    ['карта', metrics.map],
    ['избранное', metrics.favorites],
    ['отзывы', metrics.reviews],
    ['рейтинг', metrics.rating ? metrics.rating.toFixed(1) : '—'],
    ['новости', metrics.news],
    ['мероприятия', metrics.events],
    ['акции', metrics.offers],
    ['заполненность', `${metrics.completion}%`],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
      {rows.map(([label, value]) => <StatPill key={label} label={label} value={value} tone={label === 'заполненность' ? 'gold' : 'glass'} />)}
    </div>
  );
}

function ProfileCompleteness({ snapshot, onOpenModule }) {
  const firstTodo = snapshot.completionChecks.find(item => !item.done);
  return (
    <GlassCard tone="gold" style={{ borderRadius: 32, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
        <div>
          <div style={{ color: '#17120a', fontSize: 19, lineHeight: '23px', fontWeight: 920 }}>Профиль готов на {snapshot.completion}%</div>
          <div style={{ color: 'rgba(23,18,10,0.62)', fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>
            {snapshot.completionChecks.filter(item => item.done).length} из {snapshot.completionChecks.length} пунктов заполнено
          </div>
        </div>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: `conic-gradient(#17120a ${snapshot.completion * 3.6}deg, rgba(23,18,10,0.14) 0deg)`, display: 'grid', placeItems: 'center', color: '#17120a', fontSize: 12, fontWeight: 930 }}>
          <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.36)', display: 'grid', placeItems: 'center' }}>{snapshot.completion}%</span>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 7, marginTop: 14 }}>
        {snapshot.completionChecks.map(item => (
          <button key={item.id} type="button" onClick={() => onOpenModule(item.module)} style={{ border: 0, borderRadius: 16, padding: '9px 11px', background: item.done ? 'rgba(23,18,10,0.08)' : 'rgba(255,255,255,0.30)', color: '#17120a', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: item.done ? '#17120a' : 'rgba(23,18,10,0.12)', color: item.done ? '#D7B86A' : 'rgba(23,18,10,0.50)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900 }}>{item.done ? '✓' : '•'}</span>
            <span style={{ flex: 1, fontSize: 13, lineHeight: '17px', fontWeight: 790 }}>{item.label}</span>
            {!item.done && <span style={{ fontSize: 12, opacity: firstTodo?.id === item.id ? 1 : 0.45 }}>Открыть</span>}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function LokiCard({ snapshot, onOpenModule }) {
  const tasks = buildCabinetTasks(snapshot);
  const primary = tasks[0];
  const message = primary
    ? `${primary.title}: ${primary.text}`
    : snapshot.metrics.views > 0
      ? `Кабинет выглядит собранно. Сейчас можно смотреть на динамику: ${snapshot.metrics.views} просмотров и ${snapshot.metrics.reviews} отзывов.`
      : 'Кабинет готов к первым данным. Когда появятся просмотры и действия, я подскажу, где есть рост или просадка.';
  return (
    <GlassCard style={{ borderRadius: 30, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <LokiIdentity size={34} state="recommending" showText={false} style={{ placeItems: 'center' }} />
        <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, letterSpacing: 0.8, textTransform: 'uppercase' }}>Локи · кабинет</div>
      </div>
      <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '21px', fontWeight: 760 }}>{message}</div>
      {primary && <GlassButton onClick={() => onOpenModule(primary.module)} style={{ marginTop: 12, width: '100%' }}>Перейти к задаче</GlassButton>}
    </GlassCard>
  );
}

function DashboardModule({ snapshot, onOpenModule }) {
  return (
    <GlassSection title="Dashboard">
      <MetricGrid metrics={snapshot.metrics} />
      <ProfileCompleteness snapshot={snapshot} onOpenModule={onOpenModule} />
      <LokiCard snapshot={snapshot} onOpenModule={onOpenModule} />
    </GlassSection>
  );
}

function TasksModule({ snapshot, onOpenModule }) {
  const tasks = buildCabinetTasks(snapshot);
  return (
    <GlassSection title="Центр задач">
      {!tasks.length ? (
        <EmptyStateV2 icon="✓" title="Задач нет" text="Основные разделы заполнены. Новые рекомендации появятся по мере активности." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {tasks.map(task => (
            <GlassCard key={task.id} onClick={() => onOpenModule(task.module)} style={{ borderRadius: 24, display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12, alignItems: 'center' }}>
              <span style={{ width: 34, height: 34, borderRadius: 14, background: task.priority === 'high' ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.10)', color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{task.priority === 'high' ? '!' : '•'}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: APG2_PROFILE.text, fontSize: 14, fontWeight: 850 }}>{task.title}</span>
                <span style={{ display: 'block', color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 3 }}>{task.text}</span>
              </span>
            </GlassCard>
          ))}
        </div>
      )}
    </GlassSection>
  );
}

function AnalyticsModule({ snapshot }) {
  const channels = [
    ['Звонки', snapshot.metrics.calls],
    ['Telegram', snapshot.metrics.telegram],
    ['WhatsApp', snapshot.metrics.whatsapp],
    ['VK', snapshot.metrics.vk],
    ['Сайт', snapshot.metrics.website],
    ['Карта', snapshot.metrics.map],
    ['QR', snapshot.metrics.publicQRScans + snapshot.metrics.qrOpens],
  ];
  return (
    <GlassSection title="Аналитика">
      <MetricGrid metrics={snapshot.metrics} />
      <GlassCard style={{ borderRadius: 28, marginTop: 12 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 870, marginBottom: 10 }}>Источники и клики</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {channels.map(([label, value]) => {
            const max = Math.max(...channels.map(item => Number(item[1]) || 0), 1);
            return (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: APG2_PROFILE.textSoft, fontSize: 12, marginBottom: 5 }}><span>{label}</span><span>{value}</span></div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.10)', overflow: 'hidden' }}><div style={{ width: `${Math.round((Number(value) || 0) / max * 100)}%`, height: '100%', background: APG2_PROFILE.gold, borderRadius: 999 }} /></div>
              </div>
            );
          })}
        </div>
      </GlassCard>
      <SectionCard title="Графики подготовлены архитектурно" text="Модуль уже отделён от ролей: сюда можно подключить временные ряды, QR-источники и историю без переписывания кабинета." />
    </GlassSection>
  );
}

function MediaModule({ snapshot }) {
  const media = [snapshot.profile?.logoUrl, snapshot.profile?.photo, snapshot.profile?.coverPhoto, ...snapshot.gallery].filter(Boolean);
  return (
    <GlassSection title="Галерея">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        {media.slice(0, 12).map((url, index) => (
          <div key={`${url}-${index}`} style={{ aspectRatio: index === 2 ? '16/10' : '1/1', gridColumn: index === 2 ? 'span 2' : undefined, borderRadius: 18, overflow: 'hidden', background: APG2_PROFILE.goldSoft }}>
            <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>
      {!media.length && <EmptyStateV2 icon="📷" title="Медиа пока нет" text="Поддержаны аватар, обложка, галерея, фото работ, офис, команда и будущие видео." />}
      <SectionCard title="Видео" text={snapshot.videos.length ? `${snapshot.videos.length} ссылок на видео добавлено.` : 'YouTube, VK Видео, Rutube и MAX учитываются как расширение Media Manager.'} />
    </GlassSection>
  );
}

function ContactsModule({ role, profile, onSaved, onToast }) {
  const [fields, setFields] = useState(() => Object.fromEntries(contactFields(profile)));
  const [saving, setSaving] = useState(false);
  useEffect(() => setFields(Object.fromEntries(contactFields(profile))), [profile?.id]);
  const update = (key, value) => setFields(prev => ({ ...prev, [key]: value }));
  const save = async () => {
    if (!role?.updateAction || !profile?.id) return;
    for (const [key, label, value] of contactFields(fields)) {
      if (['whatsappUrl', 'telegramUrl', 'vkUrl', 'maxUrl', 'websiteUrl', 'bookingUrl'].includes(key)) {
        const platform = key === 'telegramUrl' ? 'telegram' : key === 'vkUrl' ? 'vk' : key === 'maxUrl' ? 'max' : '';
        const result = validateExternalUrl(value, platform ? { platform } : {});
        if (!result.ok) {
          onToast?.(`${label}: ${result.error}`, 'error');
          return;
        }
      }
    }
    setSaving(true);
    try {
      const patch = {};
      Object.entries(fields).forEach(([key, value]) => {
        patch[key] = ['whatsappUrl', 'telegramUrl', 'vkUrl', 'maxUrl', 'websiteUrl', 'bookingUrl'].includes(key) ? normalizeExternalUrl(value) : String(value || '').trim();
      });
      if (role.id === 'partner') {
        patch.socialUrl = patch.vkUrl || patch.telegramUrl || patch.websiteUrl || '';
        patch.hours = patch.hours || '';
      }
      await userAction(role.updateAction, { id: profile.id, patch });
      onSaved?.({ ...profile, ...patch });
      onToast?.('Контакты обновлены.', 'success');
    } catch (error) {
      onToast?.(error.message || 'Не удалось сохранить контакты.', 'error');
    }
    setSaving(false);
  };
  return (
    <GlassSection title="Контакты">
      <GlassCard style={{ borderRadius: 30 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          {contactFields(fields).map(([key, label, value]) => (
            <label key={key} style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>{label}</span>
              <GlassInput value={value} onChange={e => update(key, e.target.value)} inputMode={key === 'phone' ? 'tel' : key === 'email' ? 'email' : 'text'} placeholder={label} />
            </label>
          ))}
        </div>
        <GlassButton tone="gold" disabled={saving} onClick={save} style={{ marginTop: 12, width: '100%', color: '#17120a' }}>{saving ? 'Сохраняем...' : 'Сохранить контакты'}</GlassButton>
      </GlassCard>
    </GlassSection>
  );
}

function ContentModule({ snapshot, events, onEventCreated, onToast }) {
  return (
    <GlassSection title="Контент">
      <div style={{ display: 'grid', gap: 10 }}>
        <SectionCard title="Новости" text={snapshot.metrics.news ? `${snapshot.metrics.news} публикаций связано с кабинетом.` : 'Создавайте новости, сохраняйте черновики и отправляйте материалы на модерацию.'} />
        <SectionCard title={snapshot.roleId === 'expert' ? 'Предложение для АПГ' : 'Акции'} text={snapshot.profile?.offer || 'Добавьте скидку, бонус, подарок или спецусловие для пользователей АПГ.'} tone={snapshot.profile?.offer ? 'gold' : 'glass'} />
        <CabinetEventsBlock type={snapshot.roleId === 'expert' ? 'expert' : 'partner'} profile={snapshot.profile} events={events} onEventCreated={onEventCreated} onToast={onToast} />
      </div>
    </GlassSection>
  );
}

function ReviewsModule({ snapshot }) {
  return (
    <GlassSection title="Отзывы">
      {!snapshot.reviews.length ? (
        <EmptyStateV2 icon="⭐" title="Отзывов пока нет" text="Новые, без ответа, отвеченные, лучшие и архив будут жить в одном центре отзывов." />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {snapshot.reviews.map(review => (
            <GlassCard key={review.id} style={{ borderRadius: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 850 }}>{review.userName || review.authorName || 'Участник АПГ'}</div>
                <Stars rating={review.stars ?? review.rating ?? 0} />
              </div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>{review.text || 'Без текста'}</div>
            </GlassCard>
          ))}
        </div>
      )}
    </GlassSection>
  );
}

function NotificationsModule({ snapshot }) {
  const notifications = buildCabinetNotifications(snapshot);
  return (
    <GlassSection title="Уведомления">
      {!notifications.length ? <EmptyStateV2 icon="🔔" title="Пока тихо" text="Отзывы, публикации, модерация, события, напоминания и будущие платежи будут приходить сюда." /> : (
        <div style={{ display: 'grid', gap: 10 }}>{notifications.map(item => <SectionCard key={item.id} title={item.title} text={item.text} tone={item.level === 'warning' ? 'gold' : 'glass'} />)}</div>
      )}
    </GlassSection>
  );
}

function LokiModule({ snapshot, onOpenModule }) {
  return (
    <GlassSection title="Локи">
      <LokiCard snapshot={snapshot} onOpenModule={onOpenModule} />
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {['Что улучшить?', 'Почему меньше просмотров?', 'Какие услуги популярны?', 'Напиши новость', 'Предложи акцию'].map(prompt => <SectionCard key={prompt} title={prompt} text="Сценарий подключён к Cabinet Core и будет получать данные выбранной роли." />)}
      </div>
    </GlassSection>
  );
}

function SubscriptionModule({ role, snapshot }) {
  const label = role?.id === 'expert' ? snapshot.profile?.tariff || snapshot.profile?.tier || 'Практика' : snapshot.profile?.tariff || snapshot.profile?.tier || 'Старт';
  return (
    <GlassSection title="Подписка">
      <SectionCard tone="gold" title={`Текущий тариф: ${label}`} text="Оплата пока не подключена. Интерфейс подготовлен для следующего этапа: счета, история платежей, продление и пакеты услуг." />
    </GlassSection>
  );
}

function SettingsModule({ role, snapshot, onSaved, onToast }) {
  return (
    <GlassSection title="Настройки">
      <AiProfileSection type={role?.id === 'expert' ? 'expert' : 'partner'} entity={snapshot.profile} inputStyle={{ width: '100%', padding: '13px 14px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.24)', background: 'rgba(255,255,255,0.20)', color: APG2_PROFILE.text, fontSize: 14, boxSizing: 'border-box', outline: 'none', marginBottom: 12 }} onSave={async aiProfile => {
        if (!role?.updateAction || !snapshot.profile?.id) return;
        await userAction(role.updateAction, { id: snapshot.profile.id, patch: { aiProfile } });
        onSaved?.({ ...snapshot.profile, aiProfile });
        onToast?.('AI Profile обновлён.', 'success');
      }} onToast={onToast} />
    </GlassSection>
  );
}

function HistoryModule({ snapshot }) {
  const history = buildCabinetHistory(snapshot);
  return (
    <GlassSection title="История действий">
      {!history.length ? <EmptyStateV2 icon="🕘" title="История пока пустая" text="Обновления профиля, действия Локи и будущие операции кабинета будут собираться здесь." /> : (
        <div style={{ display: 'grid', gap: 10 }}>{history.map(item => <SectionCard key={item.id} title={item.title} text={dateText(item.value)} />)}</div>
      )}
    </GlassSection>
  );
}

function RoleSpecificModule({ id, snapshot, onOpenModule }) {
  if (id === 'services') return <GlassSection title="Услуги"><SectionCard title="Какие услуги оказываете" text={snapshot.profile?.services || snapshot.profile?.serviceDescription || 'Блок готов для будущего каталога услуг, пакетов и онлайн-записи.'} /></GlassSection>;
  if (id === 'experience') return <GlassSection title="Опыт"><SectionCard title="Опыт и доверие" text={snapshot.profile?.experience || 'Здесь будет храниться опыт, регалии, кейсы и подтверждения.'} /></GlassSection>;
  if (id === 'booking') return <GlassSection title="Запись"><SectionCard title="Онлайн-запись" text={snapshot.profile?.bookingUrl || 'Архитектура готова для календаря, расписания и записи.'} /></GlassSection>;
  if (id === 'promotions') return <GlassSection title="Акции"><SectionCard title="Акция для пользователей АПГ" text={snapshot.profile?.offer || 'Добавьте предложение, которое будет видно в карточке.'} tone={snapshot.profile?.offer ? 'gold' : 'glass'} /></GlassSection>;
  if (id === 'events') return <GlassSection title="Мероприятия"><SectionCard title="Мероприятия" text={`Связано событий: ${snapshot.relatedEvents.length}`} action={<GlassButton onClick={() => onOpenModule('content')} style={{ marginTop: 10 }}>Открыть контент</GlassButton>} /></GlassSection>;
  if (id === 'products') return <GlassSection title="Каталог товаров"><SectionCard title="Будущий каталог" text="Модуль подключён как роль партнёра, но витрина товаров будет развиваться отдельным каталогом." /></GlassSection>;
  return null;
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
  const date = new Date(item.startAt || 0);
  if (Number.isNaN(date.getTime())) return item.dateLabel || 'Дата не указана';
  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · ${item.time || date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

function BookingModule({ role, profile, onSaved, onToast }) {
  const bookingProfile = useMemo(() => buildBookingProfile(profile, role.id === 'expert' ? 'expert' : 'partner'), [profile, role.id]);
  const [enabled, setEnabled] = useState(bookingProfile.enabled);
  const [slotTimes, setSlotTimes] = useState(() => Array.isArray(profile.bookingSlotTimes) && profile.bookingSlotTimes.length ? profile.bookingSlotTimes.join(', ') : '10:00, 11:30, 13:00, 15:00, 16:30, 18:00');
  const [calendarMode, setCalendarMode] = useState(() => window.innerWidth >= 900 ? 'week' : 'day');
  const [statusFilter, setStatusFilter] = useState('');
  const [specialistFilter, setSpecialistFilter] = useState('');
  const [bookings, setBookings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const loadBookings = async () => {
    if (!profile?.id || loadingBookings) return;
    setLoadingBookings(true);
    try {
      const range = bookingDateRange(calendarMode);
      const result = await userAction('booking:calendar', {
        providerType: role.id === 'expert' ? 'expert' : 'partner',
        providerId: profile.id,
        from: range.from,
        to: range.to,
        specialistId: specialistFilter,
        status: statusFilter,
      });
      setBookings(Array.isArray(result.bookings) ? result.bookings.map(normalizeBooking) : []);
    } catch (error) {
      onToast?.(error?.message || 'Не удалось загрузить календарь', 'error');
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [profile?.id, calendarMode, statusFilter, specialistFilter]);

  const groups = useMemo(() => groupBookingsForProfile(bookings), [bookings]);
  const calendarItems = useMemo(() => buildBookingCalendar({ bookings, ...bookingDateRange(calendarMode), specialistId: specialistFilter, status: statusFilter }), [bookings, calendarMode, specialistFilter, statusFilter]);

  const runLifecycle = async (action, item, payload = {}) => {
    try {
      const result = await userAction(action, { bookingId: item.id || item.bookingId, ...payload });
      if (result?.booking) {
        const next = normalizeBooking(result.booking);
        setBookings(prev => prev.map(row => String(row.id || row.bookingId) === String(next.id || next.bookingId) ? next : row));
      }
      onToast?.('✅ Встреча обновлена', 'success');
    } catch (error) {
      onToast?.(error?.message || 'Не удалось обновить встречу', 'error');
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const patch = {
        bookingEnabled: enabled,
        onlineBookingEnabled: enabled,
        bookingMode: enabled ? 'apg' : 'external',
        bookingSlotTimes: slotTimes.split(',').map(item => item.trim()).filter(Boolean).slice(0, 12),
      };
      await userAction(role.updateAction, { id: profile.id, patch });
      onSaved?.({ ...profile, ...patch });
      onToast?.('✅ Онлайн-запись обновлена', 'success');
    } catch {
      onToast?.('Не удалось сохранить онлайн-запись', 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <GlassSection title="Встречи">
      <div style={{ display: 'grid', gap: 12 }}>
        <GlassCard style={{ borderRadius: 30, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '22px', fontWeight: 900 }}>Встречи через АПГ</div>
              <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13, lineHeight: '19px', marginTop: 4 }}>Кнопка появится в карточке, а заявка создаст контекстный диалог встречи.</div>
            </div>
            <GlassButton tone={enabled ? 'gold' : 'glass'} onClick={() => setEnabled(value => !value)} style={{ minHeight: 40, borderRadius: 18, padding: '8px 12px', color: enabled ? '#17120a' : APG2_PROFILE.text }}>{enabled ? 'Включена' : 'Выключена'}</GlassButton>
          </div>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 780 }}>Свободные интервалы</span>
            <GlassInput value={slotTimes} onChange={e => setSlotTimes(e.target.value)} placeholder="10:00, 11:30, 13:00" style={{ minHeight: 46, borderRadius: 18, fontSize: 14 }} />
          </label>
          <GlassButton tone="gold" onClick={save} disabled={saving} style={{ color: '#17120a', opacity: saving ? 0.62 : 1 }}>{saving ? 'Сохраняем...' : 'Сохранить'}</GlassButton>
        </GlassCard>
        <GlassCard style={{ borderRadius: 30, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '22px', fontWeight: 900 }}>Календарь встреч</div>
              <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>День, неделя или месяц без отдельного экрана.</div>
            </div>
            <GlassButton onClick={loadBookings} disabled={loadingBookings} style={{ minHeight: 38, borderRadius: 17 }}>{loadingBookings ? 'Обновляем...' : 'Обновить'}</GlassButton>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {['day', 'week', 'month'].map(mode => <GlassButton key={mode} tone={calendarMode === mode ? 'gold' : 'glass'} onClick={() => setCalendarMode(mode)} style={{ minHeight: 38, borderRadius: 16, color: calendarMode === mode ? '#17120a' : APG2_PROFILE.text }}>{mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}</GlassButton>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
            <select value={specialistFilter} onChange={e => setSpecialistFilter(e.target.value)} style={{ minHeight: 42, borderRadius: 17, border: APG2_PROFILE.glass.border, background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, padding: '0 10px', fontFamily: 'inherit' }}>
              <option value="">Все специалисты</option>
              {bookingProfile.specialists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minHeight: 42, borderRadius: 17, border: APG2_PROFILE.glass.border, background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, padding: '0 10px', fontFamily: 'inherit' }}>
              <option value="">Все статусы</option>
              <option value={BOOKING_STATUSES.pending}>Ожидают</option>
              <option value={BOOKING_STATUSES.confirmed}>Подтверждены</option>
              <option value={BOOKING_STATUSES.rescheduleRequested}>Перенос</option>
              <option value={BOOKING_STATUSES.cancelledByUser}>Отменены</option>
              <option value={BOOKING_STATUSES.completed}>Завершены</option>
            </select>
          </div>
          {groups.pending.length > 0 && (
            <GlassCard style={{ borderRadius: 22, padding: 12, display: 'grid', gap: 8, border: '1px solid rgba(215,184,106,0.34)' }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8 }}>Ожидают подтверждения</div>
              {groups.pending.slice(0, 4).map(item => (
                <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: APG2_PROFILE.text, fontSize: 13.5, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.userName || 'Клиент'} · {item.serviceTitle}</div>
                    <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, marginTop: 2 }}>{bookingTimeText(item)} · {item.specialistName}</div>
                  </div>
                  <GlassButton tone="gold" onClick={() => runLifecycle('booking:confirm', item)} style={{ minHeight: 34, borderRadius: 15, color: '#17120a', padding: '7px 10px' }}>Подтвердить</GlassButton>
                </div>
              ))}
            </GlassCard>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {calendarItems.length ? calendarItems.slice(0, calendarMode === 'month' ? 18 : 12).map(item => (
              <GlassCard key={item.id} style={{ borderRadius: 22, padding: 12, display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', fontWeight: 870, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookingTimeText(item)} · {item.userName || 'Клиент'}</div>
                    <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 3 }}>{item.serviceTitle || 'Услуга'} · {item.specialistName || 'Специалист'} · {item.durationMinutes || 60} мин</div>
                  </div>
                  <GlassBadge tone={item.status === BOOKING_STATUSES.confirmed || item.status === BOOKING_STATUSES.rescheduled ? 'gold' : 'glass'}>{item.statusLabel}</GlassBadge>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[BOOKING_STATUSES.pending, BOOKING_STATUSES.new].includes(item.status) && <GlassButton tone="gold" onClick={() => runLifecycle('booking:confirm', item)} style={{ minHeight: 34, borderRadius: 15, color: '#17120a', padding: '7px 10px' }}>Подтвердить</GlassButton>}
                  {item.status === BOOKING_STATUSES.rescheduleRequested && <GlassButton tone="gold" onClick={() => runLifecycle('booking:respondReschedule', item, { decision: 'accept' })} style={{ minHeight: 34, borderRadius: 15, color: '#17120a', padding: '7px 10px' }}>Принять перенос</GlassButton>}
                  {item.status === BOOKING_STATUSES.rescheduleRequested && <GlassButton onClick={() => runLifecycle('booking:respondReschedule', item, { decision: 'reject', reason: 'Отклонено партнером' })} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px' }}>Отклонить</GlassButton>}
                  {[BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status) && <GlassButton onClick={() => runLifecycle('booking:complete', item)} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px' }}>Завершить</GlassButton>}
                  {[BOOKING_STATUSES.confirmed, BOOKING_STATUSES.rescheduled].includes(item.status) && <GlassButton onClick={() => runLifecycle('booking:noShow', item, { reason: 'Клиент не пришел' })} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px' }}>Неявка</GlassButton>}
                  {item.isActive && <GlassButton onClick={() => {
                    const reason = prompt('Причина отмены') || '';
                    if (!reason) return;
                    runLifecycle('booking:cancel', item, { reason });
                  }} style={{ minHeight: 34, borderRadius: 15, padding: '7px 10px' }}>Отменить</GlassButton>}
                </div>
              </GlassCard>
            )) : (
              <EmptyStateV2 icon="📅" title="Встреч на период нет" text="Свободные интервалы остаются доступными для пользователей в карточке." />
            )}
          </div>
        </GlassCard>
        <ContentGrid min={120} gap={8}>
          <StatPill label="Услуги" value={bookingProfile.services.length} />
          <StatPill label="Специалисты" value={bookingProfile.specialists.length} />
          <StatPill label="Статус" value={enabled ? 'Активна' : 'Пауза'} />
        </ContentGrid>
        <GlassCard style={{ borderRadius: 28 }}>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 9 }}>Услуги для записи</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {bookingProfile.services.slice(0, 6).map(item => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', color: APG2_PROFILE.text }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13.5, fontWeight: 820 }}>{item.title}</span>
                <span style={{ color: APG2_PROFILE.textMuted, fontSize: 12 }}>{item.durationMinutes} мин{item.price ? ` · ${item.price}` : ''}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </GlassSection>
  );
}

export function CabinetCorePage({ nav = 'cabinet', user, partner, expert, preferredRole = 'partner', events = [], onBack, onProfileUpdate, onEventCreated, onToast, onOpenDialogs }) {
  const roleState = useMemo(() => getCabinetRoles({ user, partner, expert, preferredRole }), [user, partner, expert, preferredRole]);
  const [activeRoleId, setActiveRoleId] = useState(roleState.activeRole?.id || preferredRole);
  const activeRole = roleState.roles.find(role => role.id === activeRoleId) || roleState.activeRole;
  const [profile, setProfile] = useState(activeRole?.profile || null);
  const [reviews, setReviews] = useState([]);
  const [activeModule, setActiveModule] = useState('showcase-builder');
  const [loading, setLoading] = useState(false);
  const moduleIds = useMemo(() => {
    const allowed = new Set(['showcase-builder', 'dashboard', 'dialogs', 'tasks', 'analytics', 'media', 'contacts', 'content', 'reviews', 'notifications', 'loki', 'subscription', 'settings', 'history']);
    const ordered = ['showcase-builder', 'dashboard', 'dialogs', 'tasks', ...getRoleModuleIds(roleState.roles)];
    return [...new Set(ordered)].filter(id => allowed.has(id) || (activeRole?.modules || []).includes(id));
  }, [roleState.roles, activeRole?.id]);

  useEffect(() => {
    setActiveRoleId(roleState.activeRole?.id || preferredRole);
  }, [roleState.activeRole?.id, preferredRole]);

  useEffect(() => {
    if (!activeRole?.profile?.id || !activeRole.collection) {
      setProfile(activeRole?.profile || null);
      setReviews([]);
      return;
    }
    let alive = true;
    setLoading(true);
    const ref = doc(db, activeRole.collection, activeRole.profile.id);
    const reviewsQuery = activeRole.id === 'expert'
      ? query(collection(db, 'expertReviews'), where('expertId', '==', activeRole.profile.id), orderBy('createdAt', 'desc'), limit(20))
      : query(collection(db, 'partners', activeRole.profile.id, 'reviews'), orderBy('createdAt', 'desc'), limit(20));
    Promise.all([getDoc(ref), getDocs(reviewsQuery).catch(() => ({ docs: [] }))])
      .then(([snap, reviewSnap]) => {
        if (!alive) return;
        const nextProfile = snap.exists() ? { id: snap.id, ...snap.data() } : activeRole.profile;
        setProfile(nextProfile);
        setReviews(reviewSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      })
      .catch(() => {
        if (alive) {
          setProfile(activeRole.profile);
          setReviews([]);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [activeRole?.id, activeRole?.profile?.id]);

  const currentProfile = activeRole?.profile?.id && profile?.id !== activeRole.profile.id ? activeRole.profile : profile;

  if (!activeRole || !currentProfile) {
    return (
      <Panel id={nav}>
        <GlassPanel>
          <ScreenHeader title="Личный кабинет" subtitle="Профиль не найден" onBack={onBack} />
          <EmptyStateV2 icon="!" title="Кабинет недоступен" text="Для открытия кабинета нужен привязанный партнёр или эксперт." />
        </GlassPanel>
      </Panel>
    );
  }

  const snapshot = buildCabinetSnapshot({ role: activeRole, profile: currentProfile, events, reviews });
  const publicUrl = getCabinetPublicUrl(snapshot);
  const handleSaved = (updated) => {
    setProfile(updated);
    onProfileUpdate?.(activeRole.id, updated);
  };
  const renderModule = () => {
    if (activeModule === 'dashboard') return <DashboardModule snapshot={snapshot} onOpenModule={setActiveModule} />;
    if (activeModule === 'showcase-builder') return <DigitalShowcaseBuilder role={activeRole} profile={currentProfile} relatedEvents={snapshot.relatedEvents} onSaved={handleSaved} onOpenModule={setActiveModule} onEventCreated={onEventCreated} onToast={onToast} publicUrl={publicUrl} />;
    if (activeModule === 'tasks') return <TasksModule snapshot={snapshot} onOpenModule={setActiveModule} />;
    if (activeModule === 'analytics') return <AnalyticsModule snapshot={snapshot} />;
    if (activeModule === 'media') return <MediaModule snapshot={snapshot} />;
    if (activeModule === 'contacts') return <ContactsModule role={activeRole} profile={currentProfile} onSaved={handleSaved} onToast={onToast} />;
    if (activeModule === 'content') return <ContentModule snapshot={snapshot} events={events} onEventCreated={onEventCreated} onToast={onToast} />;
    if (activeModule === 'reviews') return <ReviewsModule snapshot={snapshot} />;
    if (activeModule === 'dialogs') return <GlassSection title="Контекстные диалоги"><SectionCard title="Вопросы по объектам" text="Здесь собираются обращения по партнёру, акциям, мероприятиям и экспертному профилю. Каждый диалог привязан к конкретной карточке." action={<GlassButton onClick={onOpenDialogs} style={{ marginTop: 10 }}>Открыть диалоги</GlassButton>} /></GlassSection>;
    if (activeModule === 'booking' && ['partner', 'expert'].includes(activeRole.id)) return <BookingModule role={activeRole} profile={currentProfile} onSaved={handleSaved} onToast={onToast} />;
    if (activeModule === 'notifications') return <NotificationsModule snapshot={snapshot} />;
    if (activeModule === 'loki') return <LokiModule snapshot={snapshot} onOpenModule={setActiveModule} />;
    if (activeModule === 'subscription') return <SubscriptionModule role={activeRole} snapshot={snapshot} />;
    if (activeModule === 'settings') return <SettingsModule role={activeRole} snapshot={snapshot} onSaved={handleSaved} onToast={onToast} />;
    if (activeModule === 'history') return <HistoryModule snapshot={snapshot} />;
    if (activeModule === 'qr') return <GlassSection title="QR"><GlassCard style={{ borderRadius: 32 }}>{activeRole.id === 'expert' ? <ExpertQRSection expert={currentProfile} /> : <PartnerQRSection partner={currentProfile} />}</GlassCard></GlassSection>;
    return <RoleSpecificModule id={activeModule} snapshot={snapshot} onOpenModule={setActiveModule} />;
  };

  return (
    <Panel id={nav}>
      <GlassPanel>
        <ScreenHeader title="Личный кабинет 2.0" subtitle={currentProfile.name} kicker={activeRole.label} onBack={onBack} />
        {roleState.hasMultipleRoles && (
          <GlassCard style={{ borderRadius: 28, padding: 6, display: 'grid', gridTemplateColumns: `repeat(${roleState.roles.length}, minmax(0,1fr))`, gap: 6, marginBottom: 12 }}>
            {roleState.roles.map(role => <GlassButton key={role.id} tone={role.id === activeRole.id ? 'gold' : 'glass'} onClick={() => { setActiveRoleId(role.id); setActiveModule('showcase-builder'); }} style={{ color: role.id === activeRole.id ? '#17120a' : APG2_PROFILE.text }}>{role.label}</GlassButton>)}
          </GlassCard>
        )}
        <ProfileHero
          image={currentProfile.coverPhoto || currentProfile.photo || currentProfile.logoUrl}
          title={currentProfile.name}
          subtitle={currentProfile.specialization || currentProfile.categoryLabel || currentProfile.address || activeRole.label}
          status={loading ? 'Обновляем данные' : `${snapshot.completion}% заполнено`}
          description={currentProfile.offer || currentProfile.description}
          avatar={<GlassBadge tone="gold">{activeRole.id === 'expert' ? 'Эксперт' : 'АПГ'}</GlassBadge>}
          badges={[activeRole.label, snapshot.metrics.rating ? `★ ${snapshot.metrics.rating.toFixed(1)}` : null, `${snapshot.metrics.views} просмотров`].filter(Boolean)}
        />
        <ContentGrid min={72} gap={7} style={{ marginTop: 12 }}>
          {[
            ['showcase-builder', 'Витрина', '◇'],
            ['dashboard', 'Дашборд', '▦'],
            ['dialogs', 'Диалоги', '💬'],
            ['booking', 'Запись', '📅'],
            ['tasks', 'Задачи', '✓'],
            ['contacts', 'Контакты', '☎'],
            ['media', 'Медиа', '▣'],
            ['content', 'Контент', '✎'],
            ['analytics', 'Аналитика', '↗'],
            ['qr', 'QR', '▤'],
            ['loki', 'Локи', '✦'],
          ].map(([id, label, icon]) => (
            <button key={id} type="button" onClick={() => setActiveModule(id)} style={{ ...APG2_PROFILE.glass, borderRadius: 22, minHeight: 58, display: 'grid', placeItems: 'center', gap: 4, padding: '8px 4px', color: APG2_PROFILE.text, fontFamily: 'inherit', cursor: 'pointer', border: activeModule === id ? '1px solid rgba(215,184,106,0.58)' : APG2_PROFILE.glass.border }}>
              <span style={{ fontSize: 18, lineHeight: 1, color: activeModule === id ? APG2_PROFILE.gold : APG2_PROFILE.textSoft }}>{icon}</span>
              <span style={{ fontSize: 10, lineHeight: '12px', fontWeight: 760, color: APG2_PROFILE.textSoft }}>{label}</span>
            </button>
          ))}
        </ContentGrid>
        <GlassCard style={{ borderRadius: 28, padding: 6, display: 'flex', gap: 6, overflowX: 'auto', marginTop: 12 }}>
          {moduleIds.map(id => <GlassButton key={id} tone={activeModule === id ? 'gold' : 'glass'} onClick={() => setActiveModule(id)} style={{ minHeight: 38, borderRadius: 18, padding: '8px 11px', whiteSpace: 'nowrap', color: activeModule === id ? '#17120a' : APG2_PROFILE.text }}>{MODULE_LABELS[id] || id}</GlassButton>)}
        </GlassCard>
        <GlassCard style={{ borderRadius: 26, marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <GlassButton onClick={() => publicUrl && window.open(publicUrl, '_blank')}>Открыть карточку</GlassButton>
          <GlassButton tone="gold" onClick={() => window.open(shareLink(activeRole.id === 'expert' ? 'expert' : 'partner', currentProfile.id), '_blank')} style={{ color: '#17120a' }}>Поделиться</GlassButton>
        </GlassCard>
        {renderModule()}
      </GlassPanel>
    </Panel>
  );
}
