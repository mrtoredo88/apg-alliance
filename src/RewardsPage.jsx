import React, { useState, useEffect, useMemo } from 'react';
import { Panel } from '@vkontakte/vkui';
import { db } from './firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

import { T, GLASS, GLASS_STRONG, GLASS_GOLD } from './design.js';
import { RichText } from './components/RichText.jsx';

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

function RaffleCard({ prize, userKeys, myEntry, counts, onEnter, index }) {
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
              {prize.partnerName && <div style={{ fontSize: 13, color: T.textPri }}>{prize.partnerName}</div>}
              {(prize.partnerContact || prize.partnerPhone) && (
                <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>{prize.partnerContact ?? prize.partnerPhone}</div>
              )}
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

// ─── Шит выбора билетов ───────────────────────────────────────────────────────

function TicketSheet({ prize, userKeys, onConfirm, onCancel, confirming }) {
  const [count, setCount] = useState(1);
  const ticketCost = prize.ticketCost ?? 0;
  const totalCost  = count * ticketCost;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: 420, ...GLASS_STRONG, borderRadius: '28px 28px 0 0', padding: '28px 22px 22px', animation: 'fadeInUp 0.3s ease' }}>
        <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 10 }}>{prize.emoji ?? '🎟️'}</div>
        <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: T.textPri, marginBottom: 4 }}>{prize.name}</div>
        <div style={{ textAlign: 'center', fontSize: 12, color: T.textSec, marginBottom: 24 }}>
          1 билет = {ticketCost} 🗝️ · Чем больше билетов — тем выше шанс
        </div>

        {/* Выбор количества */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: T.textSec, textAlign: 'center', marginBottom: 12 }}>Количество билетов</div>
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
                    border: `2px solid ${sel ? '#9664FF' : T.border}`,
                    background: sel ? 'rgba(150,100,255,0.15)' : T.chipBg,
                    color: !canBuy ? T.textSec : sel ? '#9664FF' : T.textPri,
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

        {/* Итого */}
        <div style={{ background: 'rgba(150,100,255,0.07)', border: '1px solid rgba(150,100,255,0.2)', borderRadius: 16, padding: '12px 16px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: T.textSec }}>
            {count} билет{count === 1 ? '' : count < 5 ? 'а' : 'ов'} · останется {userKeys - totalCost} 🗝️
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#9664FF' }}>{totalCost} 🗝️</div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${T.border}`, color: T.textPri, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Отмена
          </button>
          <button
            onClick={() => onConfirm(count)}
            disabled={confirming || userKeys < totalCost}
            style={{ flex: 1.5, padding: '14px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #9664FF, #7B4FD4)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: confirming ? 'default' : 'pointer', opacity: confirming ? 0.7 : 1 }}
          >
            {confirming ? 'Оформляем...' : '🎟️ Купить билеты'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Модал подтверждения покупки ──────────────────────────────────────────────

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

// ─── Модал успешного получения ────────────────────────────────────────────────

function ClaimSuccessModal({ prize, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: 420, ...GLASS_STRONG, borderRadius: '28px 28px 0 0', padding: '28px 22px 22px', animation: 'fadeInUp 0.3s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 64, marginBottom: 12, animation: 'float 2.5s ease-in-out infinite' }}>{prize.emoji ?? '🎁'}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.gold, marginBottom: 6 }}>Приз получен! 🎉</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.textPri, marginBottom: 16 }}>{prize.name}</div>
          <div style={{ background: 'rgba(75,179,75,0.08)', border: '1px solid rgba(75,179,75,0.3)', borderRadius: 16, padding: '12px 16px' }}>
            <div style={{ fontSize: 13, color: T.green, fontWeight: 600, lineHeight: '20px' }}>
              Покажи этот экран сотруднику при получении
            </div>
          </div>
        </div>

        {(prize.partnerName || prize.partnerContact || prize.partnerPhone) && (
          <div style={{ background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: 16, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.textSec, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>📍 Партнёр</div>
            {prize.partnerName && <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, marginBottom: prize.partnerContact || prize.partnerPhone ? 4 : 0 }}>{prize.partnerName}</div>}
            {(prize.partnerContact || prize.partnerPhone) && (
              <div style={{ fontSize: 13, color: T.textSec }}>{prize.partnerContact ?? prize.partnerPhone}</div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          style={{ width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

// ─── Главная страница наград ──────────────────────────────────────────────────

export function RewardsPage({ nav = 'rewards', user, userKeys, onBack, onClaim, onRaffleEnter }) {
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
      try {
        const prizesSnap = await getDocs(collection(db, 'prizes'));
        if (!alive) return;
        const loaded = prizesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.active !== false)
          .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
        setPrizes(loaded);
      } catch (e) {
        console.error('prizes fetch error:', e);
        if (alive) setLoadError(true);
      }
      if (alive) setLoading(false);

      if (!alive) return;
      if (user && user.id !== 'guest') {
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
        } catch (e) { console.error('user claims/entries fetch error:', e); }

        try {
          const prizesSnap2 = await getDocs(collection(db, 'prizes'));
          if (!alive) return;
          const rafflePrizes = prizesSnap2.docs
            .map(d => ({ id: d.id, ...d.data() }))
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
        } catch (e) { console.error('raffle counts fetch error:', e); }
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
        <ClaimSuccessModal prize={claimedPrize} onClose={() => setClaimedPrize(null)} />
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
    </Panel>
  );
}
