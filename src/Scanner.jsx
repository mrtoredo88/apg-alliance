import React from 'react';

const T = {
  gold: '#C9A84C', goldL: '#E8C97A',
  textPri: '#F0F0F0', textSec: 'rgba(240,240,240,0.5)',
  border: 'rgba(255,255,255,0.07)',
};

export default function Scanner({ isOpen, onClose, mapPlaces, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(8,8,24,0.96)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.textPri }}>Выбор партнёра</div>
          <div style={{ fontSize: 12, color: T.textSec, marginTop: 2 }}>Ручной режим — камера недоступна</div>
        </div>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: `1px solid ${T.border}`, color: T.textSec, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mapPlaces.map(place => (
          <button
            key={place.id}
            onClick={() => onConfirm(place.id)}
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))',
              border: `1px solid ${T.border}`,
              color: T.textPri, padding: '14px 16px', borderRadius: 16,
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.gold + '18', border: `1px solid ${T.gold}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {place.emoji ?? '🏪'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.textPri, fontWeight: 700 }}>{place.name}</div>
              {place.categoryLabel && <div style={{ fontSize: 11, color: T.gold, marginTop: 2 }}>{place.categoryLabel}</div>}
            </div>
            <div style={{ fontSize: 12, color: T.gold, fontWeight: 700 }}>+1 🗝️</div>
          </button>
        ))}
      </div>
    </div>
  );
}
