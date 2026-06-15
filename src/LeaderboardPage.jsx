import React, { useState, useEffect } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

import { T, GLASS, GLASS_GOLD } from './design.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function Avatar({ photo, name, size = 40 }) {
  const initials = (name ?? '?')[0].toUpperCase();
  if (photo) {
    return (
      <img
        src={photo} alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(201,168,76,0.15)', border: `1.5px solid rgba(201,168,76,0.3)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, color: T.gold, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function PodiumCard({ user, rank }) {
  const heights = [110, 80, 64];
  const sizes   = [64, 52, 48];
  const color   = MEDAL_COLORS[rank];
  const h       = heights[rank];
  const s       = sizes[rank];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: s, height: s, borderRadius: '50%',
          padding: 2.5,
          background: `linear-gradient(135deg, ${color}, ${color}88)`,
        }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: T.surface }}>
            {user.photo
              ? <img src={user.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }}/>
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: s * 0.38, color, fontWeight: 700 }}>{(user.firstName ?? '?')[0]}</div>
            }
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: -4, right: -4, fontSize: rank === 0 ? 18 : 14 }}>{MEDALS[rank]}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textPri, textAlign: 'center', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {user.firstName ?? 'Участник'}
      </div>
      <div style={{ fontSize: 11, color: T.gold, fontWeight: 700 }}>🗝️ {user.keys}</div>
      <div style={{
        width: '100%', height: h, borderRadius: '10px 10px 0 0',
        background: `linear-gradient(180deg, ${color}22, ${color}10)`,
        border: `1px solid ${color}40`, borderBottom: 'none',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: `${color}cc` }}>#{rank + 1}</span>
      </div>
    </div>
  );
}

function UserRow({ user, rank, isCurrentUser, index }) {
  const isMedal = rank <= 2;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: isCurrentUser ? `rgba(201,168,76,0.08)` : 'transparent',
      borderBottom: `1px solid ${T.border}`,
      border: isCurrentUser ? `1px solid rgba(201,168,76,0.25)` : undefined,
      borderRadius: isCurrentUser ? 14 : 0,
      margin: isCurrentUser ? '0 8px' : 0,
      animation: 'fadeInUp 0.35s ease both',
      animationDelay: `${index * 0.04}s`,
    }}>
      {/* Ранг */}
      <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
        {isMedal
          ? <span style={{ fontSize: 18 }}>{MEDALS[rank]}</span>
          : <span style={{ fontSize: 14, fontWeight: 700, color: rank < 9 ? T.textPri : T.textSec }}>#{rank + 1}</span>
        }
      </div>

      {/* Аватар */}
      <Avatar photo={user.photo} name={user.firstName} size={40} />

      {/* Имя */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: isCurrentUser ? 700 : 600,
          color: isCurrentUser ? T.gold : T.textPri,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.firstName ?? ''} {user.lastName ?? ''}
          {isCurrentUser && <span style={{ fontSize: 11, color: T.textSec, fontWeight: 400 }}> (вы)</span>}
        </div>
      </div>

      {/* Ключи */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <span style={{ fontSize: 14 }}>🗝️</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: isMedal ? MEDAL_COLORS[rank] : T.textPri }}>{user.keys}</span>
      </div>
    </div>
  );
}

export function LeaderboardPage({ nav, currentUserId, userKeys, onBack }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const users = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.keys > 0)
          .sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0));
        setLeaders(users);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const currentUserIndex = leaders.findIndex(u => u.id === String(currentUserId));
  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  // Если текущий пользователь ниже 10 места — покажем его отдельно
  const showCurrentUserSeparately = currentUserIndex >= 10;

  return (
    <Panel id={nav}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>✦ Рейтинг</div>
            {!loading && leaders.length > 0 && <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>{leaders.length} участников</div>}
          </div>
        </div>
      </div>

      <div style={{ background: T.bg, minHeight: '100%', paddingBottom: 80 }}>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative', width: 64, height: 64 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(201,168,76,0.12)', borderTopColor: '#C9A84C', animation: 'spin 1.2s linear infinite' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: T.gold, animation: 'pulse-glow 2s ease-in-out infinite' }}>🏆</div>
            </div>
            <span style={{ color: T.textSec, fontSize: 14 }}>Загружаем рейтинг...</span>
          </div>
        ) : leaders.length === 0 ? (
          <div style={{ margin: '32px 16px', ...GLASS, borderRadius: 24, padding: '36px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 56 }}>🏆</div>
            <div>
              <div style={{ color: T.textPri, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Рейтинг пока пуст</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Стань первым — сканируй QR-коды партнёров</div>
            </div>
          </div>
        ) : (
          <>
            {/* Подиум топ-3 */}
            {top3.length >= 2 && (
              <div style={{
                margin: '16px 16px 24px',
                ...GLASS_GOLD,
                borderRadius: 24,
                padding: '20px 12px 0',
              }}>
                <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 }}>
                  ✦ Лидеры АПГ ✦
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  {top3[1] && <PodiumCard user={top3[1]} rank={1} />}
                  {top3[0] && <PodiumCard user={top3[0]} rank={0} />}
                  {top3[2] && <PodiumCard user={top3[2]} rank={2} />}
                </div>
              </div>
            )}

            {/* Остальные */}
            {rest.length > 0 && (
              <div style={{ ...GLASS, borderRadius: 24, margin: '0 16px', overflow: 'hidden' }}>
                {rest.slice(0, 47).map((user, i) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    rank={i + 3}
                    isCurrentUser={user.id === String(currentUserId)}
                    index={i}
                  />
                ))}
              </div>
            )}

            {/* Позиция текущего пользователя если ниже топ-50 */}
            {showCurrentUserSeparately && currentUserIndex !== -1 && (
              <div style={{ margin: '16px 16px 0' }}>
                <div style={{ fontSize: 12, color: T.textSec, marginBottom: 8, textAlign: 'center' }}>Ваша позиция</div>
                <div style={{ ...GLASS, borderRadius: 20, border: '1px solid rgba(201,168,76,0.25)', overflow: 'hidden' }}>
                  <UserRow
                    user={leaders[currentUserIndex]}
                    rank={currentUserIndex}
                    isCurrentUser
                    index={0}
                  />
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <div style={{ fontSize: 11, color: T.textSec }}>
                {leaders.length} участников в рейтинге
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
