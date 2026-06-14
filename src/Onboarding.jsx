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

const SLIDES = [
  {
    emoji: '🏙️',
    title: 'Альянс Партнёров Города',
    subtitle: 'АПГ — это городское сообщество бизнеса и жителей Зеленограда',
    description: 'Единая экосистема, где местный бизнес и горожане объединены общей программой лояльности.',
    color: '#3F8AE0',
  },
  {
    emoji: '🗝️',
    title: 'Копи ключи',
    subtitle: 'Получай ключи за каждое взаимодействие с партнёрами',
    description: 'Сканируй QR-коды в заведениях, участвуй в событиях, приглашай друзей — и собирай ключи.',
    color: T.gold,
  },
  {
    emoji: '🎁',
    title: 'Открывай привилегии',
    subtitle: 'Ключи открывают бонусы, скидки и эксклюзивные предложения',
    description: 'Участвуй в розыгрышах призов, получай доступ к закрытым мероприятиям и разблокируй достижения.',
    color: '#4BB34B',
  },
  {
    emoji: '🤝',
    title: '18+ партнёров',
    subtitle: 'Кафе, салоны красоты, студии, бары и многое другое',
    description: 'Сеть партнёров постоянно растёт. Каждый визит к партнёру АПГ — это шаг к новым привилегиям.',
    color: '#9C27B0',
  },
];

export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '48px 24px 40px', overflow: 'hidden' }}>

      {/* Декоративный фон */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${slide.color}15, transparent 70%)`, transition: 'background 0.5s ease', pointerEvents: 'none' }} />

      {/* Логотип */}
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>✦ АПГ</div>
      </div>

      {/* Контент слайда */}
      <div style={{ position: 'relative', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>

        {/* Иконка */}
        <div style={{ width: 120, height: 120, borderRadius: 36, background: slide.color + '18', border: `2px solid ${slide.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, marginBottom: 8, boxShadow: `0 0 40px ${slide.color}30` }}>
          {slide.emoji}
        </div>

        <div>
          <div style={{ fontSize: 11, color: slide.color, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
            {step + 1} / {SLIDES.length}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.textPri, lineHeight: '30px', marginBottom: 10 }}>
            {slide.title}
          </div>
          <div style={{ fontSize: 15, color: T.textSec, lineHeight: '22px', marginBottom: 16 }}>
            {slide.subtitle}
          </div>
          <div style={{ fontSize: 13, color: T.textSec, lineHeight: '20px', background: T.surface, borderRadius: 16, padding: '14px 16px', border: `1px solid ${T.border}` }}>
            {slide.description}
          </div>
        </div>
      </div>

      {/* Индикатор шагов */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {SLIDES.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} style={{ height: 4, borderRadius: 2, cursor: 'pointer', transition: 'all 0.3s ease', width: i === step ? 24 : 8, background: i === step ? T.gold : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {!isLast && (
            <button onClick={onComplete} style={{ flex: 1, padding: '14px 0', borderRadius: 16, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.05)', color: T.textSec, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Пропустить
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
            style={{ flex: isLast ? 1 : 2, padding: '14px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 20px ${T.gold}40` }}
          >
            {isLast ? '🚀 Начать' : 'Далее →'}
          </button>
        </div>
      </div>
    </div>
  );
}
