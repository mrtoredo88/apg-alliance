import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Avatar } from '@vkontakte/vkui';
import vkBridge from './vk.js';
import { QRCodeSVG } from 'qrcode.react';
import { LEVELS, getLevel, getNextLevel, getLevelProgress, getKeysToNext } from './levels.js';

import { T, GLASS, GLASS_STRONG, GLASS_GOLD } from './design.js';

const ACHIEVEMENTS = [
  { id: 'first_scan',   title: 'Первый шаг',    emoji: '🎯', color: '#4A90D9', cond: (k)       => k >= 1 },
  { id: 'five_keys',    title: 'Коллекционер',  emoji: '🗝️', color: '#C9A84C', cond: (k)       => k >= 5 },
  { id: 'ten_keys',     title: 'Исследователь', emoji: '🔍', color: '#4BB34B', cond: (k)       => k >= 10 },
  { id: 'first_fav',    title: 'Знаток',         emoji: '⭐', color: '#FF8C00', cond: (k, f)    => f.length >= 1 },
  { id: 'five_favs',    title: 'Свой человек',   emoji: '❤️', color: '#E64646', cond: (k, f)    => f.length >= 5 },
  { id: 'referral_bdg', title: 'Магнит',         emoji: '🤝', color: '#4A90D9', cond: (k, f, r) => r >= 1 },
  { id: 'vip',          title: 'VIP',            emoji: '👑', color: '#C9A84C', cond: (k)       => k >= 30 },
  { id: 'fifty_keys',   title: 'Ветеран',        emoji: '🏅', color: '#9B59B6', cond: (k)       => k >= 50 },
  { id: 'legend',       title: 'Легенда',        emoji: '🏆', color: '#FFD700', cond: (k)       => k >= 100 },
];

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
    a: 'Нажми кнопку ◎ в центре нижней панели — откроется сканер QR-кода. Покажи партнёру телефон, он покажет тебе QR, отсканируй — и ключ у тебя. Партнёр дня даёт +2 ключа вместо одного.',
  },
  {
    q: 'Зачем нужны ключи?',
    a: 'Ключи определяют твой уровень: 🌱 Новичок (0), ⭐ Участник (10+), 🔥 Активный (25+), 💎 Профи (50+), 👑 Амбассадор АПГ (100+). Чем выше уровень — тем больше привилегий и статус в рейтинге.',
  },
  {
    q: 'Как воспользоваться предложением партнёра?',
    a: 'Зайди в раздел «Акции» или открой карточку партнёра — там его спецпредложение для участников АПГ. Покажи экран на кассе или при записи.',
  },
  {
    q: 'Можно ли сканировать одно место несколько раз?',
    a: 'У каждого партнёра можно получать ключ раз в день — это стимулирует посещать новые места. Возвращайся к любимым партнёрам хоть каждый день!',
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
      <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
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
    <div style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
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

function ShareModal({ user, userKeys, streak, scannedCount, completedTasks, unlockedAchievements, level, onClose, onShareVK }) {
  const name = user ? `${user.first_name} ${user.last_name}`.trim() : 'Участник АПГ';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 32px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, padding: '0 16px', animation: 'slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1)' }}>
        {/* Превью карточки */}
        <div style={{ borderRadius: 28, padding: '24px 20px', marginBottom: 12, background: 'linear-gradient(145deg, #120c32, #16123e)', border: '1px solid rgba(201,168,76,0.35)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.04) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}18, transparent 70%)`, pointerEvents: 'none' }} />

          <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, opacity: 0.8 }}>✦ АПГ — Альянс Партнёров Зеленограда</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            {user?.photo_200
              ? <img src={user.photo_200} alt="" style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${T.gold}88`, objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 56, height: 56, borderRadius: '50%', background: T.gold + '20', border: `2px solid ${T.gold}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👤</div>
            }
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{name}</div>
              <div style={{ fontSize: 13, color: T.gold, fontWeight: 600, marginTop: 3 }}>{level.emoji} {level.title}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { emoji: '🗝️', value: userKeys,         label: 'ключей' },
              { emoji: '🔥', value: streak,            label: 'дней стрик' },
              { emoji: '🏪', value: scannedCount,      label: 'партнёров' },
              { emoji: '🏆', value: unlockedAchievements, label: 'наград' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '10px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 18 }}>{s.emoji}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.gold, lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: T.textSec, lineHeight: '12px', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onShareVK} style={{ flex: 1, padding: '14px 0', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #4A90D9, #2D6FBC)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            📤 Поделиться в VK
          </button>
          <button onClick={onClose} style={{ padding: '14px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: T.textPri, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function StreakCalendar({ scanDates = [], streak = 0 }) {
  const days = 30;
  const today = new Date();
  const dateSet = new Set(scanDates);

  const cells = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const isToday = i === days - 1;
    return { key, active: dateSet.has(key), isToday, dayNum: d.getDate() };
  });

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>🔥 Активность — 30 дней</div>
        {streak > 0 && <div style={{ fontSize: 11, color: '#FF8C42', fontWeight: 700, background: 'rgba(255,100,0,0.1)', border: '1px solid rgba(255,100,0,0.25)', padding: '3px 10px', borderRadius: 20 }}>{streak} дн. подряд</div>}
      </div>
      <div style={{ ...GLASS, borderRadius: 20, padding: '14px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4 }}>
          {cells.map(c => (
            <div key={c.key} title={c.key} style={{
              aspectRatio: '1', borderRadius: 6,
              background: c.active
                ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})`
                : c.isToday
                  ? 'rgba(201,168,76,0.15)'
                  : 'rgba(255,255,255,0.05)',
              border: c.isToday ? `1px solid ${T.gold}60` : '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: c.active ? '#0F0F1A' : T.textSec,
              fontWeight: c.active ? 800 : 400,
            }}>
              {c.active ? '✓' : c.dayNum}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})` }} />
            <span style={{ fontSize: 10, color: T.textSec }}>Посещение</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.gold}60` }} />
            <span style={{ fontSize: 10, color: T.textSec }}>Сегодня</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfilePanel({ user, userKeys = 0, favorites = [], partners = [], events = [], registeredEventIds = [], onToggleFavorite, onOpenPartner, onOpenActivity, onEnableNotifications, notificationsEnabled = false, onLogout, onDeleteProfile, referralCount = 0, streak = 0, scannedCount = 0, completedTasks = [], scanDates = [], onShare, onOpenReferral }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [achievementToast, setAchievementToast] = useState(null);
  const [toastExiting, setToastExiting] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const showInstallBtn = !isStandalone && (installPrompt || isIos);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (isIos) { setShowIosHint(h => !h); return; }
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const handleDeleteConfirmed = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDeleteProfile?.();
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [onDeleteProfile]);

  const dismissToast = useCallback(() => {
    setToastExiting(true);
    setTimeout(() => { setAchievementToast(null); setToastExiting(false); }, 300);
  }, []);

  const safeUser = user || { first_name: 'Участник', last_name: 'АПГ', photo_200: null };
  const level = getLevel(userKeys);
  const nextLevel = getNextLevel(userKeys);
  const progress = getLevelProgress(userKeys);

  const achievements = useMemo(() =>
    ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.cond(userKeys, favorites, referralCount) })),
    [userKeys, favorites, referralCount]
  );

  useEffect(() => {
    const SEEN_KEY = 'apg_seen_achievements';
    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    const newOnes = achievements.filter(a => a.unlocked && !seen.has(a.id));
    if (newOnes.length === 0) return;
    const toShow = newOnes[newOnes.length - 1];
    newOnes.forEach(a => seen.add(a.id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    setAchievementToast(toShow);
    setToastExiting(false);
    const timer = setTimeout(() => dismissToast(), 4000);
    return () => clearTimeout(timer);
  }, [achievements, dismissToast]);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const favoritePartners = useMemo(() => partners.filter(p => favorites.includes(p.id)), [partners, favorites]);

  const stats = [
    { label: 'Ключей',    value: userKeys,          emoji: '🗝️' },
    { label: 'Избранное', value: favorites.length,   emoji: '⭐' },
    { label: 'Достижения',value: `${unlockedCount}/${achievements.length}`, emoji: '🏆' },
  ];

  const handleSupport = async () => {
    try {
      await vkBridge.send('VKWebAppOpenApp', { app_id: 54601851 });
    } catch {
      // fallback — ничего
    }
  };

  const handleWriteAdmin = async () => {
    try {
      await vkBridge.send('VKWebAppOpenLink', { link: 'https://vk.me/id988504' });
    } catch {
      window.open('https://vk.me/id988504', '_blank');
    }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>

      {/* ── Toast достижения ── */}
      {achievementToast && (
        <div style={{
          position: 'fixed', top: 60, left: 16, right: 16, zIndex: 700,
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(48px) saturate(2)',
          WebkitBackdropFilter: 'blur(48px) saturate(2)',
          border: `1px solid ${achievementToast.color}60`,
          borderRadius: 20, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: `0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px ${achievementToast.color}25`,
          animation: toastExiting ? 'achievementOut 0.3s ease both' : 'achievementPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, flexShrink: 0,
            background: achievementToast.color + '20',
            border: `2px solid ${achievementToast.color}70`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>
            {achievementToast.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>✦ Новое достижение!</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>{achievementToast.title}</div>
          </div>
          <button onClick={dismissToast} style={{ background: 'none', border: 'none', color: T.textSec, fontSize: 20, cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Кастомный хедер */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)',
        padding: '0 16px',
        display: 'flex', alignItems: 'center', height: 52,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>✦ Профиль</div>
      </div>

      {/* ── Единая карточка профиля ── */}
      {(() => {
        const toNext = getKeysToNext(userKeys);
        const pct    = getLevelProgress(userKeys);
        return (
          <div style={{
            margin: '14px 16px',
            borderRadius: 28,
            background: 'linear-gradient(145deg, rgba(18,12,50,0.97), rgba(22,18,62,0.95))',
            backdropFilter: 'blur(40px) saturate(2)',
            WebkitBackdropFilter: 'blur(40px) saturate(2)',
            border: `1px solid rgba(201,168,76,0.28)`,
            boxShadow: `0 16px 48px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.14), 0 0 0 1px rgba(201,168,76,0.06)`,
            padding: '20px 20px 18px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Фоновые элементы */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}20, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,60,220,0.1), transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative' }}>
              {/* Строка: аватар + имя/город/уровень + ключи */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
                {/* Аватар */}
                <div style={{ width: 72, height: 72, borderRadius: '50%', padding: 2.5, background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, flexShrink: 0 }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: T.surface }}>
                    {safeUser.photo_200
                      ? <img src={safeUser.photo_200} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 900, color: '#C9A84C', background: 'rgba(201,168,76,0.12)' }}>
                          {(safeUser.first_name || '?')[0].toUpperCase()}
                        </div>
                    }
                  </div>
                </div>

                {/* Имя + город + уровень */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.textPri, lineHeight: 1.2, marginBottom: 2 }}>
                    {safeUser.first_name} {safeUser.last_name}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSec, marginBottom: 8 }}>Участник АПГ · Зеленоград</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: level.color + '22', border: `1px solid ${level.color}55`, borderRadius: 16, padding: '4px 10px' }}>
                    <span style={{ fontSize: 13 }}>{level.emoji}</span>
                    <span style={{ fontSize: 11, color: level.color, fontWeight: 700 }}>{level.label}</span>
                  </div>
                </div>

                {/* Счётчик ключей */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: -1 }}>{userKeys}</div>
                  <div style={{ fontSize: 10, color: T.goldL, fontWeight: 700, marginTop: 3 }}>🗝️ ключей</div>
                </div>
              </div>

              {/* Прогресс */}
              <div style={{ height: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 7, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${level.color}, ${T.goldL})`, borderRadius: 7, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)', boxShadow: `0 0 12px ${level.color}` }} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontWeight: 600 }}>
                {nextLevel
                  ? `До «${nextLevel.label}» ${nextLevel.emoji}: ещё ${toNext} ключей`
                  : '👑 Максимальный уровень — вы Амбассадор АПГ!'}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Статистика ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Статистика</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {stats.map(s => (
            <div key={s.label} style={{ ...GLASS, borderRadius: 20, padding: '14px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.emoji}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.textPri }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T.textSec, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Путь участника ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Путь участника</div>
        <div style={{ ...GLASS, borderRadius: 24, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {LEVELS.map((lvl, i) => {
            const isReached  = userKeys >= lvl.min;
            const isCurrent  = level.id === lvl.id;
            const isLast     = i === LEVELS.length - 1;
            return (
              <div key={lvl.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                {/* Вертикальная линия */}
                {!isLast && (
                  <div style={{
                    position: 'absolute', left: 19, top: 40, width: 2, height: 'calc(100% - 12px)',
                    background: isReached ? lvl.color + '60' : 'rgba(255,255,255,0.08)',
                    transition: 'background 0.4s ease',
                  }} />
                )}
                {/* Иконка уровня */}
                <div style={{
                  width: 40, height: 40, borderRadius: 14, flexShrink: 0,
                  background: isReached ? lvl.color + '22' : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${isReached ? lvl.color + '80' : 'rgba(255,255,255,0.1)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isReached ? 18 : 16,
                  filter: isReached ? 'none' : 'grayscale(1)',
                  opacity: isReached ? 1 : 0.45,
                  boxShadow: isCurrent ? `0 0 0 3px ${lvl.color}40` : 'none',
                  transition: 'all 0.3s ease',
                }}>
                  {lvl.emoji}
                </div>
                {/* Текст */}
                <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isReached ? T.textPri : T.textSec }}>{lvl.label}</span>
                    {isCurrent && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: lvl.color, background: lvl.color + '20', border: `1px solid ${lvl.color}50`, borderRadius: 8, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: 0.5 }}>сейчас</span>
                    )}
                    {isReached && !isCurrent && (
                      <span style={{ fontSize: 12, color: T.green }}>✓</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
                    {lvl.min === 0 ? 'Стартовый уровень' : `от ${lvl.min} ключей`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Streak Calendar ── */}
      <StreakCalendar scanDates={scanDates} streak={streak} />

      {/* ── Достижения ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>✦ Достижения</div>
          <div style={{ fontSize: 11, color: T.textSec, background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.13)' }}>{unlockedCount}/{achievements.length}</div>
        </div>

        {unlockedCount === 0
          ? <div style={{ ...GLASS, borderRadius: 24, padding: '28px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
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
          : <div style={{ ...GLASS, borderRadius: 24, padding: 16 }}>
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
          {favoritePartners.length > 0 && <div style={{ fontSize: 11, color: T.textSec, background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.13)' }}>{favoritePartners.length}</div>}
        </div>

        {favoritePartners.length === 0
          ? <div style={{ ...GLASS, borderRadius: 24, padding: '28px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
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

      {/* ── Мои мероприятия ── */}
      {registeredEventIds.length > 0 && (
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Мои мероприятия</div>
          <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
            {registeredEventIds.map((eid, i, arr) => {
              const event = events.find(e => e.id === eid);
              if (!event) return null;
              const isPast = event.eventDate ? new Date(event.eventDate).getTime() < Date.now() : false;
              return (
                <div key={eid} style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: isPast ? 'rgba(255,255,255,0.05)' : 'rgba(201,168,76,0.12)',
                    border: `1px solid ${isPast ? 'rgba(255,255,255,0.1)' : 'rgba(201,168,76,0.3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {event.emoji ?? '🎉'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
                    {event.date && <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>📅 {event.date}</div>}
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 10, flexShrink: 0,
                    background: isPast ? 'rgba(255,255,255,0.05)' : T.green + '12',
                    color: isPast ? T.textSec : T.green,
                    border: `1px solid ${isPast ? 'rgba(255,255,255,0.1)' : T.green + '40'}`,
                  }}>
                    {isPast ? 'Прошло' : 'Иду ✓'}
                  </div>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}

      {/* ── Реферальная программа ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Пригласить друга</div>
        <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>

          {/* Статистика */}
          {referralCount > 0 && (
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 16 }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.textPri }}>{referralCount}</div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
                  {referralCount === 1 ? 'друг' : referralCount < 5 ? 'друга' : 'друзей'} пришло
                </div>
              </div>
              <div style={{ width: 1, background: T.border }} />
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>{referralCount * 2} 🗝️</div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>заработано</div>
              </div>
            </div>
          )}

          {/* QR-код */}
          {user?.id && (
            <div style={{ padding: '16px', borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 13, color: T.textSec, textAlign: 'center', lineHeight: '18px' }}>
                Покажи QR другу — он сканирует и вы оба получаете <span style={{ color: T.gold, fontWeight: 700 }}>+2 🗝️</span>
              </div>
              <div style={{ background: '#fff', borderRadius: 16, padding: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <QRCodeSVG
                  value={`https://vk.com/app54601851#ref_${user.id}`}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#0F0F1A"
                  level="M"
                />
              </div>
              <div style={{ fontSize: 11, color: T.textSec, textAlign: 'center' }}>
                твой личный код · ID {user.id}
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8 }}>
            <button onClick={() => setShowShareModal(true)} style={{ flex: 1, padding: '12px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #4A90D9, #2D6FBC)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              📤 Поделиться
            </button>
            <button onClick={onOpenReferral} style={{ flex: 1, padding: '12px 0', borderRadius: 14, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', color: T.textPri, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              Подробнее ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Настройки ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Настройки</div>
        <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
          {[
            { icon: '📋', label: 'История активности', action: onOpenActivity,         right: null },
            { icon: '🔔', label: 'Уведомления',        action: onEnableNotifications,  right: notificationsEnabled ? 'вкл' : null },
            { icon: '⚙️', label: 'Настройки профиля',  action: () => {},               right: null },
          ].map((item, i, arr) => (
            <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 15, color: T.textPri, fontWeight: 500 }}>{item.label}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {item.right && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.green, background: T.green + '18', padding: '3px 8px', borderRadius: 10 }}>{item.right}</span>
                )}
                <span style={{ color: T.textSec, fontSize: 16 }}>›</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <FaqSection />

      {/* ── Поддержка ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Поддержка</div>
        <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
          {[
            {
              icon: '💬',
              label: 'Написать нам',
              sub: 'Ответим в течение дня',
              action: handleWriteAdmin,
              color: T.blue,
            },
            {
              icon: '🏪',
              label: 'Предложить партнёра',
              sub: 'Знаете крутое место в Зеленограде?',
              action: handleWriteAdmin,
              color: T.green,
            },
            {
              icon: '🐞',
              label: 'Сообщить об ошибке',
              sub: 'Поможем разобраться',
              action: handleWriteAdmin,
              color: T.red,
            },
          ].map((item, i, arr) => (
            <button key={item.label} onClick={item.action}
              style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: item.color + '18', border: `1px solid ${item.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: T.textPri, fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{item.sub}</div>
              </div>
              <span style={{ color: T.textSec, fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── О приложении ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ О приложении</div>
        <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
          {/* Лого + название */}
          <div style={{ padding: '18px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${T.gold}30, ${T.goldL}18)`, border: `1px solid ${T.gold}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🗝️</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri }}>АПГ — Альянс Партнёров</div>
              <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Программа лояльности Зеленограда</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: T.gold, background: T.gold + '15', border: `1px solid ${T.gold}30`, borderRadius: 8, padding: '4px 8px', flexShrink: 0 }}>v1.0</div>
          </div>
          {/* Строки */}
          {[
            { label: 'Версия',       value: '1.0.0' },
            { label: 'Город',        value: 'Зеленоград' },
            { label: 'Разработчик',  value: 'АПГ Team' },
          ].map((row, i, arr) => (
            <div key={row.label} style={{ padding: '12px 16px', borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: T.textSec }}>{row.label}</span>
              <span style={{ fontSize: 13, color: T.textPri, fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Администрирование (только для админа) ── */}
      {user?.id === 988504 && (
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={() => { window.location.hash = '/admin'; }}
            style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: `1px solid ${T.gold}44`, background: T.gold + '15', color: T.gold, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            ⚙️ Панель администратора
          </button>
        </div>
      )}

      {/* ── Установить как приложение ── */}
      {showInstallBtn && (
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={handleInstall}
            style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: `1px solid ${T.green}44`, background: T.green + '15', color: T.green, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            📲 Добавить на экран телефона
          </button>
          {showIosHint && (
            <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <div style={{ fontSize: 13, color: T.textSec, lineHeight: '20px' }}>
                <div style={{ marginBottom: 8 }}>Чтобы установить приложение на iPhone / iPad:</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>1️⃣</span>
                  <span>Нажмите кнопку <strong style={{ color: T.textPri }}>Поделиться</strong> <span style={{ fontSize: 16 }}>⬆️</span> внизу Safari</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>2️⃣</span>
                  <span>Выберите <strong style={{ color: T.textPri }}>«На экран "Домой"»</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>3️⃣</span>
                  <span>Нажмите <strong style={{ color: T.textPri }}>«Добавить»</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Выход ── */}
      <div style={{ padding: '16px 16px 0' }}>
        <button onClick={onLogout} style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: `1px solid ${T.red}44`, background: T.red + '15', color: T.red, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Выйти из аккаунта
        </button>
      </div>

      {/* ── Удаление профиля ── */}
      <div style={{ padding: '8px 16px 0' }}>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          style={{ width: '100%', padding: '12px 0', borderRadius: 16, border: 'none', background: 'none', color: 'rgba(240,240,240,0.25)', fontSize: 13, fontWeight: 500, cursor: 'pointer', letterSpacing: 0.2 }}
        >
          Удалить профиль
        </button>
      </div>

      <div style={{ height: 90 }} />

      {/* ── Модалка подтверждения удаления ── */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 16px 32px',
        }}
          onClick={e => { if (e.target === e.currentTarget && !isDeleting) setShowDeleteConfirm(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 420,
            ...GLASS_STRONG, borderRadius: '28px 28px 0 0',
            padding: '28px 22px 22px',
            animation: 'fadeInUp 0.25s ease',
          }}>
            {/* Иконка */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                background: T.red + '18', border: `1px solid ${T.red}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>🗑️</div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.textPri, marginBottom: 8 }}>
                Удалить профиль?
              </div>
              <div style={{ fontSize: 13, color: T.textSec, lineHeight: '19px' }}>
                Все ваши ключи, достижения и история активности будут безвозвратно удалены. Это действие нельзя отменить.
              </div>
            </div>

            {/* Список что удалится */}
            <div style={{ background: 'rgba(230,70,70,0.07)', border: `1px solid ${T.red}30`, borderRadius: 14, padding: '12px 14px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { emoji: '🗝️', text: `${userKeys} ключей` },
                { emoji: '⭐', text: `${favorites.length} избранных заведений` },
                { emoji: '📋', text: 'История активности' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{item.emoji}</span>
                  <span style={{ fontSize: 13, color: T.textSec }}>{item.text}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)',
                  color: T.textPri, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={isDeleting}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  border: 'none', background: T.red,
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: isDeleting ? 'default' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {isDeleting ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <ShareModal
          user={user}
          userKeys={userKeys}
          streak={streak}
          scannedCount={scannedCount}
          completedTasks={completedTasks}
          unlockedAchievements={achievements.filter(a => a.unlocked).length}
          level={level}
          onClose={() => setShowShareModal(false)}
          onShareVK={() => {
            const name = user ? user.first_name : 'Я';
            const levelLabel = level.title;
            const msg = `${name} — участник АПГ!\n\n🗝️ ${userKeys} ключей · ${levelLabel}\n🔥 Стрик: ${streak} дней\n🏪 Партнёров посещено: ${scannedCount}\n\nПрисоединяйся к Альянсу Партнёров Зеленограда 👇`;
            vkBridge.send('VKWebAppShowWallPostBox', {
              message: msg,
              attachments: 'https://vk.com/app54601851',
            }).catch(() => {});
            setShowShareModal(false);
          }}
        />
      )}
    </div>
  );
}