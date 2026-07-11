import React from 'react';
import { APG2_PROFILE } from '../components/Apg2ProfileGlass.jsx';

export function LokiIdentity({ size = 56, state = 'ready', label = 'Локи', sublabel, style, imageStyle }) {
  const statusColor = state === 'attention' ? APG2_PROFILE.gold : state === 'busy' ? '#4A90D9' : '#4BB34B';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${size}px minmax(0,1fr)`, gap: Math.max(10, Math.round(size * 0.22)), alignItems: 'center', minWidth: 0, ...style }}>
      <div style={{ position: 'relative', width: size, height: size, borderRadius: Math.round(size * 0.42), overflow: 'hidden', background: APG2_PROFILE.goldSoft, border: '1px solid rgba(244,217,140,0.28)', boxShadow: '0 18px 46px rgba(215,184,106,0.20)', flex: '0 0 auto' }}>
        <img
          src="/loki.png"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...imageStyle }}
          draggable={false}
        />
        <span style={{ position: 'absolute', right: -1, bottom: -1, width: Math.max(13, Math.round(size * 0.26)), height: Math.max(13, Math.round(size * 0.26)), borderRadius: 99, background: statusColor, border: '2px solid rgba(24,22,20,0.86)', boxShadow: `0 0 18px ${statusColor === APG2_PROFILE.gold ? 'rgba(215,184,106,0.42)' : 'rgba(75,179,75,0.30)'}` }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: size >= 54 ? 18 : 15, lineHeight: size >= 54 ? '22px' : '19px', fontWeight: 940, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {sublabel && <div style={{ color: APG2_PROFILE.textSoft, fontSize: size >= 54 ? 12.5 : 11.5, lineHeight: size >= 54 ? '17px' : '15px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sublabel}</div>}
      </div>
    </div>
  );
}
