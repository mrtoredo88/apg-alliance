import React, { useEffect, useRef, useState } from 'react';

const CSS = `
@keyframes apg-shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@keyframes apg-splash-in {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
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
@keyframes apg-progress {
  from { width: 0%; }
  to   { width: 100%; }
}
`;

const SHIMMER_GRAD = 'linear-gradient(90deg, #8A6520 0%, #C9A84C 20%, #F0E0A0 38%, #FFFBEF 50%, #F0E0A0 62%, #C9A84C 80%, #8A6520 100%)';

const shimmerText = (extra = {}) => ({
  background: SHIMMER_GRAD,
  backgroundSize: '200% 100%',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  animation: 'apg-shimmer 2.6s linear 0.3s infinite',
  ...extra,
});

export function SplashScreen({ isReady, onDone, startTime }) {
  const [phase, setPhase]  = useState('enter');
  const mountTime          = useRef(startTime ?? Date.now());
  const MIN_SHOW_MS        = 1800;

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
        background: '#080818',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: exiting ? 'none' : 'all',
        opacity:   exiting ? 0 : 1,
        transform: exiting ? 'scale(1.04)' : 'scale(1)',
        transition: exiting
          ? 'opacity 0.45s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1)'
          : 'none',
      }}
        onTransitionEnd={e => { if (exiting && e.propertyName === 'opacity') onDone?.(); }}
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
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(rgba(201,168,76,0.045) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
        </div>

        {/* Единый блок — появляется весь сразу */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: 0,
          animation: 'apg-splash-in 0.5s cubic-bezier(0.2,0,0,1) 0.1s forwards',
        }}>

          {/* Логотип */}
          <div style={{ position: 'relative', marginBottom: 32 }}>
            <div style={{
              position: 'absolute', inset: -32, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 68%)',
              animation: 'apg-ring-pulse 2.6s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: -16, borderRadius: 52,
              border: '1px solid rgba(201,168,76,0.12)',
              animation: 'apg-ring-pulse 2.6s ease-in-out 0.3s infinite',
            }} />
            <div style={{
              position: 'relative', overflow: 'hidden', borderRadius: 36,
              boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,168,76,0.18)',
            }}>
              <div style={{
                position: 'absolute', inset: 0, zIndex: 1, borderRadius: 36,
                background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.07) 50%, transparent 70%)',
                backgroundSize: '200% 100%',
                animation: 'apg-shimmer 2.6s linear 0.3s infinite',
                pointerEvents: 'none',
              }} />
              <img src="/logo.png" alt="АПГ" style={{ width: 240, height: 240, display: 'block', borderRadius: 40 }} />
            </div>
          </div>

          {/* Название */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontSize: 52, fontWeight: 900, letterSpacing: 14,
              lineHeight: 1, paddingLeft: 14,
              ...shimmerText(),
            }}>АПГ</div>

            <div style={{
              margin: '14px auto',
              width: 64, height: 1,
              background: SHIMMER_GRAD,
              backgroundSize: '200% 100%',
              animation: 'apg-shimmer 2.6s linear 0.3s infinite',
            }} />

            <div style={{
              fontSize: 11, fontWeight: 800,
              letterSpacing: 5, paddingLeft: 5,
              textTransform: 'uppercase',
            }}>
              <span style={{ ...shimmerText() }}>Зеленоград</span>
            </div>
          </div>

          {/* Прогресс-бар */}
          <div style={{
            width: 140, height: 2,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 1, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 1,
              background: SHIMMER_GRAD,
              backgroundSize: '200% 100%',
              animation: `apg-progress ${MIN_SHOW_MS}ms cubic-bezier(0.4,0,0.2,1) 0.1s forwards,
                          apg-shimmer 2.6s linear 0.3s infinite`,
            }} />
          </div>

        </div>

      </div>
    </>
  );
}
