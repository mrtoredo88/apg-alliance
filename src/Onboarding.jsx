import React, { useState, useRef, useCallback } from 'react';

const T = {
  bg:      '#0F0F1A',
  surface: '#1A1A2E',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.55)',
};

const SLIDES = [
  {
    accent:  '#C9A84C',
    orb:     'rgba(201,168,76,0.12)',
    tag:     'ДОБРО ПОЖАЛОВАТЬ',
    title:   'АПГ — Альянс\nПартнёров Города',
    desc:    'Городская программа лояльности, которая объединяет лучшие заведения Зеленограда и их гостей',
    visual:  'welcome',
  },
  {
    accent:  '#4A90D9',
    orb:     'rgba(74,144,217,0.12)',
    tag:     'КАК ЭТО РАБОТАЕТ',
    title:   'Сканируй QR —\nполучай ключи',
    desc:    'Приходи к партнёру, нажимай ◎ и сканируй — ключ твой. Каждый день новые места, новые ключи',
    visual:  'scan',
    chips:   ['🗝️ 1 ключ за визит', '⭐ Партнёр дня: +2', '🔥 Стрик за дни подряд'],
  },
  {
    accent:  '#E8C97A',
    orb:     'rgba(232,201,122,0.1)',
    tag:     'ТВОЙ ПРОГРЕСС',
    title:   'Расти\nв программе',
    desc:    'Больше ключей — выше уровень, больше привилегий и особый статус среди участников АПГ',
    visual:  'levels',
  },
  {
    accent:  '#4BB34B',
    orb:     'rgba(75,179,75,0.1)',
    tag:     'ЗЕЛЕНОГРАД',
    title:   '18+ партнёров\nждут тебя',
    desc:    'Кафе и рестораны, салоны красоты, фитнес-клубы, магазины — вся городская жизнь в одном приложении',
    visual:  'partners',
  },
];

const LEVELS = [
  { emoji: '🌱', name: 'Новичок',    min: 0,   color: '#7EB87E' },
  { emoji: '⭐', name: 'Участник',   min: 10,  color: '#4A90D9' },
  { emoji: '🔥', name: 'Активный',   min: 25,  color: '#E07B39' },
  { emoji: '💎', name: 'Профи',      min: 50,  color: '#9B59B6' },
  { emoji: '👑', name: 'Амбассадор', min: 100, color: '#C9A84C' },
];

const PARTNER_ICONS = ['☕', '🍕', '💅', '🏋️', '🛍️', '🍣', '💆', '🎭'];

function WelcomeVisual() {
  return (
    <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Орбиты */}
      {[80, 110, 140].map((r, i) => (
        <div key={i} style={{ position: 'absolute', width: r * 2, height: r * 2, borderRadius: '50%', border: `1px solid rgba(201,168,76,${0.18 - i * 0.05})` }} />
      ))}
      {/* Центральный ключ */}
      <div style={{ width: 100, height: 100, borderRadius: 30, background: 'linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.08))', border: '2px solid rgba(201,168,76,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, animation: 'float 3s ease-in-out infinite', boxShadow: '0 0 40px rgba(201,168,76,0.2)' }}>
        🗝️
      </div>
      {/* Мини-точки по орбите */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 6, height: 6, borderRadius: '50%',
          background: `rgba(201,168,76,${0.3 + (i % 3) * 0.15})`,
          left: '50%', top: '50%',
          transform: `rotate(${deg}deg) translateX(95px) translate(-50%,-50%)`,
        }} />
      ))}
    </div>
  );
}

function ScanVisual() {
  return (
    <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Телефон */}
      <div style={{ width: 90, height: 155, borderRadius: 22, background: 'rgba(26,26,46,0.9)', border: '2px solid rgba(74,144,217,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 0 30px rgba(74,144,217,0.2)' }}>
        {/* Экран */}
        <div style={{ width: 72, height: 72, borderRadius: 12, background: 'rgba(74,144,217,0.08)', border: '1.5px solid rgba(74,144,217,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* QR паттерн упрощённый */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 2.5, padding: 6 }}>
            {[1,1,1,0,1, 1,0,1,1,0, 1,1,0,0,1, 0,1,0,1,1, 1,0,1,0,0].map((v, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: 1.5, background: v ? 'rgba(74,144,217,0.8)' : 'transparent' }} />
            ))}
          </div>
          {/* Сканирующая линия */}
          <div style={{ position: 'absolute', left: 4, right: 4, height: 2, background: 'linear-gradient(90deg, transparent, rgba(74,144,217,0.9), transparent)', animation: 'scanLine 1.8s ease-in-out infinite', borderRadius: 1 }} />
        </div>
        <div style={{ fontSize: 18 }}>◎</div>
      </div>

      {/* +1 ключ badge */}
      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', borderRadius: 20, padding: '5px 10px', fontSize: 12, fontWeight: 700, color: T.gold, animation: 'keyPop 2s ease-in-out infinite' }}>
        +1 🗝️
      </div>
    </div>
  );
}

