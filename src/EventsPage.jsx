import React, { useState, useEffect } from 'react';
import { Panel } from '@vkontakte/vkui';

import { T, GLASS, GLASS_STRONG } from './design.js';

const GRADIENTS = [
  'linear-gradient(135deg, #1a1a4e, #2d4a8a)',
  'linear-gradient(135deg, #1a3a1a, #2d6a3a)',
  'linear-gradient(135deg, #3a1a1a, #7a3030)',
  'linear-gradient(135deg, #2a1a3a, #5a2d7a)',
  'linear-gradient(135deg, #1a3a3a, #2d7a6a)',
];

function useCountdown(deadline) {
  const getRemaining = () => {
    if (!deadline) return null;
    const ms = new Date(deadline + 'T23:59:59').getTime() - Date.now();
    if (ms <= 0) return null;
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return { d, h, m, ms };
  };
  const [remaining, setRemaining] = useState(getRemaining);
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setRemaining(getRemaining()), 60000);
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
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    }} onClick={onClose}>
      <div style={{
        ...GLASS_STRONG, borderRadius: '28px 28px 0 0',
        width: '100%', padding: '24px 20px 48px',
        maxHeight: '85vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 52 }}>{event.emoji ?? '🎉'}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: T.textSec }}>✕</button>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.textPri, marginBottom: 12, lineHeight: '26px' }}>{event.title}</div>
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
        </div>
        {event.deadline && (
          <div style={{ marginBottom: 16 }}>
            <CountdownChip deadline={event.deadline} />
          </div>
        )}
        {event.description && (
          <div style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 14, padding: 14, marginBottom: 20, border: '1px solid rgba(255,255,255,0.12)' }}>
            <p style={{ color: T.textSec, fontSize: 14, lineHeight: '22px', margin: 0 }}>{event.description}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {event.address && (
            <button onClick={() => window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(event.address)}`, '_blank')} style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #FF6600, #FF8C00)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              🗺️ Проложить маршрут
            </button>
          )}
          {event.socialUrl && (
            <button onClick={() => window.open(event.socialUrl, '_blank')} style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.blue}, #2D6FBC)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              📲 Перейти к событию
            </button>
          )}
          <button onClick={onClose} style={{ width: '100%', padding: '15px 0', borderRadius: 14, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', color: T.textSec, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function EventListCard({ event, index, onClick }) {
  const grad = GRADIENTS[(event.id?.charCodeAt(0) ?? 0) % GRADIENTS.length];
  return (
    <div
      onClick={() => onClick(event)}
      style={{
        background: grad, backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', borderRadius: 24, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.13)', cursor: 'pointer',
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
        <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, lineHeight: '19px', marginBottom: 6 }}>
          {event.title}
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

export function EventsPage({ nav, events = [], onBack }) {
  const [selectedEvent, setSelectedEvent] = useState(null);

  return (
    <Panel id={nav}>
      <div style={{ position: 'sticky', top: 'var(--safe-top, 0px)', zIndex: 50, background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>✦ События</div>
            {events.length > 0 && <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>{events.length} {events.length === 1 ? 'событие' : events.length < 5 ? 'события' : 'событий'}</div>}
          </div>
        </div>
      </div>

      <div style={{ background: T.bg, minHeight: '100%' }}>

        {/* Счётчик */}

        {events.length === 0 ? (
          <div style={{ margin: '32px 16px', ...GLASS, borderRadius: 24, padding: '36px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ animation: 'float 3.5s ease-in-out infinite' }}>
              <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                <rect x="10" y="22" width="70" height="60" rx="12" fill="rgba(201,168,76,0.07)" stroke="rgba(201,168,76,0.22)" strokeWidth="1.5"/>
                <rect x="10" y="22" width="70" height="23" rx="12" fill="rgba(201,168,76,0.11)"/>
                <rect x="10" y="35" width="70" height="10" fill="rgba(201,168,76,0.11)"/>
                <rect x="25" y="12" width="7" height="19" rx="3.5" fill="rgba(201,168,76,0.65)"/>
                <rect x="58" y="12" width="7" height="19" rx="3.5" fill="rgba(201,168,76,0.65)"/>
                <circle cx="30" cy="56" r="3.5" fill="rgba(201,168,76,0.28)"/>
                <circle cx="45" cy="56" r="3.5" fill="rgba(201,168,76,0.28)"/>
                <circle cx="60" cy="56" r="3.5" fill="rgba(201,168,76,0.28)"/>
                <circle cx="45" cy="70" r="5" fill="rgba(201,168,76,0.82)"/>
              </svg>
            </div>
            <div>
              <div style={{ color: T.textPri, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Скоро будут события</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Партнёры АПГ готовят кое-что интересное</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 16px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.map((event, i) => (
              <EventListCard key={event.id} event={event} index={i} onClick={setSelectedEvent} />
            ))}
          </div>
        )}

      </div>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </Panel>
  );
}
