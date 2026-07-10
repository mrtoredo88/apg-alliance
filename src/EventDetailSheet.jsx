import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motionTransition } from './motion.js';
import { APG2_PROFILE } from './components/Apg2ProfileGlass.jsx';
import { shareLink } from './utils/shareLink.js';

const A = {
  text: APG2_PROFILE.text,
  textSec: APG2_PROFILE.textSoft,
  textMuted: APG2_PROFILE.textMuted,
  gold: APG2_PROFILE.gold,
  goldBrd: 'rgba(215,184,106,0.36)',
  border: 'var(--apg2-glass-border, rgba(255,255,255,0.24))',
};

const BUTTON = {
  padding: '10px 16px',
  borderRadius: 12,
  border: 'none',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const SECTION = {
  ...APG2_PROFILE.glass,
  borderRadius: 26,
  padding: 16,
  color: APG2_PROFILE.text,
};

const SECTION_TITLE = {
  margin: '0 0 12px',
  color: A.text,
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: 0.2,
};

const MINI_INPUT = {
  width: '100%',
  borderRadius: 10,
  border: `1px solid ${A.border}`,
  background: 'rgba(255,255,255,0.06)',
  color: A.text,
  padding: '9px 10px',
  outline: 'none',
  boxSizing: 'border-box',
};

const EVENT_MODE_META = {
  online: { label: 'Онлайн', emoji: '💻', color: 'rgba(74,144,217,0.2)', border: 'rgba(74,144,217,0.45)' },
  offline: { label: 'Офлайн', emoji: '📍', color: 'rgba(75,179,75,0.18)', border: 'rgba(75,179,75,0.45)' },
  hybrid: { label: 'Гибрид', emoji: '🌐', color: 'rgba(201,168,76,0.18)', border: 'rgba(201,168,76,0.45)' },
};

const MODERATION_STATUS_META = {
  draft: { label: 'Черновик', tone: '#9CA3AF' },
  pending_review: { label: 'На модерации', tone: '#C9A84C' },
  approved: { label: 'Опубликовано', tone: '#4BB34B' },
  published: { label: 'Опубликовано', tone: '#4BB34B' },
  revision_requested: { label: 'На доработке', tone: '#f59e0b' },
  rejected: { label: 'Отклонено', tone: '#E64646' },
  completed: { label: 'Завершено', tone: '#9CA3AF' },
};

function toDateValue(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = toDateValue(value);
  if (!d) return '';
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value) {
  const d = toDateValue(value);
  if (!d) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function parseDurationMinutes(startAt, endAt, fallback) {
  const from = toDateValue(startAt);
  const to = toDateValue(endAt);
  if (!from || !to || to <= from) return fallback || 'не указана';
  const mins = Math.max(0, Math.round((to - from) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h && !m) return 'менее минуты';
  return `${h ? `${h} ч ` : ''}${m ? `${m} мин` : ''}`.trim();
}

function eventImage(event) {
  return event?.coverPhoto || event?.coverUrl || event?.cover || event?.imageUrl || event?.thumbnail || event?.banner || event?.image || event?.photo || event?.photos?.[0] || event?.images?.[0] || '';
}

function eventGallery(event) {
  const items = event?.gallery || event?.photos || event?.images || event?.media;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (typeof item?.url === 'string') return item.url.trim();
      if (typeof item?.src === 'string') return item.src.trim();
      return '';
    })
    .filter(Boolean);
}

function userDisplayName(user) {
  return [user?.firstName ?? user?.first_name, user?.lastName ?? user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
    || user?.displayName
    || user?.name
    || user?.email
    || `#${String(user?.id ?? '').slice(0, 6)}`;
}

function safeText(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

function normalizeMode(event) {
  if (!event) return 'offline';
  const mode = String(event.locationMode || event.mode || event.platform || event.format || '').toLowerCase();
  if (mode.includes('online') || mode.includes('onlineOnly') || mode === 'hybrid') {
    if (mode === 'hybrid') return 'hybrid';
    return event.location ? 'hybrid' : 'online';
  }
  if (mode.includes('offline')) return 'offline';
  if (event.isOnline || event.online) return 'online';
  if (event.isOffline || event.offline) return 'offline';
  if (event.formats?.includes?.('online') && event.formats?.includes?.('offline')) return 'hybrid';
  if (event.formats?.includes?.('online')) return 'online';
  if (event.formats?.includes?.('offline')) return 'offline';
  if (event.isHybrid || event.hybrid) return 'hybrid';
  return 'offline';
}

function resolveStatus(event) {
  if (!event) return 'Событие';
  const rawStatus = String(event.submissionStatus || event.moderationStatus || event.status || '').toLowerCase();
  if (MODERATION_STATUS_META[rawStatus]) return MODERATION_STATUS_META[rawStatus].label;
  const now = Date.now();
  const start = toDateValue(event.startAt || event.eventDate || event.date);
  const end = toDateValue(event.endAt);
  const deadline = toDateValue(event.deadline);
  if (end && end.getTime() <= now) return 'Завершено';
  if (deadline && deadline.getTime() <= now) return 'Регистрация закрыта';
  if (start && start.getTime() > now) return 'Запланировано';
  if (start && (!end || end.getTime() > now)) return 'Идёт';
  if (event.maxParticipants > 0 && event.registeredCount >= event.maxParticipants) return 'Лимит заполнен';
  return 'Открыта запись';
}

function moderationKey(event) {
  return String(event?.submissionStatus || event?.moderationStatus || event?.status || '').toLowerCase();
}

function eventStartDate(event) {
  return toDateValue(event?.startAt || event?.eventDate || event?.date);
}

function hasEventLink(event) {
  return Boolean(String(event?.linkUrl || event?.socialUrl || '').trim());
}

function getFieldNameById(list, id) {
  const item = (list || []).find((el) => el.id === id);
  return item?.name || '';
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value != null && typeof value !== 'object' && String(value).trim()) return String(value).trim();
  }
  return '';
}

function locationText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return firstText(value.address, value.title, value.name, value.text, value.label);
}

