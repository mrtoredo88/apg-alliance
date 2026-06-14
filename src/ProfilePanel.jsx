import React, { useMemo, useState } from 'react';
import { PanelHeader, Progress, Avatar } from '@vkontakte/vkui';

const T = {
  bg:       '#0F0F1A',
  surface:  '#1A1A2E',
  surface2: '#16213E',
  border:   'rgba(255,255,255,0.07)',
  gold:     '#C9A84C',
  goldL:    '#E8C97A',
  blue:     '#4A90D9',
  green:    '#4BB34B',
  red:      '#E64646',
  textPri:  '#F0F0F0',
  textSec:  'rgba(240,240,240,0.5)',
};

const LEVELS = [
  { id: 1, title: 'Новичок',          minKeys: 0,  color: '#99A2AD', emoji: '🌱' },
  { id: 2, title: 'Участник',         minKeys: 5,  color: T.blue,    emoji: '⚡' },
  { id: 3, title: 'Активный',         minKeys: 15, color: T.green,   emoji: '🔥' },
  { id: 4, title: 'VIP участник АПГ', minKeys: 30, color: T.gold,    emoji: '👑' },
];

const ACHIEVEMENTS = [
  { id: 'first_scan',     title: 'Первый шаг',   emoji: '🎯', color: T.blue,  cond: (k)    => k >= 1 },
  { id: 'five_keys',      title: 'Коллекционер', emoji: '🗝️', color: T.gold,  cond: (k)    => k >= 5 },
  { id: 'ten_keys',       title: 'Исследователь',emoji: '🔍', color: T.green, cond: (k)    => k >= 10 },
  { id: 'first_fav',      title: 'Знаток',        emoji: '⭐', color: T.red,   cond: (k, f) => f.length >= 1 },
  { id: 'five_favs',      title: 'Свой человек',  emoji: '❤️', color: T.red,   cond: (k, f) => f.length >= 5 },
  { id: 'vip',            title: 'VIP',           emoji: '👑', color: T.gold,  cond: (k)    => k >= 30 },
];

function getLevel(keys) {
  return [...LEVELS].reverse().find(l => keys >= l.minKeys) ?? LEVELS[0];
}
function getNextLevel(keys) {
  return LEVELS.find(l => l.minKeys > keys) ?? null;
}
function getLevelProgress(keys) {
  const cur = getLevel(keys);
  const next = getNextLevel(keys);
  if (!next) return 100;
  return Math.round(((keys - cur.minKeys) / (next.minKeys - cur.minKeys)) * 100);
}

function AchievementBadge({ a, unlocked }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 76, gap: 6, opacity: unlocked ? 1 : 0.3, filter: unlocked ? 'none' : 'grayscale(1)' }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: unlocked ? a.color + '20' : 'rgba(255,255,255,0.05)', border: `2px solid ${unlocked ? a.color + '60' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, position: 'relative' }}>
        {a.emoji}
        {unlocked && <div style={{ position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8 }}>✓</div>}
      </div>
      <span style={{ fontSize: 10, color: unlocked ? T.textPri : T.textSec, fontWeight: unlocked ? 700 : 400, textAlign: 'center', lineHeight: '13px' }}>{a.title}</span>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: 'Что такое АПГ?',
    a: 'Альянс Партнёров Города — программа лояльности, объединяющая лучшие заведения Зеленограда. Участники получают эксклюзивные скидки и предложения от партнёров.',
  },
  {
    q: 'Как собирать ключи?',
    a: 'Сканируй QR-код при каждом визите к партнёру — за каждое посещение начисляется 1 ключ. Кнопка сканера находится в нижней панели.',
  },
  {
    q: 'Зачем нужны ключи?',
    a: 'Ключи определяют твой уровень в программе. Уровни: Новичок (0), Участник (5+), Активный (15+), VIP (30+). Чем выше уровень — тем больше привилегий.',
  },
  {
    q: 'Как воспользоваться предложением партнёра?',
    a: 'Открой карточку партнёра и посмотри раздел «Спецпредложение». Покажи его на кассе или при записи — партнёр применит скидку.',
  },
  {
    q: 'Можно ли сканировать одно место несколько раз?',
    a: 'Да, каждый визит к партнёру засчитывается и приносит 1 ключ.',
  },
  {
    q: 'Как добавить партнёра в избранное?',
    a: 'Нажми на сердечко на карточке партнёра. Все избранные заведения появятся в этом разделе профиля.',
  },
];

function FaqSection() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Частые вопросы</div>
      <div style={{ background: T.surface, borderRadius: 20, overflow: 'hidden', border: `1px solid ${T.border}` }}>
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} style={{ borderBottom: i < FAQ_ITEMS.length - 1 ? `1px solid ${T.border}` : 'none' }}>
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                style={{
                  width: '100%', padding: '14px 16px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, color: T.textPri, fontWeight: 600, lineHeight: '20px' }}>{item.q}</span>
                <span style={{
                  fontSize: 16, color: T.gold, flexShrink: 0,
                  transform: isOpen ? 'rotate(45deg)' : 'none',
                  transition: 'transform 0.25s ease',
                }}>✦</span>
              </button>
              {isOpen && (
                <div style={{ padding: '0 16px 14px' }}>
                  <p style={{ margin: 0, fontSize: 13, color: T.textSec, lineHeight: '20px' }}>{item.a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FavoriteCard({ partner, onOpen, onRemove }) {
  return (
    <div style={{ background: T.surface, borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, border: `1px solid ${T.border}` }}>
      {partner.logoUrl
        ? <Avatar size={44} src={partner.logoUrl} />
        : <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.gold + '18', border: `2px solid ${T.gold}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{partner.emoji ?? '🏪'}</div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name}</div>
        {partner.categoryLabel && <div style={{ fontSize: 11, color: T.gold, marginTop: 2 }}>{partner.categoryLabel}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onOpen(partner)} style={{ padding: '7px 12px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Открыть</button>
        <button onClick={() => onRemove(partner.id)} style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.05)', color: T.textSec, fontSize: 12, cursor: 'pointer' }}>✕</button>
      </div>
    </div>
  );
}

