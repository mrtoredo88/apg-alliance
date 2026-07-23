import React, { useRef, useState } from 'react';
import { MOTION, motionTransition } from '../motion.js';

export const APG2_PROFILE = {
  bg: 'var(--apg2-bg, radial-gradient(circle at 16% -10%, rgba(255,240,184,0.20), transparent 34%), radial-gradient(circle at 88% 4%, rgba(126,103,182,0.18), transparent 34%), radial-gradient(circle at 50% 102%, rgba(215,184,106,0.10), transparent 36%), linear-gradient(180deg,#17161a 0%,#1a1a1f 46%,#121317 100%))',
  text: 'var(--apg2-text, #F7F1E6)',
  textSoft: 'var(--apg2-text-soft, rgba(247,241,230,0.72))',
  textMuted: 'var(--apg2-text-muted, rgba(247,241,230,0.48))',
  gold: 'var(--apg2-gold, #D7B86A)',
  goldSoft: 'rgba(215,184,106,0.18)',
  goldGradient: 'linear-gradient(135deg,#FFF0B8,#D7B86A,#9F7932)',
  workspaceBg: 'radial-gradient(circle at 14% -8%, rgba(255,240,184,0.22), transparent 34%), radial-gradient(circle at 92% 4%, rgba(126,103,182,0.16), transparent 32%), radial-gradient(circle at 48% 110%, rgba(215,184,106,0.09), transparent 36%), linear-gradient(180deg, var(--apg2-bg-top, #19181d) 0%, var(--apg2-bg-mid, #18191e) 52%, var(--apg2-bg-bottom, #121318) 100%)',
  workspaceStage: 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.16), rgba(var(--apg2-glass-a,255,255,255),0.055))',
  heroSurface: 'radial-gradient(circle at 16% 0%, rgba(255,240,184,0.34), transparent 36%), radial-gradient(circle at 88% 16%, rgba(126,103,182,0.22), transparent 34%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.34), rgba(var(--apg2-glass-a,255,255,255),0.12))',
  quietSurface: 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.24), rgba(var(--apg2-glass-a,255,255,255),0.10))',
  radius: {
    card: 30,
    panel: 34,
    hero: 42,
    button: 22,
    badge: 999,
  },
  rhythm: {
    page: 18,
    section: 22,
    panel: 16,
    cluster: 12,
  },
  glass: {
    background: 'radial-gradient(circle at 18% 0%,rgba(var(--apg2-glass-a,255,255,255),0.34),transparent 36%), linear-gradient(145deg,rgba(var(--apg2-glass-a,255,255,255),0.38),rgba(var(--apg2-glass-a,255,255,255),0.17))',
    backdropFilter: 'blur(44px) saturate(1.72)',
    WebkitBackdropFilter: 'blur(44px) saturate(1.72)',
    border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.30))',
    boxShadow: 'inset 0 1.5px 0 rgba(var(--apg2-glass-a,255,255,255),0.42), inset 0 -22px 46px rgba(var(--apg2-glass-a,255,255,255),0.065), 0 22px 58px var(--apg2-elev-shadow, rgba(0,0,0,0.26))',
  },
  goldGlass: {
    background: 'radial-gradient(circle at 24% 0%,rgba(255,248,218,0.54),transparent 42%), linear-gradient(145deg,rgba(238,210,138,0.82),rgba(164,126,49,0.62))',
    backdropFilter: 'blur(36px) saturate(1.58)',
    WebkitBackdropFilter: 'blur(36px) saturate(1.58)',
    border: '1px solid rgba(255,232,165,0.48)',
    boxShadow: 'inset 0 1px 0 rgba(255,247,214,0.46), inset 0 -28px 58px rgba(80,52,16,0.18), 0 22px 54px var(--apg2-elev-shadow, rgba(0,0,0,0.3)), 0 0 34px rgba(215,184,106,0.13)',
  },
};

export function getProfileImage(entity) {
  return entity?.coverPhoto || entity?.photo || entity?.imageUrl || entity?.logoUrl || entity?.photos?.[0] || entity?.gallery?.[0] || '';
}

