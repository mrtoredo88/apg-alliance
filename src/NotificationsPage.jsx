import React, { useState, useEffect } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const T = {
  bg:      '#0F0F1A',
  surface: '#1A1A2E',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  blue:    '#4A90D9',
  green:   '#4BB34B',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.5)',
};

const GLASS = {
  background: 'rgba(255,255,255,0.07)',
  backdropFilter: 'blur(28px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
  border: '1px solid rgba(255,255,255,0.13)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1.5px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.08)',
};

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

export function NotificationsPage({ onBack, notificationsEnabled, onEnableNotifications, lastSeenTs }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')));
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleEnable = async () => {
    setEnabling(true);
    try { await onEnableNotifications(); } finally { setEnabling(false); }
  };

  const isUnread = (notif) => {
    if (!lastSeenTs || !notif.createdAt) return true;
    const seenDate = lastSeenTs.toDate ? lastSeenTs.toDate() : new Date(lastSeenTs);
    const notifDate = notif.createdAt.toDate ? notif.createdAt.toDate() : new Date(notif.createdAt);
    return notifDate > seenDate;
  };

  return (
    <Panel id="notifications">
      {/* Хедер */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>🔔 Уведомления</div>
        </div>
      </div>

      <div style={{ background: T.bg, minHeight: '100%', padding: '12px 16px 90px' }}>

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
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ ...GLASS, borderRadius: 20, padding: '16px', animation: 'shimmer 1.5s ease-in-out infinite' }}>
                <div style={{ width: '40%', height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8 }} />
                <div style={{ width: '80%', height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 6 }} />
                <div style={{ width: '60%', height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
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
                <div key={n.id} style={{ background: unread ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.07)', backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', borderRadius: 20, padding: '16px', border: `1px solid ${unread ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.13)'}`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', gap: 14, animation: `fadeInUp 0.3s ease ${i * 0.04}s both`, position: 'relative', overflow: 'hidden' }}>
                  {unread && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, borderRadius: '18px 0 0 18px', background: T.gold }} />}
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: unread ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${unread ? 'rgba(201,168,76,0.3)' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {n.emoji ?? '🔔'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, lineHeight: '18px' }}>{n.title}</div>
                      {unread && <div style={{ flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: T.gold, marginTop: 5 }} />}
                    </div>
                    {n.body && <div style={{ fontSize: 12, color: T.textSec, lineHeight: '17px', marginBottom: 6 }}>{n.body}</div>}
                    <div style={{ fontSize: 11, color: T.textSec, opacity: 0.7 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
