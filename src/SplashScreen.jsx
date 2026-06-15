import React, { useEffect, useRef, useState } from 'react';

const CSS = `
@keyframes apg-draw {
  from { stroke-dashoffset: 200; opacity: 0; }
  to   { stroke-dashoffset: 0;   opacity: 1; }
}
@keyframes apg-glow-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1);    }
  50%       { opacity: 1;   transform: scale(1.12); }
}
@keyframes apg-shimmer-text {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes apg-shimmer-sweep {
  0%   { left: -60%; opacity: 0; }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { left: 130%; opacity: 0; }
}
@keyframes apg-fadein {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes apg-dot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
  40%           { transform: scale(1);   opacity: 1;   }
}
@keyframes apg-orb1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(30px, -20px) scale(1.1); }
}
@keyframes apg-orb2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-20px, 30px) scale(0.95); }
}
`;

export function SplashScreen({ isReady, onDone, startTime }) {
  const [phase, setPhase]       = useState('enter');   // enter | hold | exit
  const mountTime               = useRef(startTime ?? Date.now());
  const MIN_SHOW_MS             = 2200;

  useEffect(() => {
    if (!isReady) return;
    const elapsed = Date.now() - mountTime.current;
    const wait    = Math.max(0, MIN_SHOW_MS - elapsed);
    const t = setTimeout(() => setPhase('exit'), wait);
    return () => clearTimeout(t);
  }, [isReady]);

  const exiting = phase === 'exit';

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0A0A18',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: exiting ? 'none' : 'all',
        opacity:   exiting ? 0 : 1,
        transform: exiting ? 'scale(1.06)' : 'scale(1)',
        transition: exiting
          ? 'opacity 0.55s cubic-bezier(0.4,0,0.2,1), transform 0.6s cubic-bezier(0.4,0,0.2,1)'
          : 'none',
      }}
        onTransitionEnd={() => { if (exiting) onDone?.(); }}
      >

        {/* Фоновые орбы */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: '15%', left: '20%',
            width: 340, height: 340, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(90,60,220,0.18) 0%, transparent 70%)',
            animation: 'apg-orb1 7s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '20%', right: '15%',
            width: 280, height: 280, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)',
            animation: 'apg-orb2 8s ease-in-out infinite',
          }} />
        </div>

        {/* Логотип */}
        <div style={{ position: 'relative', marginBottom: 36 }}>

          {/* Внешнее свечение — пульсирует */}
          <div style={{
            position: 'absolute', inset: -28,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,168,76,0.22) 0%, transparent 70%)',
            animation: 'apg-glow-pulse 2.4s ease-in-out infinite',
          }} />

          {/* Glass-подложка */}
          <div style={{
            width: 108, height: 108, borderRadius: 32,
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.14)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Световая полоса внутри карточки */}
            <div style={{
              position: 'absolute',
              top: 0, bottom: 0, width: '45%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
              animation: 'apg-shimmer-sweep 2.8s ease-in-out infinite',
              animationDelay: '0.4s',
              pointerEvents: 'none',
            }} />

            {/* SVG алмаз */}
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
              <defs>
                <linearGradient id="diamond-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#E8C97A" />
                  <stop offset="50%"  stopColor="#C9A84C" />
                  <stop offset="100%" stopColor="#A07830" />
                </linearGradient>
                <filter id="diamond-glow">
                  <feGaussianBlur stdDeviation="1.5" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Ромб — анимированная обводка */}
              <polygon
                points="30,6 52,30 30,54 8,30"
                fill="rgba(201,168,76,0.1)"
                stroke="url(#diamond-grad)"
                strokeWidth="1.8"
                strokeDasharray="200"
                strokeDashoffset="200"
                filter="url(#diamond-glow)"
                style={{ animation: 'apg-draw 1.2s cubic-bezier(0.4,0,0.2,1) 0.1s forwards' }}
              />
              {/* Горизонтальная линия */}
              <line x1="8" y1="30" x2="52" y2="30"
                stroke="rgba(201,168,76,0.3)" strokeWidth="0.9"
                strokeDasharray="44" strokeDashoffset="44"
                style={{ animation: 'apg-draw 0.6s ease 0.9s forwards' }}
              />
              {/* Вертикальная линия */}
              <line x1="30" y1="6" x2="30" y2="54"
                stroke="rgba(201,168,76,0.3)" strokeWidth="0.9"
                strokeDasharray="48" strokeDashoffset="48"
                style={{ animation: 'apg-draw 0.6s ease 0.9s forwards' }}
              />
              {/* Центральная точка */}
              <circle cx="30" cy="30" r="4.5" fill="#C9A84C"
                style={{ opacity: 0, animation: 'apg-fadein 0.4s ease 1.3s forwards' }}
              />
              <circle cx="30" cy="30" r="2" fill="#0A0A18"
                style={{ opacity: 0, animation: 'apg-fadein 0.4s ease 1.3s forwards' }}
              />
            </svg>
          </div>
        </div>

        {/* Надпись АПГ с переливом */}
        <div style={{
          opacity: 0,
          animation: 'apg-fadein 0.5s ease 0.8s forwards',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 44, fontWeight: 900, letterSpacing: 10,
            lineHeight: 1,
            background: 'linear-gradient(90deg, #A07830 0%, #C9A84C 25%, #F0E0A0 45%, #FFF8DC 50%, #F0E0A0 55%, #C9A84C 75%, #A07830 100%)',
            backgroundSize: '250% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'apg-shimmer-text 2.4s ease-in-out 1.2s infinite',
          }}>АПГ</div>

          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: 3.5,
            color: 'rgba(201,168,76,0.7)',
            textTransform: 'uppercase',
            marginTop: 8,
            opacity: 0,
            animation: 'apg-fadein 0.5s ease 1.1s forwards',
          }}>Зеленоград</div>

          <div style={{
            fontSize: 11, letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.28)',
            textTransform: 'uppercase',
            marginTop: 6,
            opacity: 0,
            animation: 'apg-fadein 0.5s ease 1.3s forwards',
          }}>Альянс Партнёров Города</div>
        </div>

        {/* Точки загрузки */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 52,
          opacity: 0,
          animation: 'apg-fadein 0.4s ease 1.5s forwards',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#C9A84C',
              animation: `apg-dot 1.4s ease-in-out ${i * 0.22}s infinite`,
            }} />
          ))}
        </div>

      </div>
    </>
  );
}