export function ProfilePlaceholder({ label = 'АПГ' }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 36% 18%,rgba(215,184,106,0.24),transparent 32%), linear-gradient(145deg,rgba(var(--apg2-glass-a,255,255,255),0.22),rgba(var(--apg2-glass-a,255,255,255),0.06))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--apg2-text-muted, rgba(247,241,230,0.18))', fontSize: 52, fontWeight: 850, letterSpacing: 2 }}>
      {String(label || 'А').slice(0, 1).toUpperCase()}
    </div>
  );
}

export function GlassBadge({ children, tone = 'glass', style }) {
  const gold = tone === 'gold';
  return (
    <span style={{ ...(gold ? APG2_PROFILE.goldGlass : APG2_PROFILE.glass), borderRadius: APG2_PROFILE.radius.badge, padding: '6px 10px', color: gold ? '#19140b' : APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '15px', fontWeight: gold ? 850 : 720, display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: '100%', ...style }}>
      {children}
    </span>
  );
}

export function GlassCard({ children, tone = 'glass', style, onClick, onPointerDown, onPointerUp, onPointerLeave, onPointerCancel, interactiveAs = 'button', onKeyDown, ...rest }) {
  const [pressed, setPressed] = useState(false);
  const gold = tone === 'gold';
  const Tag = onClick && interactiveAs !== 'div' ? 'button' : 'div';
  const safeStyle = Object.fromEntries(Object.entries(style || {}).filter(([, value]) => value !== undefined));
  const baseTransform = safeStyle.transform;
  const handleKeyDown = (e) => {
    onKeyDown?.(e);
    if (!onClick || Tag !== 'div' || e.defaultPrevented) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };
  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button' } : {})}
      {...(onClick && Tag === 'div' ? { role: 'button', tabIndex: 0 } : {})}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onPointerDown={(e) => { if (onClick) setPressed(true); onPointerDown?.(e); }}
      onPointerUp={(e) => { setPressed(false); onPointerUp?.(e); }}
      onPointerLeave={(e) => { setPressed(false); onPointerLeave?.(e); }}
      onPointerCancel={(e) => { setPressed(false); onPointerCancel?.(e); }}
      style={{ ...(gold ? APG2_PROFILE.goldGlass : APG2_PROFILE.glass), borderRadius: APG2_PROFILE.radius.card, padding: 16, color: APG2_PROFILE.text, border: gold ? APG2_PROFILE.goldGlass.border : APG2_PROFILE.glass.border, cursor: onClick ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit', appearance: 'none', WebkitAppearance: 'none', WebkitTapHighlightColor: 'transparent', touchAction: onClick ? 'manipulation' : undefined, transition: `${motionTransition(['transform', 'opacity'], 'fast')}, box-shadow var(--motion-base, 240ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1))`, ...safeStyle, transform: pressed ? `${baseTransform ? `${baseTransform} ` : ''}scale(${MOTION.press.card})` : baseTransform }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function GlassPanel({ children, style }) {
  return (
    <div style={{ minHeight: '100svh', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, padding: 'calc(14px + var(--safe-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 0px))', overflowX: 'clip', boxSizing: 'border-box', ...style }}>
      {children}
    </div>
  );
}

export function GlassButton({ children, onClick, tone = 'glass', style, disabled = false, type = 'button', onPointerDown, onPointerUp, onPointerLeave, onPointerCancel, ...rest }) {
  const [pressed, setPressed] = useState(false);
  const gold = tone === 'gold';
  const baseTransform = style?.transform;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={(e) => { if (!disabled && onClick) setPressed(true); onPointerDown?.(e); }}
      onPointerUp={(e) => { setPressed(false); onPointerUp?.(e); }}
      onPointerLeave={(e) => { setPressed(false); onPointerLeave?.(e); }}
      onPointerCancel={(e) => { setPressed(false); onPointerCancel?.(e); }}
      style={{ ...(gold ? APG2_PROFILE.goldGlass : APG2_PROFILE.glass), minHeight: 46, borderRadius: APG2_PROFILE.radius.button, padding: '11px 14px', color: gold ? '#17120a' : APG2_PROFILE.text, border: gold ? APG2_PROFILE.goldGlass.border : APG2_PROFILE.glass.border, fontSize: 13.5, lineHeight: '18px', fontWeight: 760, fontFamily: 'inherit', appearance: 'none', WebkitAppearance: 'none', cursor: disabled ? 'default' : onClick ? 'pointer' : 'default', opacity: disabled ? 0.48 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: `${motionTransition(['transform', 'opacity'], 'fast')}, box-shadow var(--motion-base, 240ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)), background var(--motion-base, 240ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1))`, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent', ...style, transform: pressed ? `${baseTransform ? `${baseTransform} ` : ''}scale(${MOTION.press.button})` : baseTransform }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function GlassInput({ style, tone = 'glass', invalid = false, ...rest }) {
  return (
    <input
      {...rest}
      style={{
        ...(tone === 'gold' ? APG2_PROFILE.goldGlass : APG2_PROFILE.glass),
        width: '100%',
        minHeight: 50,
        borderRadius: APG2_PROFILE.radius.button,
        padding: '12px 15px',
        color: APG2_PROFILE.text,
        border: invalid ? '1px solid rgba(230,70,70,0.44)' : APG2_PROFILE.glass.border,
        background: 'rgba(var(--apg2-glass-a,255,255,255),0.18)',
        fontSize: 16,
        lineHeight: '20px',
        fontWeight: 650,
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
        appearance: 'none',
        WebkitAppearance: 'none',
        transition: 'border-color 180ms ease, box-shadow 180ms ease, background 180ms ease',
        ...style,
      }}
    />
  );
}

export function GlassSelect({ style, invalid = false, children, ...rest }) {
  return (
    <select
      {...rest}
      style={{
        ...APG2_PROFILE.glass,
        width: '100%',
        minHeight: 50,
        borderRadius: APG2_PROFILE.radius.button,
        padding: '12px 42px 12px 15px',
        color: APG2_PROFILE.text,
        border: invalid ? '1px solid rgba(230,70,70,0.44)' : APG2_PROFILE.glass.border,
        background: 'rgba(var(--apg2-glass-a,255,255,255),0.18)',
        fontSize: 16,
        lineHeight: '20px',
        fontWeight: 650,
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
        appearance: 'none',
        WebkitAppearance: 'none',
        ...style,
      }}
    >
      {children}
    </select>
  );
}

export function GlassSwitch({ checked, onChange, disabled = false, label, style }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        ...APG2_PROFILE.glass,
        minHeight: 48,
        borderRadius: 24,
        padding: '6px 7px 6px 13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        color: APG2_PROFILE.text,
        fontFamily: 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.52 : 1,
        ...style,
      }}
    >
      {label && <span style={{ fontSize: 14, fontWeight: 760, color: APG2_PROFILE.textSoft }}>{label}</span>}
      <span style={{ width: 54, height: 32, borderRadius: 999, padding: 3, boxSizing: 'border-box', background: checked ? 'linear-gradient(135deg,#FFF0B8,#D7B86A,#9F7932)' : 'rgba(var(--apg2-glass-a,255,255,255),0.10)', border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.18))', display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start', transition: 'background 180ms ease' }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', background: checked ? '#18130a' : APG2_PROFILE.textSoft, boxShadow: '0 8px 18px var(--apg2-elev-shadow, rgba(0,0,0,0.22))', transition: 'transform 180ms ease' }} />
      </span>
    </button>
  );
}

