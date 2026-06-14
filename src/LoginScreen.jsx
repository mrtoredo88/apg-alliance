import React from 'react';

const T = {
  bg:      '#0F0F1A',
  surface: '#1A1A2E',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.5)',
};

const PERKS = [
  { icon: '🗝️', label: 'Ключи за каждый визит' },
  { icon: '🎁', label: 'Спецпредложения партнёров' },
  { icon: '🏆', label: 'Уровни и достижения' },
  { icon: '📍', label: 'Лучшие места Зеленограда' },
];

export function LoginScreen({ onLogin }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: T.bg, zIndex: 500,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 24px',
    }}>
      {/* Фон */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(201,168,76,0.05) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }} />
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,168,76,0.1), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>

        {/* Логотип */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 88, height: 88, borderRadius: 24,
            background: 'rgba(201,168,76,0.1)', border: `2px solid rgba(201,168,76,0.35)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(201,168,76,0.12)',
          }}>
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
              <polygon points="25,5 40,25 25,45 10,25" fill="rgba(201,168,76,0.1)" stroke="#C9A84C" strokeWidth="1.8"/>
              <line x1="25" y1="5" x2="25" y2="45" stroke="rgba(201,168,76,0.28)" strokeWidth="1"/>
              <line x1="10" y1="25" x2="40" y2="25" stroke="rgba(201,168,76,0.28)" strokeWidth="1"/>
              <circle cx="25" cy="25" r="4.5" fill="#C9A84C"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: T.textPri, letterSpacing: 3 }}>АПГ</div>
            <div style={{ fontSize: 12, color: T.gold, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
              Альянс Партнёров Города
            </div>
            <div style={{ fontSize: 13, color: T.textSec, marginTop: 8, lineHeight: '18px' }}>
              Программа лояльности лучших заведений Зеленограда
            </div>
          </div>
        </div>

        {/* Преимущества */}
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PERKS.map(p => (
            <div key={p.label} style={{
              background: T.surface, borderRadius: 16, padding: '14px 12px',
              border: `1px solid ${T.border}`, textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 22 }}>{p.icon}</span>
              <span style={{ fontSize: 11, color: T.textSec, lineHeight: '15px', fontWeight: 500 }}>{p.label}</span>
            </div>
          ))}
        </div>

        {/* Кнопка входа */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onLogin}
            style={{
              width: '100%', padding: '17px 0', borderRadius: 16, border: 'none',
              background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
              color: '#0F0F1A', fontSize: 16, fontWeight: 800, cursor: 'pointer',
              letterSpacing: 0.3,
              boxShadow: `0 4px 20px rgba(201,168,76,0.35)`,
            }}
          >
            Войти через ВКонтакте
          </button>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', lineHeight: '17px' }}>
            Для входа используется ваш аккаунт ВКонтакте.{'\n'}Никакого отдельного пароля не нужно.
          </div>
        </div>
      </div>
    </div>
  );
}
