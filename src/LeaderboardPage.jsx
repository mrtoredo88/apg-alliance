import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
import { getLevel } from './levels.js';

import { T, GLASS, GLASS_GOLD } from './design.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function Avatar({ photo, name, size = 40 }) {
  const [imgError, setImgError] = React.useState(false);
  const initials = (name ?? '?')[0].toUpperCase();
  if (photo && !imgError) {
    return (
      <img
        src={photo} alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={() => setImgError(true)}
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
              ? <img src={user.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }}/>
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

function UserProfileModal({ user, rank, onClose }) {
  const level = getLevel(user.keys ?? 0);
  const medals = ['🥇', '🥈', '🥉'];
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, borderRadius: 28, background: T.surface, border: '1px solid rgba(201,168,76,0.28)', boxShadow: '0 24px 80px rgba(0,0,0,0.65)', padding: '28px 24px', position: 'relative', overflow: 'hidden', animation: 'fadeInUp 0.28s cubic-bezier(0.34,1.4,0.64,1)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.04) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${level.color}18, transparent 70%)`, pointerEvents: 'none' }} />

        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSec, fontSize: 16, cursor: 'pointer' }}>✕</button>

        {/* Аватар + имя */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24, position: 'relative' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', padding: 3, background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})` }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: T.surface }}>
              {user.photo
                ? <img src={user.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: T.gold, fontWeight: 700 }}>{(user.firstName ?? '?')[0]}</div>
              }
            </div>
          </div>
          {rank < 3 && <div style={{ position: 'absolute', top: 54, left: '50%', transform: 'translateX(20px)', fontSize: 22 }}>{medals[rank]}</div>}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.textPri }}>{user.firstName ?? ''} {user.lastName ?? ''}</div>
            <div style={{ fontSize: 13, color: T.gold, fontWeight: 600, marginTop: 4 }}>{level.emoji} {level.label}</div>
          </div>
        </div>

        {/* Статистика */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { emoji: '🏆', value: `#${rank + 1}`,       label: 'место' },
            { emoji: '🗝️', value: user.keys ?? 0,       label: 'ключей' },
            { emoji: '🔥', value: user.streak ?? 0,     label: 'стрик' },
          ].map(s => (
            <div key={s.label} style={{ ...GLASS, borderRadius: 16, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20 }}>{s.emoji}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.gold, lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: T.textSec, opacity: 0.6 }}>
          Участник АПГ — Альянс Партнёров Зеленограда
        </div>
      </div>
    </div>,
    document.body
  );
}

function UserRow({ user, rank, isCurrentUser, index, onSelect }) {
  const isMedal = rank <= 2;
  return (
    <div onClick={() => onSelect(user, rank)} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: isCurrentUser ? `rgba(201,168,76,0.08)` : 'transparent',
      borderBottom: `1px solid ${T.border}`,
      border: isCurrentUser ? `1px solid rgba(201,168,76,0.25)` : undefined,
      borderRadius: isCurrentUser ? 14 : 0,
      margin: isCurrentUser ? '0 8px' : 0,
      animation: 'fadeInUp 0.35s ease both',
      animationDelay: `${index * 0.04}s`,
      cursor: 'pointer',
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
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRank, setSelectedRank] = useState(0);

  const handleSelect = (user, rank) => { setSelectedUser(user); setSelectedRank(rank); };

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), where('keys', '>', 0), orderBy('keys', 'desc'), limit(100))
        );
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

  // Если текущий пользователь ниже 50 места — покажем его отдельно (top3 + rest.slice(0,47) = 50)
  const showCurrentUserSeparately = currentUserIndex >= 50;

  return (
    <Panel id={nav}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: `1px solid ${T.headerBorder}`, borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>✦ Рейтинг</div>
            {!loading && leaders.length > 0 && <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>{leaders.length} участников</div>}
          </div>
        </div>
      </div>

      <div style={{ background: 'transparent', minHeight: '100%', paddingBottom: 80 }}>

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
                  {top3[1] && <div onClick={() => handleSelect(top3[1], 1)} style={{ flex: 1, cursor: 'pointer' }}><PodiumCard user={top3[1]} rank={1} /></div>}
                  {top3[0] && <div onClick={() => handleSelect(top3[0], 0)} style={{ flex: 1, cursor: 'pointer' }}><PodiumCard user={top3[0]} rank={0} /></div>}
                  {top3[2] && <div onClick={() => handleSelect(top3[2], 2)} style={{ flex: 1, cursor: 'pointer' }}><PodiumCard user={top3[2]} rank={2} /></div>}
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
                    onSelect={handleSelect}
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
                    onSelect={handleSelect}
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

      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          rank={selectedRank}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </Panel>
  );
}
