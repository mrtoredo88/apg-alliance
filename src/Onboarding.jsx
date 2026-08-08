import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard } from './components/Apg2ProfileGlass.jsx';
import { LokiIdentity } from './loki/LokiIdentity.jsx';
import { LEARNING_ONBOARDING_SLIDES } from './learningSystem.js';

const FEATURE_ICONS = {
  city: ['☕', '🎭', '✦', '📍'],
  social: ['👥', '💬', '🔔', '↗'],
  rewards: ['QR', '🔑', '🎁', '★'],
};

const FIRST_ACTIONS = [
  { id: 'offers', icon: '⌕', title: 'Найти место', text: 'Партнёры и акции рядом' },
  { id: 'events', icon: '◷', title: 'Выбрать событие', text: 'Посмотреть городскую афишу' },
  { id: 'loki', icon: '◈', title: 'Спросить Локи', text: 'Получить личную подсказку' },
];

function FeatureVisual({ type, accent }) {
  const icons = FEATURE_ICONS[type] || FEATURE_ICONS.city;
  return (
    <div style={{ width: '100%', maxWidth: 300, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      {icons.map((icon, index) => (
        <div key={icon} style={{ minHeight: 82, borderRadius: 24, display: 'grid', placeItems: 'center', fontSize: icon.length > 2 ? 17 : 27, fontWeight: 900, color: index === 1 ? '#17120a' : APG2_PROFILE.text, background: index === 1 ? `linear-gradient(145deg, ${accent}, #F4DB94)` : 'rgba(255,255,255,0.07)', border: `1px solid ${index === 1 ? accent : 'rgba(255,255,255,0.12)'}`, boxShadow: index === 1 ? `0 16px 34px ${accent}33` : 'inset 0 1px 0 rgba(255,255,255,0.08)', animation: 'fadeInUp 0.35s ease both', animationDelay: `${index * 0.06}s` }}>
          {icon}
        </div>
      ))}
    </div>
  );
}

function LokiVisual() {
  return (
    <div style={{ width: '100%', maxWidth: 320, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}>
        <LokiIdentity size={86} state="recommending" showText={false} style={{ placeItems: 'center' }} />
      </div>
      <div style={{ borderRadius: 24, padding: '14px 16px', background: 'rgba(156,124,255,0.10)', border: '1px solid rgba(156,124,255,0.22)', color: APG2_PROFILE.text, fontSize: 14, lineHeight: '20px', fontWeight: 720, textAlign: 'center' }}>
        «Скажи, что хочется — я помогу найти это в АПГ»
      </div>
    </div>
  );
}

function ActionVisual({ selectedAction, onSelect }) {
  return (
    <div style={{ width: '100%', display: 'grid', gap: 9 }}>
      {FIRST_ACTIONS.map(action => {
        const selected = action.id === selectedAction;
        return (
          <button key={action.id} type="button" onClick={() => onSelect(action.id)} aria-pressed={selected} style={{ width: '100%', display: 'grid', gridTemplateColumns: '46px minmax(0,1fr) 24px', gap: 12, alignItems: 'center', padding: 12, borderRadius: 22, cursor: 'pointer', textAlign: 'left', color: APG2_PROFILE.text, background: selected ? 'rgba(215,184,106,0.16)' : 'rgba(255,255,255,0.06)', border: `1px solid ${selected ? 'rgba(215,184,106,0.46)' : 'rgba(255,255,255,0.11)'}`, boxShadow: selected ? '0 14px 34px rgba(201,168,76,0.12)' : 'none', transition: 'all 180ms ease' }}>
            <span style={{ width: 46, height: 46, borderRadius: 18, display: 'grid', placeItems: 'center', background: selected ? APG2_PROFILE.goldGradient : 'rgba(255,255,255,0.08)', color: selected ? '#17120a' : APG2_PROFILE.text, fontSize: 20, fontWeight: 900 }}>{action.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, lineHeight: '18px', fontWeight: 880 }}>{action.title}</span>
              <span style={{ display: 'block', marginTop: 3, color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '16px', fontWeight: 620 }}>{action.text}</span>
            </span>
            <span style={{ color: selected ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 18 }}>{selected ? '✓' : '›'}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Onboarding({ onComplete, onProgress }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedAction, setSelectedAction] = useState('offers');
  const touchStartX = useRef(null);
  const slide = LEARNING_ONBOARDING_SLIDES[step];
  const isLast = step === LEARNING_ONBOARDING_SLIDES.length - 1;

  useEffect(() => {
    onProgress?.(step + 1, LEARNING_ONBOARDING_SLIDES.length);
  }, [onProgress, step]);

  const goTo = useCallback((next) => {
    if (next < 0 || next >= LEARNING_ONBOARDING_SLIDES.length || next === step) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }, [step]);

  const finish = (skipped = false) => onComplete?.({ action: skipped ? 'home' : selectedAction, skipped });
  const next = () => isLast ? finish(false) : goTo(step + 1);

  return (
    <div onTouchStart={event => { touchStartX.current = event.touches[0].clientX; }} onTouchEnd={event => {
      if (touchStartX.current === null) return;
      const delta = touchStartX.current - event.changedTouches[0].clientX;
      touchStartX.current = null;
      if (delta > 48 && !isLast) goTo(step + 1);
      if (delta < -48) goTo(step - 1);
    }} style={{ position: 'fixed', inset: 0, zIndex: 12000, overflowY: 'auto', color: APG2_PROFILE.text, background: APG2_PROFILE.bg, userSelect: 'none' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: `radial-gradient(circle at 50% -10%, ${slide.orb}, transparent 40%), radial-gradient(circle at 105% 55%, rgba(92,72,148,0.16), transparent 38%)`, transition: 'background 350ms ease' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 520, minHeight: '100%', margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top, 0px)) 18px calc(20px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'auto minmax(0,1fr) auto', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <GlassBadge tone="gold">АПГ · ЗЕЛЕНОГРАД</GlassBadge>
          {!isLast && <button type="button" onClick={() => finish(true)} style={{ border: 0, background: 'transparent', color: APG2_PROFILE.textSoft, padding: '9px 4px 9px 12px', cursor: 'pointer', fontSize: 12.5, fontWeight: 760 }}>Пропустить</button>}
        </div>

        <div key={step} style={{ alignSelf: 'center', display: 'grid', gap: 18, animation: direction > 0 ? 'slideInRight 0.28s cubic-bezier(0.2,0,0,1) both' : 'slideInLeft 0.28s cubic-bezier(0.2,0,0,1) both' }}>
          <GlassCard interactiveAs="div" style={{ minHeight: isLast ? 258 : 220, borderRadius: 34, padding: isLast ? 14 : 20, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {slide.visual === 'loki' ? <LokiVisual /> : slide.visual === 'actions' ? <ActionVisual selectedAction={selectedAction} onSelect={setSelectedAction} /> : <FeatureVisual type={slide.visual} accent={slide.accent} />}
          </GlassCard>
          <div style={{ textAlign: 'center', padding: '0 6px' }}>
            <div style={{ color: slide.accent, fontSize: 10.5, lineHeight: '14px', fontWeight: 900, letterSpacing: 1.7, textTransform: 'uppercase', marginBottom: 8 }}>{slide.tag}</div>
            <h1 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 'clamp(27px, 7vw, 34px)', lineHeight: 1.08, fontWeight: 920, letterSpacing: -0.7, whiteSpace: 'pre-line' }}>{slide.title}</h1>
            <p style={{ maxWidth: 430, margin: '11px auto 0', color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '20px', fontWeight: 630 }}>{slide.desc}</p>
            {slide.chips && <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 7, marginTop: 12 }}>{slide.chips.map(chip => <GlassBadge key={chip}>{chip}</GlassBadge>)}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 13 }}>
          <div aria-label={`Шаг ${step + 1} из ${LEARNING_ONBOARDING_SLIDES.length}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${LEARNING_ONBOARDING_SLIDES.length}, 1fr)`, gap: 6 }}>
            {LEARNING_ONBOARDING_SLIDES.map((item, index) => <button key={item.tag} type="button" aria-label={`Перейти к шагу ${index + 1}`} onClick={() => goTo(index)} style={{ height: 4, padding: 0, border: 0, borderRadius: 999, cursor: 'pointer', background: index <= step ? slide.accent : 'rgba(255,255,255,0.15)', transition: 'background 180ms ease' }} />)}
          </div>
          <div style={{ display: 'flex', gap: 9 }}>
            {step > 0 && <GlassButton onClick={() => goTo(step - 1)} aria-label="Назад" style={{ width: 52, minHeight: 52, borderRadius: 20, flexShrink: 0, fontSize: 22 }}>‹</GlassButton>}
            <GlassButton tone="gold" onClick={next} style={{ flex: 1, minHeight: 52, borderRadius: 20, color: '#17120a', fontSize: 15, fontWeight: 900 }}>{isLast ? FIRST_ACTIONS.find(action => action.id === selectedAction)?.title : 'Продолжить'}</GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
}
