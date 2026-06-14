import React, { useState } from 'react';
import { Panel, PanelHeader, Avatar, Button, HorizontalScroll } from '@vkontakte/vkui';

// ─── Дизайн-токены ────────────────────────────────────────────────────────────
const T = {
  bg:       '#0F0F1A',   // Глубокий тёмно-синий фон
  surface:  '#1A1A2E',   // Карточки
  surface2: '#16213E',   // Вторичные карточки
  border:   'rgba(255,255,255,0.07)',
  gold:     '#C9A84C',   // Золотой акцент
  goldL:    '#E8C97A',   // Светлый золотой
  blue:     '#4A90D9',   // Синий акцент
  green:    '#4BB34B',
  red:      '#E64646',
  textPri:  '#F0F0F0',
  textSec:  'rgba(240,240,240,0.5)',
  white:    '#FFFFFF',
};

const CATEGORIES = [
  { id: 'all',    label: 'Все',         emoji: '✦' },
  { id: 'food',   label: 'Еда',         emoji: '🍽' },
  { id: 'beauty', label: 'Красота',     emoji: '💄' },
  { id: 'sport',  label: 'Спорт',       emoji: '💪' },
  { id: 'edu',    label: 'Обучение',    emoji: '📚' },
  { id: 'fun',    label: 'Развлечения', emoji: '🎉' },
];

// ─── Модальное окно события ───────────────────────────────────────────────────

function EventModal({ event, onClose }) {
  if (!event) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-end',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: T.surface,
        borderRadius: '24px 24px 0 0',
        width: '100%', padding: '24px 20px 48px',
        maxHeight: '85vh', overflowY: 'auto',
        border: `1px solid ${T.border}`,
        borderBottom: 'none',
      }} onClick={e => e.stopPropagation()}>

        {/* Ручка */}
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ fontSize: 52 }}>{event.emoji ?? '🎉'}</div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%',
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
            background: 'rgba(255,255,255,0.05)', borderRadius: 14,
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
            background: 'rgba(255,255,255,0.05)', color: T.textSec,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Карточка события ─────────────────────────────────────────────────────────