function countValue(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value.length;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}

function normalizeDetailEvent(event, partners, experts) {
  if (!event) return null;
  const partnerName = firstText(
    event.partner,
    event.partnerName,
    event.organizer,
    event.organizerName,
    event.hostName,
    getFieldNameById(partners, event.partnerId),
  );
  const expertName = firstText(
    event.expert,
    event.expertName,
    event.speaker,
    event.speakerName,
    event.mentorName,
    getFieldNameById(experts, event.expertId),
  );
  const description = firstText(event.description, event.fullDescription, event.details, event.body, event.content, event.text, event.about, event.comment);
  const address = firstText(event.address, event.locationAddress, event.place, event.placeName, event.venue, event.venueName, locationText(event.location));
  const startAt = event.startAt || event.eventDate || event.date || event.schedule?.startAt || event.schedule?.date || event.datetime || event.startsAt;
  const endAt = event.endAt || event.schedule?.endAt || event.endsAt;
  const maxParticipants = countValue(event.maxParticipants, event.capacity, event.seats, event.seatsTotal, event.limit, event.registrationLimit);
  const registeredCount = countValue(event.registeredCount, event.registrationsCount, event.participantsCount, event.attendeesCount, event.registrations, event.participants, event.attendees);
  return {
    ...event,
    title: firstText(event.title, event.name, event.eventTitle, 'Событие АПГ'),
    emoji: firstText(event.emoji, event.icon, '🎉'),
    description,
    partner: partnerName,
    expert: expertName,
    address,
    location: typeof event.location === 'string' ? event.location : address,
    startAt,
    endAt,
    date: startAt || event.date,
    deadline: event.deadline || event.registrationDeadline || event.registrationEndsAt,
    maxParticipants,
    registeredCount,
    price: firstText(event.price, event.priceClub, event.pricePublic, event.cost),
    category: firstText(event.category, event.categoryName, event.type),
    linkUrl: firstText(event.linkUrl, event.socialUrl, event.url, event.website, event.registrationUrl),
    linkLabel: firstText(event.linkLabel, event.buttonLabel, event.ctaLabel, 'Перейти по ссылке'),
  };
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toDateOrLabel(value) {
  const d = toDateValue(value);
  if (!d) return '';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function HeroSection({ event, status, statusTone }) {
  const image = eventImage(event);
  return (
    <section style={{ ...APG2_PROFILE.glass, borderRadius: 32, padding: 0, overflow: 'hidden', color: APG2_PROFILE.text }}>
      <div style={{ position: 'relative', minHeight: 250, background: APG2_PROFILE.goldSoft, overflow: 'hidden' }}>
        {image ? (
          <img src={image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'saturate(1.04) contrast(1.02)' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: A.text, background: 'radial-gradient(circle at 34% 18%,rgba(215,184,106,0.32),transparent 36%), linear-gradient(145deg,rgba(var(--apg2-glass-a,255,255,255),0.22),rgba(var(--apg2-glass-a,255,255,255),0.06))' }}>
            {event?.emoji || '🎉'}
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(8,8,10,0.04),rgba(8,8,10,0.12) 38%,rgba(8,8,10,0.78))' }} />
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ width: 48, height: 48, borderRadius: 18, background: APG2_PROFILE.goldGlass.background, border: APG2_PROFILE.goldGlass.border, color: '#17120a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 16px 34px rgba(0,0,0,0.24)' }}>{event?.emoji || '🎉'}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 999, background: statusTone + '22', border: `1px solid ${statusTone}55`, color: statusTone, fontSize: 12, fontWeight: 880, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 10px 28px rgba(0,0,0,0.24)' }}>
              {status}
            </span>
          </div>
          <div style={{ color: '#fff', fontSize: 24, lineHeight: '29px', fontWeight: 930, letterSpacing: -0.45, textShadow: '0 2px 18px rgba(0,0,0,0.46)' }}>
            {event?.title || 'Мероприятие без названия'}
          </div>
        </div>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 20, padding: 12 }}>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Формат</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 850 }}>{normalizeMode(event) === 'online' ? 'Онлайн' : normalizeMode(event) === 'hybrid' ? 'Гибрид' : 'Офлайн'}</div>
        </div>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 20, padding: 12 }}>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Запись</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 850 }}>{Number(event?.maxParticipants || 0) > 0 ? `${Math.max(Number(event.maxParticipants || 0) - Number(event.registeredCount || 0), 0)} мест` : 'Открыта'}</div>
        </div>
      </div>
    </section>
  );
}

function DateSection({ event, status }) {
  const startAt = toDateValue(event.startAt || event.eventDate || event.date);
  const endAt = toDateValue(event.endAt);
  const deadline = toDateValue(event.deadline);
  const startDateText = startAt ? formatDate(startAt) : (event.date || event.eventDate || '—');
  const startTimeText = startAt ? formatTime(startAt) : '';
  const endTimeText = endAt ? formatTime(endAt) : '';
  const durationText = parseDurationMinutes(event.startAt || event.eventDate || event.date, event.endAt, event.duration);
  const deadlineText = deadline ? deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Дата и время</h3>
      <div style={{ display: 'grid', gap: 11 }}>
        <Row label="Дата" value={startDateText} />
        <Row label="Время" value={startTimeText ? `${startTimeText}${endTimeText ? ` — ${endTimeText}` : ''}` : 'не указано'} />
        <Row label="Длительность" value={durationText} />
        <Row label="Дедлайн регистрации" value={deadlineText || 'не указан'} />
      </div>
    </section>
  );
}

