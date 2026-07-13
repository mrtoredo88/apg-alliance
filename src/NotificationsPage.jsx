import React, { useState, useEffect } from 'react';


import { db } from './firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

import { T, GLASS } from './design.js';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassListItem, GlassPanel, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';

const NOTIFICATION_CATEGORIES = [
  ['news', 'Новости'],
  ['events', 'События'],
  ['partners', 'Новые партнёры'],
  ['experts', 'Новые эксперты'],
  ['raffles', 'Розыгрыши'],
  ['prizes', 'Призы'],
  ['offers', 'Акции'],
  ['reminders', 'Напоминания'],
  ['messages', 'Сообщения'],
  ['loki', 'Ответы Локи'],
  ['achievements', 'Достижения'],
  ['keys', 'Ключи'],
  ['invites', 'Приглашения'],
  ['updates', 'Обновления приложения'],
  ['important', 'Важные объявления'],
];

const DEFAULT_NOTIFICATION_PREFERENCES = Object.fromEntries(NOTIFICATION_CATEGORIES.map(([id]) => [id, true]));

function timeAgo(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} дн назад`;
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function matchesTarget(notif, userKeys, lastScanDate) {
  const type = notif.targetType ?? 'all';
  const val  = notif.targetValue ?? 0;
  if (type === 'all') return true;
  if (type === 'min_keys') return (userKeys ?? 0) >= val;
  if (type === 'max_keys') return (userKeys ?? 0) < val;
  if (type === 'inactive_days') {
    if (!lastScanDate) return true;
    const daysSince = Math.floor((Date.now() - new Date(lastScanDate).getTime()) / 86400000);
    return daysSince >= val;
  }
  return true;
}

export function NotificationsPage({ variant = 'v2', onBack, notificationsEnabled, onEnableNotifications, notificationPreferences, onNotificationPreferencesChange, lastSeenTs, notifications: propNotifications, userKeys = 0, lastScanDate = null, onOpenDialog }) {
  const [allNotifications, setAllNotifications] = useState(propNotifications ?? []);
  const [loading, setLoading] = useState(!propNotifications);
  const [loadError, setLoadError] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [filter, setFilter] = useState('all');
  const [queryText, setQueryText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [readAllAt, setReadAllAt] = useState(() => Number(localStorage.getItem('apg_notif_seen') || 0) || 0);

  useEffect(() => {
    if (propNotifications) {
      setAllNotifications(propNotifications);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')));
        if (!cancelled) setAllNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { if (!cancelled) setLoadError(true); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [propNotifications]);

  const handleEnable = async () => {
    setEnabling(true);
    try { await onEnableNotifications(); } finally { setEnabling(false); }
  };

  const isUnread = (notif) => {
    if (notif.isRead === true || notif.read === true || notif.seen === true) return false;
    if (notif.category === 'messages' || notif.type === 'contextDialogMessage') return true;
    if (!notif.createdAt) return true;
    const seenDate = readAllAt ? new Date(readAllAt) : lastSeenTs?.toDate ? lastSeenTs.toDate() : lastSeenTs ? new Date(lastSeenTs) : null;
    if (!seenDate) return true;
    const notifDate = notif.createdAt.toDate ? notif.createdAt.toDate() : new Date(notif.createdAt);
    return notifDate > seenDate;
  };

  const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(notificationPreferences || {}) };
  const notifications = allNotifications
    .filter(n => matchesTarget(n, userKeys, lastScanDate))
    .filter(n => {
      if (preferences.onlyCritical && !['critical', 'important'].includes(n.priority) && n.category !== 'important') return false;
      const category = n.category || 'important';
      if (preferences[category] === false) return false;
      if (filter === 'unread' && !isUnread(n)) return false;
      if (filter === 'archived' && !n.archived) return false;
      if (filter !== 'all' && filter !== 'unread' && filter !== 'archived' && category !== filter) return false;
      const q = queryText.trim().toLowerCase();
      if (q && !`${n.title || ''} ${n.body || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });

  const updatePreference = async (key, value) => {
    const next = key === 'all'
      ? { ...DEFAULT_NOTIFICATION_PREFERENCES, onlyCritical: false }
      : { ...preferences, [key]: value };
    await onNotificationPreferencesChange?.(next);
  };

  const openNotification = (notif) => {
    if (notif?.type === 'contextDialogMessage' && notif.dialogId) {
      onOpenDialog?.(notif.dialogId);
      return;
    }
    const url = notif.deepLink || notif.url || notif.actionUrl;
    if (!url) return;
    window.location.href = url;
  };

  const markAllRead = () => {
    const now = Date.now();
    localStorage.setItem('apg_notif_seen', String(now));
    setReadAllAt(now);
  };

  if (variant === 'v2') {
    const unreadCount = notifications.filter(isUnread).length;
    return (
      <GlassPanel>
        <ScreenHeader title="Уведомления" subtitle={`${notifications.length} сообщений · ${unreadCount} новых`} kicker="АПГ сообщает" onBack={onBack} />
        {!notificationsEnabled && (
          <GlassCard tone="gold" style={{ borderRadius: 34, padding: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 58, height: 58, borderRadius: 24, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📲</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#17120a', fontSize: 17, fontWeight: 880 }}>Включить push</div>
                <div style={{ color: 'rgba(20,15,8,0.66)', fontSize: 13, lineHeight: '18px', marginTop: 4 }}>Новые акции, события и розыгрыши будут приходить вовремя.</div>
              </div>
            </div>
            <GlassButton onClick={handleEnable} tone="glass" style={{ marginTop: 14, width: '100%', color: '#17120a', background: 'rgba(255,255,255,0.3)' }}>{enabling ? 'Включаем...' : 'Включить уведомления'}</GlassButton>
          </GlassCard>
        )}
        {notificationsEnabled && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <StatPill label="всего" value={notifications.length} tone="gold" />
            <StatPill label="новых" value={unreadCount} />
          </div>
        )}
        <GlassCard style={{ borderRadius: 24, padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={queryText}
              onChange={e => setQueryText(e.target.value)}
              placeholder="Поиск по уведомлениям"
              style={{ flex: 1, minWidth: 0, border: `1px solid ${T.border}`, background: T.chipBg, color: T.textPri, borderRadius: 14, padding: '11px 12px', outline: 'none', fontSize: 14 }}
            />
            <button onClick={markAllRead} style={{ border: `1px solid ${T.border}`, background: T.chipBg, color: T.textPri, borderRadius: 14, padding: '0 12px', fontSize: 12, fontWeight: 800 }}>✓ Все</button>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {[
              ['all', 'Все'],
              ['unread', 'Новые'],
              ['archived', 'Архив'],
              ...NOTIFICATION_CATEGORIES.slice(0, 7).map(([id, label]) => [id, label]),
            ].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} style={{ border: `1px solid ${filter === id ? APG2_PROFILE.gold : T.border}`, background: filter === id ? 'rgba(201,168,76,0.16)' : T.chipBg, color: filter === id ? APG2_PROFILE.gold : T.textPri, borderRadius: 999, padding: '8px 11px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{label}</button>
            ))}
            <button onClick={() => setShowSettings(v => !v)} style={{ border: `1px solid ${showSettings ? APG2_PROFILE.gold : T.border}`, background: showSettings ? 'rgba(201,168,76,0.16)' : T.chipBg, color: showSettings ? APG2_PROFILE.gold : T.textPri, borderRadius: 999, padding: '8px 11px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>⚙️ Настройки</button>
          </div>
          {showSettings && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 14, background: T.chipBg, color: T.textPri, fontSize: 13, fontWeight: 800 }}>
                Только критические
                <input type="checkbox" checked={!!preferences.onlyCritical} onChange={e => updatePreference('onlyCritical', e.target.checked)} style={{ width: 18, height: 18, accentColor: APG2_PROFILE.gold }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
                {NOTIFICATION_CATEGORIES.map(([id, label]) => (
                  <label key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 14, background: T.chipBg, color: T.textPri, fontSize: 12, fontWeight: 760 }}>
                    {label}
                    <input type="checkbox" checked={preferences[id] !== false} onChange={e => updatePreference(id, e.target.checked)} disabled={!!preferences.onlyCritical} style={{ width: 17, height: 17, accentColor: APG2_PROFILE.gold }} />
                  </label>
                ))}
              </div>
              <button onClick={() => updatePreference('all', true)} style={{ border: `1px solid ${APG2_PROFILE.gold}`, background: 'rgba(201,168,76,0.12)', color: APG2_PROFILE.gold, borderRadius: 14, padding: '11px 12px', fontSize: 13, fontWeight: 900 }}>Включить всё</button>
            </div>
          )}
        </GlassCard>
        {loadError && <EmptyStateV2 icon="⚠️" title="Не удалось загрузить" text="Проверьте соединение и попробуйте снова." />}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <GlassCard key={i} style={{ height: 86, animation: 'shimmer 1.5s ease-in-out infinite' }} />)}</div>
        ) : notifications.length === 0 ? (
          <EmptyStateV2 icon="🔔" title="Пока тихо" text="Здесь появятся важные новости АПГ, акции партнеров и приглашения на события." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {notifications.map((n, i) => {
              const unread = isUnread(n);
              return (
                <GlassListItem
                  key={n.id ?? i}
                  icon={n.emoji ?? '🔔'}
                  title={n.title ?? 'Уведомление АПГ'}
                  subtitle={n.body ?? n.text ?? n.preview ?? timeAgo(n.createdAt)}
                  meta={unread ? <GlassBadge tone="gold">new</GlassBadge> : timeAgo(n.createdAt)}
                  accent={unread ? APG2_PROFILE.gold : undefined}
                  onClick={() => openNotification(n)}
                  style={{ animation: `fadeInUp 0.32s ease ${i * 0.035}s both` }}
                />
              );
            })}
          </div>
        )}
      </GlassPanel>
    );
  }

  return (
    <>
      {/* Хедер */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: `1px solid ${T.headerBorder}`, borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>🔔 Уведомления</div>
        </div>
      </div>

      <div style={{ background: 'transparent', minHeight: '100%', padding: '12px 16px 90px' }}>

        {/* VK push-баннер */}
        {!notificationsEnabled && (
          <div style={{ background: 'linear-gradient(135deg, rgba(74,144,217,0.12), rgba(74,144,217,0.05))', border: '1px solid rgba(74,144,217,0.3)', borderRadius: 20, padding: '16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, animation: 'fadeInUp 0.3s ease' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(74,144,217,0.15)', border: '1px solid rgba(74,144,217,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
              📲
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, marginBottom: 4 }}>Включить push-уведомления</div>
              <div style={{ fontSize: 12, color: T.textSec, lineHeight: '16px' }}>Будь первым, кто узнает о новых акциях и партнёрах</div>
            </div>
            <button
              onClick={handleEnable}
              disabled={enabling}
              style={{ background: `linear-gradient(135deg, ${T.blue}, #2D6FBC)`, border: 'none', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: enabling ? 'default' : 'pointer', opacity: enabling ? 0.6 : 1, flexShrink: 0 }}
            >
              {enabling ? '...' : 'Включить'}
            </button>
          </div>
        )}

        {notificationsEnabled && (
          <div style={{ background: 'rgba(75,179,75,0.08)', border: '1px solid rgba(75,179,75,0.2)', borderRadius: 16, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>✓</span>
            <span style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>Push-уведомления включены</span>
          </div>
        )}

        {/* Список уведомлений */}
        {loadError && (
          <div style={{ ...GLASS, borderRadius: 16, padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(220,53,69,0.25)' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: T.textSec }}>Не удалось загрузить уведомления. Проверьте соединение.</span>
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ ...GLASS, borderRadius: 20, padding: '16px', animation: 'shimmer 1.5s ease-in-out infinite' }}>
                <div style={{ width: '40%', height: 10, background: T.chipBg, borderRadius: 6, marginBottom: 8 }} />
                <div style={{ width: '80%', height: 14, background: T.chipBg, borderRadius: 6, marginBottom: 6 }} />
                <div style={{ width: '60%', height: 12, background: T.border, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ ...GLASS, borderRadius: 24, padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 52, animation: 'float 3.5s ease-in-out infinite' }}>🔔</div>
            <div>
              <div style={{ color: T.textPri, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Пока пусто</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Здесь появятся новости от АПГ — акции, новые партнёры, события</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notifications.map((n, i) => {
              const unread = isUnread(n);
              return (
                <div key={n.id} style={{ background: unread ? 'rgba(201,168,76,0.06)' : T.chipBg, backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', borderRadius: 20, padding: '16px', border: `1px solid ${unread ? 'rgba(201,168,76,0.25)' : T.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', gap: 14, animation: `fadeInUp 0.3s ease ${i * 0.04}s both`, position: 'relative', overflow: 'hidden' }}>
                  {unread && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, borderRadius: '18px 0 0 18px', background: T.gold }} />}
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: unread ? 'rgba(201,168,76,0.15)' : T.chipBg, border: `1px solid ${unread ? 'rgba(201,168,76,0.3)' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {n.emoji ?? '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, lineHeight: '18px' }}>{n.title}</div>
                      {unread && <div style={{ flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: T.gold, marginTop: 5 }} />}
                    </div>
                    {(n.body || n.text || n.preview) && <div style={{ fontSize: 12, color: T.textSec, lineHeight: '17px', marginBottom: 6 }}>{n.body || n.text || n.preview}</div>}
                    <div style={{ fontSize: 11, color: T.textSec, opacity: 0.7 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
