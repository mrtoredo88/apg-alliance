import React from 'react';
import { APG2_PROFILE } from '../components/Apg2ProfileGlass.jsx';

export const LOKI_IDENTITY_STATES = {
  ready: { label: 'на связи', color: '#4BB34B', glow: 'rgba(75,179,75,0.34)', surface: 'rgba(75,179,75,0.10)' },
  thinking: { label: 'думает', color: '#4A90D9', glow: 'rgba(74,144,217,0.36)', surface: 'rgba(74,144,217,0.12)' },
  answering: { label: 'отвечает', color: APG2_PROFILE.gold, glow: 'rgba(215,184,106,0.46)', surface: 'rgba(215,184,106,0.14)' },
  listening: { label: 'слушает', color: '#8B7CFF', glow: 'rgba(139,124,255,0.38)', surface: 'rgba(139,124,255,0.12)' },
  waiting: { label: 'ожидает', color: '#9AA0AA', glow: 'rgba(154,160,170,0.26)', surface: 'rgba(255,255,255,0.08)' },
  recommending: { label: 'рекомендует', color: APG2_PROFILE.gold, glow: 'rgba(215,184,106,0.52)', surface: 'rgba(215,184,106,0.16)' },
  attention: { label: 'видит сигналы', color: APG2_PROFILE.gold, glow: 'rgba(215,184,106,0.52)', surface: 'rgba(215,184,106,0.16)' },
  busy: { label: 'в работе', color: '#4A90D9', glow: 'rgba(74,144,217,0.36)', surface: 'rgba(74,144,217,0.12)' },
  speaking: { label: 'отвечает', color: APG2_PROFILE.gold, glow: 'rgba(215,184,106,0.46)', surface: 'rgba(215,184,106,0.14)' },
};

export function LokiIdentity({ size = 56, state = 'ready', label = 'Локи', sublabel, showText = true, style, imageStyle }) {
  const current = LOKI_IDENTITY_STATES[state] || LOKI_IDENTITY_STATES.ready;
  const orbSize = Math.round(size * 1.06);
  const imageSize = Math.round(size * 0.82);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: showText ? `${orbSize}px minmax(0,1fr)` : `${orbSize}px`, gap: Math.max(11, Math.round(size * 0.22)), alignItems: 'center', minWidth: 0, justifyContent: showText ? 'stretch' : 'center', ...style }}>
      <style>{`@keyframes lokiIdentityPulse{0%,100%{transform:scale(1);opacity:.64}50%{transform:scale(1.08);opacity:1}}@keyframes lokiIdentityFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}`}</style>
      <div style={{ position: 'relative', width: orbSize, height: orbSize, borderRadius: 999, display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 42% 28%, rgba(255,255,255,0.62), transparent 18%), radial-gradient(circle at 50% 50%, ${current.surface}, transparent 66%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.24), rgba(var(--apg2-glass-a,255,255,255),0.08))`, border: `1px solid ${current.color === APG2_PROFILE.gold ? 'rgba(215,184,106,0.44)' : 'rgba(var(--apg2-glass-a,255,255,255),0.24)'}`, boxShadow: `0 18px 48px ${current.glow}, inset 0 1px 0 rgba(255,255,255,0.28)`, flex: '0 0 auto', overflow: 'visible' }}>
        <span aria-hidden="true" style={{ position: 'absolute', inset: -4, borderRadius: 999, border: `1px solid ${current.color}`, opacity: 0.42, animation: state === 'waiting' ? 'none' : 'lokiIdentityPulse 2.4s ease-in-out infinite' }} />
        <div style={{ width: imageSize, height: imageSize, borderRadius: 999, overflow: 'hidden', background: APG2_PROFILE.goldSoft, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)', animation: state === 'thinking' || state === 'answering' ? 'lokiIdentityFloat 2.2s ease-in-out infinite' : 'none' }}>
          <img
            src="/loki.png"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scale(1.05)', ...imageStyle }}
            draggable={false}
          />
        </div>
        <span style={{ position: 'absolute', right: Math.max(1, Math.round(size * 0.02)), bottom: Math.max(1, Math.round(size * 0.02)), width: Math.max(13, Math.round(size * 0.24)), height: Math.max(13, Math.round(size * 0.24)), borderRadius: 99, background: current.color, border: '2px solid rgba(24,22,20,0.86)', boxShadow: `0 0 20px ${current.glow}` }} />
      </div>
      {showText && (
        <div style={{ minWidth: 0 }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: size >= 54 ? 18 : 15, lineHeight: size >= 54 ? '22px' : '19px', fontWeight: 940, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: size >= 54 ? 12.5 : 11.5, lineHeight: size >= 54 ? '17px' : '15px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sublabel || current.label}</div>
        </div>
      )}
    </div>
  );
}
