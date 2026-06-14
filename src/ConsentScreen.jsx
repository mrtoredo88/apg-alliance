import React, { useState } from 'react';

const T = {
  bg:      '#0F0F1A',
  surface: '#1A1A2E',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.5)',
};

const ITEMS = [
  { icon: '👤', text: 'Имя и фото профиля ВКонтакте — для отображения в приложении' },
  { icon: '🗝️', text: 'История посещений партнёров — для начисления ключей и достижений' },
  { icon: '⭐', text: 'Список избранных заведений — для персональных рекомендаций' },
  { icon: '📊', text: 'Статистика активности — для участия в рейтинге' },
];

export function ConsentScreen({ onAccept }) {
  const [checked, setChecked] = useState(false);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: T.bg, zIndex: 500,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 20px',
      overflowY: 'auto',
    }}>
      {/* Фоновая сетка */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(201,168,76,0.05) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }} />
      {/* Свечение */}
      <div style={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,168,76,0.08), transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Логотип */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'rgba(201,168,76,0.1)', border: `1.5px solid rgba(201,168,76,0.4)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="1" y="1" width="38" height="38" rx="10" fill="rgba(201,168,76,0.1)" stroke="rgba(201,168,76,0.4)" strokeWidth="1.5"/>
              <polygon points="20,5 31,20 20,35 9,20" fill="rgba(201,168,76,0.08)" stroke="#C9A84C" strokeWidth="1.5"/>
              <line x1="20" y1="5" x2="20" y2="35" stroke="rgba(201,168,76,0.25)" strokeWidth="1"/>
              <line x1="9" y1="20" x2="31" y2="20" stroke="rgba(201,168,76,0.25)" strokeWidth="1"/>
              <circle cx="20" cy="20" r="3.5" fill="#C9A84C"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.textPri, letterSpacing: 1 }}>АПГ</div>
            <div style={{ fontSize: 11, color: T.textSec, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>Альянс Партнёров Города</div>
          </div>
        </div>

        {/* Карточка согласия */}
        <div style={{
          background: T.surface, borderRadius: 24, padding: '22px 18px',
          border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, marginBottom: 4 }}>
            Обработка персональных данных
          </div>
          <div style={{ fontSize: 13, color: T.textSec, lineHeight: '19px', marginBottom: 16 }}>
            Для участия в программе лояльности АПГ приложению необходим доступ к следующим данным:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ITEMS.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: 13, color: T.textSec, lineHeight: '19px', paddingTop: 6 }}>{item.text}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, color: T.textSec, lineHeight: '18px' }}>
              Данные хранятся в защищённой базе и не передаются третьим лицам. Вы можете удалить свои данные, обратившись к администратору АПГ.
            </div>
          </div>
        </div>

        {/* Чекбокс */}
        <button
          onClick={() => setChecked(v => !v)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1,
            border: `2px solid ${checked ? T.gold : 'rgba(255,255,255,0.2)'}`,
            background: checked ? T.gold : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}>
            {checked && <span style={{ color: '#0F0F1A', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontSize: 13, color: T.textSec, lineHeight: '19px' }}>
            Я ознакомился с условиями и даю согласие на обработку персональных данных
          </span>
        </button>

        {/* Кнопка */}
        <button
          onClick={onAccept}
          disabled={!checked}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 16, border: 'none',
            background: checked
              ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})`
              : 'rgba(255,255,255,0.08)',
            color: checked ? '#0F0F1A' : 'rgba(255,255,255,0.25)',
            fontSize: 16, fontWeight: 800, cursor: checked ? 'pointer' : 'default',
            transition: 'all 0.25s ease',
            letterSpacing: 0.3,
          }}
        >
          Принять и продолжить
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: '16px' }}>
          Продолжая, вы подтверждаете, что вам исполнилось 14 лет
        </div>
      </div>
    </div>
  );
}
