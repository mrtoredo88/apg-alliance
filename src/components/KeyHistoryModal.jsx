import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { APG2_PROFILE, GlassButton, GlassCard } from './Apg2ProfileGlass.jsx';
import { userAction } from '../userApi.js';

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function operationLabel(item) {
  const type = String(item.type || '').toLowerCase();
  if (type.includes('scan') || type.includes('visit')) return 'Начисление за визит';
  if (type.includes('task')) return 'Награда за задание';
  if (type.includes('referral')) return 'Реферальная награда';
  if (type.includes('prize') || type.includes('claim')) return 'Получение подарка';
  if (type.includes('raffle') || type.includes('ticket')) return 'Билеты розыгрыша';
  if (type.includes('booking')) return 'Начисление за запись';
  return item.title || 'Операция с ключами';
}

export function KeyHistoryModal({ open, userId, currentBalance = 0, onClose, onBalance }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [balance, setBalance] = useState(Number(currentBalance) || 0);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    userAction('economy:history', { userId, limit: 100 })
      .then(result => {
        if (cancelled) return;
        const nextBalance = Number(result.balance ?? currentBalance) || 0;
        setHistory(Array.isArray(result.operations) ? result.operations : []);
        setBalance(nextBalance);
        onBalance?.(nextBalance);
      })
      .catch(cause => {
        if (!cancelled) setError(cause?.message || 'Не удалось загрузить историю ключей.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentBalance, onBalance, open, userId]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="История ключей"
      onClick={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 13000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 'calc(18px + env(safe-area-inset-top, 0px)) 12px 0',
        boxSizing: 'border-box',
        background: 'rgba(8,8,12,0.72)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <GlassCard interactiveAs="div" style={{ width: '100%', maxWidth: 560, maxHeight: 'min(86dvh, 760px)', borderRadius: '30px 30px 0 0', padding: 16, paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))', overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)' }}>
        <div style={{ display: 'grid', gap: 12, paddingBottom: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 48, height: 48, borderRadius: 19, display: 'grid', placeItems: 'center', background: APG2_PROFILE.goldGradient, color: '#17120a', fontSize: 23 }}>🗝️</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 21, lineHeight: '25px', fontWeight: 920 }}>История ключей</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '17px', marginTop: 2 }}>Текущий баланс: <strong style={{ color: APG2_PROFILE.gold }}>{balance}</strong></div>
            </div>
            <button type="button" onClick={onClose} aria-label="Закрыть" style={{ width: 38, height: 38, borderRadius: 17, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.08)', color: APG2_PROFILE.text, fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', display: 'grid', alignContent: 'start', gap: 9 }}>
          {loading && <div style={{ color: APG2_PROFILE.textSoft, padding: 24, textAlign: 'center' }}>Загружаем операции…</div>}
          {!loading && error && (
            <GlassCard style={{ textAlign: 'center', display: 'grid', gap: 10 }}>
              <div style={{ color: '#E64646', fontSize: 13 }}>{error}</div>
              <GlassButton onClick={onClose}>Закрыть</GlassButton>
            </GlassCard>
          )}
          {!loading && !error && history.length === 0 && (
            <GlassCard style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 30 }}>🗝️</div>
              <div style={{ color: APG2_PROFILE.text, fontWeight: 850, marginTop: 8 }}>История пока пуста</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 5 }}>Новые начисления и списания появятся здесь автоматически.</div>
            </GlassCard>
          )}
          {!loading && !error && history.map(item => {
            const delta = Number(item.delta || 0);
            return (
              <GlassCard key={item.id} style={{ padding: 13, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: APG2_PROFILE.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 840 }}>{operationLabel(item)}</div>
                  <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 3 }}>{item.reason || item.text || 'Операция АПГ'}</div>
                  {item.sourceLabel && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '16px', marginTop: 2 }}>{item.sourceLabel}</div>}
                  <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '15px', marginTop: 5 }}>{formatDate(item.createdAt)} · {item.statusLabel || 'Выполнено'}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 68 }}>
                  <div style={{ color: delta >= 0 ? '#4BB34B' : '#E64646', fontSize: 19, lineHeight: '23px', fontWeight: 920 }}>{delta >= 0 ? '+' : ''}{delta}</div>
                  {Number.isFinite(Number(item.balanceAfter)) && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, marginTop: 4 }}>Баланс {item.balanceAfter}</div>}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </GlassCard>
    </div>,
    document.body,
  );
}
