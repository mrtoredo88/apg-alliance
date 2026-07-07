import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APG2_PROFILE } from '../components/Apg2ProfileGlass.jsx';
import { useLoki } from './LokiProvider.jsx';
import { LokiExperience } from './LokiExperience.jsx';
import { LOKI_ACTIONS } from './lokiBehavior.js';
import { getLokiPosition } from './lokiPosition.js';

function getMotionName(emotion) {
  if (emotion === 'happy') return 'lokiHappy';
  if (emotion === 'excited') return 'lokiExcited';
  if (emotion === 'thinking') return 'lokiThinking';
  if (emotion === 'sad') return 'lokiSad';
  if (emotion === 'sleep') return 'lokiSleep';
  return 'lokiIdle';
}

function getActionName(action) {
  if (action === LOKI_ACTIONS.WAVE) return 'lokiWave';
  if (action === LOKI_ACTIONS.POINT) return 'lokiPoint';
  if (action === LOKI_ACTIONS.SPARK) return 'lokiSpark';
  if (action === LOKI_ACTIONS.CATCH_KEY) return 'lokiCatchKey';
  if (action === LOKI_ACTIONS.LISTEN) return 'lokiListen';
  if (action === LOKI_ACTIONS.YAWN) return 'lokiYawn';
  if (action === LOKI_ACTIONS.LOOK_AROUND) return 'lokiLookAround';
  if (action === LOKI_ACTIONS.PEEK) return 'lokiPeek';
  return 'none';
}

