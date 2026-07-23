import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { APG2_PROFILE } from '../components/Apg2ProfileGlass.jsx';
import { useLoki } from './LokiProvider.jsx';
import { LokiExperience } from './LokiExperience.jsx';
import { LokiIdentity } from './LokiIdentity.jsx';
import { LOKI_ACTIONS } from './lokiBehavior.js';
import { getLokiPosition } from './lokiPosition.js';
import { LOKI_APP_ACTIONS, createLokiAction } from './lokiActionTypes.js';

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

function getIdentityState(emotion, action) {
  if (action === LOKI_ACTIONS.LISTEN) return 'listening';
  if (emotion === 'thinking') return 'thinking';
  if (emotion === 'excited' || emotion === 'happy') return 'recommending';
  if (emotion === 'sleep') return 'waiting';
  return 'ready';
}

function recordLokiTapTrace(step, detail = {}) {
  if (typeof window === 'undefined') return;
  const trace = Array.isArray(window.__APG_LOKI_TAP_TRACE__) ? window.__APG_LOKI_TAP_TRACE__ : [];
  const entry = {
    step,
    detail,
    at: new Date().toISOString(),
  };
  window.__APG_LOKI_TAP_TRACE__ = [...trace.slice(-39), entry];
}

function eventDetail(event) {
  const touch = event.changedTouches?.[0] || event.touches?.[0] || null;
  return {
    type: event.type,
    pointerType: event.pointerType || '',
    cancelable: Boolean(event.cancelable),
    defaultPrevented: Boolean(event.defaultPrevented),
    x: Math.round(touch?.clientX ?? event.clientX ?? 0),
    y: Math.round(touch?.clientY ?? event.clientY ?? 0),
    target: event.target?.getAttribute?.('aria-label') || event.target?.tagName || '',
    currentTarget: event.currentTarget?.getAttribute?.('aria-label') || event.currentTarget?.tagName || '',
  };
}