export function GlassLoader({ title = 'Загружаем', text, style }) {
  return (
    <GlassCard style={{ minHeight: 160, padding: 26, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, ...style }}>
      <span style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid rgba(215,184,106,0.20)', borderTopColor: APG2_PROFILE.gold, boxShadow: '0 0 26px rgba(215,184,106,0.18)', animation: 'spin 0.9s linear infinite' }} />
      <div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '22px', fontWeight: 820 }}>{title}</div>
        {text && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>{text}</div>}
      </div>
    </GlassCard>
  );
}

export function GlassToast({ toast, onClose, onShare }) {
  if (!toast) return null;
  const success = toast.type === 'success';
  const error = toast.type === 'error';
  return (
    <div style={{ position: 'fixed', top: 'calc(var(--safe-top, 0px) + 12px)', left: 16, right: 16, zIndex: 12000, pointerEvents: toast.sharePartner ? 'auto' : 'none', display: 'flex', justifyContent: 'center' }}>
      <div style={{ ...APG2_PROFILE.glass, width: '100%', maxWidth: 430, borderRadius: 24, padding: 13, color: APG2_PROFILE.text, display: 'grid', gap: toast.sharePartner ? 10 : 0, border: success ? '1px solid rgba(75,179,75,0.34)' : error ? '1px solid rgba(230,70,70,0.34)' : APG2_PROFILE.glass.border, animation: 'toastIn var(--motion-base, 240ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 34, height: 34, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: success ? 'rgba(75,179,75,0.16)' : error ? 'rgba(230,70,70,0.16)' : APG2_PROFILE.goldSoft, color: success ? '#4BB34B' : error ? '#E64646' : APG2_PROFILE.gold, fontWeight: 860 }}>{success ? '✓' : error ? '!' : '✦'}</span>
          <span style={{ flex: 1, minWidth: 0, color: APG2_PROFILE.text, fontSize: 14, lineHeight: '19px', fontWeight: 760, overflowWrap: 'anywhere' }}>{toast.msg}</span>
        </div>
        {toast.sharePartner && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.72fr', gap: 8 }}>
            <GlassButton onClick={onShare} tone="gold" style={{ minHeight: 38, borderRadius: 17, padding: '8px 10px', color: '#17120a' }}>Поделиться</GlassButton>
            <GlassButton onClick={onClose} style={{ minHeight: 38, borderRadius: 17, padding: '8px 10px' }}>Позже</GlassButton>
          </div>
        )}
      </div>
    </div>
  );
}

export function GlassSection({ title, action, children, style }) {
  return (
    <section style={{ marginTop: 18, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '23px', fontWeight: 780 }}>{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ApgModal({ title, subtitle, children, onClose, maxWidth = 430 }) {
  const startYRef = useRef(0);
  const dragReadyRef = useRef(false);
  const [dragY, setDragY] = useState(0);

  const handleTouchStart = (e) => {
    e.stopPropagation();
    startYRef.current = e.touches[0].clientY;
    dragReadyRef.current = e.currentTarget.scrollTop <= 2;
  };
  const handleTouchMove = (e) => {
    e.stopPropagation();
    if (!dragReadyRef.current) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy > 0) setDragY(Math.min(dy, 180));
  };
  const handleTouchEnd = (e) => {
    e.stopPropagation();
    const shouldClose = dragY > 88;
    setDragY(0);
    dragReadyRef.current = false;
    if (shouldClose) onClose?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: 'calc(18px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
        overflowY: 'auto',
        background: 'rgba(10,10,12,0.42)',
        backdropFilter: 'blur(22px) saturate(1.35)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.35)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        animation: 'fadeIn var(--motion-fast, 180ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
      }}
    >
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { setDragY(0); dragReadyRef.current = false; }}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: 'calc(100dvh - 36px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
          overflowY: 'auto',
          boxSizing: 'border-box',
          borderRadius: 34,
          padding: 18,
          ...APG2_PROFILE.glass,
          background: 'radial-gradient(circle at 22% 0%,rgba(215,184,106,0.22),transparent 36%), linear-gradient(145deg,rgba(var(--apg2-glass-a,255,255,255),0.44),rgba(var(--apg2-glass-a,255,255,255),0.22))',
          boxShadow: '0 28px 90px rgba(0,0,0,0.36), inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.44), inset 0 -24px 46px rgba(var(--apg2-glass-a,255,255,255),0.07)',
          animation: 'fadeInUp var(--motion-modal, 320ms) var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
          transform: `translate3d(0, ${dragY}px, 0) scale(${dragY ? Math.max(0.965, 1 - dragY / 2200) : 1})`,
          transition: dragY ? 'none' : motionTransition(['transform'], 'base'),
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 42, height: 4, borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.24)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && <div style={{ color: APG2_PROFILE.text, fontSize: 21, lineHeight: '25px', fontWeight: 850 }}>{title}</div>}
            {subtitle && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13, lineHeight: '18px', marginTop: 5 }}>{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              ...APG2_PROFILE.glass,
              width: 40,
              height: 40,
              borderRadius: 18,
              color: APG2_PROFILE.textSoft,
              border: APG2_PROFILE.glass.border,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              flexShrink: 0,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ScreenHeader({ title, subtitle, kicker, onBack, action, style }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 55, margin: 'calc(-14px - var(--safe-top, 0px)) -16px 14px', padding: 'calc(14px + var(--safe-top, 0px)) 16px 12px', background: 'linear-gradient(180deg,var(--apg2-header-bg-strong, rgba(17,17,19,0.96)),var(--apg2-header-bg-soft, rgba(17,17,19,0.80)),rgba(17,17,19,0))', backdropFilter: 'blur(26px) saturate(1.45)', WebkitBackdropFilter: 'blur(26px) saturate(1.45)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {onBack && (
          <button type="button" onClick={onBack} style={{ ...APG2_PROFILE.glass, width: 42, height: 42, borderRadius: 18, color: APG2_PROFILE.text, border: APG2_PROFILE.glass.border, fontSize: 24, lineHeight: 1, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>‹</button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {kicker && <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 820, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 3 }}>{kicker}</div>}
          <div style={{ color: APG2_PROFILE.text, fontSize: 23, lineHeight: '27px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function EmptyStateV2({ icon = '✦', title, text, action }) {
  return (
    <GlassCard style={{ minHeight: 218, padding: '34px 22px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      <div style={{ width: 74, height: 74, borderRadius: 28, background: 'radial-gradient(circle at 35% 20%,rgba(255,247,214,0.28),transparent 42%), linear-gradient(145deg,rgba(215,184,106,0.22),rgba(255,255,255,0.06))', border: '1px solid rgba(215,184,106,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)' }}>{icon}</div>
      <div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '22px', fontWeight: 820, marginBottom: 6 }}>{title}</div>
        {text && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '20px', maxWidth: 270 }}>{text}</div>}
      </div>
      {action}
    </GlassCard>
  );
}

export function StatPill({ label, value, tone = 'glass' }) {
  return (
    <GlassCard tone={tone} style={{ flex: 1, minWidth: 0, borderRadius: 24, padding: '13px 12px' }}>
      <div style={{ color: tone === 'gold' ? '#17120a' : APG2_PROFILE.text, fontSize: 24, lineHeight: '26px', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ color: tone === 'gold' ? 'rgba(20,15,8,0.64)' : APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '14px', marginTop: 4 }}>{label}</div>
    </GlassCard>
  );
}

export function GlassListItem({ icon, title, subtitle, meta, accent, onClick, style }) {
  return (
    <GlassCard onClick={onClick} style={{ borderRadius: 26, padding: 14, display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <div style={{ width: 46, height: 46, borderRadius: 18, flexShrink: 0, background: accent ? `${accent}22` : APG2_PROFILE.goldSoft, border: `1px solid ${accent ? `${accent}44` : 'rgba(215,184,106,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '19px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '17px', marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{subtitle}</div>}
      </div>
      {meta && <div style={{ color: accent || APG2_PROFILE.gold, fontSize: 12, fontWeight: 820, flexShrink: 0, textAlign: 'right' }}>{meta}</div>}
    </GlassCard>
  );
}

export function ContactCard({ icon, label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ ...APG2_PROFILE.glass, borderRadius: 22, padding: '12px 13px', display: 'flex', gap: 11, alignItems: 'center', color: APG2_PROFILE.text, textAlign: 'left', fontFamily: 'inherit', cursor: onClick ? 'pointer' : 'default', width: '100%', minHeight: 58, WebkitTapHighlightColor: 'transparent' }}>
      <span style={{ width: 34, height: 34, borderRadius: 14, background: APG2_PROFILE.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: APG2_PROFILE.textMuted, fontSize: 11, marginBottom: 2 }}>{label}</span>
        <span style={{ display: 'block', color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', overflowWrap: 'anywhere' }}>{value}</span>
      </span>
    </button>
  );
}

export function ProfileHero({ image, title, subtitle, status, avatar, badges = [], description }) {
  return (
    <section style={{ position: 'relative', minHeight: 420, borderRadius: APG2_PROFILE.radius.hero, overflow: 'hidden', ...APG2_PROFILE.glass, border: '1px solid rgba(255,255,255,0.2)' }}>
      {image ? (
        <img src={image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.12) contrast(1.04)', transform: 'scale(1.01)' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
      ) : (
        <ProfilePlaceholder label={title} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,0.08) 0%,rgba(0,0,0,0.27) 38%,rgba(12,12,13,0.9) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 72% 16%,rgba(215,184,106,0.24),transparent 26%), linear-gradient(145deg,rgba(255,255,255,0.08),transparent 40%)' }} />
      <div style={{ position: 'relative', minHeight: 420, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <GlassBadge tone="gold" style={{ padding: '8px 13px' }}>{status}</GlassBadge>
          {avatar}
        </div>
        <div style={{ ...APG2_PROFILE.glass, borderRadius: 30, padding: 17 }}>
          {badges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {badges.map((badge, i) => <GlassBadge key={`${badge}_${i}`}>{badge}</GlassBadge>)}
            </div>
          )}
          {subtitle && <div style={{ color: APG2_PROFILE.gold, fontSize: 13, lineHeight: '17px', fontWeight: 760, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          <h1 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 31, lineHeight: '34px', fontWeight: 850, letterSpacing: 0, textShadow: '0 18px 38px rgba(0,0,0,0.45)', overflowWrap: 'anywhere' }}>{title}</h1>
          {description && (
            <div style={{ marginTop: 12, color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {description}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export const GlassHero = ProfileHero;

export function ProfileGallery({ items = [], onOpen, emptyText = 'Фотографии скоро появятся.' }) {
  if (!items.length) {
    return <div style={{ ...APG2_PROFILE.glass, borderRadius: 34, padding: 26, color: APG2_PROFILE.textSoft, textAlign: 'center' }}>{emptyText}</div>;
  }
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 2px 10px', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }} onTouchStart={e => e.stopPropagation()}>
      {items.map((url, i) => (
        <button key={`${url}_${i}`} onClick={() => onOpen?.(i)} style={{ flex: '0 0 82%', height: 220, border: 0, borderRadius: 34, overflow: 'hidden', padding: 0, position: 'relative', scrollSnapAlign: 'start', ...APG2_PROFILE.glass, cursor: onOpen ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' }}>
          <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          <div style={{ position: 'absolute', right: 12, bottom: 12, ...APG2_PROFILE.glass, borderRadius: 999, padding: '6px 11px', color: APG2_PROFILE.text, fontSize: 12, fontWeight: 760 }}>{i + 1}/{items.length}</div>
        </button>
      ))}
    </div>
  );
}

export function ProfileReviewCard({ review, isOwn = false, textFallback = 'Гость оценил без комментария.' }) {
  const [expanded, setExpanded] = useState(false);
  const stars = review?.stars ?? review?.rating ?? 0;
  const date = review?.createdAt?.toDate ? review.createdAt.toDate() : review?.createdAt ? new Date(review.createdAt) : null;
  const name = review?.userName || 'Участник АПГ';
  const text = review?.text || textFallback;
  const canCollapse = text.length > 180;
  const ownerReply = review?.ownerReply;
  return (
    <div style={{ ...APG2_PROFILE.glass, borderRadius: 28, padding: 15, flex: '0 0 82%', scrollSnapAlign: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
        {review?.userPhoto
          ? <img src={review.userPhoto} alt="" loading="lazy" style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.22)' }} />
          : <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(145deg,rgba(215,184,106,0.28),rgba(255,255,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: APG2_PROFILE.text, fontWeight: 800 }}>{name[0]}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: isOwn ? APG2_PROFILE.gold : APG2_PROFILE.text, fontSize: 14, fontWeight: 780, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, marginTop: 2 }}>{date ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'недавно'}</div>
        </div>
        <div style={{ color: APG2_PROFILE.gold, fontSize: 13 }}>{'★'.repeat(Math.max(0, Math.min(5, Math.round(stars))))}</div>
      </div>
      <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px', ...(expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
        {text}
      </div>
      {canCollapse && (
        <button type="button" onClick={() => setExpanded(value => !value)} style={{ marginTop: 7, padding: 0, border: 0, background: 'transparent', color: APG2_PROFILE.gold, font: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          {expanded ? 'Свернуть' : 'Читать полностью'}
        </button>
      )}
      {ownerReply?.text && (
        <div style={{ marginTop: 12, padding: '11px 12px', borderRadius: 18, background: 'rgba(215,184,106,0.10)', border: '1px solid rgba(215,184,106,0.22)' }}>
          <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, marginBottom: 5 }}>
            {ownerReply.authorName || (ownerReply.authorType === 'expert' ? 'Ответ эксперта' : 'Ответ партнёра')}
          </div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', whiteSpace: 'pre-wrap' }}>{ownerReply.text}</div>
        </div>
      )}
    </div>
  );
}

export function ReviewReplyEditor({ review, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review?.ownerReply?.text || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave?.(value);
      setEditing(false);
    } catch (saveError) {
      setError(saveError?.message || 'Не удалось сохранить ответ.');
    } finally {
      setSaving(false);
    }
  };
  if (!editing) {
    return (
      <div style={{ marginTop: 10 }}>
        {review?.ownerReply?.text && (
          <div style={{ padding: '10px 11px', borderRadius: 16, background: 'rgba(215,184,106,0.10)', border: '1px solid rgba(215,184,106,0.22)', color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', whiteSpace: 'pre-wrap' }}>
            <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, marginBottom: 4 }}>Ваш ответ</div>
            {review.ownerReply.text}
          </div>
        )}
        <GlassButton onClick={() => setEditing(true)} style={{ minHeight: 34, marginTop: review?.ownerReply?.text ? 8 : 0, padding: '6px 11px', borderRadius: 14, fontSize: 12 }}>
          {review?.ownerReply?.text ? 'Изменить ответ' : 'Ответить на отзыв'}
        </GlassButton>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 10 }}>
      <textarea
        value={text}
        onChange={event => setText(event.target.value.slice(0, 2000))}
        placeholder="Напишите вежливый и полезный ответ"
        rows={3}
        autoFocus
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 16, padding: 11, border: APG2_PROFILE.glass.border, background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, font: 'inherit', fontSize: 13, lineHeight: '19px', outline: 'none' }}
      />
      {error && <div style={{ color: '#ff9aa8', fontSize: 12, marginTop: 6 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <GlassButton tone="gold" disabled={!text.trim() || saving} onClick={submit} style={{ minHeight: 34, padding: '6px 11px', borderRadius: 14, color: '#17120a', fontSize: 12 }}>{saving ? 'Сохраняем...' : 'Опубликовать ответ'}</GlassButton>
        <GlassButton disabled={saving} onClick={() => { setText(review?.ownerReply?.text || ''); setEditing(false); setError(''); }} style={{ minHeight: 34, padding: '6px 11px', borderRadius: 14, fontSize: 12 }}>Отмена</GlassButton>
      </div>
    </div>
  );
}