export function LokiAssistant() {
  const loki = useLoki();
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [brainText, setBrainText] = useState('');
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [rendered, setRendered] = useState(loki.visible);
  const [leaving, setLeaving] = useState(false);
  const rafRef = useRef(null);
  const shouldShowRestore = loki.dismissed || !loki.settings.enabled || loki.isHiddenOnPanel;
  const motionName = getMotionName(loki.emotion);
  const actionName = getActionName(loki.action);
  const position = getLokiPosition(loki.anchor);
  const bubbleText = String(loki.message || '');
  const isLongMessage = bubbleText.length > 86;

  useEffect(() => {
    if (!loki.visible) return undefined;
    const handlePointerMove = (event) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const centerX = window.innerWidth - 54;
        const centerY = window.innerHeight - 134;
        const dx = Math.max(-1, Math.min(1, (event.clientX - centerX) / 260));
        const dy = Math.max(-1, Math.min(1, (event.clientY - centerY) / 320));
        setLook({ x: Number((dx * 4).toFixed(2)), y: Number((dy * 3).toFixed(2)) });
      });
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [loki.visible]);

  useEffect(() => {
    if (loki.visible) {
      setRendered(true);
      setLeaving(false);
      return undefined;
    }
    if (!rendered) return undefined;
    setLeaving(true);
    const t = setTimeout(() => {
      setRendered(false);
      setLeaving(false);
    }, 360);
    return () => clearTimeout(t);
  }, [loki.visible, rendered]);

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

  if (loki.experienceOpen) {
    return <LokiExperience loki={loki} />;
  }

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

  if (!rendered) return null;

  return (
    <div
      style={{
        position: 'fixed',
        ...position,
        zIndex: 9997,
        display: 'grid',
        gap: 10,
        pointerEvents: 'none',
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'translate3d(8px, 12px, 0) scale(0.96)' : 'translate3d(0, 0, 0) scale(1)',
        filter: leaving ? 'blur(4px)' : 'blur(0)',
        transition: 'right 720ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)), bottom 720ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)), opacity 320ms ease, transform 520ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)), filter 320ms ease',
        animation: 'lokiAppear var(--motion-modal, 320ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
      }}
    >
      {loki.message && loki.canTalk && (
        <div
          style={{
            ...lokiPanelStyle,
            width: 'min(312px, calc(100vw - 28px))',
            maxWidth: 312,
            borderRadius: 24,
            padding: isLongMessage ? '15px 15px 14px' : '14px 14px 13px',
            color: APG2_PROFILE.text,
            border: '1px solid rgba(232,201,122,0.32)',
            pointerEvents: 'auto',
            transformOrigin: 'calc(100% - 36px) 100%',
            animation: 'lokiBubbleIn 340ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) 120ms both',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 11.5, lineHeight: '15px', fontWeight: 880, marginBottom: 5 }}>Локи</div>
              <div style={{ color: '#FFF9EA', fontSize: isLongMessage ? 13.5 : 14, lineHeight: isLongMessage ? '19.5px' : '20px', fontWeight: 800, letterSpacing: 0, overflowWrap: 'anywhere', hyphens: 'auto', textShadow: '0 1px 14px rgba(0,0,0,0.34)' }}>{bubbleText}</div>
            </div>
            <button
              type="button"
              onClick={() => loki.hide()}
              aria-label="Скрыть Локи"
              style={{ width: 30, height: 30, borderRadius: 13, border: '1px solid rgba(255,248,233,0.18)', background: 'rgba(255,255,255,0.09)', color: 'rgba(255,248,233,0.78)', fontSize: 18, lineHeight: '24px', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}
            >
              ×
            </button>
          </div>
          {loki.card && (
            <div style={{ marginTop: 11, borderRadius: 19, padding: 11, background: 'linear-gradient(145deg, rgba(12,11,13,0.68), rgba(32,26,18,0.52))', border: '1px solid rgba(215,184,106,0.26)', display: 'grid', gap: 8, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
              <div>
                <div style={{ color: '#FFF8E9', fontSize: 12.5, lineHeight: '16px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loki.card.title}</div>
                <div style={{ color: 'rgba(255,248,233,0.76)', fontSize: 11.5, lineHeight: '16px', marginTop: 2 }}>{loki.card.text}</div>
              </div>
              <button
                type="button"
                onClick={() => loki.executeAction(loki.card.action)}
                style={{
                  minHeight: 34,
                  borderRadius: 14,
                  border: '1px solid rgba(215,184,106,0.32)',
                  background: 'linear-gradient(135deg, rgba(215,184,106,0.28), rgba(255,255,255,0.08))',
                  color: APG2_PROFILE.gold,
                  fontSize: 12,
                  fontWeight: 860,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {loki.card.label}
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
            <button type="button" onClick={() => loki.hideCurrentPanel()} style={lokiSecondaryButtonStyle}>Скрыть тут</button>
            <button type="button" onClick={() => loki.setHintsEnabled(false)} style={{ ...lokiSecondaryButtonStyle, border: '1px solid rgba(215,184,106,0.28)', background: 'rgba(215,184,106,0.14)', color: APG2_PROFILE.gold }}>Выключить</button>
          </div>
        </div>
      )}

      <div style={{ position: 'relative', pointerEvents: 'auto' }}>
        {menuOpen && (
          <div style={{ ...lokiPanelStyle, position: 'absolute', right: 0, bottom: 88, width: 190, borderRadius: 24, padding: 9, display: 'grid', gap: 7, border: '1px solid rgba(215,184,106,0.28)', animation: 'lokiBubbleIn var(--motion-fast, 180ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both' }}>
            <button type="button" onClick={() => { loki.openExperience(); setMenuOpen(false); }} style={menuButtonStyle}>Открыть Локи</button>
            <button type="button" onClick={() => { setBrainOpen(v => !v); setHistoryOpen(false); setMenuOpen(false); }} style={menuButtonStyle}>Спросить Локи</button>
            <button type="button" onClick={() => { setHistoryOpen(v => !v); setMenuOpen(false); }} style={menuButtonStyle}>История Локи</button>
            <button type="button" onClick={() => { loki.handleCharacterTap(); setMenuOpen(false); }} style={menuButtonStyle}>Поздороваться</button>
            <button type="button" onClick={() => { loki.hideCurrentPanel(); setMenuOpen(false); }} style={menuButtonStyle}>Скрыть на экране</button>
            <button type="button" onClick={() => { loki.setHintsEnabled(false); setMenuOpen(false); }} style={menuButtonStyle}>Выключить подсказки</button>
          </div>
        )}
        {brainOpen && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const text = brainText.trim();
              if (!text || loki.brainThinking) return;
              setBrainText('');
              await loki.askBrain(text);
            }}
            style={{ ...lokiPanelStyle, position: 'absolute', right: 0, bottom: 88, width: 'min(304px, calc(100vw - 28px))', borderRadius: 26, padding: 13, display: 'grid', gap: 10, border: '1px solid rgba(215,184,106,0.28)', animation: 'lokiBubbleIn var(--motion-fast, 180ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 880 }}>Спросить Локи</div>
                <div style={{ color: 'rgba(255,248,233,0.68)', fontSize: 10.5, marginTop: 2 }}>Только по данным АПГ</div>
              </div>
              <button type="button" onClick={() => setBrainOpen(false)} style={{ width: 26, height: 26, borderRadius: 11, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.textSoft, fontSize: 16 }}>×</button>
            </div>
            <input
              value={brainText}
              onChange={e => setBrainText(e.target.value)}
              placeholder="Например: где выпить кофе?"
              style={{ minHeight: 44, borderRadius: 17, border: '1px solid rgba(255,248,233,0.18)', background: 'rgba(8,8,10,0.32)', color: '#FFF9EA', fontSize: 14, fontWeight: 720, fontFamily: 'inherit', outline: 'none', padding: '0 13px', boxSizing: 'border-box' }}
            />
            <button
              type="submit"
              disabled={!brainText.trim() || loki.brainThinking}
              style={{ minHeight: 38, borderRadius: 16, border: '1px solid rgba(215,184,106,0.32)', background: 'linear-gradient(135deg, rgba(215,184,106,0.30), rgba(255,255,255,0.08))', color: APG2_PROFILE.gold, fontSize: 12.5, fontWeight: 880, fontFamily: 'inherit', opacity: !brainText.trim() || loki.brainThinking ? 0.52 : 1 }}
            >
              {loki.brainThinking ? 'Думаю...' : 'Спросить'}
            </button>
          </form>
        )}
        {historyOpen && (
          <div style={{ ...lokiPanelStyle, position: 'absolute', right: 0, bottom: 88, width: 'min(294px, calc(100vw - 28px))', maxHeight: 'min(340px, calc(100svh - 220px))', overflowY: 'auto', WebkitOverflowScrolling: 'touch', borderRadius: 26, padding: 12, display: 'grid', gap: 9, border: '1px solid rgba(215,184,106,0.28)', animation: 'lokiBubbleIn var(--motion-fast, 180ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 880 }}>История Локи</div>
              <button type="button" onClick={() => setHistoryOpen(false)} style={{ width: 26, height: 26, borderRadius: 11, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.textSoft, fontSize: 16 }}>×</button>
            </div>
            {loki.history.length ? loki.history.slice(0, 8).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => item.card?.action && loki.executeAction(item.card.action)}
                style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)', borderRadius: 17, padding: 10, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: APG2_PROFILE.text, textAlign: 'left', fontFamily: 'inherit', display: 'grid', gap: 4 }}
              >
                <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 780, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.text}</span>
                <span style={{ fontSize: 10.5, color: APG2_PROFILE.textMuted }}>{item.status === 'opened' ? 'Открыто' : item.status === 'ignored' ? 'Пропущено' : 'Показано'}</span>
              </button>
            )) : (
              <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '17px', padding: 8 }}>Здесь появятся советы, поздравления и рекомендации.</div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={loki.openExperience}
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
          }}
        >
          <span style={{ display: 'block', transformOrigin: '50% 80%', animation: `${motionName} ${loki.emotion === 'excited' ? '860ms' : '4.6s'} var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) infinite` }}>
            <span style={{ display: 'block', transform: `translate3d(${look.x}px, ${look.y}px, 0) rotate(${look.x * 0.6}deg)`, transition: 'transform 260ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1))', animation: actionName === 'none' ? 'none' : `${actionName} 1500ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both` }}>
              <span style={spriteStyle}>
                <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 52% 30%, rgba(255,255,255,0.14), transparent 34%), linear-gradient(180deg, transparent, rgba(0,0,0,0.08))' }} />
                <span style={{ position: 'absolute', left: 18 + look.x, top: 19 + look.y, width: 28, height: 10, borderRadius: 999, background: 'rgba(20,14,24,0.42)', opacity: loki.action === LOKI_ACTIONS.BLINK ? 1 : 0, transform: 'scaleY(0.35)', animation: loki.action === LOKI_ACTIONS.BLINK ? 'lokiBlink 900ms ease both' : 'none', pointerEvents: 'none' }} />
                {(loki.action === LOKI_ACTIONS.POINT || loki.action === LOKI_ACTIONS.SPARK || loki.action === LOKI_ACTIONS.CATCH_KEY) && (
                  <span style={{ position: 'absolute', right: -7, top: 16, width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,184,0.95), rgba(215,184,106,0.58) 44%, transparent 70%)', boxShadow: '0 0 18px rgba(215,184,106,0.62)', animation: 'lokiSparkle 960ms ease-in-out infinite', pointerEvents: 'none' }} />
                )}
              </span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          aria-label="Настройки Локи"
          style={{ position: 'absolute', right: -3, top: -4, width: 28, height: 28, borderRadius: 12, border: '1px solid rgba(215,184,106,0.28)', background: 'rgba(16,14,10,0.44)', color: '#F7F1E6', fontSize: 16, lineHeight: '24px', fontWeight: 800, fontFamily: 'inherit', boxShadow: '0 10px 22px rgba(0,0,0,0.24)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', cursor: 'pointer' }}
        >
          ···
        </button>
      </div>
    </div>
  );
}

const menuButtonStyle = {
  minHeight: 38,
  borderRadius: 16,
  border: '1px solid rgba(255,248,233,0.14)',
  background: 'linear-gradient(145deg, rgba(255,255,255,0.10), rgba(255,255,255,0.045))',
  color: '#FFF8E9',
  fontSize: 12.5,
  fontWeight: 790,
  fontFamily: 'inherit',
  textAlign: 'left',
  padding: '0 11px',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

const lokiPanelStyle = {
  background: 'radial-gradient(circle at 18% 0%, rgba(255,244,205,0.24), transparent 38%), radial-gradient(circle at 80% 100%, rgba(215,184,106,0.13), transparent 46%), linear-gradient(145deg, rgba(34,28,24,0.965), rgba(15,15,18,0.925))',
  backdropFilter: 'blur(54px) saturate(1.86)',
  WebkitBackdropFilter: 'blur(54px) saturate(1.86)',
  boxShadow: '0 26px 74px rgba(0,0,0,0.44), 0 0 36px rgba(215,184,106,0.13), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -24px 48px rgba(215,184,106,0.07)',
};

const lokiSecondaryButtonStyle = {
  flex: 1,
  minHeight: 34,
  borderRadius: 15,
  border: '1px solid rgba(255,248,233,0.16)',
  background: 'rgba(255,255,255,0.075)',
  color: 'rgba(255,248,233,0.78)',
  fontSize: 11.5,
  fontWeight: 790,
  fontFamily: 'inherit',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};
