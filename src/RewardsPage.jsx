import React, { useState, useEffect } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

import { T, GLASS, GLASS_STRONG, GLASS_GOLD } from './design.js';

function PrizeCard({ prize, userKeys, onClaim, isClaimed, index }) {
  const canAfford = userKeys >= prize.cost;
  const outOfStock = prize.stock !== null && prize.stock !== undefined && prize.stock <= 0;
  const unavailable = outOfStock || isClaimed;

  return (
    <div style={{
      background: isClaimed ? 'rgba(75,179,75,0.05)' : T.chipBg,
      backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
      borderRadius: 24,
      padding: 16,
      border: `1px solid ${isClaimed ? 'rgba(75,179,75,0.3)' : outOfStock ? T.border : canAfford ? 'rgba(201,168,76,0.22)' : T.border}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      animation: `fadeInUp 0.4s ease ${index * 0.06}s both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, flexShrink: 0,
          background: isClaimed ? 'rgba(75,179,75,0.12)' : outOfStock ? T.chipBg : 'rgba(201,168,76,0.1)',
          border: `1px solid ${isClaimed ? 'rgba(75,179,75,0.3)' : outOfStock ? T.border : 'rgba(201,168,76,0.25)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          filter: outOfStock && !isClaimed ? 'grayscale(1) opacity(0.5)' : 'none',
        }}>
          {prize.emoji ?? '🎁'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: outOfStock ? T.textSec : T.textPri, marginBottom: 3 }}>
            {prize.name}
          </div>
          {prize.description && (
            <div style={{ fontSize: 12, color: T.textSec, lineHeight: '16px' }}>{prize.description}</div>
          )}
        </div>
        {isClaimed && (
          <div style={{ fontSize: 10, fontWeight: 700, color: T.green, background: 'rgba(75,179,75,0.12)', border: '1px solid rgba(75,179,75,0.3)', borderRadius: 8, padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            ПОЛУЧЕНО
          </div>
        )}
        {!isClaimed && outOfStock && (
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '3px 8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            РАЗОБРАНО
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          flex: 1,
          background: canAfford && !unavailable ? 'rgba(201,168,76,0.08)' : T.chipBg,
          border: `1px solid ${canAfford && !unavailable ? 'rgba(201,168,76,0.2)' : T.border}`,
          borderRadius: 12, padding: '8px 12px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>🗝️</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: canAfford && !unavailable ? T.gold : T.textSec }}>
              {prize.cost}
            </div>
            {!canAfford && !isClaimed && !outOfStock && (
              <div style={{ fontSize: 10, color: T.textSec }}>не хватает {prize.cost - userKeys}</div>
            )}
          </div>
        </div>
        <button
          onClick={() => !unavailable && canAfford && onClaim(prize)}
          disabled={unavailable || !canAfford}
          style={{
            padding: '11px 18px', borderRadius: 14, border: 'none',
            cursor: unavailable || !canAfford ? 'default' : 'pointer',
            background: isClaimed
              ? 'rgba(75,179,75,0.15)'
              : outOfStock
                ? T.chipBg
                : canAfford
                  ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})`
                  : T.chipBg,
            color: isClaimed ? T.green : outOfStock || !canAfford ? T.textSec : '#0F0F1A',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}
        >
          {isClaimed ? '✓ Получено' : outOfStock ? 'Нет в наличии' : !canAfford ? 'Мало ключей' : 'Получить'}
        </button>
      </div>

      {!isClaimed && prize.stock !== null && prize.stock !== undefined && prize.stock > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: T.textSec }}>В наличии: {prize.stock} шт.</div>
      )}
    </div>
  );
}

