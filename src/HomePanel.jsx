import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TASKS } from './tasks.js';
import { getLevel, getNextLevel, getLevelProgress, getKeysToNext } from './levels.js';
import { Panel, Avatar, Button, HorizontalScroll } from '@vkontakte/vkui';
import { T, GLASS, GLASS_STRONG, GLASS_GOLD } from './design.js';
import vkBridge from './vk.js';

const CATEGORIES = [
  { id: 'all',           label: 'Все',          emoji: '✦' },
  { id: 'food',          label: 'Еда',          emoji: '🍕' },
  { id: 'beauty',        label: 'Красота',       emoji: '💄' },
  { id: 'sport',         label: 'Спорт',         emoji: '💪' },
  { id: 'education',     label: 'Обучение',      emoji: '📚' },
  { id: 'entertainment', label: 'Развлечения',   emoji: '🎉' },
  { id: 'health',        label: 'Здоровье',      emoji: '🏥' },
  { id: 'home',          label: 'Дом и ремонт',  emoji: '🏠' },
  { id: 'pets',          label: 'Животные',      emoji: '🐾' },
  { id: 'fashion',       label: 'Одежда',        emoji: '👗' },
  { id: 'auto',          label: 'Авто',          emoji: '🚗' },
  { id: 'services',      label: 'Услуги',        emoji: '💼' },
  { id: 'other',         label: 'Другое',        emoji: '📦' },
];

// ─── Модальное окно события ───────────────────────────────────────────────────

function EventModal({ event, onClose }) {
  if (!event) return null;

  const modal = (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', zIndex: 9999,
      display: 'flex', alignItems: 'flex-end',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: T.surface,
        backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        borderRadius: '24px 24px 0 0',
        width: '100%', padding: '24px 20px 48px',
        maxHeight: '85vh', overflowY: 'auto',
        border: '1px solid var(--c-header-border, rgba(255,255,255,0.1))',
        borderBottom: 'none',
      }} onClick={e => e.stopPropagation()}>

        {/* Ручка */}
        <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Обложка события */}
        {event.imageUrl && (
          <div style={{ margin: '-24px -20px 20px', overflow: 'hidden', borderRadius: '0' }}>
            <img src={event.imageUrl} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} onError={e => e.target.style.display='none'} />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 52 }}>{event.emoji ?? '🎉'}</div>
          <button onClick={onClose} style={{
            background: T.chipBg, border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: T.textSec,
          }}>✕</button>
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: T.textPri, marginBottom: 12, lineHeight: '26px' }}>
          {event.title}
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
        </div>

        {event.description && (
          <div style={{
            background: T.chipBg, borderRadius: 14,
            padding: 14, marginBottom: 20,
            border: `1px solid ${T.border}`,
          }}>
            <p style={{ color: T.textSec, fontSize: 14, lineHeight: '22px', margin: 0 }}>{event.description}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {event.address && (
            <button onClick={() => window.open(`https://yandex.ru/maps/?text=${encodeURIComponent(event.address)}`, '_blank')} style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #FF6600, #FF8C00)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              🗺️ Проложить маршрут
            </button>
          )}
          {event.socialUrl && (
            <button onClick={() => window.open(event.socialUrl, '_blank')} style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${T.blue}, #2D6FBC)`,
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              📲 Перейти к событию
            </button>
          )}
          <button onClick={onClose} style={{
            width: '100%', padding: '15px 0', borderRadius: 14,
            border: `1px solid ${T.border}`,
            background: T.chipBg, color: T.textSec,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

// ─── Карточка события ─────────────────────────────────────────────────────────

function EventCard({ event, onClick, index = 0, isDark = true }) {
  const gradientsDark = [
    'linear-gradient(135deg, #1a1a4e, #2d4a8a)',
    'linear-gradient(135deg, #1a3a1a, #2d6a3a)',
    'linear-gradient(135deg, #3a1a1a, #7a3030)',
    'linear-gradient(135deg, #2a1a3a, #5a2d7a)',
    'linear-gradient(135deg, #1a3a3a, #2d7a6a)',
  ];
  const gradientsLight = [
    'linear-gradient(135deg, rgba(74,144,217,0.12), rgba(74,144,217,0.06))',
    'linear-gradient(135deg, rgba(75,179,75,0.12), rgba(75,179,75,0.06))',
    'linear-gradient(135deg, rgba(230,70,70,0.12), rgba(230,70,70,0.06))',
    'linear-gradient(135deg, rgba(142,68,173,0.12), rgba(142,68,173,0.06))',
    'linear-gradient(135deg, rgba(26,188,156,0.12), rgba(26,188,156,0.06))',
  ];
  const gradients = isDark ? gradientsDark : gradientsLight;
  const grad = gradients[(event.id?.charCodeAt(0) ?? 0) % gradients.length];

  return (
    <div onClick={() => onClick(event)} style={{
      minWidth: 200, borderRadius: 20, overflow: 'hidden',
      background: grad, flexShrink: 0, cursor: 'pointer',
      border: `1px solid ${T.border}`,
      position: 'relative',
      animation: 'fadeInUp 0.4s ease both',
      animationDelay: `${index * 0.08}s`,
    }}>
      {/* Золотая полоска сверху */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${T.gold}, transparent)` }} />

      <div style={{ padding: '16px 14px 14px' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>{event.emoji ?? '🎉'}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 6, lineHeight: '18px' }}>
          {event.title}
        </div>
        {event.date && (
          <div style={{ fontSize: 11, color: T.gold, fontWeight: 600, marginBottom: 2 }}>
            📅 {event.date}
          </div>
        )}
        {event.partner && (
          <div style={{ fontSize: 11, color: T.textSec }}>📍 {event.partner}</div>
        )}
        <div style={{ marginTop: 10, fontSize: 11, color: T.gold, fontWeight: 700 }}>
          Подробнее →
        </div>
      </div>
    </div>
  );
}

// ─── Логотип партнёра с fallback на инициалы ────────────────────────────────

function PartnerLogo({ partner, size = 56 }) {
  const [failed, setFailed] = useState(false);
  const name = partner.name ?? '?';
  const initial = name[0].toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  if (!partner.logoUrl || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue},50%,52%), hsl(${hue},42%,44%))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.38), fontWeight: 800,
        color: '#fff',
        border: `1.5px solid ${T.border}`,
      }}>
        {initial}
      </div>
    );
  }
  return (
    <img
      src={partner.logoUrl} alt={name} loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${T.border}`, display: 'block', flexShrink: 0 }}
    />
  );
}

// ─── Карточка партнёра ────────────────────────────────────────────────────────

function PartnerCard({ partner, isFavorite, onOpen, onToggleFavorite, index = 0 }) {
  const isNew = (() => {
    if (!partner.createdAt) return false;
    const ts = partner.createdAt.toDate ? partner.createdAt.toDate() : new Date(partner.createdAt);
    return Date.now() - ts.getTime() < 14 * 24 * 60 * 60 * 1000;
  })();

  return (
    <div style={{
      ...GLASS,
      borderRadius: 20, padding: 16, textAlign: 'center',
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden',
      animation: 'fadeInUp 0.45s ease both',
      animationDelay: `${index * 0.07}s`,
      height: '100%', boxSizing: 'border-box',
    }}>
      {/* Золотая точка если в избранном */}
      {isFavorite && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          width: 8, height: 8, borderRadius: '50%',
          background: T.gold, boxShadow: `0 0 6px ${T.gold}`,
        }} />
      )}
      {/* NEW бейдж */}
      {isNew && !partner.offer && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(74,144,217,0.2)', border: '1px solid rgba(74,144,217,0.5)',
          borderRadius: 8, padding: '2px 6px', fontSize: 10, fontWeight: 800, color: '#4A90D9',
        }}>✦ NEW</div>
      )}
      {/* Бейдж акции */}
      {partner.offer && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: T.green + '22', border: `1px solid ${T.green}55`,
          borderRadius: 8, padding: '2px 6px', fontSize: 10, fontWeight: 700, color: T.green,
        }}>🎁 акция</div>
      )}

      <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto' }}>
        <PartnerLogo partner={partner} size={56} />
        <button onClick={() => onToggleFavorite(partner.id)} style={{
          position: 'absolute', top: -4, right: -4,
          background: isFavorite ? T.red : T.chipBg,
          border: `1px solid ${isFavorite ? T.red : T.border}`,
          borderRadius: '50%', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 10, padding: 0, color: isFavorite ? '#fff' : T.textPri,
        }}>
          {isFavorite ? '♥' : '♡'}
        </button>
        {partner.visitCount > 0 && (
          <div style={{
            position: 'absolute', bottom: -4, left: -4,
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: '1px 5px',
            fontSize: 9, fontWeight: 700, color: T.textSec, lineHeight: '14px',
          }}>×{partner.visitCount}</div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, lineHeight: '16px', marginBottom: 3 }}>
          {partner.name ?? 'Партнёр'}
        </div>
        {partner.avgRating > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: '#FFD700', letterSpacing: 0.5 }}>
              {'★'.repeat(Math.round(partner.avgRating))}{'☆'.repeat(5 - Math.round(partner.avgRating))}
            </span>
            <span style={{ fontSize: 10, color: T.textSec }}>{partner.avgRating.toFixed(1)}</span>
          </div>
        ) : partner.categoryLabel ? (
          <div style={{ fontSize: 10, color: T.gold }}>
            {CATEGORIES.find(c => c.id === partner.category)?.emoji} {partner.categoryLabel}
          </div>
        ) : null}
      </div>

      {partner.stampTarget > 0 && (() => {
        const filled = Math.min(partner.visitCount ?? 0, partner.stampTarget);
        const pct = (filled / partner.stampTarget) * 100;
        const done = filled >= partner.stampTarget;
        return (
          <div style={{ width: '100%', marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 9, color: done ? T.gold : T.textSec, fontWeight: 700 }}>🎟️ Штамп</span>
              <span style={{ fontSize: 9, color: done ? T.gold : T.textSec, fontWeight: 700 }}>{filled}/{partner.stampTarget}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: T.border, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: done ? T.gold : 'rgba(201,168,76,0.5)', transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })()}

      <button onClick={() => onOpen(partner)} style={{
        width: '100%', padding: '9px 0', borderRadius: 12, border: 'none',
        background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
        color: '#0F0F1A', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        marginTop: 'auto',
      }}>
        Подробнее
      </button>
    </div>
  );
}

