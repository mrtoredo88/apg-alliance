import React, { useMemo, useState, useEffect } from 'react';

import { T, GLASS } from './design.js';
import { RichText } from './components/RichText.jsx';
import { APG2_PROFILE, ApgModal, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';
import { EventDetailSheet } from './EventDetailSheet.jsx';
import { openUrl } from './vk.js';

const GRADIENTS_DARK = [
  'linear-gradient(135deg, #1a1a4e, #2d4a8a)',
  'linear-gradient(135deg, #1a3a1a, #2d6a3a)',
  'linear-gradient(135deg, #3a1a1a, #7a3030)',
  'linear-gradient(135deg, #2a1a3a, #5a2d7a)',
  'linear-gradient(135deg, #1a3a3a, #2d7a6a)',
];
const GRADIENTS_LIGHT = [
  'linear-gradient(135deg, rgba(74,144,217,0.12), rgba(74,144,217,0.06))',
  'linear-gradient(135deg, rgba(75,179,75,0.12), rgba(75,179,75,0.06))',
  'linear-gradient(135deg, rgba(230,70,70,0.12), rgba(230,70,70,0.06))',
  'linear-gradient(135deg, rgba(142,68,173,0.12), rgba(142,68,173,0.06))',
  'linear-gradient(135deg, rgba(26,188,156,0.12), rgba(26,188,156,0.06))',
];

const eventImageOf = (event) =>
  event?.coverPhoto || event?.imageUrl || event?.thumbnail || event?.banner || event?.image || '';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const CATEGORY_COLORS = {
  economy: '#6AABEC',
  society: '#A78BFA',
  sport: '#4ade80',
  culture: '#f59e0b',
  education: '#38bdf8',
  transport: '#fb923c',
  kids: '#fb7185',
  family: '#D7B86A',
};

function toDateValue(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function eventDate(event) {
  return toDateValue(event?.startAt || event?.eventDate || event?.date || event?.deadline);
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return a && b && dayKey(a) === dayKey(b);
}

function isWeekendDate(date) {
  return date && (date.getDay() === 0 || date.getDay() === 6);
}

function isEventPast(event) {
  const d = eventDate(event);
  if (!d) return false;
  const end = toDateValue(event?.endAt);
  return (end || d).getTime() < Date.now() - 2 * 60 * 60 * 1000;
}

function isFreeEvent(event) {
  const text = `${event?.priceClub || ''} ${event?.pricePublic || ''} ${event?.price || ''}`.toLowerCase();
  return !text.trim() || text.includes('бесплат') || text.includes('free') || text === '0';
}

function isKidsEvent(event) {
  const text = `${event?.title || ''} ${event?.description || ''} ${event?.category || ''}`.toLowerCase();
  return text.includes('дет') || text.includes('сем') || text.includes('kids') || event?.forKids || event?.family;
}

function isAdultEvent(event) {
  const text = `${event?.title || ''} ${event?.description || ''}`.toLowerCase();
  return text.includes('18+') || event?.adultOnly;
}

function deadlineSoon(event) {
  const d = toDateValue(event?.deadline);
  return d && d.getTime() >= Date.now() && d.getTime() <= Date.now() + 3 * 24 * 60 * 60 * 1000;
}

function distanceKm(a, b) {
  if (!a || !b) return null;
  const toRad = v => v * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function eventCoords(event) {
  const lat = Number(event?.latitude ?? event?.lat ?? event?.coords?.lat);
  const lng = Number(event?.longitude ?? event?.lng ?? event?.coords?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function formatEventDate(event) {
  const d = eventDate(event);
  if (!d) return event?.date || 'Скоро';
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

function formatEventTime(event) {
  const d = eventDate(event);
  if (!d) return '';
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function useCountdown(deadline) {
  const getRemaining = (dl) => {
    if (!dl) return null;
    const ms = new Date(dl + 'T23:59:59').getTime() - Date.now();
    if (ms <= 0) return null;
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return { d, h, m, ms };
  };
  const [remaining, setRemaining] = useState(() => getRemaining(deadline));
  useEffect(() => {
    setRemaining(getRemaining(deadline)); // обновляем сразу при смене deadline
    if (!deadline) return;
    const t = setInterval(() => setRemaining(getRemaining(deadline)), 60000);
    return () => clearInterval(t);
  }, [deadline]);
  return remaining;
}

function CountdownChip({ deadline }) {
  const rem = useCountdown(deadline);
  if (!rem) return null;
  const label = rem.d > 0 ? `${rem.d}д ${rem.h}ч` : rem.h > 0 ? `${rem.h}ч ${rem.m}м` : `${rem.m}м`;
  const urgent = rem.ms < 86400000 * 3;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: urgent ? 'rgba(230,70,70,0.18)' : 'rgba(255,140,0,0.15)',
      border: `1px solid ${urgent ? 'rgba(230,70,70,0.45)' : 'rgba(255,140,0,0.4)'}`,
      borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 700,
      color: urgent ? '#E64646' : '#FF8C00',
    }}>
      ⏱ {label}
    </div>
  );
}

function EventModal({ event, onClose }) {
  if (!event) return null;
  const eventImage = eventImageOf(event);
  return (
    <ApgModal title={event.title || 'Мероприятие АПГ'} subtitle={event.partner || event.address || 'Подробности мероприятия'} onClose={onClose} maxWidth={460}>
        {eventImage && (
          <div style={{ margin: '-6px -4px 18px', borderRadius: 28, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 18px 48px rgba(0,0,0,0.22)' }}>
            <img src={eventImage} alt="" loading="lazy" style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }} onError={e => { e.currentTarget.parentElement.style.display = 'none'; }} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ ...APG2_PROFILE.glass, width: 72, height: 72, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>{event.emoji ?? '🎉'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: APG2_PROFILE.text, lineHeight: '26px', flex: 1 }}>
            {(event.priority ?? 0) >= 8 && <span style={{ fontSize: 10, fontWeight: 800, color: T.gold, background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 5, padding: '2px 6px', marginRight: 7, verticalAlign: 'middle' }}>📌 Важно</span>}
            {event.title}
          </div>
          {event.isExpertEvent && (
            <div style={{ flexShrink: 0, background: 'rgba(74,144,217,0.18)', border: '1px solid rgba(74,144,217,0.35)', borderRadius: 10, padding: '3px 9px', fontSize: 11, fontWeight: 800, color: '#6AABEC' }}>ЭКСПЕРТ</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {event.date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(74,144,217,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📅</div>
              <span style={{ color: APG2_PROFILE.text, fontSize: 14 }}>{event.date}</span>
            </div>
          )}
          {event.partner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏪</div>
              <span style={{ color: APG2_PROFILE.text, fontSize: 14 }}>{event.partner}</span>
            </div>
          )}
          {event.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(75,179,75,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📍</div>
              <span style={{ color: APG2_PROFILE.text, fontSize: 14 }}>{event.address}</span>
            </div>
          )}
          {(event.priceClub || event.pricePublic) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {event.priceClub && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🗝️</div>
                  <div>
                    <div style={{ fontSize: 10, color: APG2_PROFILE.textSoft, fontWeight: 600 }}>Для клуба АПГ</div>
                    <div style={{ fontSize: 14, color: APG2_PROFILE.gold, fontWeight: 700 }}>{event.priceClub}</div>
                  </div>
                </div>
              )}
              {event.pricePublic && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💰</div>
                  <div>
                    <div style={{ fontSize: 10, color: APG2_PROFILE.textSoft, fontWeight: 600 }}>Для всех</div>
                    <div style={{ fontSize: 14, color: APG2_PROFILE.text, fontWeight: 700 }}>{event.pricePublic}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {event.deadline && (
          <div style={{ marginBottom: 16 }}>
            <CountdownChip deadline={event.deadline} />
          </div>
        )}
        {event.description && (
          <div style={{ ...APG2_PROFILE.glass, borderRadius: 18, padding: 15, marginBottom: 20 }}>
            <RichText color={APG2_PROFILE.textSoft} fontSize={14}>{event.description}</RichText>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {event.address && (
            <GlassButton onClick={() => openUrl(`https://yandex.ru/maps/?text=${encodeURIComponent(event.address)}`)} tone="gold" style={{ width: '100%', color: '#17120a' }}>Проложить маршрут</GlassButton>
          )}
          {event.socialUrl && (
            <GlassButton onClick={() => openUrl(event.socialUrl)} tone="gold" style={{ width: '100%', color: '#17120a' }}>Перейти к событию</GlassButton>
          )}
          {event.linkUrl && event.linkLabel && (
            <GlassButton onClick={() => openUrl(event.linkUrl)} style={{ width: '100%' }}>{event.linkLabel} →</GlassButton>
          )}
          <GlassButton onClick={onClose} style={{ width: '100%' }}>Закрыть</GlassButton>
        </div>
    </ApgModal>
  );
}

function EventCardV2({ event, index, onClick }) {
  const date = event.date || event.eventDate || event.deadline || 'Скоро';
  const day = String(date).slice(0, 2).replace(/\D/g, '') || '✦';
  const month = String(date).replace(/^\d+\.?\s*/, '').slice(0, 6) || 'АПГ';
  const eventImage = eventImageOf(event);
  return (
    <GlassCard
      onClick={() => onClick(event)}
      style={{ minHeight: index === 0 ? 176 : 132, padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: index === 0 ? '112px 1fr' : '88px 1fr', animation: `fadeInUp 0.38s ease ${index * 0.04}s both` }}
    >
      <div style={{ position: 'relative', background: 'radial-gradient(circle at 40% 18%,rgba(255,247,214,0.34),transparent 34%), linear-gradient(160deg,rgba(215,184,106,0.28),rgba(255,255,255,0.055))', borderRight: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 15 }}>
        <GlassBadge tone="gold" style={{ alignSelf: 'flex-start', fontSize: 10, padding: '5px 8px' }}>{event.isExpertEvent ? 'Эксперт' : 'Событие'}</GlassBadge>
        <div>
          <div style={{ color: APG2_PROFILE.text, fontSize: index === 0 ? 38 : 30, lineHeight: '34px', fontWeight: 900 }}>{day}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11, lineHeight: '14px', fontWeight: 760, textTransform: 'uppercase' }}>{month}</div>
        </div>
      </div>
      <div style={{ padding: index === 0 ? 18 : 15, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12, position: 'relative', overflow: 'hidden' }}>
        {eventImage && (
          <>
            <img src={eventImage} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: index === 0 ? 0.24 : 0.16, filter: 'saturate(1.05) contrast(1.03)' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(12,12,14,0.86), rgba(12,12,14,0.54))' }} />
          </>
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: index === 0 ? 20 : 16, lineHeight: index === 0 ? '24px' : '20px', fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.title || 'Событие АПГ'}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '18px', marginTop: 7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {event.partner || event.address || event.description || 'Подробности появятся скоро'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {event.deadline && <GlassBadge>до регистрации</GlassBadge>}
          {event.priceClub && <GlassBadge tone="gold">{event.priceClub}</GlassBadge>}
          <span style={{ marginLeft: 'auto', color: APG2_PROFILE.gold, fontSize: 22, lineHeight: 1 }}>›</span>
        </div>
      </div>
    </GlassCard>
  );
}

function EventListCard({ event, index, onClick, isDark = true }) {
  const gradients = isDark ? GRADIENTS_DARK : GRADIENTS_LIGHT;
  const grad = gradients[(event.id?.charCodeAt(0) ?? 0) % gradients.length];
  return (
    <div
      onClick={() => onClick(event)}
      style={{
        background: grad, backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', borderRadius: 24, overflow: 'hidden',
        border: `1px solid ${T.border}`, cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        display: 'flex', alignItems: 'stretch',
        animation: 'fadeInUp 0.4s ease both',
        animationDelay: `${index * 0.06}s`,
      }}
    >
      {/* Левая золотая полоска */}
      <div style={{ width: 3, background: `linear-gradient(180deg, ${T.gold}, transparent)`, flexShrink: 0 }} />

      {/* Эмодзи */}
      <div style={{
        width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, flexShrink: 0, padding: '16px 0',
      }}>
        {event.emoji ?? '🎉'}
      </div>

      {/* Контент */}
      <div style={{ flex: 1, padding: '14px 14px 14px 4px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, lineHeight: '19px', flex: 1 }}>
            {(event.priority ?? 0) >= 8 && <span style={{ fontSize: 9, fontWeight: 800, color: T.gold, background: 'rgba(201,168,76,0.18)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 4, padding: '1px 5px', marginRight: 5, verticalAlign: 'middle' }}>📌</span>}
            {event.title}
          </div>
          {event.isExpertEvent && (
            <div style={{ flexShrink: 0, background: 'rgba(74,144,217,0.2)', border: '1px solid rgba(74,144,217,0.4)', borderRadius: 8, padding: '2px 7px', fontSize: 10, fontWeight: 800, color: '#6AABEC', letterSpacing: 0.4 }}>
              ЭКСПЕРТ
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {event.date && (
            <div style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>📅 {event.date}</div>
          )}
          {event.partner && (
            <div style={{ fontSize: 12, color: T.textSec }}>🏪 {event.partner}</div>
          )}
          {event.address && (
            <div style={{ fontSize: 12, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📍 {event.address}
            </div>
          )}
          {(event.priceClub || event.pricePublic) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              {event.priceClub && (
                <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, padding: '2px 7px' }}>
                  🗝️ {event.priceClub}
                </div>
              )}
              {event.pricePublic && (
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textSec, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '2px 7px' }}>
                  {event.pricePublic}
                </div>
              )}
            </div>
          )}
          {event.deadline && (
            <div style={{ marginTop: 4 }}>
              <CountdownChip deadline={event.deadline} />
            </div>
          )}
        </div>
      </div>

      {/* Стрелка */}
      <div style={{ display: 'flex', alignItems: 'center', paddingRight: 14, color: T.gold, fontSize: 18, flexShrink: 0 }}>›</div>
    </div>
  );
}

function isEventPastLegacy(event) {
  const dateStr = event.deadline ?? event.eventDate;
  if (!dateStr) return false;
  const d = new Date(dateStr.length <= 10 ? dateStr + 'T23:59:59' : dateStr);
  return !isNaN(d) && d.getTime() < Date.now();
}

function EmptyState({ tab }) {
  return (
    <div style={{ margin: '32px 16px', ...GLASS, borderRadius: 24, padding: '36px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 48 }}>{tab === 'upcoming' ? '🗓️' : '📦'}</div>
      <div>
        <div style={{ color: T.textPri, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
          {tab === 'upcoming' ? 'Скоро будут события' : 'Прошедших событий нет'}
        </div>
        <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>
          {tab === 'upcoming' ? 'Партнёры АПГ готовят кое-что интересное' : 'Здесь появятся прошедшие мероприятия'}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, children, onClick }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, minHeight: 38, padding: '8px 13px', borderRadius: 999, border: active ? '1px solid rgba(215,184,106,0.50)' : APG2_PROFILE.glass.border, background: active ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.12)', color: active ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 820, fontFamily: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>{children}</button>
  );
}

function EventPosterCard({ event, index, onClick, compact = false }) {
  const image = eventImageOf(event);
  const d = eventDate(event);
  const capacity = Number(event?.maxParticipants || 0);
  const registered = Number(event?.registeredCount || 0);
  const left = capacity > 0 ? Math.max(0, capacity - registered) : null;
  return (
    <GlassCard onClick={() => onClick(event)} style={{ borderRadius: 30, padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: compact ? '92px 1fr' : '116px 1fr', minHeight: compact ? 126 : 158, animation: `fadeInUp 0.34s ease ${index * 0.035}s both` }}>
      <div style={{ position: 'relative', background: APG2_PROFILE.goldSoft, overflow: 'hidden' }}>
        {image ? <img src={image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>{event?.emoji || '🎉'}</div>}
        <div style={{ position: 'absolute', left: 10, bottom: 10, minWidth: 48, borderRadius: 18, padding: '8px 7px', background: 'rgba(12,12,14,0.72)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', color: APG2_PROFILE.text, textAlign: 'center', border: '1px solid rgba(255,255,255,0.18)' }}>
          <div style={{ fontSize: 20, fontWeight: 930, lineHeight: '20px' }}>{d ? d.getDate() : '—'}</div>
          <div style={{ fontSize: 9, fontWeight: 820, color: APG2_PROFILE.gold, textTransform: 'uppercase' }}>{d ? MONTHS_GEN[d.getMonth()].slice(0, 3) : 'скоро'}</div>
        </div>
      </div>
      <div style={{ padding: compact ? 13 : 16, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          {isFreeEvent(event) && <GlassBadge tone="gold" style={{ fontSize: 10, padding: '4px 7px' }}>Бесплатно</GlassBadge>}
          {deadlineSoon(event) && <GlassBadge style={{ fontSize: 10, padding: '4px 7px' }}>Регистрация скоро</GlassBadge>}
          {event.isExpertEvent && <GlassBadge style={{ fontSize: 10, padding: '4px 7px' }}>Эксперт</GlassBadge>}
        </div>
        <div style={{ color: APG2_PROFILE.text, fontSize: compact ? 15 : 18, lineHeight: compact ? '19px' : '22px', fontWeight: 900, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.title || 'Событие АПГ'}</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '18px', marginTop: 7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {formatEventDate(event)}{formatEventTime(event) ? ` · ${formatEventTime(event)}` : ''}{event.partner ? ` · ${event.partner}` : ''}{event.address ? ` · ${event.address}` : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 760 }}>
          {left !== null ? <span>{left} мест осталось</span> : <span>Запись открыта</span>}
          <span style={{ marginLeft: 'auto', color: APG2_PROFILE.gold, fontSize: 22, lineHeight: 1 }}>›</span>
        </div>
      </div>
    </GlassCard>
  );
}

function EventsCalendarView({ events, selectedDay, onSelectDay, onOpenEvent }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = new Date();
  const byDay = useMemo(() => {
    const map = {};
    events.forEach(event => {
      const d = eventDate(event);
      if (!d) return;
      const key = dayKey(d);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [events]);
  const grid = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = [];
    for (let i = offset - 1; i >= 0; i -= 1) days.push({ date: new Date(y, m, -i), outside: true });
    const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d += 1) days.push({ date: new Date(y, m, d), outside: false });
    while (days.length < 42) days.push({ date: new Date(y, m + 1, days.length - offset - last + 1), outside: true });
    return days;
  }, [month]);
  const selectedEvents = selectedDay ? (byDay[dayKey(selectedDay)] || []) : [];
  return (
    <>
      <GlassCard style={{ borderRadius: 32, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={{ ...APG2_PROFILE.glass, width: 38, height: 38, borderRadius: 17, color: APG2_PROFILE.text, border: APG2_PROFILE.glass.border, fontSize: 22 }}>‹</button>
          <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 900 }}>{MONTHS_RU[month.getMonth()]} {month.getFullYear()}</div>
          <button onClick={() => setMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={{ ...APG2_PROFILE.glass, width: 38, height: 38, borderRadius: 17, color: APG2_PROFILE.text, border: APG2_PROFILE.glass.border, fontSize: 22 }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
          {DAYS_SHORT.map(day => <div key={day} style={{ color: APG2_PROFILE.textMuted, fontSize: 10, textAlign: 'center', fontWeight: 850 }}>{day}</div>)}
          {grid.map(({ date, outside }, idx) => {
            const key = dayKey(date);
            const dayEvents = byDay[key] || [];
            const active = selectedDay && isSameDay(date, selectedDay);
            const isToday = isSameDay(date, today);
            return (
              <button key={idx} onClick={() => onSelectDay(active ? null : date)} style={{ minHeight: 58, borderRadius: 18, border: active ? '1px solid rgba(215,184,106,0.58)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: active ? APG2_PROFILE.goldSoft : isToday ? 'rgba(215,184,106,0.16)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: outside ? APG2_PROFILE.textMuted : APG2_PROFILE.text, padding: 6, fontFamily: 'inherit', cursor: 'pointer' }}>
                <div style={{ fontSize: 13, fontWeight: isToday ? 950 : 760, color: isToday ? APG2_PROFILE.gold : outside ? APG2_PROFILE.textMuted : APG2_PROFILE.text }}>{date.getDate()}</div>
                {dayEvents.length > 0 && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 10, fontWeight: 850, marginTop: 3 }}>{dayEvents.length}</div>}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 4 }}>
                  {dayEvents.slice(0, 3).map((event, i) => <span key={`${event.id}-${i}`} style={{ width: 5, height: 5, borderRadius: '50%', background: CATEGORY_COLORS[event.category] || APG2_PROFILE.gold }} />)}
                  {dayEvents.length > 3 && <span style={{ color: APG2_PROFILE.textMuted, fontSize: 9, lineHeight: '5px' }}>+{dayEvents.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>
      {selectedDay && (
        <div style={{ animation: 'fadeInUp 0.24s ease both' }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 900, margin: '14px 2px 10px' }}>
            {selectedDay.getDate()} {MONTHS_GEN[selectedDay.getMonth()]}
          </div>
          {selectedEvents.length ? (
            <div style={{ display: 'grid', gap: 10 }}>{selectedEvents.map((event, index) => <EventPosterCard key={event.id || index} event={event} index={index} compact onClick={onOpenEvent} />)}</div>
          ) : (
            <EmptyStateV2 icon="☕" title="На эту дату мероприятий пока нет." text="Можно посмотреть ближайшие события в списке." />
          )}
        </div>
      )}
    </>
  );
}

export function EventsPage({ nav, variant = 'v2', events = [], onBack, appearance = 'dark', initialEventTarget = null, registeredEventIds = [], onEventRegister }) {
  const isDark = appearance === 'dark';
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('apg_events_v2_view') || 'list'; } catch { return 'list'; }
  });
  const [filters, setFilters] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [nearRadius, setNearRadius] = useState(1);

  useEffect(() => {
    if (!selectedEvent) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [selectedEvent]);

  useEffect(() => {
    try { localStorage.setItem('apg_events_v2_view', view); } catch {}
  }, [view]);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  const upcoming = events.filter(e => !isEventPast(e) && e.active !== false && !['draft', 'pending_review', 'rejected', 'revision_requested'].includes(String(e.status || e.submissionStatus || '').toLowerCase()));
  const past     = events.filter(e => isEventPast(e)).reverse();
  const list     = tab === 'upcoming' ? upcoming : past;
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  const toggleFilter = (id) => setFilters(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);

  const filteredUpcoming = useMemo(() => {
    return upcoming.filter(event => {
      const d = eventDate(event);
      if (filters.includes('today') && !isSameDay(d, today)) return false;
      if (filters.includes('tomorrow') && !isSameDay(d, tomorrow)) return false;
      if (filters.includes('weekend') && !isWeekendDate(d)) return false;
      if (filters.includes('week') && (!d || d < today || d > weekEnd)) return false;
      if (filters.includes('free') && !isFreeEvent(event)) return false;
      if (filters.includes('kids') && !isKidsEvent(event)) return false;
      if (filters.includes('adult') && !isAdultEvent(event)) return false;
      if (filters.includes('popular') && Number(event.registeredCount || 0) < 5 && Number(event.priority || 0) < 8) return false;
      if (filters.includes('deadline') && !deadlineSoon(event)) return false;
      if (filters.includes('near')) {
        const km = distanceKm(userLocation, eventCoords(event));
        if (km === null || km > nearRadius) return false;
      }
      return true;
    }).sort((a, b) => {
      const da = eventDate(a);
      const db = eventDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
  }, [upcoming, filters, today, tomorrow, weekEnd, userLocation, nearRadius]);

  const grouped = useMemo(() => {
    const groups = { today: [], tomorrow: [], weekend: [], later: [] };
    filteredUpcoming.forEach(event => {
      const d = eventDate(event);
      if (isSameDay(d, today)) groups.today.push(event);
      else if (isSameDay(d, tomorrow)) groups.tomorrow.push(event);
      else if (isWeekendDate(d) && d <= weekEnd) groups.weekend.push(event);
      else groups.later.push(event);
    });
    return [
      ['Сегодня', groups.today],
      ['Завтра', groups.tomorrow],
      ['Выходные', groups.weekend],
      ['Позже', groups.later],
    ].filter(([, items]) => items.length);
  }, [filteredUpcoming, today, tomorrow, weekEnd]);

  const collections = [
    ['🔥 Самые популярные', upcoming.filter(e => Number(e.registeredCount || 0) >= 5 || Number(e.priority || 0) >= 8).slice(0, 6)],
    ['⭐ Скоро закончится регистрация', upcoming.filter(deadlineSoon).slice(0, 6)],
    ['🆕 Новые события', [...upcoming].sort((a, b) => (toDateValue(b.createdAt)?.getTime() || 0) - (toDateValue(a.createdAt)?.getTime() || 0)).slice(0, 6)],
    ['🎁 Бесплатные', upcoming.filter(isFreeEvent).slice(0, 6)],
    ['👨‍👩‍👧 Для всей семьи', upcoming.filter(isKidsEvent).slice(0, 6)],
  ].filter(([, items]) => items.length);

  useEffect(() => {
    const targetId = initialEventTarget?.id ? String(initialEventTarget.id) : '';
    if (!targetId) return;
    const target = events.find(event => String(event?.id || '') === targetId);
    if (!target) return;
    setTab(isEventPast(target) ? 'past' : 'upcoming');
    setSelectedEvent(target);
  }, [events, initialEventTarget]);

  if (variant === 'v2') {
    return (
      <GlassPanel>
        <ScreenHeader title="Афиша города" subtitle="Что сегодня, вечером, на выходных и рядом" kicker="События АПГ" onBack={onBack} />

        <GlassCard style={{ borderRadius: 28, padding: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
          {[['list', 'Список'], ['calendar', 'Календарь']].map(([id, label]) => (
            <GlassButton key={id} onClick={() => setView(id)} tone={view === id ? 'gold' : 'glass'} style={{ minHeight: 44, borderRadius: 20, color: view === id ? '#17120a' : APG2_PROFILE.text }}>{label}</GlassButton>
          ))}
        </GlassCard>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 2px 12px', margin: '0 -2px 4px' }}>
          {[
            ['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['weekend', 'Выходные'], ['week', 'Эта неделя'],
            ['free', 'Бесплатно'], ['kids', 'Детям'], ['adult', '18+'],
            ...(userLocation ? [['near', 'Рядом']] : []),
            ['popular', 'Популярное'], ['deadline', 'Скоро регистрация закроется'],
          ].map(([id, label]) => <FilterChip key={id} active={filters.includes(id)} onClick={() => toggleFilter(id)}>{label}</FilterChip>)}
        </div>

        {filters.includes('near') && userLocation && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[0.5, 1, 3, 5].map(radius => (
              <FilterChip key={radius} active={nearRadius === radius} onClick={() => setNearRadius(radius)}>{radius < 1 ? '500 м' : `${radius} км`}</FilterChip>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <StatPill label="событий" value={filteredUpcoming.length} tone="gold" />
          <StatPill label="сегодня" value={upcoming.filter(e => isSameDay(eventDate(e), today)).length} />
          <StatPill label="бесплатно" value={upcoming.filter(isFreeEvent).length} />
        </div>

        {filteredUpcoming.length === 0 ? (
          <EmptyStateV2
            icon="😊"
            title={filters.length ? 'На эту дату мероприятий пока нет.' : 'Сегодня город отдыхает'}
            text="Можно сбросить фильтры или посмотреть ближайшие события."
            action={<GlassButton tone="gold" onClick={() => { setFilters([]); setView('list'); }} style={{ color: '#17120a' }}>Показать ближайшие события</GlassButton>}
          />
        ) : view === 'calendar' ? (
          <EventsCalendarView events={filteredUpcoming} selectedDay={selectedDay} onSelectDay={setSelectedDay} onOpenEvent={setSelectedEvent} />
        ) : (
          <>
            {collections.length > 0 && filters.length === 0 && (
              <div style={{ display: 'grid', gap: 16, marginBottom: 18 }}>
                {collections.map(([title, items]) => (
                  <section key={title}>
                    <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 900, margin: '0 2px 10px' }}>{title}</div>
                    <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(260px, 82%)', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
                      {items.map((event, index) => <EventPosterCard key={`${title}-${event.id || index}`} event={event} index={index} compact onClick={setSelectedEvent} />)}
                    </div>
                  </section>
                ))}
              </div>
            )}
            <div style={{ display: 'grid', gap: 16 }}>
              {grouped.map(([title, items]) => (
                <section key={title}>
                  <div style={{ position: 'sticky', top: 'calc(var(--safe-top, 0px) + 66px)', zIndex: 4, margin: '0 -2px 10px', padding: '8px 2px', background: 'linear-gradient(180deg,rgba(17,17,19,0.94),rgba(17,17,19,0.74),rgba(17,17,19,0))', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: 'uppercase' }}>{title}</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {items.map((event, index) => <EventPosterCard key={event.id || index} event={event} index={index} onClick={setSelectedEvent} />)}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        <EventDetailSheet
          open={Boolean(selectedEvent)}
          event={selectedEvent}
          role="user"
          registeredEventIds={registeredEventIds}
          onRegister={onEventRegister}
          onClose={() => setSelectedEvent(null)}
        />
      </GlassPanel>
    );
  }

  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: `1px solid ${T.headerBorder}`, borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>✦ События</div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 12 }}>
          {[['upcoming', `Предстоящие${upcoming.length ? ` · ${upcoming.length}` : ''}`], ['past', `Прошедшие${past.length ? ` · ${past.length}` : ''}`]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: tab === id ? T.gold : T.chipBg,
              color: tab === id ? '#0F0F1A' : T.textSec,
              transition: 'all 0.18s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ background: 'transparent', minHeight: '100%' }}>
        {list.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div style={{ padding: '8px 16px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((event, i) => (
              <EventListCard key={event.id} event={event} index={i} onClick={setSelectedEvent} isDark={isDark} />
            ))}
          </div>
        )}
      </div>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </>
  );
}
