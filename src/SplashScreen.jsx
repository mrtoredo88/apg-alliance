import React, { useEffect, useRef, useState } from 'react';

const SPLASH_RATIO = 1009 / 1558;
const MIN_SHOW_MS = 1900;
const MAX_SHOW_MS = 3600;

const CSS = `
@keyframes apg-splash-art-in {
  0% { opacity: 0; transform: translateY(10px) scale(0.985); filter: blur(10px) saturate(0.92); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) saturate(1.02); }
}
@keyframes apg-splash-out {
  0% { opacity: 1; transform: scale(1); filter: blur(0); }
  100% { opacity: 0; transform: scale(1.018); filter: blur(8px); }
}
@media (max-width: 560px) {
  [data-apg-splash-frame] {
    width: 100vw !important;
    height: 100svh !important;
    max-width: none !important;
    max-height: none !important;
    border-radius: 0 !important;
    border: 0 !important;
  }
  [data-apg-splash-art] {
    object-fit: cover !important;
  }
}
`;

export function SplashScreen({ isReady, onDone, startTime }) {
  const [phase, setPhase] = useState('enter');
  const mountTime = useRef(startTime ?? Date.now());

  useEffect(() => {
    if (!isReady) return undefined;
    const elapsed = Date.now() - mountTime.current;
    const wait = Math.max(0, MIN_SHOW_MS - elapsed);
    const timer = setTimeout(() => setPhase('exit'), wait);
    return () => clearTimeout(timer);
  }, [isReady]);

  useEffect(() => {
    const elapsed = Date.now() - mountTime.current;
    const wait = Math.max(MIN_SHOW_MS, MAX_SHOW_MS - elapsed);
    const timer = setTimeout(() => setPhase('exit'), wait);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== 'exit') return undefined;
    const timer = setTimeout(() => onDone?.(), 620);
    return () => clearTimeout(timer);
  }, [phase, onDone]);

  const exiting = phase === 'exit';

  return (
    <>
      <style>{CSS}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'calc(10px + env(safe-area-inset-top, 0px)) 10px calc(10px + env(safe-area-inset-bottom, 0px))',
          boxSizing: 'border-box',
          background: 'radial-gradient(circle at 50% 86%, rgba(201,148,46,0.22), transparent 34%), linear-gradient(180deg, #05080B 0%, #090B0E 52%, #030405 100%)',
          pointerEvents: exiting ? 'none' : 'auto',
          animation: exiting ? 'apg-splash-out 520ms cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
        }}
        onAnimationEnd={e => {
          if (exiting && e.animationName === 'apg-splash-out') onDone?.();
        }}
      >
        <div
          data-apg-splash-frame
          style={{
            position: 'relative',
            width: `min(calc(100vw - 20px), 440px, calc((100svh - 20px) * ${SPLASH_RATIO}))`,
            aspectRatio: '1009 / 1558',
            maxHeight: 'calc(100svh - 20px)',
            borderRadius: 34,
            overflow: 'hidden',
            background: '#07090C',
            border: '1px solid rgba(232,201,122,0.30)',
            boxShadow: '0 28px 90px rgba(0,0,0,0.58), 0 0 54px rgba(201,148,46,0.12)',
            opacity: 0,
            animation: 'apg-splash-art-in 760ms cubic-bezier(0.2,0,0,1) 80ms forwards',
          }}
        >
          <img
            data-apg-splash-art
            src="/splash-v43.png"
            alt="АПГ — Альянс партнёров города"
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center center',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </>
  );
}