function EventCard({ event, onClick, index = 0 }) {
  const gradients = [
    'linear-gradient(135deg, #1a1a4e, #2d4a8a)',
    'linear-gradient(135deg, #1a3a1a, #2d6a3a)',
    'linear-gradient(135deg, #3a1a1a, #7a3030)',
    'linear-gradient(135deg, #2a1a3a, #5a2d7a)',
    'linear-gradient(135deg, #1a3a3a, #2d7a6a)',
  ];
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

// ─── Карточка партнёра ────────────────────────────────────────────────────────

function PartnerCard({ partner, isFavorite, onOpen, onToggleFavorite, index = 0 }) {
  return (
    <div style={{
      background: T.surface,
      borderRadius: 20, padding: 16, textAlign: 'center',
      border: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden',
      animation: 'fadeInUp 0.45s ease both',
      animationDelay: `${index * 0.07}s`,
    }}>
      {/* Золотая точка если в избранном */}
      {isFavorite && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          width: 8, height: 8, borderRadius: '50%',
          background: T.gold, boxShadow: `0 0 6px ${T.gold}`,
        }} />
      )}

      <div style={{ position: 'relative', display: 'inline-block', margin: '0 auto' }}>
        {partner.logoUrl
          ? <Avatar size={56} src={partner.logoUrl} style={{ border: `2px solid ${T.border}` }} />
          : (
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(201,168,76,0.1)',
              border: `2px solid ${T.gold}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>
              {partner.emoji ?? '🏪'}
            </div>
          )
        }
        <button onClick={() => onToggleFavorite(partner.id)} style={{
          position: 'absolute', top: -4, right: -4,
          background: isFavorite ? T.red : T.surface2,
          border: `1px solid ${isFavorite ? T.red : T.border}`,
          borderRadius: '50%', width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 10, padding: 0, color: '#fff',
        }}>
          {isFavorite ? '♥' : '♡'}
        </button>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, lineHeight: '16px', marginBottom: 3 }}>
          {partner.name ?? 'Партнёр'}
        </div>
        {partner.categoryLabel && (
          <div style={{ fontSize: 10, color: T.gold }}>
            {CATEGORIES.find(c => c.id === partner.category)?.emoji} {partner.categoryLabel}
          </div>
        )}
      </div>

      <button onClick={() => onOpen(partner)} style={{
        width: '100%', padding: '9px 0', borderRadius: 12, border: 'none',
        background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
        color: '#0F0F1A', fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
        Подробнее
      </button>
    </div>
  );
}

// ─── Баннер ───────────────────────────────────────────────────────────────────

function HeroBanner({ userKeys, userName }) {
  const MAX_KEYS = 50;
  const progress = Math.min(Math.round((userKeys / MAX_KEYS) * 100), 100);

  return (
    <div style={{
      margin: '8px 16px',
      borderRadius: 24,
      background: 'linear-gradient(135deg, #0F0F2E 0%, #1A1A4E 50%, #0F0F2E 100%)',
      padding: '22px 20px 20px',
      position: 'relative', overflow: 'hidden',
      border: `1px solid rgba(201,168,76,0.3)`,
      animation: 'fadeInUp 0.5s ease both',
    }}>
      {/* Декоративная сетка */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(rgba(201,168,76,0.07) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }} />
      {/* Золотое свечение */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 140, height: 140, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,168,76,0.15), transparent 70%)',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
          ✦ Альянс Партнёров Города
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.white, marginBottom: 16, lineHeight: '28px' }}>
          Добро пожаловать,{'\n'}{userName ?? 'участник'}
        </div>

        {/* Ключи */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 14, padding: '12px 14px',
          border: `1px solid rgba(201,168,76,0.2)`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>🗝️</span>
              <span style={{ color: T.white, fontSize: 15, fontWeight: 700 }}>{userKeys} ключей</span>
            </div>
            <span style={{ color: T.textSec, fontSize: 12 }}>из {MAX_KEYS}</span>
          </div>
          {/* Прогресс */}
          <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: `linear-gradient(90deg, ${T.gold}, ${T.goldL})`,
              borderRadius: 3, transition: 'width 0.4s ease',
              boxShadow: `0 0 8px ${T.gold}88`,
            }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Быстрые действия ────────────────────────────────────────────────────────

function QuickActions({ onScan, onShare, onOpenLeaderboard }) {
  const actions = [
    { icon: '📷', label: 'QR-скан',  color: T.blue,  onClick: onScan },
    { icon: '🎁', label: 'Акции',    color: T.green, onClick: () => {} },
    { icon: '🏆', label: 'Рейтинг', color: T.gold,  onClick: onOpenLeaderboard },
    { icon: '👥', label: 'Позвать', color: T.red,   onClick: onShare },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: '0 16px' }}>
      {actions.map((a) => (
        <button key={a.label} onClick={a.onClick} style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 16, padding: '12px 4px',
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: a.color + '18',
            border: `1px solid ${a.color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>
            {a.icon}
          </div>
          <span style={{ color: T.textSec, fontSize: 10, fontWeight: 600 }}>{a.label}</span>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ color: '#C9A84C', fontWeight: 800, fontSize: 17, letterSpacing: 2, lineHeight: 1 }}>АПГ</span>
        <span style={{ color: 'rgba(201,168,76,0.5)', fontSize: 7.5, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1 }}>Альянс Партнёров</span>
      </div>
    </div>
  );
}

// ─── Основной компонент ───────────────────────────────────────────────────────