export function ProfilePanel({ user, userKeys = 0, favorites = [], partners = [], onToggleFavorite, onOpenPartner, onLogout }) {
  const safeUser = user || { first_name: 'Участник', last_name: 'АПГ', photo_200: null };
  const level = getLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const progress = getLevelProgress(userKeys);

  const achievements = useMemo(() =>
    ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.cond(userKeys, favorites) })),
    [userKeys, favorites]
  );
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const favoritePartners = useMemo(() => partners.filter(p => favorites.includes(p.id)), [partners, favorites]);

  const stats = [
    { label: 'Ключей',    value: userKeys,          emoji: '🗝️' },
    { label: 'Избранное', value: favorites.length,   emoji: '⭐' },
    { label: 'Достижения',value: `${unlockedCount}/${achievements.length}`, emoji: '🏆' },
  ];

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      <PanelHeader>Профиль</PanelHeader>

      {/* ── Шапка профиля ── */}
      <div style={{ margin: '8px 16px', borderRadius: 24, background: 'linear-gradient(135deg, #0F0F2E, #1A1A4E)', padding: '24px 20px 20px', position: 'relative', overflow: 'hidden', border: `1px solid rgba(201,168,76,0.25)` }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.06) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12), transparent 70%)' }} />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {/* Аватар */}
          <div style={{ position: 'relative' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', padding: 3, background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})` }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: T.surface }}>
                {safeUser.photo_200
                  ? <img src={safeUser.photo_200} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>👤</div>
                }
              </div>
            </div>
          </div>

          {/* Имя */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.textPri }}>{safeUser.first_name} {safeUser.last_name}</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 3 }}>Участник АПГ</div>
          </div>

          {/* Бейдж уровня */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: level.color + '20', border: `1px solid ${level.color}50`, borderRadius: 20, padding: '5px 14px' }}>
            <span style={{ fontSize: 14 }}>{level.emoji}</span>
            <span style={{ fontSize: 12, color: level.color, fontWeight: 700 }}>{level.title}</span>
          </div>

          {/* Прогресс */}
          <div style={{ width: '100%', marginTop: 4 }}>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${T.gold}, ${T.goldL})`, borderRadius: 3, boxShadow: `0 0 8px ${T.gold}88` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: T.textSec }}>🗝️ {userKeys} ключей</span>
              <span style={{ fontSize: 11, color: T.textSec }}>{nextLevel ? `До «${nextLevel.title}»: ${nextLevel.minKeys - userKeys}` : '🏆 Макс. уровень'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Статистика ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Статистика</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: T.surface, borderRadius: 16, padding: '14px 8px', textAlign: 'center', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.textPri }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T.textSec, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Достижения ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>✦ Достижения</div>
          <div style={{ fontSize: 11, color: T.textSec, background: T.surface, padding: '3px 10px', borderRadius: 20, border: `1px solid ${T.border}` }}>{unlockedCount}/{achievements.length}</div>
        </div>

        {unlockedCount === 0
          ? <div style={{ background: T.surface, borderRadius: 24, padding: '28px 20px', textAlign: 'center', border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ animation: 'float 3.5s ease-in-out infinite' }}>
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                  <path d="M28 17 H62 V46 C62 62 45 72 45 72 C45 72 28 62 28 46 Z" fill="rgba(201,168,76,0.08)" stroke="rgba(201,168,76,0.26)" strokeWidth="1.5"/>
                  <path d="M14 24 H28 V46 C28 46 19 42 14 33 Z" fill="rgba(201,168,76,0.05)" stroke="rgba(201,168,76,0.16)" strokeWidth="1"/>
                  <path d="M76 24 H62 V46 C62 46 71 42 76 33 Z" fill="rgba(201,168,76,0.05)" stroke="rgba(201,168,76,0.16)" strokeWidth="1"/>
                  <line x1="37" y1="72" x2="37" y2="80" stroke="rgba(201,168,76,0.4)" strokeWidth="2.5"/>
                  <line x1="53" y1="72" x2="53" y2="80" stroke="rgba(201,168,76,0.4)" strokeWidth="2.5"/>
                  <rect x="29" y="78" width="32" height="7" rx="3.5" fill="rgba(201,168,76,0.12)" stroke="rgba(201,168,76,0.28)" strokeWidth="1"/>
                  <rect x="36" y="38" width="18" height="15" rx="4" fill="rgba(201,168,76,0.15)" stroke="rgba(201,168,76,0.45)" strokeWidth="1.5"/>
                  <path d="M39 38 V32 C39 27 51 27 51 32 V38" stroke="rgba(201,168,76,0.45)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  <circle cx="45" cy="45" r="2.5" fill="rgba(201,168,76,0.7)"/>
                  <rect x="77" y="13" width="5" height="5" rx="0.5" transform="rotate(45 79 15)" fill="rgba(201,168,76,0.65)"/>
                  <rect x="4" y="16" width="4" height="4" rx="0.5" transform="rotate(45 6 18)" fill="rgba(201,168,76,0.35)"/>
                </svg>
              </div>
              <div>
                <div style={{ color: T.textPri, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Достижения заперты</div>
                <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Сканируй QR-коды партнёров — так появятся первые достижения</div>
              </div>
            </div>
          : <div style={{ background: T.surface, borderRadius: 20, padding: 16, border: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {achievements.map(a => <AchievementBadge key={a.id} a={a} unlocked={a.unlocked} />)}
              </div>
            </div>
        }
      </div>

      {/* ── Избранное ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>✦ Избранное</div>
          {favoritePartners.length > 0 && <div style={{ fontSize: 11, color: T.textSec, background: T.surface, padding: '3px 10px', borderRadius: 20, border: `1px solid ${T.border}` }}>{favoritePartners.length}</div>}
        </div>

        {favoritePartners.length === 0
          ? <div style={{ background: T.surface, borderRadius: 24, padding: '28px 20px', textAlign: 'center', border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ animation: 'float 4s ease-in-out infinite' }}>
                <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                  <path d="M45 72 C45 72 14 51 14 31 C14 21 22 14 32 14 C37 14 42 17 45 23 C48 17 53 14 58 14 C68 14 76 21 76 31 C76 51 45 72 45 72 Z" fill="rgba(201,168,76,0.08)" stroke="rgba(201,168,76,0.26)" strokeWidth="1.5"/>
                  <path d="M45 72 C45 72 14 51 14 31 C14 21 22 14 32 14 C37 14 42 17 45 23" stroke="rgba(201,168,76,0.12)" strokeWidth="1" fill="none"/>
                  <circle cx="28" cy="26" r="3" fill="rgba(201,168,76,0.28)"/>
                  <circle cx="64" cy="24" r="2.5" fill="rgba(201,168,76,0.22)"/>
                  <circle cx="20" cy="44" r="2" fill="rgba(201,168,76,0.18)"/>
                  <circle cx="70" cy="42" r="2" fill="rgba(201,168,76,0.18)"/>
                  <rect x="40" y="38" width="10" height="10" rx="1" transform="rotate(45 45 43)" fill="rgba(201,168,76,0.4)" stroke="rgba(201,168,76,0.5)" strokeWidth="1"/>
                  <rect x="4" y="78" width="5" height="5" rx="0.5" transform="rotate(45 6 80)" fill="rgba(201,168,76,0.28)"/>
                  <rect x="78" y="74" width="4" height="4" rx="0.5" transform="rotate(45 80 76)" fill="rgba(201,168,76,0.22)"/>
                </svg>
              </div>
              <div>
                <div style={{ color: T.textPri, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Список пуст</div>
                <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Добавляй партнёров в избранное — они появятся здесь</div>
              </div>
            </div>
          : <div>{favoritePartners.map(p => <FavoriteCard key={p.id} partner={p} onOpen={onOpenPartner} onRemove={onToggleFavorite} />)}</div>
        }
      </div>

      {/* ── Настройки ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Настройки</div>
        <div style={{ background: T.surface, borderRadius: 20, overflow: 'hidden', border: `1px solid ${T.border}` }}>
          {[
            { icon: '🔔', label: 'Уведомления', action: () => {} },
            { icon: '⚙️', label: 'Настройки профиля', action: () => {} },
          ].map((item, i) => (
            <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: i === 0 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 15, color: T.textPri, fontWeight: 500 }}>{item.label}</span>
              <span style={{ marginLeft: 'auto', color: T.textSec, fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <FaqSection />

      {/* ── Выход ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <button onClick={onLogout} style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: `1px solid ${T.red}44`, background: T.red + '15', color: T.red, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Выйти из аккаунта
        </button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}