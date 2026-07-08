import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

import { T, GLASS, GLASS_STRONG, GLASS_GOLD } from './design.js';
import { RichText } from './components/RichText.jsx';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassPanel, GlassSection, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';
import { logError } from './errorLogger.js';

// ─── Таймер обратного отсчёта ─────────────────────────────────────────────────

function calcLeft(raffleDate) {
  if (!raffleDate) return null;
  const target = raffleDate.toDate ? raffleDate.toDate() : new Date(raffleDate);
  const diff = target - Date.now();
  if (diff <= 0) return null;
  return {
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins:  Math.floor((diff % 3600000) / 60000),
    secs:  Math.floor((diff % 60000) / 1000),
  };
}

function useCountdown(raffleDate) {
  const [left, setLeft] = useState(() => calcLeft(raffleDate));
  useEffect(() => {
    const t = setInterval(() => setLeft(calcLeft(raffleDate)), 1000);
    return () => clearInterval(t);
  }, [raffleDate]);
  return left;
}

// ─── Карточка покупки приза ───────────────────────────────────────────────────

function PrizeCard({ prize, userKeys, onClaim, isClaimed, index }) {
  const canAfford   = userKeys >= prize.cost;
  const outOfStock  = prize.stock !== null && prize.stock !== undefined && prize.stock <= 0;
  const unavailable = outOfStock || isClaimed;

  return (
    <div style={{
      background: isClaimed ? 'rgba(75,179,75,0.05)' : T.chipBg,
      backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
      borderRadius: 24, padding: 16,
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
          <div style={{ fontSize: 15, fontWeight: 700, color: outOfStock ? T.textSec : T.textPri, marginBottom: 3 }}>{prize.name}</div>
          {prize.description && <RichText color={T.textSec} fontSize={12}>{prize.description}</RichText>}
        </div>
        {isClaimed && (
          <div style={{ fontSize: 10, fontWeight: 700, color: T.green, background: 'rgba(75,179,75,0.12)', border: '1px solid rgba(75,179,75,0.3)', borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>ПОЛУЧЕНО</div>
        )}
        {!isClaimed && outOfStock && (
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textSec, background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>РАЗОБРАНО</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          flex: 1, background: canAfford && !unavailable ? 'rgba(201,168,76,0.08)' : T.chipBg,
          border: `1px solid ${canAfford && !unavailable ? 'rgba(201,168,76,0.2)' : T.border}`,
          borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>🗝️</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: canAfford && !unavailable ? T.gold : T.textSec }}>{prize.cost}</div>
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
            background: isClaimed ? 'rgba(75,179,75,0.15)' : outOfStock ? T.chipBg : canAfford ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})` : T.chipBg,
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

// ─── Карточка розыгрыша ───────────────────────────────────────────────────────

function RaffleCard({ prize, userKeys, myEntry, counts, onEnter, index, partners = [], experts = [] }) {
  const left    = useCountdown(prize.raffleDate);
  const ended   = !left;
  const myTickets = myEntry?.ticketsCount ?? 0;
  const maxReached = prize.maxTickets && (counts?.tickets ?? 0) >= prize.maxTickets;

  const raffleDate = prize.raffleDate?.toDate ? prize.raffleDate.toDate()
    : prize.raffleDate ? new Date(prize.raffleDate) : null;
  const dateStr = raffleDate
    ? raffleDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    : '';

  const isWinner = prize.winner && String(prize.winner.userId) === String(myEntry?.userId ?? '');

  return (
    <div style={{
      background: T.chipBg,
      backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
      borderRadius: 24, padding: 16,
      border: `1px solid ${isWinner ? 'rgba(75,179,75,0.4)' : 'rgba(150,100,255,0.25)'}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      animation: `fadeInUp 0.4s ease ${index * 0.06}s both`,
    }}>
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: 'rgba(150,100,255,0.12)', border: '1px solid rgba(150,100,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
          {prize.emoji ?? '🎟️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>{prize.name}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#9664FF', background: 'rgba(150,100,255,0.15)', border: '1px solid rgba(150,100,255,0.3)', borderRadius: 6, padding: '2px 7px', flexShrink: 0, letterSpacing: 0.5 }}>РОЗЫГРЫШ</div>
          </div>
          {prize.description && <RichText color={T.textSec} fontSize={12}>{prize.description}</RichText>}
        </div>
      </div>

      {/* Таймер / победитель */}
      {!ended ? (
        <div style={{ background: 'rgba(150,100,255,0.07)', border: '1px solid rgba(150,100,255,0.2)', borderRadius: 14, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⏱️</span>
          <div>
            <div style={{ fontSize: 10, color: T.textSec, marginBottom: 2 }}>Розыгрыш {dateStr}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#9664FF', fontVariantNumeric: 'tabular-nums', letterSpacing: 0.5 }}>
              {left.days > 0 ? `${left.days}д ` : ''}{String(left.hours).padStart(2,'0')}:{String(left.mins).padStart(2,'0')}:{String(left.secs).padStart(2,'0')}
            </div>
          </div>
        </div>
      ) : prize.winner ? (
        <div style={{ background: isWinner ? 'rgba(75,179,75,0.1)' : T.chipBg, border: `1px solid ${isWinner ? 'rgba(75,179,75,0.35)' : T.border}`, borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
          {isWinner ? (
            <>
              <div style={{ fontSize: 12, color: T.green, fontWeight: 700, marginBottom: 4 }}>🎉 Вы выиграли этот розыгрыш!</div>
              {(() => {
                const donorName = prize.partnerName
                  ?? partners.find(p => p.id === prize.partnerId)?.name
                  ?? experts.find(e => e.id === prize.expertId)?.name;
                const donorContact = prize.partnerContact ?? prize.partnerPhone;
                return donorName ? (
                  <>
                    <div style={{ fontSize: 13, color: T.textPri }}>{donorName}</div>
                    {donorContact && <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{donorContact}</div>}
                  </>
                ) : null;
              })()}
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: T.textSec, marginBottom: 3 }}>Победитель розыгрыша</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri }}>🏆 {prize.winner.userName}</div>
            </>
          )}
        </div>
      ) : (
        <div style={{ background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: 14, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: T.textSec }}>Розыгрыш завершён · Определяем победителя...</div>
        </div>
      )}

      {/* Счётчики */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: T.chipBg, borderRadius: 12, padding: '8px 10px', border: `1px solid ${T.border}`, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>{counts?.participants ?? 0}</div>
          <div style={{ fontSize: 10, color: T.textSec, marginTop: 1 }}>участников</div>
        </div>
        <div style={{ flex: 1, background: T.chipBg, borderRadius: 12, padding: '8px 10px', border: `1px solid ${T.border}`, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>{counts?.tickets ?? 0}</div>
          <div style={{ fontSize: 10, color: T.textSec, marginTop: 1 }}>билетов</div>
        </div>
        <div style={{ flex: 1, background: myTickets > 0 ? 'rgba(150,100,255,0.08)' : T.chipBg, borderRadius: 12, padding: '8px 10px', border: `1px solid ${myTickets > 0 ? 'rgba(150,100,255,0.3)' : T.border}`, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: myTickets > 0 ? '#9664FF' : T.textPri }}>{myTickets}</div>
          <div style={{ fontSize: 10, color: T.textSec, marginTop: 1 }}>мои билеты</div>
        </div>
      </div>

      {/* Кнопка участия */}
      {!ended && !prize.winner && (
        maxReached ? (
          <div style={{ textAlign: 'center', fontSize: 12, color: T.textSec, padding: '6px 0' }}>Все билеты разобраны</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(150,100,255,0.06)', border: '1px solid rgba(150,100,255,0.2)', borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🎟️</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#9664FF' }}>{prize.ticketCost} 🗝️</div>
                <div style={{ fontSize: 10, color: T.textSec }}>за билет</div>
              </div>
            </div>
            <button
              onClick={() => onEnter(prize)}
              disabled={userKeys < (prize.ticketCost ?? 0)}
              style={{
                padding: '11px 18px', borderRadius: 14, border: 'none', flexShrink: 0,
                cursor: userKeys < (prize.ticketCost ?? 0) ? 'default' : 'pointer',
                background: userKeys < (prize.ticketCost ?? 0) ? T.chipBg : 'linear-gradient(135deg, #9664FF, #7B4FD4)',
                color: userKeys < (prize.ticketCost ?? 0) ? T.textSec : '#fff',
                fontSize: 13, fontWeight: 700,
              }}
            >
              {userKeys < (prize.ticketCost ?? 0) ? 'Мало ключей' : (myTickets > 0 ? 'Ещё билеты' : 'Участвовать')}
            </button>
          </div>
        )
      )}
    </div>
  );
}

