import React, { useEffect, useRef, useState } from 'react';

const CSS = `
@keyframes apg-draw {
  from { stroke-dashoffset: 200; opacity: 0; }
  to   { stroke-dashoffset: 0;   opacity: 1; }
}
@keyframes apg-shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@keyframes apg-fadein {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes apg-progress {
  from { width: 0%; }
  to   { width: 100%; }
}
@keyframes apg-orb1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(24px, -16px) scale(1.08); }
}
@keyframes apg-orb2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-18px, 22px) scale(0.93); }
}
@keyframes apg-ring-pulse {
  0%, 100% { opacity: 0.35; transform: scale(1); }
  50%       { opacity: 0.65; transform: scale(1.1); }
}
@keyframes apg-logo-in {
  from { opacity: 0; transform: scale(0.82); }
  to   { opacity: 1; transform: scale(1); }
}
`;

const SHIMMER_GRAD = 'linear-gradient(90deg, #8A6520 0%, #C9A84C 20%, #F0E0A0 38%, #FFFBEF 50%, #F0E0A0 62%, #C9A84C 80%, #8A6520 100%)';

export function SplashScreen({ isReady, onDone, startTime }) {
  const [phase, setPhase] = useState('enter');
  const mountTime         = useRef(startTime ?? Date.now());
  const MIN_SHOW_MS       = 2400;

  useEffect(() => {
    if (!isReady) return;
    const elapsed = Date.now() - mountTime.current;
    const wait    = Math.max(0, MIN_SHOW_MS - elapsed);
    const t = setTimeout(() => setPhase('exit'), wait);
    return () => clearTimeout(t);
  }, [isReady]);

  const exiting = phase === 'exit';

  // Общий стиль переливающегося текста — одинаковый для всех
  const shimmerText = (extra = {}) => ({
    background: SHIMMER_GRAD,
    backgroundSize: '200% 100%',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    animation: 'apg-shimmer 2.6s linear 1.0s infinite',
    ...extra,
  });

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#080818',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: exiting ? 'none' : 'all',
        opacity:    exiting ? 0 : 1,
        transform:  exiting ? 'scale(1.05)' : 'scale(1)',
        transition: exiting
          ? 'opacity 0.55s cubic-bezier(0.4,0,0.2,1), transform 0.6s cubic-bezier(0.4,0,0.2,1)'
          : 'none',
      }}
        onTransitionEnd={() => { if (exiting) onDone?.(); }}
      >

        {/* Фоновые орбы */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: '8%', left: '10%',
            width: 380, height: 380, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(80,55,210,0.2) 0%, transparent 70%)',
            animation: 'apg-orb1 8s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', right: '8%',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,76,0.13) 0%, transparent 70%)',
            animation: 'apg-orb2 9s ease-in-out infinite',
          }} />
          {/* Точечная сетка */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(rgba(201,168,76,0.045) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
        </div>

        {/* Логотип */}
        <div style={{
          position: 'relative', marginBottom: 40,
          opacity: 0,
          animation: 'apg-logo-in 0.7s cubic-bezier(0.2,0,0,1) 0.15s forwards',
        }}>
          {/* Пульсирующее кольцо */}
          <div style={{
            position: 'absolute', inset: -32, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 68%)',
            animation: 'apg-ring-pulse 2.6s ease-in-out 1.0s infinite',
          }} />
          {/* Второе кольцо */}
          <div style={{
            position: 'absolute', inset: -16, borderRadius: 44,
            border: '1px solid rgba(201,168,76,0.12)',
            animation: 'apg-ring-pulse 2.6s ease-in-out 1.3s infinite',
          }} />

          {/* Карточка логотипа */}
          <div style={{
            width: 112, height: 112, borderRadius: 34,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Внутренний шиммер — синхронизирован с текстом */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)`,
              backgroundSize: '200% 100%',
              animation: 'apg-shimmer 2.6s linear 1.0s infinite',
            }} />

            <svg width="58" height="58" viewBox="0 0 60 60" fill="none">
              <defs>
                <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#E8C97A" />
                  <stop offset="50%"  stopColor="#C9A84C" />
                  <stop offset="100%" stopColor="#9A7030" />
                </linearGradient>
                <filter id="df">
                  <feGaussianBlur stdDeviation="1.2" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <polygon
                points="30,5 53,30 30,55 7,30"
                fill="rgba(201,168,76,0.08)"
                stroke="url(#dg)" strokeWidth="1.6"
                strokeDasharray="200" strokeDashoffset="200"
                filter="url(#df)"
                style={{ animation: 'apg-draw 1.1s cubic-bezier(0.4,0,0.2,1) 0.2s forwards' }}
              />
              <line x1="7" y1="30" x2="53" y2="30"
                stroke="rgba(201,168,76,0.28)" strokeWidth="0.8"
                strokeDasharray="46" strokeDashoffset="46"
                style={{ animation: 'apg-draw 0.5s ease 1.0s forwards' }}
              />
              <line x1="30" y1="5" x2="30" y2="55"
                stroke="rgba(201,168,76,0.28)" strokeWidth="0.8"
                strokeDasharray="50" strokeDashoffset="50"
                style={{ animation: 'apg-draw 0.5s ease 1.0s forwards' }}
              />
              <circle cx="30" cy="30" r="4" fill="#C9A84C"
                style={{ opacity: 0, animation: 'apg-fadein 0.35s ease 1.3s forwards' }}
              />
              <circle cx="30" cy="30" r="1.6" fill="#080818"
                style={{ opacity: 0, animation: 'apg-fadein 0.35s ease 1.3s forwards' }}
              />
            </svg>
          </div>
        </div>

        {/* Текстовый блок — все элементы переливаются одинаково */}
        <div style={{
          textAlign: 'center',
          opacity: 0,
          animation: 'apg-fadein 0.5s ease 0.7s forwards',
        }}>
          {/* АПГ */}
          <div style={{
            fontSize: 52, fontWeight: 900, letterSpacing: 14,
            lineHeight: 1,
            paddingLeft: 14,
            ...shimmerText(),
          }}>АПГ</div>

          {/* Разделитель */}
          <div style={{
            margin: '16px auto',
            width: 64, height: 1,
            background: SHIMMER_GRAD,
            backgroundSize: '200% 100%',
            animation: 'apg-shimmer 2.6s linear 1.0s infinite',
            opacity: 0,
            animationFillMode: 'both',
            animationDelay: '1.0s',
          }} />

          {/* ЗЕЛЕНОГРАД */}
          <div style={{
            fontSize: 11, fontWeight: 800,
            letterSpacing: 5, paddingLeft: 5,
            textTransform: 'uppercase',
            opacity: 0,
            animation: 'apg-fadein 0.4s ease 0.9s forwards',
          }}>
            <span style={{ ...shimmerText() }}>Зеленоград</span>
          </div>

          {/* Альянс Партнёров Города */}
          <div style={{
            fontSize: 12, letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginTop: 8,
            opacity: 0,
            animation: 'apg-fadein 0.4s ease 1.1s forwards',
          }}>
            <span style={{
              ...shimmerText({ WebkitTextFillColor: undefined, backgroundClip: undefined }),
              background: undefined,
              color: 'rgba(201,168,76,0.45)',
              WebkitTextFillColor: 'rgba(201,168,76,0.45)',
            }}>Альянс Партнёров Города</span>
          </div>
        </div>

        {/* Прогресс-бар */}
        <div style={{
          position: 'absolute', bottom: 52,
          width: 140, height: 2,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 1, overflow: 'hidden',
          opacity: 0,
          animation: 'apg-fadein 0.4s ease 1.4s forwards',
        }}>
          <div style={{
            height: '100%', borderRadius: 1,
            background: SHIMMER_GRAD,
            backgroundSize: '200% 100%',
            animation: `apg-progress ${MIN_SHOW_MS}ms cubic-bezier(0.4,0,0.2,1) 0.3s forwards,
                        apg-shimmer 2.6s linear 1.0s infinite`,
          }} />
        </div>

      </div>
    </>
  );
}
