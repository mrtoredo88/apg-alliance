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

function EventCard({ event, onClick }) {
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

function PartnerCard({ partner, isFavorite, onOpen, onToggleFavorite }) {
  return (
    <div style={{
      background: T.surface,
      borderRadius: 20, padding: 16, textAlign: 'center',
      border: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden',
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

function QuickActions({ onScan }) {
  const actions = [
    { icon: '📷', label: 'QR-скан',    color: T.blue,  onClick: onScan },
    { icon: '🎁', label: 'Акции',      color: T.green, onClick: () => {} },
    { icon: '🏆', label: 'Рейтинг',   color: T.gold,  onClick: () => {} },
    { icon: '👥', label: 'Позвать',   color: T.red,   onClick: () => {} },
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

// ─── Основной компонент ───────────────────────────────────────────────────────

export function HomePanel({
  user, userKeys = 0, favorites = [], partners = [], events = [],
  loading = false, error = null,
  onOpenPartner, onToggleFavorite, onScan, onRetry,
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const filteredPartners = activeCategory === 'all'
    ? partners
    : partners.filter(p => p.category === activeCategory);

  return (
    <Panel id="home">
      <PanelHeader style={{ background: T.bg }}>
        <span style={{ color: T.gold, fontWeight: 800, letterSpacing: 1 }}>АПГ</span>
      </PanelHeader>

      <div style={{ background: T.bg, minHeight: '100%' }}>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 40 }}>✦</div>
            <span style={{ color: T.textSec, fontSize: 14 }}>Загружаем данные...</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: T.textPri, fontWeight: 600, marginBottom: 8 }}>Нет подключения</div>
            <button onClick={onRetry} style={{
              padding: '12px 24px', borderRadius: 12, border: 'none',
              background: T.gold, color: '#0F0F1A', fontWeight: 700, cursor: 'pointer',
            }}>Повторить</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <HeroBanner userKeys={userKeys} userName={user?.first_name} />

            <div style={{ padding: '12px 0 4px' }}>
              <QuickActions onScan={onScan} />
            </div>

            {/* События */}
            <div style={{ padding: '20px 16px 8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>
                  <span style={{ color: T.gold }}>✦</span> Ближайшие события
                </div>
              </div>
            </div>

            {events.length === 0 ? (
              <div style={{ margin: '0 16px', background: T.surface, borderRadius: 20, padding: 24, textAlign: 'center', border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
                <div style={{ color: T.textPri, fontWeight: 600, marginBottom: 6 }}>Скоро будут события</div>
                <div style={{ color: T.textSec, fontSize: 13 }}>Партнёры АПГ готовят кое-что интересное</div>
              </div>
            ) : (
              <HorizontalScroll>
                <div style={{ display: 'flex', gap: 12, padding: '0 16px 4px' }}>
                  {events.map(e => <EventCard key={e.id} event={e} onClick={setSelectedEvent} />)}
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
                <div style={{ background: T.surface, borderRadius: 20, padding: 24, textAlign: 'center', border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ color: T.textSec, fontSize: 13 }}>В этой категории пока нет партнёров</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {filteredPartners.map(p => (
                    <PartnerCard
                      key={p.id} partner={p}
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