export function LokiAssistant({ desktopMode = false, onOpenMessages, messageUnreadCount = 0 }) {
  const loki = useLoki();
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [brainText, setBrainText] = useState('');
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [rendered, setRendered] = useState(loki.visible);
  const [leaving, setLeaving] = useState(false);
  const rafRef = useRef(null);
  const floatingButtonRef = useRef(null);
  const openGuardRef = useRef(0);
  const shouldShowRestore = loki.dismissed || !loki.settings.enabled || loki.isHiddenOnPanel;
  const motionName = getMotionName(loki.emotion);
  const actionName = getActionName(loki.action);
  const position = desktopMode
    ? {
      right: 'max(18px, env(safe-area-inset-right, 0px))',
      bottom: 'max(18px, env(safe-area-inset-bottom, 0px))',
      width: 'auto',
      maxWidth: 'calc(100vw - 36px)',
      justifyItems: 'end',
      justifyContent: 'end',
      boxSizing: 'border-box',
    }
    : getLokiPosition(loki.anchor);
  const bubbleText = String(loki.message || '');
  const isLongMessage = bubbleText.length > 86;
  const isCelebrating = loki.emotion === 'happy' || loki.emotion === 'excited';
  const isThinking = loki.emotion === 'thinking' || loki.action === LOKI_ACTIONS.LOOK_AROUND;
  const rootWidth = desktopMode
    ? position.width
    : (loki.message && loki.canTalk)
      ? 'min(334px, calc(100vw - 28px))'
      : brainOpen
        ? 'min(304px, calc(100vw - 28px))'
        : historyOpen
          ? 'min(294px, calc(100vw - 28px))'
          : menuOpen
            ? 190
            : 92;
  const safeMessageUnread = Math.max(0, Math.min(99, Number(messageUnreadCount || 0) || 0));
  const showMessageFab = !desktopMode && typeof onOpenMessages === 'function';
  const hasLokiSignal = Boolean(loki.card || (loki.message && loki.canTalk));
  const hitDebug = import.meta.env.DEV && (() => {
    try {
      return localStorage.getItem('apg_loki_hit_debug') === '1';
    } catch {
      return false;
    }
  })();
  const markFloatingButtonEvent = (event) => {
    recordLokiTapTrace(`react_capture_${event.type}`, eventDetail(event));
    if (!hitDebug || typeof window === 'undefined') return;
    const target = event.target;
    window.__apgLokiHitDebug = {
      type: event.type,
      target: target?.getAttribute?.('aria-label') || target?.tagName || '',
      currentTarget: event.currentTarget?.getAttribute?.('aria-label') || event.currentTarget?.tagName || '',
      time: Date.now(),
    };
  };
  const openFromFloatingButton = (event, source) => {
    recordLokiTapTrace(`open_request_${source}`, event ? eventDetail(event) : {});
    const now = Date.now();
    if (now - openGuardRef.current < 650) {
      recordLokiTapTrace('open_guard_skip', { source });
      return;
    }
    openGuardRef.current = now;
    setMenuOpen(false);
    setBrainOpen(false);
    setHistoryOpen(false);
    recordLokiTapTrace('provider_open_call', { source });
    loki.openExperience();
    requestAnimationFrame(() => {
      recordLokiTapTrace('after_open_raf', {
        experienceOpenBeforeRender: Boolean(loki.experienceOpen),
        dialogPresent: Boolean(document.querySelector('[role="dialog"][aria-label="Локи"]')),
      });
    });
  };
  const messageFab = showMessageFab ? (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpenMessages();
      }}
      aria-label="Сообщения"
      data-floating-messages-button="true"
      style={{
        width: 56,
        height: 56,
        minWidth: 56,
        minHeight: 56,
        borderRadius: 22,
        border: '1px solid rgba(120,214,255,0.34)',
        background: 'linear-gradient(145deg, rgba(120,214,255,0.24), rgba(var(--apg2-glass-a,255,255,255),0.10))',
        color: '#EAF8FF',
        display: 'grid',
        placeItems: 'center',
        fontSize: 23,
        lineHeight: '28px',
        padding: 0,
        position: 'relative',
        cursor: 'pointer',
        touchAction: 'manipulation',
        pointerEvents: 'auto',
        WebkitTapHighlightColor: 'transparent',
        backdropFilter: 'blur(22px) saturate(1.65)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.65)',
        boxShadow: '0 18px 44px rgba(0,0,0,0.28), 0 0 28px rgba(120,214,255,0.14), inset 0 1px 0 rgba(255,255,255,0.24)',
      }}
    >
      💬
      {safeMessageUnread > 0 && (
        <span style={{ position: 'absolute', right: -5, top: -5, minWidth: 22, height: 22, borderRadius: 999, padding: '0 6px', boxSizing: 'border-box', background: '#E64646', border: '2px solid rgba(9,10,16,0.96)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, lineHeight: '15px', fontWeight: 920 }}>
          {safeMessageUnread}
        </span>
      )}
    </button>
  ) : null;

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

  useEffect(() => {
    const node = floatingButtonRef.current;
    if (!node) return undefined;
    recordLokiTapTrace('native_listener_attached', {
      tag: node.tagName,
      label: node.getAttribute('aria-label') || '',
    });
    const handleNativeStart = (event) => {
      recordLokiTapTrace(`native_${event.type}`, eventDetail(event));
    };
    const handleNativeOpen = (event) => {
      recordLokiTapTrace(`native_${event.type}`, eventDetail(event));
      if (event.cancelable && (event.type === 'touchend' || event.type === 'pointerup')) event.preventDefault();
      openFromFloatingButton(event, `native_${event.type}`);
    };
    node.addEventListener('touchstart', handleNativeStart, { capture: true, passive: true });
    node.addEventListener('pointerdown', handleNativeStart, { capture: true, passive: true });
    node.addEventListener('touchend', handleNativeOpen, { capture: true, passive: false });
    node.addEventListener('pointerup', handleNativeOpen, { capture: true, passive: false });
    node.addEventListener('click', handleNativeOpen, { capture: true });
    return () => {
      node.removeEventListener('touchstart', handleNativeStart, { capture: true });
      node.removeEventListener('pointerdown', handleNativeStart, { capture: true });
      node.removeEventListener('touchend', handleNativeOpen, { capture: true });
      node.removeEventListener('pointerup', handleNativeOpen, { capture: true });
      node.removeEventListener('click', handleNativeOpen, { capture: true });
      recordLokiTapTrace('native_listener_removed');
    };
  }, [loki.visible, rendered, shouldShowRestore]);

  const identityState = getIdentityState(loki.emotion, loki.action);

  if (loki.experienceOpen) {
    recordLokiTapTrace('assistant_render_experience');
    return createPortal(<LokiExperience loki={loki} />, document.body);
  }

  if (loki.settings.dockedToHeader) return null;

  if (shouldShowRestore) {
    return (
      <div
        data-loki-floating-root="restore"
        style={{
          position: 'fixed',
          right: 'max(14px, env(safe-area-inset-right, 0px))',
          bottom: desktopMode ? 'max(18px, env(safe-area-inset-bottom, 0px))' : 'calc(112px + max(env(safe-area-inset-bottom, 0px), var(--apg-vv-bottom, 0px)))',
          zIndex: 10040,
          display: 'grid',
          gap: 10,
          justifyItems: 'end',
          pointerEvents: 'auto',
        }}
      >
        {messageFab}
        <button
          ref={floatingButtonRef}
          type="button"
          onClick={() => {
            loki.setHintsEnabled(true);
            loki.showCurrentPanel();
            loki.show();
            setMenuOpen(false);
          }}
          aria-label="Вернуть Локи"
          style={{
            width: 56,
            height: 56,
            minWidth: 56,
            minHeight: 56,
            borderRadius: 22,
            border: '1px solid rgba(215,184,106,0.34)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.20), rgba(255,255,255,0.06))',
            backdropFilter: 'blur(22px) saturate(1.7)',
            WebkitBackdropFilter: 'blur(22px) saturate(1.7)',
            boxShadow: '0 14px 36px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.24)',
            padding: 0,
            overflow: 'hidden',
            cursor: 'pointer',
            position: 'relative',
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            animation: 'lokiAppear 620ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both, lokiBreath 5.8s ease-in-out 700ms infinite',
          }}
        >
          <LokiIdentity size={48} state="ready" showText={false} style={{ width: '100%', height: '100%', placeItems: 'center' }} />
          {hasLokiSignal && <span style={{ position: 'absolute', right: 5, top: 5, width: 9, height: 9, borderRadius: '50%', background: '#78D6FF', border: '2px solid rgba(9,10,16,0.96)', boxShadow: '0 0 16px rgba(120,214,255,0.72)' }} />}
        </button>
      </div>
    );
  }

  if (!rendered) return null;

  return (
    <div
      data-loki-floating-root="active"
      style={{
        position: 'fixed',
        ...position,
        width: rootWidth,
        zIndex: 10040,
        display: 'grid',
        gap: 10,
        pointerEvents: 'auto',
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'translate3d(12px, 18px, 0) scale(0.92) rotate(2deg)' : 'none',
        filter: leaving ? 'blur(6px) saturate(0.82)' : 'none',
        transition: 'right 760ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)), bottom 760ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)), opacity 520ms ease, transform 680ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)), filter 520ms ease',
        animation: 'none',
        willChange: leaving ? 'transform, opacity, filter' : 'auto',
      }}
    >
      {loki.message && loki.canTalk && !desktopMode && (
        <div
          style={{
            ...lokiPanelStyle,
            width: 'min(334px, calc(100vw - 28px))',
            maxWidth: 334,
            borderRadius: 26,
            padding: isLongMessage ? '17px 17px 16px' : '16px 16px 15px',
            color: APG2_PROFILE.text,
            border: '1px solid rgba(232,201,122,0.38)',
            pointerEvents: 'auto',
            transformOrigin: 'calc(100% - 36px) 100%',
            animation: 'lokiBubbleIn 520ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) 160ms both',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span style={{ position: 'absolute', inset: 0, borderRadius: 26, background: 'radial-gradient(circle at 18% 0%, rgba(255,247,220,0.17), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.07), transparent 44%)', pointerEvents: 'none' }} />
          <span style={{ position: 'absolute', left: 18, right: 18, top: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,240,184,0.56), transparent)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '16px', fontWeight: 900, marginBottom: 6, letterSpacing: 0 }}>Локи</div>
              <div style={{ color: '#FFF9EA', fontSize: isLongMessage ? 14 : 14.5, lineHeight: isLongMessage ? '20.5px' : '21px', fontWeight: 780, letterSpacing: 0, overflowWrap: 'anywhere', hyphens: 'auto', textShadow: '0 1px 18px rgba(0,0,0,0.42)' }}>{bubbleText}</div>
            </div>
            <button
              type="button"
              onClick={() => loki.hide()}
              aria-label="Скрыть Локи"
              style={{ width: 32, height: 32, borderRadius: 14, border: '1px solid rgba(255,248,233,0.22)', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,248,233,0.86)', fontSize: 18, lineHeight: '24px', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)' }}
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
        {messageFab && <div style={{ display: 'grid', justifyItems: 'end', gap: 10, marginBottom: 10, pointerEvents: 'auto' }}>{messageFab}</div>}
        {hitDebug && (
          <div
            aria-hidden="true"
            data-loki-hit-debug="true"
            style={{
              position: 'absolute',
              inset: 0,
              border: '2px dashed rgba(120,214,255,0.78)',
              borderRadius: 38,
              pointerEvents: 'none',
              zIndex: 4,
              boxShadow: '0 0 0 1px rgba(215,184,106,0.64)',
            }}
          />
        )}
        {menuOpen && (
          <div style={{ ...lokiPanelStyle, position: 'absolute', right: 0, bottom: 88, width: 190, borderRadius: 24, padding: 9, display: 'grid', gap: 7, border: '1px solid rgba(215,184,106,0.28)', animation: 'lokiBubbleIn var(--motion-fast, 180ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both' }}>
            <button type="button" onClick={() => { loki.executeAction(createLokiAction(LOKI_APP_ACTIONS.OPEN_LOKI)); setMenuOpen(false); }} style={menuButtonStyle}>Открыть Локи</button>
            <button type="button" onClick={() => { setBrainOpen(v => !v); setHistoryOpen(false); setMenuOpen(false); }} style={menuButtonStyle}>Спросить Локи</button>
            <button type="button" onClick={() => { setHistoryOpen(v => !v); setMenuOpen(false); }} style={menuButtonStyle}>История Локи</button>
            <button type="button" onClick={() => { loki.handleCharacterTap(); setMenuOpen(false); }} style={menuButtonStyle}>Поздороваться</button>
            <button type="button" onClick={() => { loki.hideCurrentPanel(); setMenuOpen(false); }} style={menuButtonStyle}>Скрыть на экране</button>
            <button type="button" onClick={() => { loki.setDockedToHeader(true); setMenuOpen(false); setBrainOpen(false); setHistoryOpen(false); }} style={menuButtonStyle}>Свернуть в шапку</button>
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
          ref={floatingButtonRef}
          type="button"
          onPointerDownCapture={markFloatingButtonEvent}
          onPointerUpCapture={markFloatingButtonEvent}
          onTouchStartCapture={markFloatingButtonEvent}
          onTouchEndCapture={markFloatingButtonEvent}
          onClick={(event) => {
            markFloatingButtonEvent(event);
            openFromFloatingButton(event, 'react_click');
          }}
          aria-label="Локи"
          data-floating-loki-button="true"
          style={{
            width: 92,
            height: 92,
            minWidth: 92,
            minHeight: 92,
            border: 0,
            borderRadius: 34,
            padding: 5,
            background: isCelebrating
              ? 'linear-gradient(145deg, rgba(232,201,122,0.48), rgba(255,255,255,0.16))'
              : 'linear-gradient(145deg, rgba(215,184,106,0.36), rgba(var(--apg2-glass-a,255,255,255),0.12))',
            boxShadow: '0 24px 64px rgba(0,0,0,0.30), 0 0 34px rgba(215,184,106,0.18)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transformOrigin: '50% 80%',
            overflow: 'visible',
            position: 'relative',
          }}
        >
          <span style={{ position: 'absolute', inset: -8, borderRadius: 38, background: isThinking ? 'radial-gradient(circle, rgba(120,214,255,0.18), transparent 68%)' : 'radial-gradient(circle, rgba(232,201,122,0.22), transparent 70%)', filter: 'blur(7px)', opacity: 0.9, animation: 'lokiAmbientGlow 4.8s ease-in-out infinite', pointerEvents: 'none' }} />
          {hasLokiSignal && <span style={{ position: 'absolute', right: 10, top: 10, width: 11, height: 11, borderRadius: '50%', background: '#78D6FF', border: '2px solid rgba(9,10,16,0.96)', boxShadow: '0 0 18px rgba(120,214,255,0.72)', pointerEvents: 'none' }} />}
          <span style={{ display: 'block', transformOrigin: '50% 80%', animation: `${motionName} ${loki.emotion === 'excited' ? '1180ms' : '6.2s'} var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) infinite`, pointerEvents: 'none' }}>
            <span style={{ display: 'block', transform: `translate3d(${look.x}px, ${look.y}px, 0) rotate(${look.x * 0.55}deg)`, transition: 'transform 420ms cubic-bezier(0.16,1,0.3,1)', animation: actionName === 'none' ? 'none' : `${actionName} 1800ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both`, willChange: 'transform', pointerEvents: 'none' }}>
              <LokiIdentity size={82} state={identityState} showText={false} style={{ placeItems: 'center', willChange: 'transform', pointerEvents: 'none' }} />
              {(loki.action === LOKI_ACTIONS.POINT || loki.action === LOKI_ACTIONS.SPARK || loki.action === LOKI_ACTIONS.CATCH_KEY) && (
                <span style={{ position: 'absolute', right: -7, top: 16, width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,184,0.95), rgba(215,184,106,0.58) 44%, transparent 70%)', boxShadow: '0 0 18px rgba(215,184,106,0.62)', animation: 'lokiSparkle 960ms ease-in-out infinite', pointerEvents: 'none' }} />
              )}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            loki.setDockedToHeader(true);
            setMenuOpen(false);
            setBrainOpen(false);
            setHistoryOpen(false);
          }}
          aria-label="Спрятать Локи в шапку"
          data-loki-dock-button="true"
          style={{ position: 'absolute', right: 31, top: -7, minWidth: 76, height: 30, padding: '0 10px', borderRadius: 13, border: '1px solid rgba(215,184,106,0.32)', background: 'rgba(16,14,10,0.78)', color: '#F0D88F', fontSize: 11, lineHeight: '28px', fontWeight: 820, fontFamily: 'inherit', boxShadow: '0 10px 22px rgba(0,0,0,0.26)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Спрятать
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
  background: 'radial-gradient(circle at 18% 0%, rgba(255,244,205,0.28), transparent 38%), radial-gradient(circle at 84% 100%, rgba(215,184,106,0.16), transparent 48%), linear-gradient(145deg, rgba(38,31,25,0.982), rgba(13,13,16,0.955))',
  backdropFilter: 'blur(64px) saturate(1.95)',
  WebkitBackdropFilter: 'blur(64px) saturate(1.95)',
  boxShadow: '0 30px 88px rgba(0,0,0,0.52), 0 0 42px rgba(215,184,106,0.16), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -28px 54px rgba(215,184,106,0.08)',
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