function LevelsVisual() {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {LEVELS.map((lvl, i) => (
        <div key={lvl.name} style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'fadeInUp 0.4s ease both', animationDelay: `${i * 0.07}s` }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: lvl.color + '20', border: `1.5px solid ${lvl.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {lvl.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>{lvl.name}</span>
              <span style={{ fontSize: 11, color: lvl.color, fontWeight: 600 }}>{lvl.min === 0 ? 'старт' : `${lvl.min}+ 🗝️`}</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${20 + i * 20}%`, background: `linear-gradient(90deg, ${lvl.color}aa, ${lvl.color})`, borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PartnersVisual() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
      {PARTNER_ICONS.map((icon, i) => (
        <div key={i} style={{ width: '100%', aspectRatio: '1', borderRadius: 18, background: 'rgba(75,179,75,0.08)', border: '1px solid rgba(75,179,75,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, animation: 'fadeInUp 0.4s ease both', animationDelay: `${i * 0.05}s` }}>
          {icon}
        </div>
      ))}
    </div>
  );
}

export function Onboarding({ onComplete }) {
  const [step, setStep]   = useState(0);
  const [dir, setDir]     = useState(1); // 1=вперёд, -1=назад
  const [animKey, setAnimKey] = useState(0);

  const touchStartX = useRef(null);

  const slide   = SLIDES[step];
  const isLast  = step === SLIDES.length - 1;

  const goTo = useCallback((next) => {
    if (next < 0 || next >= SLIDES.length) return;
    setDir(next > step ? 1 : -1);
    setAnimKey(k => k + 1);
    setStep(next);
  }, [step]);

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (dx > 40)       isLast ? onComplete() : goTo(step + 1);
    else if (dx < -40) goTo(step - 1);
  };

  const slideAnim = dir > 0
    ? 'slideInRight 0.32s cubic-bezier(0.2, 0, 0, 1) both'
    : 'slideInLeft  0.32s cubic-bezier(0.2, 0, 0, 1) both';

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 2000, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' }}
    >
      {/* Фоновый орб */}
      <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 480, height: 480, borderRadius: '50%', background: `radial-gradient(circle, ${slide.orb}, transparent 70%)`, transition: 'background 0.5s ease', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(201,168,76,0.04) 1px, transparent 1px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />

      {/* Верхняя строка: лого + кнопка пропуска */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 11, color: T.gold, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>✦ АПГ</div>
        {!isLast && (
          <button onClick={onComplete} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: T.textSec, fontWeight: 600, cursor: 'pointer' }}>
            Пропустить
          </button>
        )}
      </div>

      {/* Контент слайда */}
      <div key={animKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 28, position: 'relative', zIndex: 1, animation: slideAnim }}>

        {/* Визуальный блок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          {slide.visual === 'welcome'  && <WelcomeVisual />}
          {slide.visual === 'scan'     && <ScanVisual />}
          {slide.visual === 'levels'   && <LevelsVisual />}
          {slide.visual === 'partners' && <PartnersVisual />}
        </div>

        {/* Текстовый блок */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 10, color: slide.accent, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 10 }}>
            {slide.tag}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.textPri, lineHeight: '32px', marginBottom: 12, whiteSpace: 'pre-line' }}>
            {slide.title}
          </div>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: '22px' }}>
            {slide.desc}
          </div>

          {/* Фичи-чипы (только слайд 2) */}
          {slide.chips && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              {slide.chips.map((chip, i) => (
                <div key={i} style={{ background: 'rgba(74,144,217,0.1)', border: '1px solid rgba(74,144,217,0.25)', borderRadius: 20, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: T.textPri, animation: 'fadeInUp 0.4s ease both', animationDelay: `${0.1 + i * 0.08}s` }}>
                  {chip}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Нижняя панель: точки + кнопка */}
      <div style={{ padding: '20px 24px 40px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

        {/* Прогресс-точки */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              onClick={() => goTo(i)}
              style={{ height: 4, borderRadius: 2, cursor: 'pointer', transition: 'all 0.35s cubic-bezier(0.2, 0, 0, 1)', width: i === step ? 28 : 8, background: i === step ? slide.accent : 'rgba(255,255,255,0.18)' }}
            />
          ))}
        </div>

        {/* Кнопка */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {step > 0 && (
            <button onClick={() => goTo(step - 1)} style={{ width: 52, height: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: T.textSec, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              ‹
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : goTo(step + 1)}
            style={{ flex: 1, height: 52, borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${slide.accent}, ${slide.accent}cc)`, color: '#0F0F1A', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 24px ${slide.accent}40`, transition: 'box-shadow 0.3s, background 0.3s' }}
          >
            {isLast ? '🚀 Начать' : 'Далее →'}
          </button>
        </div>
      </div>
    </div>
  );
}
