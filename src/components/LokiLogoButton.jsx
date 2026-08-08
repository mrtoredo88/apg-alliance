import React from 'react';

export function LokiLogoButton({ onClick, size = 44, radius = 18, style }) {
  return (
    <button type="button" onClick={onClick} aria-label="Открыть Локи" title="Открыть Локи" style={{ width: size, height: size, padding: 0, border: 0, borderRadius: radius, background: 'transparent', position: 'relative', display: 'grid', placeItems: 'center', flexShrink: 0, cursor: 'pointer', isolation: 'isolate', ...style }}>
      <style>{`@keyframes apgLokiLogoOrbit{to{transform:rotate(360deg)}}@keyframes apgLokiLogoGlow{0%,100%{opacity:.72;filter:blur(4px)}50%{opacity:1;filter:blur(7px)}}`}</style>
      <span aria-hidden="true" style={{ position: 'absolute', inset: -3, zIndex: -2, borderRadius: radius + 4, background: 'conic-gradient(from 0deg, rgba(184,255,92,0.12), #B8FF5C, #6FDB9A, rgba(184,255,92,0.16), #D8FF89, rgba(184,255,92,0.12))', animation: 'apgLokiLogoOrbit 3.8s linear infinite', boxShadow: '0 0 16px rgba(184,255,92,0.28)' }} />
      <span aria-hidden="true" style={{ position: 'absolute', inset: -5, zIndex: -3, borderRadius: radius + 6, background: 'rgba(184,255,92,0.25)', animation: 'apgLokiLogoGlow 2.6s ease-in-out infinite', pointerEvents: 'none' }} />
      <span style={{ width: size, height: size, padding: 2, boxSizing: 'border-box', borderRadius: radius, background: 'var(--apg2-bg-color, #101010)', display: 'block', overflow: 'hidden', boxShadow: '0 14px 34px rgba(0,0,0,0.28)' }}>
        <picture>
          <source srcSet="/logo.webp" type="image/webp" />
          <img src="/logo.png" alt="АПГ" style={{ width: '100%', height: '100%', borderRadius: Math.max(0, radius - 3), objectFit: 'cover', display: 'block' }} />
        </picture>
      </span>
    </button>
  );
}
