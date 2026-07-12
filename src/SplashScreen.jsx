import React, { useEffect, useRef, useState } from 'react';
import { MOTION } from './motion.js';

const MIN_SHOW_MS = 1900;
const MAX_SHOW_MS = 4200;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const CSS = `
@keyframes apg-splash-enter {
  0% { opacity: 1; transform: scale(1); filter: blur(0); }
  100% { opacity: 1; transform: scale(1); filter: blur(0); }
}
@keyframes apg-splash-out {
  0% { opacity: 1; transform: scale(1); filter: blur(0); }
  72% { opacity: 1; transform: scale(1.006); filter: blur(0); }
  100% { opacity: 0; transform: scale(1.022); filter: blur(14px); }
}
@keyframes apg-splash-orbit {
  0% { transform: translate3d(-2.8%, -1.8%, 0) scale(1); opacity: 0.76; }
  50% { transform: translate3d(2.6%, 2.1%, 0) scale(1.035); opacity: 0.94; }
  100% { transform: translate3d(-2.8%, -1.8%, 0) scale(1); opacity: 0.76; }
}
@keyframes apg-splash-noise {
  0% { transform: translate3d(0, 0, 0); opacity: 0.18; }
  50% { transform: translate3d(-1.2%, 0.8%, 0); opacity: 0.25; }
  100% { transform: translate3d(0, 0, 0); opacity: 0.18; }
}
@keyframes apg-splash-logo-breathe {
  0%, 100% { transform: translate3d(0,0,0) scale(1); filter: drop-shadow(0 0 20px rgba(123,85,255,0.22)) drop-shadow(0 0 28px rgba(232,201,122,0.12)); }
  50% { transform: translate3d(0,-1px,0) scale(1.03); filter: drop-shadow(0 0 34px rgba(123,85,255,0.38)) drop-shadow(0 0 34px rgba(232,201,122,0.20)); }
}
@keyframes apg-splash-title-in {
  0% { opacity: 0; transform: translateY(8px); filter: blur(8px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes apg-splash-shimmer {
  0% { transform: translateX(-110%); opacity: 0; }
  12% { opacity: 0.9; }
  88% { opacity: 0.9; }
  100% { transform: translateX(110%); opacity: 0; }
}
@keyframes apg-splash-particle-one {
  0%, 100% { transform: translate3d(-7px, 5px, 0) scale(0.72); opacity: 0.2; }
  48% { transform: translate3d(8px, -7px, 0) scale(1); opacity: 0.74; }
}
@keyframes apg-splash-particle-two {
  0%, 100% { transform: translate3d(6px, -4px, 0) scale(0.68); opacity: 0.16; }
  52% { transform: translate3d(-8px, 7px, 0) scale(0.94); opacity: 0.58; }
}
@media (prefers-reduced-motion: reduce) {
  [data-apg-splash-animated] {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
`;