export function HomePanel({
  user, userKeys = 0, favorites = [], partners = [], events = [],
  loading = false, error = null,
  onOpenPartner, onToggleFavorite, onScan, onShare, onOpenEvents, onOpenLeaderboard, onRetry,
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const filteredPartners = activeCategory === 'all'
    ? partners
    : partners.filter(p => p.category === activeCategory);

  return (
    <Panel id="home">
      <PanelHeader style={{ background: T.bg }}>
        <ApgLogo />
      </PanelHeader>

      <div style={{ background: T.bg, minHeight: '100%' }}>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320, flexDirection: 'column', gap: 18 }}>
            <div style={{ position: 'relative', width: 72, height: 72 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2px solid rgba(201,168,76,0.12)',
                borderTopColor: '#C9A84C',
                animation: 'spin 1.2s linear infinite',
              }} />
              <div style={{
                position: 'absolute', inset: 8, borderRadius: '50%',
                border: '1.5px solid rgba(201,168,76,0.07)',
                borderBottomColor: 'rgba(201,168,76,0.35)',
                animation: 'spin 2s linear infinite reverse',
              }} />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: '#C9A84C',
                animation: 'pulse-glow 2s ease-in-out infinite',
              }}>✦</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: T.textPri, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>АПГ</div>
              <div style={{ color: T.textSec, fontSize: 13 }}>Загружаем данные...</div>
            </div>
          </div>
        )}

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
            <HeroBanner userKeys={userKeys} userName={user?.first_name} />

            <div style={{ padding: '12px 0 4px' }}>
              <QuickActions onScan={onScan} onShare={onShare} onOpenLeaderboard={onOpenLeaderboard} />
            </div>

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
              <div style={{ margin: '0 16px', background: T.surface, borderRadius: 24, padding: '28px 20px', textAlign: 'center', border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
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
                  {events.map((e, i) => <EventCard key={e.id} event={e} index={i} onClick={setSelectedEvent} />)}
                </div>
              </HorizontalScroll>
            )}

            {/* Фильтр категорий */}
            <div style={{ padding: '20px 0 8px' }}>
              <HorizontalScroll>
                <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} style={{
                      padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700,
                      background: activeCategory === cat.id
                        ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})`
                        : T.surface,
                      color: activeCategory === cat.id ? '#0F0F1A' : T.textSec,
                      border: activeCategory === cat.id ? 'none' : `1px solid ${T.border}`,
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
                <div style={{ fontSize: 11, color: T.textSec, background: T.surface, padding: '4px 10px', borderRadius: 20, border: `1px solid ${T.border}` }}>
                  {filteredPartners.length} партнёров
                </div>
              </div>

              {filteredPartners.length === 0 ? (
                <div style={{ background: T.surface, borderRadius: 24, padding: '28px 20px', textAlign: 'center', border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div style={{ animation: 'float 3s ease-in-out infinite' }}>
                    <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                      <circle cx="40" cy="38" r="26" fill="rgba(201,168,76,0.06)" stroke="rgba(201,168,76,0.22)" strokeWidth="2"/>
                      <circle cx="40" cy="38" r="16" fill="rgba(201,168,76,0.04)" stroke="rgba(201,168,76,0.11)" strokeWidth="1.5"/>
                      <line x1="59" y1="57" x2="78" y2="76" stroke="rgba(201,168,76,0.45)" strokeWidth="4" strokeLinecap="round"/>
                      <line x1="33" y1="38" x2="47" y2="38" stroke="rgba(201,168,76,0.35)" strokeWidth="2.5" strokeLinecap="round"/>
                      <line x1="40" y1="31" x2="40" y2="45" stroke="rgba(201,168,76,0.35)" strokeWidth="2.5" strokeLinecap="round"/>
                      <circle cx="22" cy="22" r="2.5" fill="rgba(201,168,76,0.3)"/>
                      <circle cx="60" cy="18" r="2" fill="rgba(201,168,76,0.22)"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ color: T.textPri, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Ничего не найдено</div>
                    <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>В этой категории пока нет партнёров</div>
                  </div>
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