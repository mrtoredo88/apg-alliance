import React, { useMemo, useState } from 'react';
import { APG2_PROFILE } from '../components/Apg2ProfileGlass.jsx';
import { useLoki } from './LokiProvider.jsx';

function getMotionName(emotion) {
  if (emotion === 'happy') return 'lokiHappy';
  if (emotion === 'excited') return 'lokiExcited';
  if (emotion === 'thinking') return 'lokiThinking';
  if (emotion === 'sad') return 'lokiSad';
  if (emotion === 'sleep') return 'lokiSleep';
  return 'lokiIdle';
}

export function LokiAssistant() {
  const loki = useLoki();
  const [menuOpen, setMenuOpen] = useState(false);
  const shouldShowRestore = !loki.visible || !loki.settings.enabled || loki.isHiddenOnPanel;
  const motionName = getMotionName(loki.emotion);

  const spriteStyle = useMemo(() => ({
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundImage: 'url(/loki.png)',
    backgroundSize: '285%',
    backgroundPosition: '50% 23%',
    backgroundRepeat: 'no-repeat',
    boxShadow: '0 18px 48px rgba(0,0,0,0.28), 0 0 34px rgba(215,184,106,0.25)',
    border: '1px solid rgba(215,184,106,0.32)',
    display: 'block',
    position: 'relative',
    overflow: 'hidden',
  }), []);

  if (shouldShowRestore) {
    return (
      <button
        type="button"
        onClick={() => {
          loki.setHintsEnabled(true);
          loki.showCurrentPanel();
          loki.show();
          setMenuOpen(false);
        }}
        aria-label="Вернуть Локи"
        style={{
          position: 'fixed',
          right: 'max(14px, env(safe-area-inset-right, 0px))',
          bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))',
          zIndex: 9997,
          width: 46,
          height: 46,
          borderRadius: 19,
          border: '1px solid rgba(215,184,106,0.34)',
          background: 'linear-gradient(145deg, rgba(255,255,255,0.20), rgba(255,255,255,0.06))',
          backdropFilter: 'blur(22px) saturate(1.7)',
          WebkitBackdropFilter: 'blur(22px) saturate(1.7)',
          boxShadow: '0 14px 36px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.24)',
          padding: 0,
          overflow: 'hidden',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          animation: 'lokiAppear var(--motion-modal, 320ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
        }}
      >
        <span style={{ display: 'block', width: '100%', height: '100%', backgroundImage: 'url(/loki.png)', backgroundSize: '330%', backgroundPosition: '50% 23%', backgroundRepeat: 'no-repeat' }} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 'max(12px, env(safe-area-inset-right, 0px))',
        bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
        zIndex: 9997,
        width: 'min(292px, calc(100vw - 24px))',
        display: 'grid',
        justifyItems: 'end',
        gap: 10,
        pointerEvents: 'none',
        animation: 'lokiAppear var(--motion-modal, 320ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
      }}
    >
      {loki.message && loki.canTalk && (
        <div
          style={{
            ...APG2_PROFILE.glass,
            maxWidth: 246,
            borderRadius: 22,
            padding: '12px 12px 11px',
            color: APG2_PROFILE.text,
            border: '1px solid rgba(215,184,106,0.24)',
            boxShadow: '0 18px 50px var(--apg2-elev-shadow, rgba(0,0,0,0.28)), inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.28)',
            pointerEvents: 'auto',
            animation: 'lokiBubbleIn var(--motion-base, 240ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 11, lineHeight: '14px', fontWeight: 860, marginBottom: 4 }}>Локи</div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 13, lineHeight: '18px', fontWeight: 720 }}>{loki.message}</div>
            </div>
            <button
              type="button"
              onClick={() => loki.hide()}
              aria-label="Скрыть Локи"
              style={{ width: 28, height: 28, borderRadius: 12, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.18)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.textSoft, fontSize: 18, lineHeight: '24px', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}
            >
              ×
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => loki.hideCurrentPanel()} style={{ flex: 1, minHeight: 30, borderRadius: 13, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: APG2_PROFILE.textSoft, fontSize: 11, fontWeight: 760, fontFamily: 'inherit' }}>Скрыть тут</button>
            <button type="button" onClick={() => loki.setHintsEnabled(false)} style={{ flex: 1, minHeight: 30, borderRadius: 13, border: '1px solid rgba(215,184,106,0.22)', background: 'rgba(215,184,106,0.12)', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 800, fontFamily: 'inherit' }}>Выключить</button>
          </div>
        </div>
      )}

      <div style={{ position: 'relative', pointerEvents: 'auto' }}>
        {menuOpen && (
          <div style={{ ...APG2_PROFILE.glass, position: 'absolute', right: 0, bottom: 86, width: 178, borderRadius: 22, padding: 8, display: 'grid', gap: 6, border: '1px solid rgba(215,184,106,0.22)', animation: 'lokiBubbleIn var(--motion-fast, 180ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both' }}>
            <button type="button" onClick={() => { loki.hideCurrentPanel(); setMenuOpen(false); }} style={menuButtonStyle}>Скрыть на экране</button>
            <button type="button" onClick={() => { loki.setHintsEnabled(false); setMenuOpen(false); }} style={menuButtonStyle}>Выключить подсказки</button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Локи"
          style={{
            width: 84,
            height: 84,
            border: 0,
            borderRadius: 30,
            padding: 4,
            background: 'linear-gradient(145deg, rgba(215,184,106,0.34), rgba(var(--apg2-glass-a,255,255,255),0.12))',
            boxShadow: '0 22px 56px rgba(0,0,0,0.26)',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transformOrigin: '50% 80%',
            animation: `${motionName} ${loki.emotion === 'excited' ? '860ms' : '4.6s'} var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) infinite`,
          }}
        >
          <span style={spriteStyle}>
            <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 52% 30%, rgba(255,255,255,0.14), transparent 34%), linear-gradient(180deg, transparent, rgba(0,0,0,0.08))' }} />
          </span>
        </button>
      </div>
    </div>
  );
}

const menuButtonStyle = {
  minHeight: 36,
  borderRadius: 15,
  border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)',
  background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)',
  color: APG2_PROFILE.text,
  fontSize: 12,
  fontWeight: 760,
  fontFamily: 'inherit',
  textAlign: 'left',
  padding: '0 10px',
  cursor: 'pointer',
};
