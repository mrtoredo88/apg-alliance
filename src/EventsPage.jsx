import React, { useState, useEffect } from 'react';

import { T, GLASS } from './design.js';
import { RichText } from './components/RichText.jsx';
import { APG2_PROFILE, ApgModal, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';

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
  return (
    <ApgModal title={event.title || 'Мероприятие АПГ'} subtitle={event.partner || event.address || 'Подробности мероприятия'} onClose={onClose} maxWidth={460}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ ...APG2_PROFILE.glass, width: 72, height: 72, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>{event.emoji ?? '🎉'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.textPri, lineHeight: '26px', flex: 1 }}>
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
              <div style={{ width: 32, height: 32, borderRadius: 10, background: T.blue + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📅</div>
              <span style={{ color: T.textPri, fontSize: 14 }}>{event.date}</span>
            </div>
          )}
          {event.partner && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: T.gold + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏪</div>
              <span style={{ color: T.textPri, fontSize: 14 }}>{event.partner}</span>
            </div>
          )}
          {event.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: T.green + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📍</div>
              <span style={{ color: T.textPri, fontSize: 14 }}>{event.address}</span>
            </div>
          )}
          {(event.priceClub || event.pricePublic) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {event.priceClub && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: T.gold + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🗝️</div>
                  <div>
                    <div style={{ fontSize: 10, color: T.textSec, fontWeight: 600 }}>Для клуба АПГ</div>
                    <div style={{ fontSize: 14, color: T.gold, fontWeight: 700 }}>{event.priceClub}</div>
                  </div>
                </div>
              )}
              {event.pricePublic && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>💰</div>
                  <div>
                    <div style={{ fontSize: 10, color: T.textSec, fontWeight: 600 }}>Для всех</div>
                    <div style={{ fontSize: 14, color: T.textPri, fontWeight: 700 }}>{event.pricePublic}</div>
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
          <div style={{ background: T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 14, padding: 14, marginBottom: 20, border: `1px solid ${T.border}` }}>
            <RichText color={T.textSec} fontSize={14}>{event.description}</RichText>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {event.address && (
            <GlassButton onClick={() => window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(event.address)}`, '_blank')} tone="gold" style={{ width: '100%', color: '#17120a' }}>Проложить маршрут</GlassButton>
          )}
          {event.socialUrl && (
            <GlassButton onClick={() => window.open(event.socialUrl, '_blank')} tone="gold" style={{ width: '100%', color: '#17120a' }}>Перейти к событию</GlassButton>
          )}
          {event.linkUrl && event.linkLabel && (
            <GlassButton onClick={() => window.open(event.linkUrl, '_blank')} style={{ width: '100%' }}>{event.linkLabel} →</GlassButton>
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
      <div style={{ padding: index === 0 ? 18 : 15, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: APG2_PROFILE.text, fontSize: index === 0 ? 20 : 16, lineHeight: index === 0 ? '24px' : '20px', fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.title || 'Событие АПГ'}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '18px', marginTop: 7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {event.partner || event.address || event.description || 'Подробности появятся скоро'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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

function isEventPast(event) {
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

export function EventsPage({ nav, variant = 'v2', events = [], onBack, appearance = 'dark' }) {
  const isDark = appearance === 'dark';
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    if (selectedEvent) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [selectedEvent]);

  const upcoming = events.filter(e => !isEventPast(e));
  const past     = events.filter(e => isEventPast(e)).reverse();
  const list     = tab === 'upcoming' ? upcoming : past;

  if (variant === 'v2') {
    return (
      <GlassPanel>
        <ScreenHeader title="Афиша мероприятий" subtitle={`${upcoming.length} предстоящих · ${past.length} прошедших`} kicker="События города" onBack={onBack} />
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <StatPill label="предстоящих" value={upcoming.length} tone="gold" />
          <StatPill label="в архиве" value={past.length} />
        </div>
        <GlassCard style={{ borderRadius: 26, padding: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 18 }}>
          {[['upcoming', 'Скоро'], ['past', 'Архив']].map(([id, label]) => (
            <GlassButton key={id} onClick={() => setTab(id)} tone={tab === id ? 'gold' : 'glass'} style={{ minHeight: 44, borderRadius: 20, color: tab === id ? '#17120a' : APG2_PROFILE.text }}>{label}</GlassButton>
          ))}
        </GlassCard>
        {list.length === 0 ? (
          <EmptyStateV2 icon={tab === 'upcoming' ? '🗓️' : '✦'} title={tab === 'upcoming' ? 'Скоро будут мероприятия' : 'Архив пока пуст'} text={tab === 'upcoming' ? 'Партнеры АПГ готовят новые события и поводы выйти в город.' : 'После мероприятий здесь появится история.'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((event, i) => <EventCardV2 key={event.id ?? i} event={event} index={i} onClick={setSelectedEvent} />)}
          </div>
        )}
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
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