export function SplashScreen({
  isReady = false,
  onDone,
  startTime,
  label = 'Альянс партнёров города',
  status = 'Подготавливаем вашу экосистему…',
  autoTimeout = true,
}) {
  const [phase, setPhase] = useState('enter');
  const [progress, setProgress] = useState(0.08);
  const mountTime = useRef(startTime ?? Date.now());
  const doneRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const elapsed = Date.now() - mountTime.current;
      const baseTarget = isReady ? 1 : clamp(0.08 + elapsed / 4400, 0.08, 0.88);
      setProgress(prev => {
        const speed = isReady ? 0.18 : 0.024;
        const next = prev + (baseTarget - prev) * speed;
        return clamp(next, 0.08, isReady ? 1 : 0.9);
      });
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isReady]);

  useEffect(() => {
    if (!isReady) return undefined;
    const elapsed = Date.now() - mountTime.current;
    const wait = Math.max(0, MIN_SHOW_MS - elapsed);
    const timer = setTimeout(() => {
      setProgress(1);
      setPhase('exit');
    }, wait + 360);
    return () => clearTimeout(timer);
  }, [isReady]);

  useEffect(() => {
    if (!autoTimeout) return undefined;
    const elapsed = Date.now() - mountTime.current;
    const wait = Math.max(MIN_SHOW_MS, MAX_SHOW_MS - elapsed);
    const timer = setTimeout(() => {
      setProgress(1);
      setPhase('exit');
    }, wait);
    return () => clearTimeout(timer);
  }, [autoTimeout]);

  useEffect(() => {
    if (phase !== 'exit') return undefined;
    const timer = setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone?.();
    }, MOTION.duration.splash + 180);
    return () => clearTimeout(timer);
  }, [phase, onDone]);

  const exiting = phase === 'exit';
  const progressPercent = `${Math.round(progress * 1000) / 10}%`;
  const flareLeft = `${clamp(progress * 100, 8, 100)}%`;

  return (
    <>
      <style>{CSS}</style>
      <div
        data-apg-splash-root
        data-apg-splash-animated
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          overflow: 'hidden',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100svh',
          padding: 'max(24px, env(safe-area-inset-top, 0px)) max(22px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(22px, env(safe-area-inset-left, 0px))',
          boxSizing: 'border-box',
          color: '#F8F2E6',
          background: '#05050B',
          pointerEvents: exiting ? 'none' : 'auto',
          animation: exiting
            ? 'apg-splash-out var(--motion-splash, 760ms) var(--motion-ease-in-out, cubic-bezier(0.4,0,0.2,1)) forwards'
            : 'none',
        }}
        onAnimationEnd={event => {
          if (!exiting || event.animationName !== 'apg-splash-out' || doneRef.current) return;
          doneRef.current = true;
          onDone?.();
        }}
      >
        <div
          data-apg-splash-animated
          style={{
            position: 'absolute',
            inset: '-18%',
            background: [
              'radial-gradient(circle at 50% 38%, rgba(113,72,255,0.28), transparent 23%)',
              'radial-gradient(circle at 38% 64%, rgba(201,168,76,0.20), transparent 28%)',
              'radial-gradient(circle at 74% 20%, rgba(72,88,196,0.20), transparent 30%)',
              'linear-gradient(135deg, #020308 0%, #111222 42%, #060712 100%)',
            ].join(', '),
            animation: 'apg-splash-orbit 9000ms ease-in-out infinite',
            transform: 'translate3d(0,0,0)',
          }}
        />
        <div
          data-apg-splash-animated
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.28,
            backgroundImage: [
              'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '72px 72px',
            maskImage: 'radial-gradient(circle at center, black 0%, transparent 68%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 0%, transparent 68%)',
          }}
        />
        <div
          data-apg-splash-animated
          style={{
            position: 'absolute',
            inset: '-30%',
            background: 'radial-gradient(circle at 52% 48%, rgba(255,255,255,0.12), transparent 11%), radial-gradient(circle at 42% 54%, rgba(201,168,76,0.10), transparent 18%)',
            filter: 'blur(42px)',
            mixBlendMode: 'screen',
            animation: 'apg-splash-noise 7600ms ease-in-out infinite',
          }}
        />

        <main
          style={{
            position: 'relative',
            zIndex: 1,
            width: 'min(440px, calc(100vw - 44px))',
            display: 'grid',
            justifyItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 122,
              height: 122,
              display: 'grid',
              placeItems: 'center',
              marginBottom: 26,
            }}
          >
            <div style={{ position: 'absolute', inset: -28, borderRadius: '50%', background: 'radial-gradient(circle, rgba(123,85,255,0.28), rgba(201,168,76,0.12) 36%, transparent 68%)', filter: 'blur(20px)' }} />
            <div style={{ position: 'absolute', inset: -7, borderRadius: 34, background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.34), 0 24px 80px rgba(0,0,0,0.42)' }} />
            <img
              data-apg-splash-animated
              src="/logo.png"
              alt="АПГ"
              width="96"
              height="96"
              style={{
                position: 'relative',
                display: 'block',
                width: 96,
                height: 96,
                objectFit: 'contain',
                borderRadius: 26,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                pointerEvents: 'none',
                animation: 'apg-splash-logo-breathe 3300ms ease-in-out infinite',
              }}
            />
          </div>

          <div data-apg-splash-animated style={{ animation: 'apg-splash-title-in 720ms var(--motion-ease-soft, cubic-bezier(0.2,0,0,1)) 120ms both' }}>
            <div style={{ color: '#F9F2DE', fontSize: 'clamp(18px, 2.1vw, 22px)', lineHeight: 1.12, fontWeight: 900, letterSpacing: '-0.03em' }}>
              {label}
            </div>
            <div style={{ marginTop: 10, color: 'rgba(248,242,230,0.58)', fontSize: 12.5, lineHeight: '17px', fontWeight: 650, letterSpacing: '0.01em' }}>
              {status}
            </div>
          </div>

          <div
            aria-label="Загрузка АПГ"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            style={{
              position: 'relative',
              width: 'min(330px, 78vw)',
              height: 8,
              marginTop: 34,
              borderRadius: 999,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.045))',
              border: '1px solid rgba(255,255,255,0.16)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), inset 0 -1px 0 rgba(0,0,0,0.34), 0 18px 54px rgba(0,0,0,0.36)',
              overflow: 'visible',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: progressPercent,
                  height: '100%',
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #9B6DFF 0%, #C9A84C 36%, #FFF0B8 66%, #7E5BFF 100%)',
                  boxShadow: exiting
                    ? '0 0 34px rgba(255,240,184,0.78), 0 0 56px rgba(126,91,255,0.42), inset 0 0 14px rgba(255,255,255,0.50)'
                    : '0 0 24px rgba(201,168,76,0.46), 0 0 38px rgba(126,91,255,0.22), inset 0 0 10px rgba(255,255,255,0.30)',
                  transition: 'width 260ms var(--motion-ease-soft, cubic-bezier(0.2,0,0,1)), box-shadow 420ms ease',
                }}
              />
              <div
                data-apg-splash-animated
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '58%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.68) 48%, transparent 100%)',
                  mixBlendMode: 'screen',
                  animation: 'apg-splash-shimmer 1800ms ease-in-out infinite',
                }}
              />
            </div>
            <div
              data-apg-splash-animated
              style={{
                position: 'absolute',
                left: flareLeft,
                top: '50%',
                width: 17,
                height: 17,
                borderRadius: '50%',
                transform: 'translate3d(-50%, -50%, 0)',
                background: 'radial-gradient(circle, #FFF5C9 0%, #E8C97A 34%, rgba(126,91,255,0.62) 66%, transparent 72%)',
                boxShadow: '0 0 20px rgba(255,240,184,0.86), 0 0 34px rgba(126,91,255,0.48)',
                transition: 'left 260ms var(--motion-ease-soft, cubic-bezier(0.2,0,0,1))',
              }}
            >
              <span data-apg-splash-animated style={{ position: 'absolute', left: -5, top: 1, width: 4, height: 4, borderRadius: '50%', background: '#FFF0B8', boxShadow: '0 0 12px rgba(255,240,184,0.8)', animation: 'apg-splash-particle-one 1700ms ease-in-out infinite' }} />
              <span data-apg-splash-animated style={{ position: 'absolute', right: -4, bottom: 0, width: 3, height: 3, borderRadius: '50%', background: '#B39CFF', boxShadow: '0 0 10px rgba(179,156,255,0.8)', animation: 'apg-splash-particle-two 1900ms ease-in-out infinite' }} />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