function LocationSection({ event, partnerName, expertName }) {
  const modeKey = normalizeMode(event);
  const mode = EVENT_MODE_META[modeKey] || EVENT_MODE_META.offline;
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Партнёр и локация</h3>
      <div style={{ display: 'grid', gap: 11 }}>
        <Row label="Партнёр" value={partnerName || 'не указан'} />
        <Row label="Эксперт" value={expertName || 'не указан'} />
        <Row label="Адрес" value={event?.address || event?.location || 'не указан'} />
        <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, background: mode.color, border: `1px solid ${mode.border}`, color: A.text }}>
          <span>{mode.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{mode.label}</span>
        </div>
      </div>
    </section>
  );
}

function DescriptionSection({ event }) {
  const gallery = eventGallery(event);
  const linkUrl = event?.linkUrl || event?.socialUrl || '';
  const linkLabel = event?.linkLabel || 'Перейти по ссылке';
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Описание</h3>
      <div style={{ color: A.textSec, fontSize: 14.5, lineHeight: '22px', whiteSpace: 'pre-wrap', marginBottom: event.description ? 14 : 0 }}>
        {event.description || 'Описание пока не заполнено.'}
      </div>

      {gallery.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: A.text, fontWeight: 700, marginBottom: 8 }}>Галерея</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {gallery.map((src, idx) => (
              <img
                key={`${src}-${idx}`}
                src={src}
                alt=""
                loading="lazy"
                style={{ width: 140, height: 100, borderRadius: 12, objectFit: 'cover', border: `1px solid ${A.border}`, flexShrink: 0 }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ))}
          </div>
        </div>
      )}

      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-block',
            textDecoration: 'none',
            color: '#1A1208',
            background: 'linear-gradient(135deg, #C9A84C, #E8C76D)',
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {linkLabel || 'Открыть ссылку'}
        </a>
      )}
    </section>
  );
}