function PrizeCardV2({ prize, userKeys, onClaim, isClaimed, index }) {
  const canAfford = userKeys >= (prize.cost ?? 0);
  const outOfStock = prize.stock !== null && prize.stock !== undefined && prize.stock <= 0;
  const disabled = isClaimed || outOfStock || !canAfford;
  return (
    <GlassCard tone={canAfford && !disabled ? 'gold' : 'glass'} style={{ borderRadius: 32, padding: 0, overflow: 'hidden', animation: `fadeInUp 0.34s ease ${index * 0.04}s both` }}>
      <div style={{ padding: 17, display: 'flex', gap: 14 }}>
        <div style={{ width: 72, height: 72, borderRadius: 28, background: 'radial-gradient(circle at 34% 22%,rgba(255,247,214,0.34),transparent 38%), linear-gradient(145deg,rgba(215,184,106,0.24),rgba(255,255,255,0.065))', border: '1px solid rgba(215,184,106,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, flexShrink: 0, filter: outOfStock ? 'grayscale(1)' : 'none' }}>{prize.emoji ?? '🎁'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ color: canAfford && !disabled ? '#17120a' : APG2_PROFILE.text, fontSize: 17, lineHeight: '21px', fontWeight: 860, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{prize.name || 'Приз АПГ'}</div>
            <GlassBadge tone={canAfford && !disabled ? 'glass' : 'gold'} style={{ flexShrink: 0 }}>{prize.cost ?? 0} 🗝️</GlassBadge>
          </div>
          {prize.description && <div style={{ color: canAfford && !disabled ? 'rgba(20,15,8,0.66)' : APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '18px', marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{prize.description}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {isClaimed && <GlassBadge>Получено</GlassBadge>}
            {outOfStock && <GlassBadge>Разобрано</GlassBadge>}
            {!isClaimed && !outOfStock && prize.stock !== null && prize.stock !== undefined && <GlassBadge>осталось {prize.stock}</GlassBadge>}
            {!canAfford && !isClaimed && !outOfStock && <GlassBadge>не хватает {(prize.cost ?? 0) - userKeys}</GlassBadge>}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 17px 17px' }}>
        <GlassButton onClick={() => !disabled && onClaim(prize)} tone={canAfford && !disabled ? 'glass' : 'gold'} style={{ width: '100%', minHeight: 50, opacity: disabled ? 0.62 : 1, color: canAfford && !disabled ? '#17120a' : APG2_PROFILE.text }}>
          {isClaimed ? 'Уже получено' : outOfStock ? 'Нет в наличии' : !canAfford ? 'Мало ключей' : 'Получить приз'}
        </GlassButton>
      </div>
    </GlassCard>
  );
}

function RaffleCardV2({ prize, userKeys, myEntry, counts, onEnter, index }) {
  const left = useCountdown(prize.raffleDate);
  const myTickets = myEntry?.ticketsCount ?? 0;
  const ended = !left || !!prize.winner;
  const canEnter = !ended && userKeys >= (prize.ticketCost ?? 0);
  return (
    <GlassCard style={{ borderRadius: 34, padding: 18, minHeight: 190, position: 'relative', overflow: 'hidden', animation: `fadeInUp 0.34s ease ${index * 0.04}s both` }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 10%,rgba(150,100,255,0.22),transparent 36%), radial-gradient(circle at 16% 92%,rgba(215,184,106,0.12),transparent 34%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <GlassBadge tone="gold">Розыгрыш</GlassBadge>
          <GlassBadge>{prize.ticketCost ?? 0} 🗝️ / билет</GlassBadge>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 46, lineHeight: 1 }}>{prize.emoji ?? '🎟️'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 21, lineHeight: '25px', fontWeight: 880, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{prize.name || 'Розыгрыш АПГ'}</div>
            {prize.description && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '18px', marginTop: 7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{prize.description}</div>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '17px 0 14px' }}>
          <StatPill label="участников" value={counts?.participants ?? 0} />
          <StatPill label="билетов" value={counts?.tickets ?? 0} />
          <StatPill label="моих" value={myTickets} tone={myTickets ? 'gold' : 'glass'} />
        </div>
        <GlassButton onClick={() => canEnter && onEnter(prize)} tone={canEnter ? 'gold' : 'glass'} style={{ width: '100%', opacity: canEnter ? 1 : 0.62, color: canEnter ? '#17120a' : APG2_PROFILE.text }}>
          {ended ? (prize.winner ? `Победитель: ${prize.winner.userName ?? 'определен'}` : 'Розыгрыш завершен') : canEnter ? (myTickets ? 'Купить еще билеты' : 'Участвовать') : 'Недостаточно ключей'}
        </GlassButton>
      </div>
    </GlassCard>
  );
}

// ─── Шит выбора билетов ───────────────────────────────────────────────────────

function TicketSheet({ prize, userKeys, onConfirm, onCancel, confirming }) {
  const [count, setCount] = useState(1);
  const ticketCost = prize.ticketCost ?? 0;
  const totalCost  = count * ticketCost;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ width: '100%', maxWidth: 420, ...APG2_PROFILE.glass, borderRadius: '34px 34px 0 0', padding: '28px 22px 22px', animation: 'fadeInUp 0.3s ease', color: APG2_PROFILE.text }}>
        <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 10 }}>{prize.emoji ?? '🎟️'}</div>
        <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: APG2_PROFILE.text, marginBottom: 4 }}>{prize.name}</div>
        <div style={{ textAlign: 'center', fontSize: 12, color: APG2_PROFILE.textSoft, marginBottom: 24 }}>
          1 билет = {ticketCost} 🗝️ · Чем больше билетов — тем выше шанс
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: APG2_PROFILE.textSoft, textAlign: 'center', marginBottom: 12 }}>Количество билетов</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map(n => {
              const canBuy = userKeys >= n * ticketCost;
              const sel    = count === n;
              return (
                <button
                  key={n}
                  onClick={() => canBuy && setCount(n)}
                  disabled={!canBuy}
                  style={{
                    width: 50, height: 50, borderRadius: 14,
                    border: `2px solid ${sel ? '#9664FF' : 'rgba(255,255,255,0.16)'}`,
                    background: sel ? 'rgba(150,100,255,0.18)' : 'rgba(255,255,255,0.08)',
                    color: !canBuy ? APG2_PROFILE.textMuted : sel ? '#9664FF' : APG2_PROFILE.text,
                    fontSize: 17, fontWeight: 700,
                    cursor: canBuy ? 'pointer' : 'default',
                    opacity: canBuy ? 1 : 0.35,
                    transition: 'all 0.15s',
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: 'rgba(150,100,255,0.09)', border: '1px solid rgba(150,100,255,0.24)', borderRadius: 16, padding: '12px 16px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: APG2_PROFILE.textSoft }}>
            {count} билет{count === 1 ? '' : count < 5 ? 'а' : 'ов'} · останется {userKeys - totalCost} 🗝️
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#9664FF' }}>{totalCost} 🗝️</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <GlassButton onClick={onCancel} style={{ flex: 1 }}>Отмена</GlassButton>
          <GlassButton
            onClick={() => onConfirm(count)}
            disabled={confirming || userKeys < totalCost}
            style={{ flex: 1.5, background: 'linear-gradient(135deg, #9664FF, #7B4FD4)', color: '#fff', border: '1px solid rgba(150,100,255,0.4)' }}
          >
            {confirming ? 'Оформляем...' : '🎟️ Купить билеты'}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ─── Модал подтверждения покупки ──────────────────────────────────────────────

function ConfirmModal({ prize, userKeys, onConfirm, onCancel, claiming }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ width: '100%', maxWidth: 420, ...APG2_PROFILE.glass, borderRadius: '34px 34px 0 0', padding: '28px 22px 22px', animation: 'fadeInUp 0.3s ease', color: APG2_PROFILE.text }}>
        <div style={{ textAlign: 'center', fontSize: 56, marginBottom: 14 }}>{prize.emoji ?? '🎁'}</div>
        <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 800, color: APG2_PROFILE.text, marginBottom: 8 }}>{prize.name}</div>
        <div style={{ textAlign: 'center', fontSize: 14, color: APG2_PROFILE.textSoft, lineHeight: '22px', marginBottom: 22 }}>
          Потратить <span style={{ color: APG2_PROFILE.gold, fontWeight: 700 }}>{prize.cost} 🗝️</span> на этот приз?
          <br />
          <span style={{ fontSize: 12 }}>Останется: {userKeys - prize.cost} ключей</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <GlassButton onClick={onCancel} style={{ flex: 1 }}>Отмена</GlassButton>
          <GlassButton onClick={onConfirm} disabled={claiming} tone="gold" style={{ flex: 1.5 }}>
            {claiming ? 'Обработка...' : 'Подтвердить →'}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

// ─── Модал успешного получения ────────────────────────────────────────────────

function ClaimSuccessModal({ prize, onClose, partners = [], experts = [] }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ width: '100%', maxWidth: 420, ...APG2_PROFILE.glass, borderRadius: '34px 34px 0 0', padding: '28px 22px 22px', animation: 'fadeInUp 0.3s ease', color: APG2_PROFILE.text }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 64, marginBottom: 12, animation: 'float 2.5s ease-in-out infinite' }}>{prize.emoji ?? '🎁'}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: APG2_PROFILE.gold, marginBottom: 6 }}>Приз получен! 🎉</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: APG2_PROFILE.text, marginBottom: 16 }}>{prize.name}</div>
          <div style={{ background: 'rgba(75,179,75,0.08)', border: '1px solid rgba(75,179,75,0.3)', borderRadius: 16, padding: '12px 16px' }}>
            <div style={{ fontSize: 13, color: '#4BB34B', fontWeight: 600, lineHeight: '20px' }}>
              Покажи этот экран сотруднику при получении
            </div>
          </div>
        </div>

        {(() => {
          const donorName = prize.partnerName
            ?? partners.find(p => p.id === prize.partnerId)?.name
            ?? experts.find(e => e.id === prize.expertId)?.name;
          const donorContact = prize.partnerContact ?? prize.partnerPhone;
          const isExpert = !prize.partnerId && !prize.partnerName && !!prize.expertId;
          return donorName ? (
            <div style={{ ...APG2_PROFILE.glass, borderRadius: 20, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: APG2_PROFILE.textSoft, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                {isExpert ? '🎓 Эксперт' : '📍 Партнёр'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: APG2_PROFILE.text, marginBottom: donorContact ? 4 : 0 }}>{donorName}</div>
              {donorContact && <div style={{ fontSize: 13, color: APG2_PROFILE.textSoft }}>{donorContact}</div>}
            </div>
          ) : null;
        })()}

        <GlassButton onClick={onClose} tone="gold" style={{ width: '100%' }}>Понятно</GlassButton>
      </div>
    </div>
  );
}