// ─── Партнёр дня ─────────────────────────────────────────────────────────────

function FeaturedPartnerCard({ partner, onOpen }) {
  return (
    <div style={{ margin: '0 16px 4px', animation: 'fadeInUp 0.4s ease both' }}>
      <button onClick={() => onOpen(partner)} style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: 0, background: 'none',
      }}>
        <div style={{
          borderRadius: 24,
          ...GLASS_GOLD,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          {/* Метка */}
          <div style={{ flexShrink: 0 }}>
            <PartnerLogo partner={partner} size={52} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#FFD700', letterSpacing: 1.2, textTransform: 'uppercase' }}>⭐ Партнёр дня</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#FFD700', background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 6, padding: '1px 6px' }}>+2 🗝️</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>{partner.name}</div>
            {partner.offer && (
              <div style={{ fontSize: 12, color: T.textSec, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🎁 {partner.offer}
              </div>
            )}
          </div>

          <div style={{ fontSize: 18, color: T.textSec, flexShrink: 0 }}>›</div>
        </div>
      </button>
    </div>
  );
}

// ─── Новостной виджет ────────────────────────────────────────────────────────

function NewsModal({ item, onClose }) {
  const [dragY, setDragY]           = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchY      = useRef(null);
  const sheetRef    = useRef(null);
  const scrollRef   = useRef(null);
  const closeTimer  = useRef(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const THRESHOLD = 110;

  // Non-passive touchmove: intercept downward drag only when inner scroll is at top
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const onMove = (e) => {
      if (touchY.current === null) return;
      const dy = e.touches[0].clientY - touchY.current;
      if (dy <= 0) return;
      if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
      e.preventDefault();
      setDragY(Math.min(dy, 420));
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, []);

  const onTouchStart = (e) => {
    touchY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const onTouchEnd = (e) => {
    if (touchY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    setIsDragging(false);
    if (dy >= THRESHOLD) {
      setDragY(700);
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(onClose, 300);
    } else {
      setDragY(0);
    }
  };

  const dateStr = item.createdAt?.toDate
    ? item.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const pct = Math.max(0, 1 - dragY / 280);

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: `rgba(0,0,0,${(0.72 * pct).toFixed(2)})`,
        display: 'flex', alignItems: 'flex-end',
        backdropFilter: `blur(${(6 * pct).toFixed(1)}px)`,
        WebkitBackdropFilter: `blur(${(6 * pct).toFixed(1)}px)`,
      }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface,
          backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
          borderRadius: '24px 24px 0 0',
          width: '100%', maxHeight: '88vh',
          border: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', borderBottom: 'none',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.32s cubic-bezier(0.2,0,0,1)',
          willChange: 'transform',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Ручка — всегда активна для свайпа */}
        <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, margin: '14px auto 6px', flexShrink: 0 }} />

        {/* Скроллируемый контент */}
        <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1 }}>
          {item.imageUrl && (
            <img src={item.imageUrl} alt="" onError={e => { e.target.style.display = 'none'; }}
              style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block', marginTop: 8 }} />
          )}
          <div style={{ padding: '20px 20px 48px' }}>
            {!item.imageUrl && item.emoji && <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>{item.emoji}</div>}
            <div style={{ fontSize: 22, fontWeight: 900, color: T.textPri, lineHeight: 1.3, marginBottom: 12, letterSpacing: -0.4 }}>{item.title}</div>
            {dateStr && <div style={{ fontSize: 11, color: T.textSec, marginBottom: 14 }}>{dateStr}</div>}
            <div style={{ fontSize: 15, color: T.textSec, lineHeight: '24px', whiteSpace: 'pre-wrap' }}>{item.text}</div>
            {item.linkUrl && item.linkLabel && (
              <a
                href={item.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  marginTop: 24,
                  padding: '16px 18px',
                  background: T.chipBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  color: T.textPri,
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: 'none',
                  textAlign: 'center',
                }}
              >
                {item.linkLabel} →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

function NewsWidget({ news }) {
  const [idx, setIdx]         = useState(0);
  const [modal, setModal]     = useState(null);
  const [offset, setOffset]   = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const widgetBodyRef = useRef(null);
  const touchY   = useRef(null);
  const idxRef   = useRef(0);

  const ITEM_H    = 270;
  const THRESHOLD = 55;

  const goTo = useCallback((newIdx) => {
    const clamped = Math.max(0, Math.min(news.length - 1, newIdx));
    idxRef.current = clamped;
    setIdx(clamped);
    setOffset(0);
    setIsDragging(false);
  }, [news.length]);

  // Non-passive touchmove: prevents page scroll while swiping inside the widget
  useEffect(() => {
    const el = widgetBodyRef.current;
    if (!el) return;
    const onMove = (e) => {
      if (touchY.current === null) return;
      e.preventDefault();
      const dy = e.touches[0].clientY - touchY.current;
      const cur = idxRef.current;
      const atEdge = (cur === 0 && dy > 0) || (cur === news.length - 1 && dy < 0);
      setOffset(atEdge ? dy * 0.2 : dy);
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [news.length]);

  if (!news.length) return null;

  const onTouchStart = (e) => {
    touchY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const onTouchEnd = (e) => {
    if (touchY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    if (dy < -THRESHOLD && idxRef.current < news.length - 1) goTo(idxRef.current + 1);
    else if (dy > THRESHOLD && idxRef.current > 0) goTo(idxRef.current - 1);
    else { setOffset(0); setIsDragging(false); }
  };

  return (
    <>
      <div style={{ margin: '8px 16px 0', ...GLASS_STRONG, borderRadius: 24, overflow: 'hidden', position: 'relative', animation: 'fadeInUp 0.4s ease both' }}>

        {/* Шапка виджета */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 10px' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: T.gold, letterSpacing: 2.5, textTransform: 'uppercase' }}>✦ Новости АПГ</span>
          {news.length > 1 && <span style={{ fontSize: 11, color: T.textSec, fontWeight: 600 }}>{idx + 1} / {news.length}</span>}
        </div>

        {/* Вертикальный слайдер */}
        <div
          ref={widgetBodyRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ height: ITEM_H, overflow: 'hidden', position: 'relative' }}
        >
          <div style={{
            transform: `translateY(${-idx * ITEM_H + offset}px)`,
            transition: isDragging ? 'none' : 'transform 0.32s cubic-bezier(0.2,0,0,1)',
          }}>
            {news.map((n) => {
              const ds = n.createdAt?.toDate
                ? n.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
                : n.createdAt
                ? new Date(n.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
                : '';
              return (
                <div key={n.id} style={{ height: ITEM_H, display: 'flex', flexDirection: 'column', padding: '0 16px' }}>
                  {n.imageUrl ? (
                    <div style={{ margin: '0 -16px 12px', position: 'relative', flexShrink: 0 }}>
                      <img src={n.imageUrl} alt="" onError={e => { e.target.style.display = 'none'; }}
                        style={{ width: '100%', height: 132, objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,8,26,0.55) 0%, transparent 55%)', pointerEvents: 'none' }} />
                    </div>
                  ) : (
                    n.emoji && <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 10, flexShrink: 0 }}>{n.emoji}</div>
                  )}
                  <div style={{ fontSize: 17, fontWeight: 900, color: T.textPri, lineHeight: 1.35, marginBottom: 8, letterSpacing: -0.3, flexShrink: 0 }}>
                    {n.imageUrl && n.emoji && <span style={{ marginRight: 6 }}>{n.emoji}</span>}
                    {n.title}
                  </div>
                  <div style={{ fontSize: 13, color: T.textSec, lineHeight: '20px', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: n.imageUrl ? 3 : 4, WebkitBoxOrient: 'vertical' }}>
                    {n.text}
                  </div>
                  {ds && <div style={{ fontSize: 11, color: T.textSec, marginTop: 8, flexShrink: 0 }}>{ds}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Подвал: вертикальные точки + кнопка */}
        <div style={{ padding: '10px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {news.length > 1 && news.map((_, i) => (
              <div key={i} onClick={() => goTo(i)} style={{
                width: 6,
                height: i === idx ? 20 : 6,
                borderRadius: 3,
                cursor: 'pointer',
                background: i === idx ? T.gold : T.border,
                transition: 'all 0.25s ease',
              }} />
            ))}
          </div>
          <button onClick={() => setModal(news[idx])} style={{
            background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
            color: '#0F0F1A', border: 'none', borderRadius: 14,
            padding: '9px 18px', fontSize: 13, fontWeight: 800,
            cursor: 'pointer', flexShrink: 0, letterSpacing: 0.3,
            boxShadow: `0 4px 14px rgba(201,168,76,0.35)`,
            marginLeft: news.length > 1 ? 0 : 'auto',
          }}>
            Подробнее
          </button>
        </div>
      </div>

      {modal && <NewsModal item={modal} onClose={() => setModal(null)} />}
    </>
  );
}

function NewsFeed({ news }) {
  return <NewsWidget news={news} />;
}

// ─── Баннер ───────────────────────────────────────────────────────────────────

function HeroBanner({ userKeys, userName, streak }) {
  const level    = getLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const pct      = getLevelProgress(userKeys);
  const toNext   = getKeysToNext(userKeys);

  return (
    <div style={{
      margin: '8px 16px',
      borderRadius: 28,
      ...GLASS_STRONG,
      padding: '22px 20px 20px',
      position: 'relative', overflow: 'hidden',
      animation: 'fadeInUp 0.5s ease both',
    }}>
      {/* Лёгкий золотой gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(201,168,76,0.06) 0%, transparent 60%)', pointerEvents: 'none', borderRadius: 28 }} />
      <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}28, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10, opacity: 0.85 }}>
          ✦ Альянс Партнёров Города
        </div>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: T.textSec, fontWeight: 500, marginBottom: 2 }}>Добро пожаловать,</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T.textPri, lineHeight: 1.15, letterSpacing: -0.5 }}>
              {userName ?? 'участник'} 👋
            </div>
          </div>
          {streak >= 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,100,0,0.15)', border: '1px solid rgba(255,100,0,0.35)', borderRadius: 12, padding: '6px 10px', gap: 1 }}>
              <span style={{ fontSize: 18 }}>🔥</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#FF8C42' }}>{streak}</span>
              <span style={{ fontSize: 8, color: T.textSec, textTransform: 'uppercase', letterSpacing: 0.3 }}>дней</span>
            </div>
          )}
        </div>

        {/* Уровень + ключи */}
        <div style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 18, padding: '14px 16px', border: `1px solid ${level.color}44`, boxShadow: `inset 0 1.5px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.2)` }}>

          {/* Верхняя строка: уровень и счётчик */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `${level.color}30`, border: `1px solid ${level.color}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {level.emoji}
              </div>
              <div>
                <div style={{ fontSize: 11, color: level.color, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{level.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: T.textPri, lineHeight: 1, letterSpacing: -0.5 }}>
                  {userKeys} <span style={{ fontSize: 14, fontWeight: 700, color: T.goldL }}>🗝️</span>
                </div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 3 }}>
                  {nextLevel ? `До ${nextLevel.label}: ${toNext} ключей` : 'Максимальный уровень 👑'}
                </div>
              </div>
            </div>
            {nextLevel && (
              <div style={{ textAlign: 'center', background: T.chipBg, borderRadius: 10, padding: '6px 10px', border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, color: T.textSec, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>следующий</div>
                <div style={{ fontSize: 16 }}>{nextLevel.emoji}</div>
                <div style={{ fontSize: 9, color: T.textPri, fontWeight: 700 }}>{nextLevel.label}</div>
              </div>
            )}
          </div>

          {/* Прогресс-бар */}
          <div style={{ height: 8, background: T.border, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg, ${level.color}, ${T.goldL})`,
              borderRadius: 8, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: `0 0 12px ${level.color}`,
            }} />
          </div>

          {/* Подпись */}
          <div style={{ fontSize: 12, color: T.textPri, textAlign: 'center', fontWeight: 600 }}>
            {nextLevel
              ? `До ${nextLevel.emoji} ${nextLevel.label}: ещё ${toNext} ключей`
              : '👑 Максимальный уровень — вы Амбассадор АПГ!'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Стрик ───────────────────────────────────────────────────────────────────

const STREAK_MILESTONES = [3, 7, 30];

function StreakWidget({ streak, lastScanDate, onOpenTasks }) {
  if (streak < 1) return null;
  const todayKey = new Date().toISOString().slice(0, 10);
  const scannedToday = lastScanDate === todayKey;

  const nextMilestone = STREAK_MILESTONES.find(m => streak < m) ?? null;
  const daysLeft = nextMilestone ? nextMilestone - streak : 0;

  // Показываем 7 точек: последние дни серии + сегодня
  const totalDots = 7;
  const dots = Array.from({ length: totalDots }, (_, i) => {
    const daysAgo = totalDots - 1 - i; // 6..0
    if (daysAgo === 0) return scannedToday ? 'done' : 'today';
    return streak > daysAgo ? 'done' : 'empty';
  });

  const flameSize = streak >= 30 ? 28 : streak >= 7 ? 24 : 20;

  return (
    <div style={{ margin: '10px 16px 0', borderRadius: 24, padding: '14px 16px', background: T.chipBg, backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', border: '1px solid rgba(255,100,0,0.22)', boxShadow: '0 8px 28px rgba(0,0,0,0.18), inset 0 1.5px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeInUp 0.4s ease both' }}>
      {/* Иконка пламени */}
      <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,100,0,0.15)', border: '1px solid rgba(255,100,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: flameSize, flexShrink: 0 }}>
        🔥
      </div>

      {/* Контент */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#FF8C42', lineHeight: 1 }}>{streak}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,140,66,0.8)', fontWeight: 600 }}>{streak === 1 ? 'день подряд' : streak < 5 ? 'дня подряд' : 'дней подряд'}</span>
        </div>

        {/* Точки-дни */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
          {dots.map((state, i) => (
            <div key={i} style={{
              width: state === 'done' ? 18 : 16,
              height: state === 'done' ? 18 : 16,
              borderRadius: '50%',
              background: state === 'done' ? 'linear-gradient(135deg, #FF8C42, #FF4500)' : state === 'today' ? 'rgba(255,140,66,0.2)' : T.border,
              border: state === 'today' ? '2px dashed rgba(255,140,66,0.6)' : state === 'done' ? '2px solid rgba(255,140,66,0.6)' : `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, transition: 'all 0.3s',
              boxShadow: state === 'done' ? '0 0 6px rgba(255,140,66,0.4)' : 'none',
            }}>
              {state === 'done' ? '✓' : ''}
            </div>
          ))}
        </div>

        {/* Подсказка */}
        {scannedToday
          ? <div style={{ fontSize: 11, color: T.textSec }}>{nextMilestone ? `До задания «${nextMilestone} дней»: ещё ${daysLeft}` : '🏆 Рекорд! Так держать!'}</div>
          : <div style={{ fontSize: 11, color: '#FF8C42', fontWeight: 600 }}>Посети партнёра сегодня, чтобы не потерять серию</div>
        }
      </div>

      {/* Кнопка к заданиям */}
      {nextMilestone && (
        <button onClick={onOpenTasks} style={{ background: 'rgba(255,100,0,0.15)', border: '1px solid rgba(255,100,0,0.3)', borderRadius: 10, padding: '6px 10px', color: '#FF8C42', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, textAlign: 'center', lineHeight: '14px' }}>
          🎁<br/>{daysLeft}д
        </button>
      )}
    </div>
  );
}

// ─── Быстрые действия ────────────────────────────────────────────────────────

function QuickActions({ onShare, onOpenLeaderboard, onOpenEvents, onOpenTasks, onOpenRewards, userRank }) {
  const actions = [
    { icon: '🗓️', label: 'События',               color: T.blue,    onClick: onOpenEvents },
    { icon: '✦',  label: 'Задания',               color: '#9B7EDF', onClick: onOpenTasks },
    { icon: '🏆', label: 'Рейтинг', rank: userRank, color: T.gold,    onClick: onOpenLeaderboard },
    { icon: '🎁', label: 'Призы',                 color: T.green,   onClick: onOpenRewards },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 16px' }}>
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick} style={{
          ...GLASS,
          borderRadius: 20, padding: '13px 4px',
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 7, position: 'relative',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 14,
            background: `linear-gradient(145deg, ${a.color}28, ${a.color}10)`,
            border: `1px solid ${a.color}35`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px ${a.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            {a.icon}
          </div>
          <span style={{ color: T.textSec, fontSize: 10, fontWeight: 600 }}>{a.label}</span>
          {a.rank != null && (
            <div style={{
              position: 'absolute', top: 6, right: 6,
              background: T.gold, borderRadius: 8, padding: '1px 5px',
              fontSize: 9, fontWeight: 800, color: '#0F0F1A', lineHeight: '14px',
            }}>#{a.rank}</div>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Логотип ─────────────────────────────────────────────────────────────────

function ApgLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <rect x="0.75" y="0.75" width="28.5" height="28.5" rx="8" fill="rgba(201,168,76,0.12)" stroke="rgba(201,168,76,0.45)" strokeWidth="1.5"/>
        <polygon points="15,4 24,15 15,26 6,15" fill="rgba(201,168,76,0.07)" stroke="#C9A84C" strokeWidth="1.3"/>
        <line x1="15" y1="4" x2="15" y2="26" stroke="rgba(201,168,76,0.22)" strokeWidth="0.8"/>
        <line x1="6" y1="15" x2="24" y2="15" stroke="rgba(201,168,76,0.22)" strokeWidth="0.8"/>
        <circle cx="15" cy="15" r="2.8" fill="#C9A84C"/>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ color: '#C9A84C', fontWeight: 800, fontSize: 17, letterSpacing: 2, lineHeight: 1 }}>АПГ</span>
          <span style={{ color: 'rgba(201,168,76,0.6)', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1 }}>Зеленоград</span>
        </div>
        <span style={{ color: 'rgba(201,168,76,0.45)', fontSize: 7.5, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', lineHeight: 1 }}>Альянс Партнёров Города</span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skel({ w = '100%', h = 16, radius = 8, style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, flexShrink: 0,
      background: `linear-gradient(90deg, ${T.border} 0%, rgba(201,168,76,0.08) 50%, ${T.border} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      ...extra,
    }} />
  );
}

function SkeletonHome() {
  return (
    <div>
      {/* Hero */}
      <div style={{ margin: '8px 16px', borderRadius: 24, ...GLASS, padding: '22px 20px' }}>
        <Skel h={11} w={140} radius={6} style={{ marginBottom: 10 }} />
        <Skel h={26} w={190} radius={8} style={{ marginBottom: 4 }} />
        <Skel h={18} w={110} radius={8} style={{ marginBottom: 18 }} />
        <div style={{ background: T.chipBg, borderRadius: 14, padding: '12px 14px' }}>
          <Skel h={14} w={160} radius={6} style={{ marginBottom: 10 }} />
          <Skel h={5} radius={3} />
        </div>
      </div>

      {/* QuickActions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '12px 16px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ ...GLASS, borderRadius: 16, padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Skel w={38} h={38} radius={12} />
            <Skel w={32} h={10} radius={5} />
          </div>
        ))}
      </div>

      {/* Partners */}
      <div style={{ padding: '20px 16px 8px' }}>
        <Skel h={18} w={140} radius={8} style={{ marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ ...GLASS, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Skel w={56} h={56} radius={28} />
              <Skel h={13} w={80} radius={6} />
              <Skel h={10} w={56} radius={5} />
              <Skel h={34} radius={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Закрытые мероприятия ─────────────────────────────────────────────────────

function calcTimeLeft(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function PrivateEventCard({ event, userKeys, isRegistered, onRegister }) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(event.eventDate));

  useEffect(() => {
    if (!event.eventDate) return;
    const id = setInterval(() => setTimeLeft(calcTimeLeft(event.eventDate)), 1000);
    return () => clearInterval(id);
  }, [event.eventDate]);

  const minKeys = event.minKeys ?? 0;
  const hasEnough = minKeys === 0 || userKeys >= minKeys;
  const isFull = event.maxParticipants > 0 && (event.registeredCount ?? 0) >= event.maxParticipants;
  const isPast = timeLeft === null && !!event.eventDate;
  const need = minKeys - userKeys;

  return (
    <div style={{ margin: '16px 16px 0', ...GLASS_GOLD, borderRadius: 24, padding: '18px 18px 16px' }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>{event.emoji ?? '🎉'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>✦ Следующее мероприятие АПГ</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: '19px' }}>{event.title}</div>
          </div>
        </div>
        {isRegistered && (
          <div style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.green + '18', border: `1px solid ${T.green}40`, borderRadius: 10, padding: '4px 9px', flexShrink: 0 }}>✓ Записан</div>
        )}
      </div>

      {/* Таймер обратного отсчёта */}
      {!isPast && event.eventDate && timeLeft && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
          {[
            { v: timeLeft.days,    l: 'дн'  },
            { v: timeLeft.hours,   l: 'ч'   },
            { v: timeLeft.minutes, l: 'мин' },
            { v: timeLeft.seconds, l: 'сек' },
          ].map(({ v, l }) => (
            <div key={l} style={{ flex: 1, ...GLASS, borderRadius: 14, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: T.textPri, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{String(v).padStart(2, '0')}</div>
              <div style={{ fontSize: 9, color: T.textSec, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {isPast && (
        <div style={{ fontSize: 12, color: T.textSec, textAlign: 'center', marginBottom: 12 }}>Мероприятие состоялось</div>
      )}

      {/* Прогресс ключей */}
      {minKeys > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: T.textSec }}>Прогресс к порогу</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: hasEnough ? T.green : T.gold }}>
              {Math.min(userKeys, minKeys)} / {minKeys} 🗝️
            </span>
          </div>
          <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.min((userKeys / minKeys) * 100, 100)}%`,
              background: hasEnough
                ? `linear-gradient(90deg, ${T.green}, #6ECC6E)`
                : `linear-gradient(90deg, ${T.gold}, ${T.goldL})`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Кнопка */}
      {isRegistered ? (
        <button onClick={() => onRegister(event)} style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: `1px solid ${T.green}40`, background: T.green + '12', color: T.green, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          ✓ Я записан — отменить?
        </button>
      ) : isFull ? (
        <div style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: T.chipBg, border: `1px solid ${T.border}`, color: T.textSec, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
          Мест нет
        </div>
      ) : isPast ? null : hasEnough ? (
        <button onClick={() => onRegister(event)} style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
          Я иду! 🎉
        </button>
      ) : (
        <div style={{ width: '100%', padding: '12px 0', borderRadius: 14, background: T.chipBg, border: `1px solid ${T.border}`, color: T.textSec, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
          Нужно ещё {need} {need === 1 ? 'ключ' : need < 5 ? 'ключа' : 'ключей'} 🗝️
        </div>
      )}

      {/* Дата, место и поделиться */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div style={{ fontSize: 11, color: T.textSec }}>
          {event.date && `📅 ${event.date}`}{event.address && ` · ${event.address}`}
        </div>
        <button
          onClick={() => {
            const text = `🔒 Закрытое мероприятие АПГ: «${event.title}»${event.date ? ` — ${event.date}` : ''}. Нужно ${minKeys} ключей АПГ для входа!`;
            vkBridge.send('VKWebAppShare', { link: 'https://vk.com/app54601851', text }).catch(() => {});
          }}
          style={{ background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '5px 10px', fontSize: 11, color: T.textSec, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
        >
          ↗ Поделиться
        </button>
      </div>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

const VK_APP_URL = 'https://vk.com/app54601851';

function openVKApp() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href =
      'intent://vk.com/app54601851#Intent;scheme=https;package=com.vkontakte.android;' +
      'S.browser_fallback_url=' + encodeURIComponent(VK_APP_URL) + ';end';
    return;
  }
  window.location.href = VK_APP_URL;
}

export function HomePanel({
  user, userKeys = 0, favorites = [], partners = [], events = [], news = [], recentReviews = [],
  loading = false, error = null, streak = 0, lastScanDate = null,
  completedTasks = [], referralCount = 0, scannedCount = 0, unreadCount = 0, isWebMode = false,
  registeredEventIds = [], onEventRegister, userRank = null, customTasks = [],
  appearance = 'light',
  joinedGroup = false, onJoinGroup,
  onOpenPartner, onToggleFavorite, onScan, onShare, onOpenEvents, onOpenOffers, onOpenTasks, onOpenLeaderboard, onRetry, onOpenNotifications, onRefresh, onOpenMap, onOpenRewards,
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Pull-to-refresh ────────────────────────────────────────────────────────
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef       = useRef(null);
  const touchStartY        = useRef(0);
  const touchStartScroll   = useRef(0);
  const pullYRef           = useRef(0);
  const isRefreshingRef    = useRef(false);

  const PULL_TRIGGER = 28; // dampened px to trigger refresh
  const PULL_DAMPEN  = 0.45;
  const PULL_MAX     = 56;

  const updatePull = (val) => { pullYRef.current = val; setPullY(val); };

  const handleTouchStart = useCallback((e) => {
    if (isRefreshingRef.current) return;
    touchStartScroll.current = window.scrollY;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (isRefreshingRef.current) return;
    // Проверяем текущую позицию скролла — если не в самом верху, PTR не активируем
    if (window.scrollY > 4) { updatePull(0); return; }
    if (touchStartScroll.current > 4) { updatePull(0); return; }
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy <= 0) { updatePull(0); return; }
    updatePull(Math.min(dy * PULL_DAMPEN, PULL_MAX));
  }, []);

  const handleTouchEnd = useCallback(async () => {
    const py = pullYRef.current;
    if (py >= PULL_TRIGGER) {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      updatePull(0);
      try { await onRefresh?.(); } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    } else {
      updatePull(0);
    }
  }, [onRefresh]);

  const featuredPartner = partners.find(p => p.featured === true) ?? null;

  const nextPrivateEvent = useMemo(() => {
    const privates = events.filter(e => e.isPrivate);
    if (!privates.length) return null;
    const nowMs = Date.now();
    const upcoming = privates
      .filter(e => e.eventDate && new Date(e.eventDate).getTime() > nowMs)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    if (upcoming.length) return upcoming[0];
    return privates.sort((a, b) => new Date(b.eventDate || 0) - new Date(a.eventDate || 0))[0] ?? null;
  }, [events]);

  const taskPreview = useMemo(() => {
    function checkCustom(t) {
      const v = t.target ?? 0;
      switch (t.type) {
        case 'keys':      return userKeys >= v;
        case 'favs':      return favorites.length >= v;
        case 'referrals': return referralCount >= v;
        case 'streak':    return streak >= v;
        case 'scanned':   return scannedCount >= v;
        case 'manual':    return true;
        default:          return false;
      }
    }
    const statuses = TASKS.map(t => ({
      ...t,
      done:  completedTasks.includes(t.id),
      ready: t.check(userKeys, favorites.length, referralCount, streak, scannedCount) && !completedTasks.includes(t.id),
      prog:  t.progress ? t.progress(userKeys, favorites.length, referralCount, streak, scannedCount) : 0,
    }));
    const customStatuses = customTasks.map(t => ({
      ...t,
      done:  completedTasks.includes(t.id),
      ready: checkCustom(t) && !completedTasks.includes(t.id),
      prog:  0,
    }));
    const all = [...statuses, ...customStatuses];
    const claimable  = all.filter(s => s.ready);
    const inProgress = all.filter(s => !s.done && !s.ready);
    return [...claimable, ...inProgress].slice(0, 2);
  }, [userKeys, favorites.length, referralCount, streak, scannedCount, completedTasks, customTasks]);

  const isSearching = searchQuery.trim().length > 0;
  const filteredPartners = useMemo(() => partners
    .filter(p => isSearching || activeCategory === 'all' || p.category === activeCategory)
    .filter(p => !isSearching || (() => {
      const q = searchQuery.trim().toLowerCase();
      return p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.categoryLabel?.toLowerCase().includes(q) ||
        p.offer?.toLowerCase().includes(q);
    })()), [partners, isSearching, activeCategory, searchQuery]);

  return (
    <Panel id="home">
      <div style={{ position:'sticky', top:0, zIndex:50, background:T.headerBg, backdropFilter:'blur(36px) saturate(2)', WebkitBackdropFilter:'blur(36px) saturate(2)', borderBottom:'1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow:'inset 0 -1px 0 rgba(0,0,0,0.2)', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52 }}>
        <ApgLogo />
        <button onClick={onOpenNotifications} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, position: 'relative', color: T.textSec, fontSize: 22, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          🔔
          {unreadCount > 0 && (
            <div style={{ position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, background: '#E64646', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', padding: '0 3px', border: '2px solid rgba(15,15,26,0.92)' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </button>
      </div>

      {/* Pull-to-refresh indicator */}
      <div style={{
        height: isRefreshing ? 52 : Math.round(pullY),
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: (isRefreshing || pullY === 0) ? 'height 0.3s ease' : 'none',
        background: 'transparent', pointerEvents: 'none',
      }}>
        {(pullY > 12 || isRefreshing) && (
          <>
            <span style={{
              fontSize: 18, display: 'inline-block', color: T.gold, lineHeight: 1,
              animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none',
              transform: isRefreshing ? 'none' : `rotate(${Math.min((pullY / PULL_TRIGGER) * 180, 180)}deg)`,
              transition: isRefreshing ? 'none' : 'transform 0.15s',
            }}>↻</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.gold }}>
              {isRefreshing ? 'Обновление...' : pullY >= PULL_TRIGGER ? 'Отпустите' : 'Потяните вниз'}
            </span>
          </>
        )}
      </div>

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ background: 'transparent', minHeight: '100%' }}
      >

        {loading && <SkeletonHome />}

        {!loading && error && (
          <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ animation: 'float 3s ease-in-out infinite' }}>
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="46" fill="rgba(230,70,70,0.05)" stroke="rgba(230,70,70,0.18)" strokeWidth="1.5"/>
                <path d="M22 52 C22 38 35 26 50 26 C65 26 78 38 78 52" stroke="rgba(230,70,70,0.35)" strokeWidth="3" strokeLinecap="round" fill="none"/>
                <path d="M31 60 C31 50 40 41 50 41 C60 41 69 50 69 60" stroke="rgba(230,70,70,0.55)" strokeWidth="3" strokeLinecap="round" fill="none"/>
                <line x1="43" y1="68" x2="57" y2="82" stroke="#E64646" strokeWidth="3" strokeLinecap="round"/>
                <line x1="57" y1="68" x2="43" y2="82" stroke="#E64646" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="50" cy="75" r="6" fill="rgba(230,70,70,0.1)"/>
              </svg>
            </div>
            <div>
              <div style={{ color: T.textPri, fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Нет подключения</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px', marginBottom: 20 }}>Проверьте интернет и попробуйте снова</div>
              <button onClick={onRetry} style={{
                padding: '13px 36px', borderRadius: 14, border: 'none',
                background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
                color: '#0F0F1A', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>Повторить</button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Демо-баннер для веб-версии */}
            {isWebMode && (
              <div style={{ margin: '10px 16px 0', borderRadius: 20, background: 'linear-gradient(135deg, rgba(39,135,245,0.14), rgba(39,135,245,0.06))', border: '1px solid rgba(39,135,245,0.28)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeInUp 0.4s ease both' }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>📱</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#5BA4F5', marginBottom: 2 }}>Демо-версия</div>
                  <div style={{ fontSize: 11, color: T.textSec, lineHeight: '15px' }}>Полный функционал — в приложении ВКонтакте</div>
                </div>
                <button
                  onClick={openVKApp}
                  style={{ background: 'rgba(39,135,245,0.2)', border: '1px solid rgba(39,135,245,0.4)', borderRadius: 12, padding: '7px 12px', color: '#5BA4F5', fontSize: 11, fontWeight: 800, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  Открыть ВК →
                </button>
              </div>
            )}

            {/* Новостная лента */}
            <NewsFeed news={news} />

            <StreakWidget streak={streak} lastScanDate={lastScanDate} onOpenTasks={onOpenTasks} />

            {/* Баннер подписки на сообщество ВКонтакте */}
            {!joinedGroup && (
              <div style={{ padding: '12px 16px 0' }}>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(74,144,217,0.13), rgba(120,80,220,0.10))',
                  border: '1px solid rgba(74,144,217,0.28)',
                  borderRadius: 20, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  animation: 'fadeInUp 0.3s ease',
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(74,144,217,0.25), rgba(120,80,220,0.2))',
                    border: '1px solid rgba(74,144,217,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                  }}>🤝</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 2 }}>
                      Вступи в сообщество АПГ
                    </div>
                    <div style={{ fontSize: 11, color: T.textSec, lineHeight: '15px' }}>
                      Новости, акции и события — и <span style={{ color: '#C9A84C', fontWeight: 700 }}>+1 🗝️</span> за подписку
                    </div>
                  </div>
                  <button
                    onClick={onJoinGroup}
                    style={{
                      background: 'linear-gradient(135deg, #4A90D9, #7850DC)',
                      border: 'none', borderRadius: 12, padding: '9px 14px',
                      color: '#fff', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                  >
                    Вступить
                  </button>
                </div>
              </div>
            )}

            <div style={{ padding: '12px 0 4px' }}>
              <QuickActions onShare={onShare} onOpenLeaderboard={onOpenLeaderboard} onOpenEvents={onOpenEvents} onOpenTasks={onOpenTasks} onOpenRewards={onOpenRewards} userRank={userRank} />
            </div>

            {/* Закрытое мероприятие АПГ */}
            {nextPrivateEvent && (
              <PrivateEventCard
                event={nextPrivateEvent}
                userKeys={userKeys}
                isRegistered={registeredEventIds.includes(nextPrivateEvent.id)}
                onRegister={onEventRegister}
              />
            )}

            {/* Партнёр дня */}
            {featuredPartner && (
              <FeaturedPartnerCard partner={featuredPartner} onOpen={onOpenPartner} />
            )}

            {/* Задания — превью */}
            {taskPreview.length > 0 && (
              <div style={{ padding: '20px 16px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>
                    <span style={{ color: T.gold }}>✦</span> Задания
                  </div>
                  <button onClick={onOpenTasks} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.gold, fontWeight: 700, padding: 0 }}>
                    Все →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {taskPreview.map(t => (
                    <button key={t.id} onClick={onOpenTasks} style={{
                      background: t.ready ? 'rgba(201,168,76,0.12)' : T.chipBg,
                      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                      border: `1px solid ${t.ready ? 'rgba(201,168,76,0.4)' : T.border}`,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                      borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{t.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{t.title}</div>
                        {t.total && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: t.ready ? `linear-gradient(90deg, ${T.gold}, ${T.goldL})` : T.textSec, borderRadius: 2, width: `${Math.round((t.prog / t.total) * 100)}%`, transition: 'width 0.5s' }} />
                            </div>
                            <div style={{ fontSize: 10, color: T.textSec, marginTop: 3 }}>{t.prog} / {t.total}</div>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: t.ready ? T.gold : T.textPri, background: t.ready ? 'rgba(201,168,76,0.15)' : T.chipBg, border: `1px solid ${t.ready ? 'rgba(201,168,76,0.3)' : T.border}`, borderRadius: 8, padding: '4px 9px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {t.ready ? '🎁 Забрать' : `+${t.reward} 🗝️`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* События */}
            <div style={{ padding: '20px 16px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>
                  <span style={{ color: T.gold }}>✦</span> Ближайшие события
                </div>
                {events.length > 0 && (
                  <button onClick={onOpenEvents} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: T.gold, fontWeight: 700, padding: 0,
                  }}>
                    Все →
                  </button>
                )}
              </div>
            </div>

            {events.length === 0 ? (
              <div style={{ margin: '0 16px', ...GLASS, borderRadius: 24, padding: '28px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
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
                    <circle cx="30" cy="70" r="3" fill="rgba(201,168,76,0.2)"/>
                    <circle cx="45" cy="70" r="5" fill="rgba(201,168,76,0.82)"/>
                    <circle cx="60" cy="70" r="3" fill="rgba(201,168,76,0.2)"/>
                    <rect x="76" y="10" width="5" height="5" rx="0.5" transform="rotate(45 78 12)" fill="rgba(201,168,76,0.7)"/>
                    <rect x="4" y="14" width="4" height="4" rx="0.5" transform="rotate(45 6 16)" fill="rgba(201,168,76,0.4)"/>
                  </svg>
                </div>
                <div>
                  <div style={{ color: T.textPri, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Скоро будут события</div>
                  <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Партнёры АПГ готовят кое-что интересное</div>
                </div>
              </div>
            ) : (
              <HorizontalScroll>
                <div style={{ display: 'flex', gap: 12, padding: '0 16px 4px' }}>
                  {events.map((e, i) => <EventCard key={e.id} event={e} index={i} onClick={setSelectedEvent} isDark={appearance === 'dark'} />)}
                </div>
              </HorizontalScroll>
            )}

            {/* Поиск */}
            <div style={{ padding: '20px 16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...GLASS, borderRadius: 14, padding: '10px 14px' }}>
                <span style={{ fontSize: 15, opacity: 0.7, flexShrink: 0 }}>🔍</span>
                <input
                  type="search"
                  placeholder="Найти партнёра..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: T.textPri, fontSize: 14, flex: 1, minWidth: 0 }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSec, fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>
                )}
              </div>
            </div>

            {/* Фильтр категорий */}
            <div style={{ padding: '10px 0 8px' }}>
              <HorizontalScroll>
                <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                      padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                      whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700,
                      background: activeCategory === cat.id
                        ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})`
                        : T.chipBg,
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      color: activeCategory === cat.id ? '#0F0F1A' : T.chipText,
                      border: activeCategory === cat.id
                        ? 'none'
                        : `1px solid ${T.chipBorder}`,
                    }}>
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </HorizontalScroll>
            </div>

            {/* Партнёры */}
            <div style={{ padding: '4px 16px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>
                  <span style={{ color: T.gold }}>✦</span> Партнёры АПГ
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {!isSearching && (
                    <button onClick={onOpenMap} style={{ padding: '4px 10px', borderRadius: 16, border: `1px solid rgba(74,144,217,0.35)`, background: 'rgba(74,144,217,0.1)', color: '#4A90D9', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      🗺️ Карта
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: isSearching ? T.gold : T.textSec, background: isSearching ? 'rgba(201,168,76,0.12)' : T.surface, padding: '4px 10px', borderRadius: 20, border: `1px solid ${isSearching ? 'rgba(201,168,76,0.3)' : T.border}`, transition: 'all 0.2s', fontWeight: isSearching ? 700 : 400 }}>
                    {isSearching ? `${filteredPartners.length} из ${partners.length}` : filteredPartners.length}
                  </div>
                </div>
              </div>

              {filteredPartners.length === 0 ? (
                <div style={{ borderRadius: 24, padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: T.chipBg, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 52, animation: 'float 3s ease-in-out infinite' }}>
                    {searchQuery.trim() ? '🔍' : '🏪'}
                  </div>
                  <div>
                    <div style={{ color: T.textPri, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                      {searchQuery.trim() ? 'Ничего не найдено' : 'Пока нет партнёров'}
                    </div>
                    <div style={{ color: T.textSec, fontSize: 13, lineHeight: '20px' }}>
                      {searchQuery.trim()
                        ? `По запросу «${searchQuery.trim()}» партнёры не найдены`
                        : 'В этой категории пока нет партнёров — загляните позже'}
                    </div>
                  </div>
                  {(searchQuery.trim() || activeCategory !== 'all') && (
                    <button
                      onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                      style={{ padding: '10px 24px', borderRadius: 12, background: 'rgba(201,168,76,0.15)', color: '#C9A84C', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(201,168,76,0.3)' }}
                    >
                      Сбросить фильтр
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {filteredPartners.map((p, i) => (
                    <PartnerCard
                      key={p.id} partner={p} index={i}
                      isFavorite={favorites.includes(p.id)}
                      onOpen={onOpenPartner}
                      onToggleFavorite={onToggleFavorite}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Свежие отзывы ── */}
            {recentReviews.length > 0 && (
              <div style={{ margin: '4px 16px' }}>
                <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Свежие отзывы</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentReviews.slice(0, 5).map(r => (
                    <div key={r.id} style={{ ...GLASS, borderRadius: 16, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {r.userPhoto
                        ? <img src={r.userPhoto} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                      }
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{r.userName ?? 'Участник АПГ'}</span>
                          <span style={{ fontSize: 11, color: '#FFD700', letterSpacing: 0.5 }}>{'★'.repeat(r.stars ?? 0)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: T.gold, marginBottom: r.text ? 4 : 0 }}>📍 {r.partnerName}</div>
                        {r.text && <div style={{ fontSize: 12, color: T.textSec, lineHeight: '17px' }}>{r.text}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Футер */}
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <div style={{ fontSize: 11, color: T.textSec, letterSpacing: 1 }}>
                ✦ АПГ — Альянс Партнёров Города ✦
              </div>
            </div>

            <div style={{ height: 16 }} />
          </>
        )}
      </div>

      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </Panel>
  );
}