function RegistrationSection({ event }) {
  const capacity = Number(event?.maxParticipants ?? 0);
  const registered = Number(event?.registeredCount ?? 0);
  const remaining = capacity > 0 ? Math.max(capacity - registered, 0) : 0;
  const progress = capacity > 0 ? Math.min(Math.max((registered / capacity) * 100, 0), 100) : null;
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Регистрация</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <Row label="Количество мест" value={capacity > 0 ? String(capacity) : 'не ограничено'} />
        <Row label="Зарегистрировано" value={String(registered)} />
        <Row label="Осталось" value={capacity > 0 ? String(remaining) : 'неограниченно'} />
        {progress !== null && (
          <div>
            <div style={{ marginBottom: 6, color: A.textSec, fontSize: 12, fontWeight: 700 }}>
              Прогресс регистрации
            </div>
            <div style={{ height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <div style={{ width: `${progress.toFixed(1)}%`, height: '100%', background: A.gold, borderRadius: 8 }} />
            </div>
            <div style={{ marginTop: 5, fontSize: 11, color: A.textSec }}>{progress.toFixed(0)}%</div>
          </div>
        )}
      </div>
    </section>
  );
}

function createIcs(event) {
  const start = eventStartDate(event) || new Date();
  const end = toDateValue(event?.endAt) || new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const esc = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//APG//Events//RU',
    'BEGIN:VEVENT',
    `UID:${event?.id || Date.now()}@myapg.ru`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(event?.title || 'Событие АПГ')}`,
    `DESCRIPTION:${esc(event?.description || '')}`,
    `LOCATION:${esc(event?.address || event?.location || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs(event) {
  const blob = new Blob([createIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `apg_event_${event?.id || 'calendar'}.ics`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 120);
}

function UserActionsSection({ event, isRegistered, onRegister, onClose }) {
  const [reminder, setReminder] = useState(() => {
    try { return localStorage.getItem(`apg_event_reminder_${event?.id}`) || ''; } catch { return ''; }
  });
  const capacity = Number(event?.maxParticipants ?? 0);
  const registered = Number(event?.registeredCount ?? 0);
  const seatsLeft = capacity > 0 ? Math.max(0, capacity - registered) : null;
  const canRoute = Boolean(event?.address || event?.location);
  const share = async () => {
    const text = `${event?.title || 'Событие АПГ'}${event?.date ? ` · ${event.date}` : ''}`;
    const url = shareLink('event', event?.id || '');
    if (navigator?.share) {
      await navigator.share({ title: event?.title || 'Событие АПГ', text, url }).catch(() => {});
      return;
    }
    await navigator?.clipboard?.writeText(`${text}\n${url}`).catch(() => {});
  };
  const saveReminder = (value) => {
    setReminder(value);
    try { localStorage.setItem(`apg_event_reminder_${event?.id}`, value); } catch {}
  };
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Действия</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <button onClick={() => onRegister?.(event)} style={{ ...BUTTON, width: '100%', background: isRegistered ? 'rgba(75,179,75,0.16)' : A.gold, color: isRegistered ? '#4BB34B' : '#1A1208', border: isRegistered ? '1px solid rgba(75,179,75,0.36)' : 'none' }}>
          {isRegistered ? 'Вы записаны · отменить' : 'Зарегистрироваться'}
        </button>
        {seatsLeft !== null && <div style={{ color: A.textSec, fontSize: 12, textAlign: 'center' }}>Свободно мест: {seatsLeft}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => downloadIcs(event)} style={{ ...BUTTON, background: 'rgba(255,255,255,0.08)', color: A.text, border: `1px solid ${A.border}` }}>В календарь</button>
          <button onClick={share} style={{ ...BUTTON, background: 'rgba(255,255,255,0.08)', color: A.text, border: `1px solid ${A.border}` }}>Поделиться</button>
          <button disabled={!canRoute} onClick={() => window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(event?.address || event?.location || '')}`, '_blank')} style={{ ...BUTTON, background: 'rgba(255,255,255,0.08)', color: canRoute ? A.text : A.textSec, border: `1px solid ${A.border}`, cursor: canRoute ? 'pointer' : 'not-allowed' }}>Маршрут</button>
          <button onClick={onClose} style={{ ...BUTTON, background: 'rgba(255,255,255,0.08)', color: A.text, border: `1px solid ${A.border}` }}>Закрыть</button>
        </div>
        <div>
          <div style={{ color: A.textSec, fontSize: 12, fontWeight: 800, marginBottom: 7 }}>Напомнить</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['1d', 'за сутки'], ['2h', 'за 2 часа'], ['30m', 'за 30 минут']].map(([value, label]) => (
              <button key={value} onClick={() => saveReminder(reminder === value ? '' : value)} style={{ padding: '7px 10px', borderRadius: 999, border: `1px solid ${reminder === value ? A.goldBrd : A.border}`, background: reminder === value ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.05)', color: reminder === value ? A.gold : A.textSec, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{label}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildPreparationItems(event, partnerName, expertName) {
  const description = String(event?.description || '').trim();
  const gallery = eventGallery(event);
  const hasDate = Boolean(eventStartDate(event));
  return [
    { key: 'card', label: 'Карточка заполнена', required: true, done: Boolean(event?.title && description && hasDate) },
    { key: 'cover', label: 'Есть обложка', required: true, done: Boolean(eventImage(event)) },
    { key: 'gallery', label: 'Есть галерея', done: gallery.length > 0 },
    { key: 'description', label: 'Есть описание', required: true, done: description.length >= 80 },
    { key: 'address', label: 'Есть адрес', required: true, done: Boolean(event?.address || event?.location || normalizeMode(event) === 'online') },
    { key: 'link', label: 'Есть кнопка', done: hasEventLink(event) },
    { key: 'partner', label: 'Есть партнёр', required: true, done: Boolean(partnerName || event?.partnerId) },
    { key: 'category', label: 'Есть категория', required: true, done: Boolean(event?.category) },
    { key: 'expert', label: 'Назначен эксперт', done: Boolean(expertName || event?.expertId || !event?.isExpertEvent) },
    { key: 'news', label: 'Запланирована новость', done: Boolean(event?.promotionPlan?.news || event?.newsPlanned) },
    { key: 'push', label: 'Запланирован Push', done: Boolean(event?.promotionPlan?.push || event?.pushPlanned) },
    { key: 'vk', label: 'Подготовлен пост VK', done: Boolean(event?.promotionPlan?.vk) },
    { key: 'telegram', label: 'Подготовлен Telegram', done: Boolean(event?.promotionPlan?.telegram) },
    { key: 'banner', label: 'Добавлен баннер', done: Boolean(event?.promotionPlan?.banner || event?.bannerId) },
    { key: 'registration', label: 'Проверена регистрация', required: true, done: Boolean(event?.registrationChecked || event?.opsChecklist?.registrationChecked) },
  ];
}

function qualityIssues(event, partnerName) {
  const issues = [];
  const description = String(event?.description || '').trim();
  if (!eventImage(event)) issues.push({ level: 'error', label: 'Нет фотографии' });
  if (description.length < 80) issues.push({ level: description ? 'warning' : 'error', label: description ? 'Короткое описание' : 'Нет описания' });
  if (!event?.address && !event?.location && normalizeMode(event) !== 'online') issues.push({ level: 'error', label: 'Нет адреса' });
  if (!event?.category) issues.push({ level: 'error', label: 'Нет категории' });
  if (!eventStartDate(event)) issues.push({ level: 'error', label: 'Нет времени' });
  if (!partnerName && !event?.partnerId) issues.push({ level: 'warning', label: 'Не указан партнёр' });
  return issues;
}

function readinessPercent(items) {
  if (!items.length) return 0;
  return Math.round((items.filter(item => item.done).length / items.length) * 100);
}

function PreparationSection({ event, partnerName, expertName }) {
  const items = buildPreparationItems(event, partnerName, expertName);
  const percent = readinessPercent(items);
  return (
    <section style={SECTION}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ ...SECTION_TITLE, marginBottom: 3 }}>Подготовка мероприятия</h3>
          <div style={{ color: A.textSec, fontSize: 12 }}>Готовность события</div>
        </div>
        <div style={{ color: percent >= 80 ? A.gold : '#f59e0b', fontSize: 28, fontWeight: 900 }}>{percent}%</div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ width: `${percent}%`, height: '100%', background: percent >= 80 ? A.gold : '#f59e0b', borderRadius: 99 }} />
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {items.map(item => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 12, background: item.done ? 'rgba(75,179,75,0.10)' : item.required ? 'rgba(230,70,70,0.10)' : 'rgba(255,255,255,0.04)', border: `1px solid ${item.done ? 'rgba(75,179,75,0.25)' : item.required ? 'rgba(230,70,70,0.25)' : A.border}` }}>
            <span style={{ width: 20, height: 20, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.done ? '#4BB34B' : 'rgba(255,255,255,0.08)', color: item.done ? '#061407' : A.textSec, fontSize: 12, fontWeight: 900 }}>{item.done ? '✓' : ''}</span>
            <span style={{ flex: 1, color: item.done ? A.text : item.required ? '#E64646' : A.textSec, fontSize: 13, fontWeight: 700 }}>{item.label}</span>
            {item.required && !item.done && <span style={{ color: '#E64646', fontSize: 10, fontWeight: 800 }}>важно</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function QualitySection({ event, partnerName, expertName }) {
  const items = buildPreparationItems(event, partnerName, expertName);
  const issues = qualityIssues(event, partnerName);
  const percent = readinessPercent(items);
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Готовность публикации</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 78, height: 78, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${percent >= 80 ? A.gold : '#f59e0b'} ${percent}%, rgba(255,255,255,0.12) 0)`, color: A.text, fontSize: 22, fontWeight: 900 }}>
          <span style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgba(10,10,18,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{percent}%</span>
        </div>
        <div>
          {issues.length === 0 ? (
            <div style={{ color: '#4BB34B', fontSize: 14, fontWeight: 800 }}>Критичных замечаний нет</div>
          ) : (
            <>
              <div style={{ color: A.text, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Не хватает:</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {issues.map(issue => (
                  <span key={issue.label} style={{ padding: '5px 8px', borderRadius: 999, color: issue.level === 'error' ? '#E64646' : '#f59e0b', background: issue.level === 'error' ? 'rgba(230,70,70,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${issue.level === 'error' ? 'rgba(230,70,70,0.28)' : 'rgba(245,158,11,0.28)'}`, fontSize: 11, fontWeight: 800 }}>
                    {issue.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function PromotionPlanSection({ event, canManage, onPatch }) {
  const options = [
    ['news', 'Создать новость'],
    ['push', 'Отправить Push'],
    ['vk', 'Создать публикацию VK'],
    ['telegram', 'Создать Telegram-пост'],
    ['poster', 'Создать афишу'],
    ['stories', 'Создать Stories'],
    ['banner', 'Добавить баннер'],
  ];
  const plan = event?.promotionPlan || {};
  const toggle = (key) => {
    if (!canManage) return;
    onPatch?.(event, { promotionPlan: { ...plan, [key]: !plan[key] } });
  };
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>План продвижения</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {options.map(([key, label]) => (
          <button key={key} type="button" onClick={() => toggle(key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 12, border: `1px solid ${plan[key] ? A.goldBrd : A.border}`, background: plan[key] ? 'rgba(201,168,76,0.13)' : 'rgba(255,255,255,0.04)', color: plan[key] ? A.gold : A.text, textAlign: 'left', cursor: canManage ? 'pointer' : 'default', fontWeight: 750 }}>
            <span style={{ width: 20, height: 20, borderRadius: 7, background: plan[key] ? A.gold : 'rgba(255,255,255,0.08)', color: '#1A1208', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>{plan[key] ? '✓' : ''}</span>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ConflictSection({ event, allEvents }) {
  const start = eventStartDate(event);
  if (!start) return null;
  const sameDay = (allEvents || []).filter(item => {
    if (!item?.id || item.id === event.id) return false;
    const d = eventStartDate(item);
    return d && d.toDateString() === start.toDateString();
  });
  const partnerConflicts = sameDay.filter(item => event.partnerId && item.partnerId === event.partnerId);
  const timeConflicts = sameDay.filter(item => {
    const d = eventStartDate(item);
    return d && Math.abs(d.getTime() - start.getTime()) < 2 * 60 * 60 * 1000;
  });
  const bigEvents = sameDay.filter(item => Number(item.priority || 0) >= 8 || item.isMajorEvent);
  const warnings = [
    ...partnerConflicts.map(item => `У этого же партнёра уже есть событие: ${item.title || 'без названия'}`),
    ...timeConflicts.map(item => `Пересечение времени: ${item.title || 'без названия'}`),
    ...bigEvents.map(item => `В этот день крупное событие АПГ: ${item.title || 'без названия'}`),
  ].filter((value, index, arr) => arr.indexOf(value) === index);
  if (!warnings.length) return null;
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Конфликты планирования</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {warnings.map(warning => (
          <div key={warning} style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.28)', borderRadius: 12, padding: 10, fontSize: 12, lineHeight: '18px', fontWeight: 700 }}>
            {warning}
          </div>
        ))}
      </div>
    </section>
  );
}

function PreviewSection({ event, partnerName }) {
  const [mode, setMode] = useState('app');
  const image = eventImage(event);
  const modes = [['app', 'В приложении'], ['list', 'Список'], ['calendar', 'Календарь'], ['home', 'Главная']];
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Предпросмотр</h3>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {modes.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setMode(key)} style={{ ...BUTTON, padding: '7px 10px', fontSize: 11, background: mode === key ? A.gold : 'rgba(255,255,255,0.06)', color: mode === key ? '#1A1208' : A.textSec, border: `1px solid ${mode === key ? A.goldBrd : A.border}` }}>{label}</button>
        ))}
      </div>
      <div style={{ borderRadius: mode === 'calendar' ? 16 : 22, border: `1px solid ${A.border}`, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        {mode !== 'calendar' && (
          image ? <img src={image} alt="" style={{ width: '100%', height: mode === 'list' ? 92 : 150, objectFit: 'cover', display: 'block' }} /> : <div style={{ height: mode === 'list' ? 70 : 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, background: 'rgba(201,168,76,0.10)' }}>{event?.emoji || '🎉'}</div>
        )}
        <div style={{ padding: mode === 'calendar' ? 12 : 14 }}>
          {mode === 'calendar' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', gap: 12, alignItems: 'center' }}>
              <div style={{ borderRadius: 16, background: A.gold, color: '#1A1208', textAlign: 'center', padding: '8px 4px', fontWeight: 900 }}>
                <div style={{ fontSize: 20 }}>{eventStartDate(event)?.getDate?.() || '—'}</div>
                <div style={{ fontSize: 10 }}>день</div>
              </div>
              <div>
                <div style={{ color: A.text, fontWeight: 850, fontSize: 14 }}>{event?.title || 'Название события'}</div>
                <div style={{ color: A.textSec, fontSize: 12, marginTop: 3 }}>{formatTime(eventStartDate(event)) || 'время'} · {partnerName || event?.location || 'площадка'}</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ color: mode === 'home' ? A.gold : A.text, fontSize: mode === 'home' ? 18 : 15, fontWeight: 900, lineHeight: '21px' }}>{event?.title || 'Название события'}</div>
              <div style={{ color: A.textSec, fontSize: 12, lineHeight: '18px', marginTop: 5 }}>{formatDate(eventStartDate(event)) || event?.date || 'Дата не указана'}{partnerName ? ` · ${partnerName}` : ''}</div>
              {mode === 'app' && <div style={{ color: A.textSec, fontSize: 13, lineHeight: '19px', marginTop: 10 }}>{String(event?.description || 'Описание события').slice(0, 170)}</div>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SeriesSection({ event, canManage, onCreateSeries }) {
  const [frequency, setFrequency] = useState('weekly');
  const [count, setCount] = useState('4');
  const [endDate, setEndDate] = useState('');
  if (!canManage) return null;
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Повторяющиеся события</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, marginBottom: 8 }}>
        <select value={frequency} onChange={e => setFrequency(e.target.value)} style={MINI_INPUT}>
          <option value="daily">Ежедневно</option>
          <option value="weekly">Каждую неделю</option>
          <option value="biweekly">Раз в две недели</option>
          <option value="monthly">Каждый месяц</option>
        </select>
        <input value={count} onChange={e => setCount(e.target.value)} type="number" min="1" max="52" style={MINI_INPUT} />
      </div>
      <input value={endDate} onChange={e => setEndDate(e.target.value)} type="date" style={{ ...MINI_INPUT, marginBottom: 10 }} />
      <button type="button" onClick={() => onCreateSeries?.(event, { frequency, count: Number(count) || 1, endDate })} style={{ ...BUTTON, width: '100%', background: 'rgba(201,168,76,0.16)', color: A.gold, border: `1px solid ${A.goldBrd}` }}>Создать серию черновиков</button>
    </section>
  );
}

function ModerationSection({ event, canManage }) {
  const key = moderationKey(event);
  if (!['pending_review', 'revision_requested', 'rejected'].includes(key) && !event?.submittedByUserId && !event?.submissionComment) return null;
  const createdAt = toDateValue(event?.submittedAt || event?.createdAt);
  const author = event?.submittedProfileName || event?.proposalAuthorName || event?.submittedByName || event?.submittedByUserId || 'Автор не указан';
  const authorType = event?.proposalAuthorType === 'expert' ? 'Эксперт' : event?.proposalAuthorType === 'partner' ? 'Партнёр' : 'Автор';
  return (
    <section style={SECTION}>
      <h3 style={SECTION_TITLE}>Модерация</h3>
      <div style={{ display: 'grid', gap: 10 }}>
        <Row label="Кто предложил" value={`${authorType}: ${author}`} />
        <Row label="Дата создания" value={createdAt ? createdAt.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'не указана'} />
        <Row label="Комментарий автора" value={event?.submissionComment || event?.comment || 'без комментария'} />
        {(event?.revisionComment || event?.rejectionReason || event?.moderationComment) && (
          <Row label={event?.rejectionReason ? 'Причина' : 'Комментарий админа'} value={event?.rejectionReason || event?.revisionComment || event?.moderationComment} />
        )}
        {canManage && key === 'pending_review' && (
          <div style={{ color: A.textSec, fontSize: 12, lineHeight: '18px', padding: 10, borderRadius: 12, border: `1px solid ${A.goldBrd}`, background: 'rgba(201,168,76,0.10)' }}>
            Предложение ожидает решения администратора. Публикация произойдёт только после одобрения.
          </div>
        )}
      </div>
    </section>
  );
}

function ParticipantsSection({ participants, search, setSearch, canManage }) {
  if (!canManage) return null;
  const q = search.trim().toLowerCase();
  const visibleParticipants = q
    ? participants.filter((entry) => {
        const text = [
          safeText(entry?.name),
          safeText(entry?.email),
          safeText(entry?.phone),
          safeText(entry?.id),
        ].join(' ').toLowerCase();
        return text.includes(q);
      })
    : participants;
  const searchBox = (
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="🔎 Поиск по участникам"
      style={{
        width: '100%',
        borderRadius: 10,
        border: `1px solid ${A.border}`,
        background: 'rgba(255,255,255,0.05)',
        color: A.text,
        padding: '9px 11px',
        marginBottom: 10,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
  return (
    <section style={SECTION}>
      {searchBox}
      {participants.length === 0 ? (
        <div style={{ textAlign: 'center', color: A.textSec, padding: '16px 4px', borderRadius: 12, border: `1px dashed ${A.border}`, background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>🫥</div>
          <div style={{ fontSize: 13 }}>Пока нет участников</div>
        </div>
      ) : visibleParticipants.length === 0 ? (
        <div style={{ textAlign: 'center', color: A.textSec, padding: 12, borderRadius: 12, border: `1px dashed ${A.border}` }}>
          По вашему запросу никого не найдено
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
          {visibleParticipants.map((entry, idx) => {
            const participantName = safeText(entry?.name, 'Участник');
            const participantContact = safeText(entry?.email || entry?.phone || entry?.id, 'контакт не указан');
            return (
            <div key={entry?.id || idx} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${A.border}` }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: A.gold, flexShrink: 0 }}>
                {participantName.slice(0, 1) || '👤'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: A.text, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {participantName}
                </div>
                <div style={{ color: A.textSec, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {participantContact}
                </div>
              </div>
            </div>
          );})}
        </div>
      )}
    </section>
  );
}

function FooterActions({ isAdminRole, event, onEdit, onClose, onDuplicate, onApprove, onRequestChanges, onReject }) {
  const key = moderationKey(event);
  const canModerate = isAdminRole && key === 'pending_review';
  return (
    <section style={SECTION}>
      {canModerate && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <button onClick={() => onApprove?.(event)} style={{ ...BUTTON, background: '#4BB34B', color: '#061407' }}>Одобрить</button>
          <button onClick={() => onRequestChanges?.(event)} style={{ ...BUTTON, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)' }}>Доработка</button>
          <button onClick={() => onReject?.(event)} style={{ ...BUTTON, background: 'rgba(230,70,70,0.18)', color: '#E64646', border: '1px solid rgba(230,70,70,0.35)' }}>Отклонить</button>
        </div>
      )}
      {isAdminRole ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <button onClick={onEdit} style={{ ...BUTTON, background: A.gold, color: '#1A1208' }}>Редактировать</button>
          <button
            onClick={() => onDuplicate?.(event)}
            style={{ ...BUTTON, background: 'rgba(255,255,255,0.08)', color: A.text, border: `1px solid ${A.border}` }}
          >
            Дублировать
          </button>
          <button onClick={onClose} style={{ ...BUTTON, background: 'rgba(255,255,255,0.09)', color: A.text, border: `1px solid ${A.border}` }}>Закрыть</button>
        </div>
      ) : (
        <button onClick={onClose} style={{ ...BUTTON, width: '100%', background: 'rgba(255,255,255,0.09)', color: A.text, border: `1px solid ${A.border}` }}>Закрыть</button>
      )}
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: A.textSec, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{label}</span>
      <span style={{ color: A.text, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function buildParticipants(users, eventId) {
  if (!Array.isArray(users) || !eventId) return [];
  const result = [];
  for (const user of users) {
    const reg = user?.registeredEvents ?? user?.registeredEventIds ?? user?.events;
    let isRegistered = false;
    if (typeof reg === 'string') {
      isRegistered = reg === eventId;
    } else if (Array.isArray(reg)) {
      isRegistered = reg.some((item) => {
        if (item === eventId) return true;
        if (!item) return false;
        if (typeof item === 'string') return item === eventId;
        if (item?.id) return item.id === eventId;
        if (item?.eventId) return item.eventId === eventId;
        return false;
      });
    }
    if (!isRegistered && Array.isArray(user?.eventIds)) {
      isRegistered = user.eventIds.includes(eventId);
    }
    if (!isRegistered) continue;
    result.push({
      id: user.id || `${user.firstName ?? ''}-${user.lastName ?? ''}`,
      name: userDisplayName(user),
      email: user?.email || '',
      phone: user?.phone || '',
      createdAt: toDateOrLabel(user?.registeredAt || user?.createdAt),
    });
  }
  return result;
}

function exportParticipantsCSV(event, participants) {
  if (!event?.id || !Array.isArray(participants) || participants.length === 0) return;
  const header = ['ID', 'Имя', 'Email', 'Телефон', 'Дата регистрации'];
  const rows = participants.map((entry) => [
    entry.id,
    entry.name,
    entry.email,
    entry.phone,
    entry.createdAt,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `apg_event_${event.id}_participants.csv`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 120);
}

export function EventDetailSheet({
  open = false,
  event = null,
  role = '',
  users = [],
  partners = [],
  experts = [],
  allEvents = [],
  onClose = () => {},
  onEdit = () => {},
  onDuplicate = () => {},
  onPatch = () => {},
  onCreateSeries = () => {},
  registeredEventIds = [],
  onRegister = null,
  onApprove = () => {},
  onRequestChanges = () => {},
  onReject = () => {},
}) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const [touchStartY, setTouchStartY] = useState(null);
  const [pointerStartY, setPointerStartY] = useState(null);
  const contentRef = useRef(null);
  const detailEvent = useMemo(() => normalizeDetailEvent(event, partners, experts), [event, partners, experts]);
  const participants = useMemo(() => buildParticipants(users, event?.id), [users, event?.id]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setIsClosing(false);
    } else if (visible) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsClosing(false);
        setVisible(false);
      }, 320);
      return () => clearTimeout(timer);
    }
  }, [open, visible]);

  useEffect(() => {
    const isOpen = Boolean(open && event);
    window.dispatchEvent(new CustomEvent('apg:event-sheet-open', { detail: { open: isOpen } }));
    if (isOpen) document.body.dataset.apgEventSheetOpen = '1';
    else delete document.body.dataset.apgEventSheetOpen;
    return () => {
      window.dispatchEvent(new CustomEvent('apg:event-sheet-open', { detail: { open: false } }));
      delete document.body.dataset.apgEventSheetOpen;
    };
  }, [open, event?.id]);

  useLayoutEffect(() => {
    if (!open || !detailEvent?.id) return;
    const resetScroll = () => {
      if (contentRef.current) contentRef.current.scrollTop = 0;
    };
    resetScroll();
    const frame = requestAnimationFrame(resetScroll);
    const timers = [setTimeout(resetScroll, 80), setTimeout(resetScroll, 180)];
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [open, detailEvent?.id]);

  if (!visible || !detailEvent) return null;

  const isAdminRole = ['admin', 'owner'].includes(String(role || '').toLowerCase());
  const status = resolveStatus(detailEvent);
  const statusTone = MODERATION_STATUS_META[moderationKey(detailEvent)]?.tone || (status === 'Завершено' ? '#E64646' : status.includes('закрыта') ? '#f59e0b' : A.gold);
  const modeKey = normalizeMode(detailEvent);
  const mode = EVENT_MODE_META[modeKey] || EVENT_MODE_META.offline;
  const capacity = Number(detailEvent?.maxParticipants ?? 0);
  const registered = Number(detailEvent?.registeredCount ?? 0);
  const partnerName = detailEvent?.partner || getFieldNameById(partners, detailEvent?.partnerId);
  const expertName = detailEvent?.expert || getFieldNameById(experts, detailEvent?.expertId);
  const isRegistered = registeredEventIds.map(String).includes(String(detailEvent?.id || ''));

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  const handleEdit = () => {
    onEdit(detailEvent);
  };

  const handleExport = () => exportParticipantsCSV(detailEvent, participants);

  const handleTouchEnd = (touchEvent) => {
    if (touchStartY == null) return;
    const endY = touchEvent.changedTouches?.[0]?.clientY ?? touchStartY;
    if (endY - touchStartY > 86) {
      handleClose();
    }
    setTouchStartY(null);
  };

  const handleTouchMove = (touchEvent) => {
    if (touchStartY == null) return;
    const currentY = touchEvent.touches?.[0]?.clientY ?? touchStartY;
    if (currentY - touchStartY > 110) {
      setTouchStartY(null);
      handleClose();
    }
  };

  const handlePointerMove = (pointerEvent) => {
    if (pointerStartY == null) return;
    if (pointerEvent.clientY - pointerStartY > 110) {
      setPointerStartY(null);
      handleClose();
    }
  };

  const sheet = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: isClosing ? 'rgba(12,12,14,0.36)' : 'rgba(12,12,14,0.58)',
        backdropFilter: 'blur(12px) saturate(1.35)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.35)',
        padding: `max(10px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right)) 0 max(6px, env(safe-area-inset-left))`,
        transition: motionTransition(['background', 'backdrop-filter'], 'modal', 'soft'),
        overflow: 'hidden',
        boxSizing: 'border-box',
        isolation: 'isolate',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: APG2_PROFILE.bg,
          backdropFilter: APG2_PROFILE.glass.backdropFilter,
          WebkitBackdropFilter: APG2_PROFILE.glass.WebkitBackdropFilter,
          border: APG2_PROFILE.glass.border,
          boxShadow: '0 -26px 90px rgba(0,0,0,0.38), inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.38)',
          width: '100%',
          maxWidth: 'min(900px, 100%)',
          height: 'calc(96dvh - max(10px, env(safe-area-inset-top)))',
          maxHeight: '96dvh',
          minHeight: 'min(90dvh, calc(96dvh - max(10px, env(safe-area-inset-top))))',
          borderRadius: 34,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transform: isClosing ? 'translateY(110%) scale(0.985)' : 'translateY(0) scale(1)',
          opacity: isClosing ? 0 : 1,
          transition: motionTransition(['transform', 'opacity'], 'modal', 'out'),
          willChange: 'transform, opacity',
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          const y = event.touches?.[0]?.clientY ?? null;
          setTouchStartY(y);
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => setTouchStartY(null)}
        onPointerDown={(event) => {
          setPointerStartY(event.clientY);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setPointerStartY(null)}
        onPointerCancel={() => setPointerStartY(null)}
      >
        <div style={{ height: 6, width: 46, borderRadius: 99, background: 'rgba(var(--apg2-glass-a,255,255,255),0.34)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)', margin: '12px auto 0' }} />
        <div style={{ padding: '16px 10px 0', flexShrink: 0, boxSizing: 'border-box' }}>
          <HeroSection event={detailEvent} status={status} statusTone={statusTone} />
        </div>
        <div key={detailEvent.id || 'event-detail'} ref={contentRef} style={{ overflowY: 'auto', padding: '14px 10px max(18px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, boxSizing: 'border-box' }}>
          {isAdminRole && <QualitySection event={detailEvent} partnerName={partnerName} expertName={expertName} />}
          {isAdminRole && <PreparationSection event={detailEvent} partnerName={partnerName} expertName={expertName} />}
          {isAdminRole && <ConflictSection event={detailEvent} allEvents={allEvents} />}
          <DateSection event={detailEvent} status={status} />
          <LocationSection event={detailEvent} partnerName={partnerName} expertName={expertName} />
          <DescriptionSection event={detailEvent} />
          <ModerationSection event={detailEvent} canManage={isAdminRole} />
          {isAdminRole && <PreviewSection event={detailEvent} partnerName={partnerName} />}
          {isAdminRole && <PromotionPlanSection event={detailEvent} canManage={isAdminRole} onPatch={onPatch} />}
          {isAdminRole && <SeriesSection event={detailEvent} canManage={isAdminRole} onCreateSeries={onCreateSeries} />}
          <RegistrationSection event={detailEvent} />
          {!isAdminRole && onRegister && (
            <UserActionsSection
              event={detailEvent}
              isRegistered={isRegistered}
              onRegister={onRegister}
              onClose={handleClose}
            />
          )}
      {isAdminRole && (
        <div style={{ ...SECTION }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={SECTION_TITLE}>Участники</h3>
                <button
                  onClick={handleExport}
                  disabled={!participants.length}
                  style={{
                    ...BUTTON,
                    width: 150,
                    background: participants.length ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.08)',
                    color: participants.length ? A.gold : 'rgba(240,240,240,0.5)',
                    border: participants.length ? `1px solid ${A.goldBrd}` : `1px solid ${A.border}`,
                    padding: '8px 12px',
                    fontSize: 12,
                    cursor: participants.length ? 'pointer' : 'not-allowed',
                  }}
                >
                  Экспорт CSV
                </button>
              </div>
          <ParticipantsSection
            participants={participants}
            search={search}
            setSearch={setSearch}
            canManage={isAdminRole}
          />
        </div>
      )}
          {isAdminRole && capacity ? (
            <div style={SECTION}>
              <Row label="Статус формата" value={mode.label} />
              <Row label="Ключевая метка" value={status} />
              <Row label="Доступность" value={registered > 0 ? 'есть участники' : 'пока никто не записался'} />
            </div>
          ) : null}
          <FooterActions
            isAdminRole={isAdminRole}
            event={detailEvent}
            onEdit={handleEdit}
            onClose={handleClose}
            onDuplicate={onDuplicate}
            onApprove={onApprove}
            onRequestChanges={onRequestChanges}
            onReject={onReject}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}