// ─── Главная страница наград ──────────────────────────────────────────────────

export function RewardsPage({ nav = 'rewards', variant = 'v2', user, userKeys, onBack, onClaim, onRaffleEnter, partners = [], experts = [] }) {
  const [prizes, setPrizes]               = useState([]);
  const [myClaims, setMyClaims]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(false);
  const [confirmPrize, setConfirmPrize]   = useState(null);
  const [claimedPrize, setClaimedPrize]   = useState(null);
  const [claiming, setClaiming]           = useState(false);

  // Розыгрыши
  const [myRaffleEntries, setMyRaffleEntries] = useState({});   // prizeId → entry
  const [raffleCounts, setRaffleCounts]       = useState({});   // prizeId → {participants, tickets}
  const [raffleSheet, setRaffleSheet]         = useState(null); // приз в шите выбора билетов
  const [enteringRaffle, setEnteringRaffle]   = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    setLoading(true);
    (async () => {
      let allPrizes = [];
      try {
        const prizesSnap = await getDocs(collection(db, 'prizes'));
        if (!alive) return;
        allPrizes = prizesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const loaded = allPrizes
          .filter(p => p.active !== false)
          .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
        setPrizes(loaded);
      } catch (e) {
        logError(e, 'RewardsPage.fetchPrizes');
        if (alive) setLoadError(true);
      }
      if (alive) setLoading(false);

      if (!alive) return;
      if (user && !String(user.id).startsWith('guest_')) {
        const uid = String(user.id);
        try {
          const [claimsSnap, entriesSnap] = await Promise.all([
            getDocs(query(collection(db, 'users', uid, 'claims'), orderBy('claimedAt', 'desc'))),
            getDocs(query(collection(db, 'raffleEntries'), where('userId', '==', uid))),
          ]);
          if (!alive) return;
          setMyClaims(claimsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          const entries = {};
          entriesSnap.docs.forEach(d => { entries[d.data().prizeId] = { id: d.id, ...d.data() }; });
          setMyRaffleEntries(entries);
        } catch (e) { logError(e, 'RewardsPage.fetchUserClaimsAndEntries'); }

        try {
          const rafflePrizes = allPrizes
            .filter(p => p.active !== false && p.type === 'raffle');
          if (rafflePrizes.length > 0) {
            const counts = {};
            await Promise.all(rafflePrizes.map(async p => {
              const snap = await getDocs(query(collection(db, 'raffleEntries'), where('prizeId', '==', p.id)));
              const docs = snap.docs.map(d => d.data());
              counts[p.id] = {
                participants: docs.length,
                tickets: docs.reduce((s, d) => s + (d.ticketsCount ?? 0), 0),
              };
            }));
            if (alive) setRaffleCounts(counts);
          }
        } catch (e) { logError(e, 'RewardsPage.fetchRaffleCounts'); }
      }
    })();
    return () => { alive = false; };
  }, [user]);

  const handleConfirmClaim = async () => {
    if (!confirmPrize) return;
    setClaiming(true);
    try {
      const success = await onClaim(confirmPrize);
      if (success) {
        setMyClaims(prev => [{ id: String(Date.now()), prizeId: confirmPrize.id, prizeName: confirmPrize.name, prizeEmoji: confirmPrize.emoji, cost: confirmPrize.cost, claimedAt: { toDate: () => new Date() } }, ...prev]);
        if (confirmPrize.stock !== null && confirmPrize.stock !== undefined) {
          setPrizes(prev => prev.map(p => p.id === confirmPrize.id ? { ...p, stock: (p.stock ?? 1) - 1 } : p).filter(p => p.stock === null || p.stock === undefined || p.stock > 0));
        }
        const won = confirmPrize;
        setConfirmPrize(null);
        setClaimedPrize(won);
      }
    } finally { setClaiming(false); }
  };

  const handleEnterRaffle = async (ticketCount) => {
    if (!raffleSheet || !onRaffleEnter) return;
    setEnteringRaffle(true);
    try {
      const success = await onRaffleEnter(raffleSheet, ticketCount);
      if (success) {
        const prizeId = raffleSheet.id;
        const uid = String(user.id);
        setMyRaffleEntries(prev => ({
          ...prev,
          [prizeId]: { ...prev[prizeId], userId: uid, ticketsCount: (prev[prizeId]?.ticketsCount ?? 0) + ticketCount },
        }));
        setRaffleCounts(prev => {
          const ex = prev[prizeId];
          return {
            ...prev,
            [prizeId]: {
              participants: ex ? ex.participants : (prev[prizeId]?.participants ?? 0) + 1,
              tickets: (ex?.tickets ?? 0) + ticketCount,
            },
          };
        });
        setRaffleSheet(null);
      }
    } finally { setEnteringRaffle(false); }
  };

  const claimedIds = useMemo(() => new Set(myClaims.map(c => c.prizeId)), [myClaims]);

  const purchasePrizes = useMemo(() => prizes.filter(p => !p.type || p.type === 'purchase'), [prizes]);
  const rafflePrizes   = useMemo(() => prizes.filter(p => p.type === 'raffle'), [prizes]);

  if (variant === 'v2') {
    return (
      <GlassPanel>
        <ScreenHeader title="Призы" subtitle={`Баланс: ${userKeys} ключей`} kicker="Награды АПГ" onBack={onBack} />
        <GlassCard tone="gold" style={{ borderRadius: 36, padding: 20, marginBottom: 18 }}>
          <div style={{ color: 'rgba(20,15,8,0.62)', fontSize: 12, fontWeight: 760, marginBottom: 4 }}>Доступно для обмена</div>
          <div style={{ color: '#17120a', fontSize: 44, lineHeight: '46px', fontWeight: 940 }}>{userKeys} <span style={{ fontSize: 24 }}>🗝️</span></div>
          <div style={{ color: 'rgba(20,15,8,0.66)', fontSize: 13, lineHeight: '18px', marginTop: 10 }}>Ключи превращаются в подарки, участия в розыгрышах и маленькие городские радости.</div>
        </GlassCard>
        {loadError && <EmptyStateV2 icon="⚠️" title="Не удалось загрузить призы" text="Проверьте соединение и попробуйте снова." />}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1, 2, 3].map(i => <GlassCard key={i} style={{ height: 132, animation: 'shimmer 1.5s ease-in-out infinite' }} />)}</div>
        ) : prizes.length === 0 ? (
          <EmptyStateV2 icon="🎁" title="Призы скоро появятся" text="Мы готовим награды, которые будет приятно получить." />
        ) : (
          <>
            {rafflePrizes.length > 0 && (
              <GlassSection title="Розыгрыши">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {rafflePrizes.map((prize, i) => <RaffleCardV2 key={prize.id} prize={prize} userKeys={userKeys} myEntry={myRaffleEntries[prize.id]} counts={raffleCounts[prize.id]} onEnter={p => setRaffleSheet(p)} index={i} />)}
                </div>
              </GlassSection>
            )}
            {purchasePrizes.length > 0 && (
              <GlassSection title="Обменять ключи">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {purchasePrizes.map((prize, i) => <PrizeCardV2 key={prize.id} prize={prize} userKeys={userKeys} onClaim={p => setConfirmPrize(p)} isClaimed={claimedIds.has(prize.id)} index={i} />)}
                </div>
              </GlassSection>
            )}
            {myClaims.length > 0 && (
              <GlassSection title="Мои призы">
                <GlassCard style={{ borderRadius: 30, padding: 8 }}>
                  {myClaims.map((claim, i) => (
                    <div key={claim.id} style={{ padding: '12px 10px', borderBottom: i < myClaims.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 0, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 17, background: APG2_PROFILE.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{claim.prizeEmoji ?? '🎁'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: APG2_PROFILE.text, fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claim.prizeName}</div>
                        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, marginTop: 2 }}>−{claim.cost} ключей</div>
                      </div>
                      <GlassBadge>выдадут</GlassBadge>
                    </div>
                  ))}
                </GlassCard>
              </GlassSection>
            )}
          </>
        )}
        {confirmPrize && <ConfirmModal prize={confirmPrize} userKeys={userKeys} onConfirm={handleConfirmClaim} onCancel={() => !claiming && setConfirmPrize(null)} claiming={claiming} />}
        {claimedPrize && <ClaimSuccessModal prize={claimedPrize} onClose={() => setClaimedPrize(null)} partners={partners} experts={experts} />}
        {raffleSheet && <TicketSheet prize={raffleSheet} userKeys={userKeys} onConfirm={handleEnterRaffle} onCancel={() => !enteringRaffle && setRaffleSheet(null)} confirming={enteringRaffle} />}
      </GlassPanel>
    );
  }

  return (
    <>
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

      <div style={{ background: 'transparent', minHeight: '100%', padding: '12px 16px 90px' }}>

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

        {loadError && (
          <div style={{ ...GLASS, borderRadius: 16, padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid rgba(220,53,69,0.25)' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ fontSize: 13, color: T.textSec }}>Не удалось загрузить призы. Проверьте соединение.</span>
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
            {/* Розыгрыши */}
            {rafflePrizes.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9664FF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                  🎟️ Розыгрыши · {rafflePrizes.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  {rafflePrizes.map((prize, i) => (
                    <RaffleCard
                      key={prize.id}
                      prize={prize}
                      userKeys={userKeys}
                      myEntry={myRaffleEntries[prize.id]}
                      counts={raffleCounts[prize.id]}
                      onEnter={p => setRaffleSheet(p)}
                      index={i}
                      partners={partners}
                      experts={experts}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Обычные призы */}
            {purchasePrizes.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textSec, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                  Доступно · {purchasePrizes.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {purchasePrizes.map((prize, i) => (
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
              </>
            )}

            {/* История получений */}
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
      {claimedPrize && (
        <ClaimSuccessModal prize={claimedPrize} onClose={() => setClaimedPrize(null)} partners={partners} experts={experts} />
      )}
      {raffleSheet && (
        <TicketSheet
          prize={raffleSheet}
          userKeys={userKeys}
          onConfirm={handleEnterRaffle}
          onCancel={() => !enteringRaffle && setRaffleSheet(null)}
          confirming={enteringRaffle}
        />
      )}
    </>
  );
}