function ConfirmModal({ prize, userKeys, onConfirm, onCancel, claiming }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: 420, ...GLASS_STRONG, borderRadius: '28px 28px 0 0', padding: '28px 22px 22px', animation: 'fadeInUp 0.3s ease' }}>
        <div style={{ textAlign: 'center', fontSize: 56, marginBottom: 14 }}>{prize.emoji ?? '🎁'}</div>
        <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, color: T.textPri, marginBottom: 8 }}>{prize.name}</div>
        <div style={{ textAlign: 'center', fontSize: 14, color: T.textSec, lineHeight: '22px', marginBottom: 22 }}>
          Потратить <span style={{ color: T.gold, fontWeight: 700 }}>{prize.cost} 🗝️</span> на этот приз?
          <br />
          <span style={{ fontSize: 12 }}>Останется: {userKeys - prize.cost} ключей</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${T.border}`, color: T.textPri, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={claiming}
            style={{ flex: 1.5, padding: '14px 0', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 14, fontWeight: 800, cursor: claiming ? 'default' : 'pointer', opacity: claiming ? 0.7 : 1 }}
          >
            {claiming ? 'Обработка...' : 'Подтвердить →'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RewardsPage({ nav = 'rewards', user, userKeys, onBack, onClaim }) {
  const [prizes, setPrizes] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmPrize, setConfirmPrize] = useState(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const prizesSnap = await getDocs(
          query(collection(db, 'prizes'), where('active', '==', true), orderBy('cost', 'asc'))
        );
        setPrizes(prizesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        if (user && user.id !== 'guest') {
          const claimsSnap = await getDocs(
            query(collection(db, 'users', String(user.id), 'claims'), orderBy('claimedAt', 'desc'))
          );
          setMyClaims(claimsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [user]);

  const handleConfirmClaim = async () => {
    if (!confirmPrize) return;
    setClaiming(true);
    try {
      const success = await onClaim(confirmPrize);
      if (success) {
        setMyClaims(prev => [{
          id: String(Date.now()),
          prizeId: confirmPrize.id,
          prizeName: confirmPrize.name,
          prizeEmoji: confirmPrize.emoji,
          cost: confirmPrize.cost,
          claimedAt: { toDate: () => new Date() },
        }, ...prev]);
        if (confirmPrize.stock !== null && confirmPrize.stock !== undefined) {
          setPrizes(prev => prev.map(p =>
            p.id === confirmPrize.id ? { ...p, stock: (p.stock ?? 1) - 1 } : p
          ).filter(p => p.stock === null || p.stock === undefined || p.stock > 0));
        }
        setConfirmPrize(null);
      }
    } finally {
      setClaiming(false);
    }
  };

  const claimedIds = new Set(myClaims.map(c => c.prizeId));

  return (
    <Panel id={nav}>
      {/* Хедер */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: `1px solid ${T.headerBorder}`, borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>🎁 Обменять ключи</div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>Баланс: {userKeys} 🗝️</div>
          </div>
        </div>
      </div>

      <div style={{ background: T.bg, minHeight: '100%', padding: '12px 16px 90px' }}>

        {/* Баланс-карточка */}
        <div style={{ ...GLASS_GOLD, borderRadius: 24, padding: '16px 20px', marginBottom: userKeys === 0 ? 12 : 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40 }}>🗝️</div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: T.gold, lineHeight: 1 }}>{userKeys}</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>ключей доступно</div>
          </div>
          {myClaims.length > 0 && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.textPri }}>{myClaims.length}</div>
              <div style={{ fontSize: 11, color: T.textSec }}>получено</div>
            </div>
          )}
        </div>

        {userKeys === 0 && (
          <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 20, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>💡</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 4 }}>Как заработать ключи?</div>
              <div style={{ fontSize: 12, color: T.textSec, lineHeight: '18px' }}>
                Сканируй QR-коды в заведениях-партнёрах АПГ — каждый визит даёт 1 ключ. За «Партнёра дня» — x2. Выполняй задания и приглашай друзей.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ ...GLASS, borderRadius: 24, height: 128, animation: 'shimmer 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : prizes.length === 0 ? (
          <div style={{ ...GLASS, borderRadius: 24, padding: '48px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 56, animation: 'float 3s ease-in-out infinite' }}>🎁</div>
            <div>
              <div style={{ color: T.textPri, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Призов пока нет</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>Скоро здесь появятся интересные призы за ваши ключи</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
              Доступно · {prizes.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {prizes.map((prize, i) => (
                <PrizeCard
                  key={prize.id}
                  prize={prize}
                  userKeys={userKeys}
                  onClaim={p => setConfirmPrize(p)}
                  isClaimed={claimedIds.has(prize.id)}
                  index={i}
                />
              ))}
            </div>

            {myClaims.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, letterSpacing: 1, textTransform: 'uppercase', margin: '24px 0 12px' }}>
                  Мои призы · {myClaims.length}
                </div>
                <div style={{ ...GLASS, borderRadius: 24, overflow: 'hidden' }}>
                  {myClaims.map((claim, i) => (
                    <div key={claim.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < myClaims.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(75,179,75,0.12)', border: '1px solid rgba(75,179,75,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {claim.prizeEmoji ?? '🎁'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claim.prizeName}</div>
                        <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>−{claim.cost} 🗝️</div>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.green, background: 'rgba(75,179,75,0.12)', border: '1px solid rgba(75,179,75,0.25)', borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>
                        ✓ ВЫДАДУТ
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {confirmPrize && (
        <ConfirmModal
          prize={confirmPrize}
          userKeys={userKeys}
          onConfirm={handleConfirmClaim}
          onCancel={() => !claiming && setConfirmPrize(null)}
          claiming={claiming}
        />
      )}
    </Panel>
  );
}
