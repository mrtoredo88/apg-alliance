import React from 'react';
import { APG2_PROFILE, GlassButton, GlassCard } from '../components/Apg2ProfileGlass.jsx';
import { T } from '../design.js';
import { MOTION, motionTransition } from '../motion.js';
import { buildWorkspaceLayout, WORKSPACE_REGIONS } from './WorkspaceCore.js';

const safeArray = value => Array.isArray(value) ? value.filter(Boolean) : [];
const WORKSPACE_COMPONENT_Z = {
  contextPanel: 50,
  floating: 40,
};

export function GlassContainer({ children, style, tone = 'default' }) {
  return (
    <GlassCard tone={tone === 'gold' ? 'gold' : undefined} style={{ borderRadius: tone === 'quiet' ? 24 : 32, padding: tone === 'compact' ? 12 : 16, background: tone === 'quiet' ? APG2_PROFILE.quietSurface : undefined, ...style }}>
      {children}
    </GlassCard>
  );
}

export function WorkspaceShell({ layout, header, leftSidebar, children, rightSidebar, bottomBar, floatingPanels, style }) {
  const resolvedLayout = layout || buildWorkspaceLayout();
  const isDesktop = resolvedLayout.mode === 'desktop';
  return (
    <div style={{
      minHeight: '100svh',
      width: '100%',
      maxWidth: resolvedLayout.maxContentWidth,
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: isDesktop && resolvedLayout.regions[WORKSPACE_REGIONS.leftSidebar].visible
        ? '280px minmax(0,1fr) auto'
        : 'minmax(0,1fr)',
      gridTemplateRows: 'auto minmax(0,1fr) auto',
      gap: isDesktop ? 18 : 12,
      padding: isDesktop ? '18px 20px 28px' : '0',
      boxSizing: 'border-box',
      color: APG2_PROFILE.text,
      ...style,
    }}>
      {header && <div style={{ gridColumn: '1 / -1' }}>{header}</div>}
      {isDesktop && resolvedLayout.regions[WORKSPACE_REGIONS.leftSidebar].visible && <aside>{leftSidebar}</aside>}
      <main style={{ minWidth: 0 }}>{children}</main>
      {resolvedLayout.regions[WORKSPACE_REGIONS.rightSidebar].visible && <aside style={{ width: 340 }}>{rightSidebar}</aside>}
      {!isDesktop && bottomBar && <div style={{ gridColumn: '1 / -1' }}>{bottomBar}</div>}
      {resolvedLayout.regions[WORKSPACE_REGIONS.floatingPanels].visible && floatingPanels}
    </div>
  );
}

export function WorkspaceHeader({ title, subtitle, kicker, actions, onBack, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', padding: '10px 0', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {onBack && <GlassButton onClick={onBack} style={{ width: 42, minHeight: 42, padding: 0, borderRadius: 16 }}>‹</GlassButton>}
        <div style={{ minWidth: 0 }}>
          {kicker && <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 850, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 }}>{kicker}</div>}
          <div style={{ color: APG2_PROFILE.text, fontSize: 24, lineHeight: '28px', fontWeight: 920, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {subtitle && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '18px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{actions}</div>}
    </div>
  );
}

export function Sidebar({ items = [], activeId, onSelect, footer, style }) {
  return (
    <div style={{ ...APG2_PROFILE.glass, minHeight: 'calc(100svh - 36px)', borderRadius: 34, padding: 12, position: 'sticky', top: 18, ...style }}>
      <div style={{ display: 'grid', gap: 7 }}>
        {items.map(item => {
          const active = activeId === item.panelId || activeId === item.id;
          return (
            <button key={item.id} type="button" onClick={() => onSelect?.(item)} style={{
              border: active ? '1px solid rgba(215,184,106,0.52)' : APG2_PROFILE.glass.border,
              background: active ? APG2_PROFILE.goldSoft : 'rgba(var(--apg2-glass-a,255,255,255),0.08)',
              color: active ? APG2_PROFILE.gold : APG2_PROFILE.text,
              borderRadius: 22,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 820,
              cursor: 'pointer',
              textAlign: 'left',
              transition: motionTransition(['background', 'border-color', 'transform'], 'base'),
            }}>
              <span style={{ width: 28, height: 28, borderRadius: 12, display: 'grid', placeItems: 'center', background: active ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.08)' }}>{item.emoji || '•'}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
    </div>
  );
}

export function WorkspacePanel({ title, subtitle, children, actions, style }) {
  return (
    <div style={{ ...APG2_PROFILE.glass, borderRadius: APG2_PROFILE.radius.panel, padding: APG2_PROFILE.rhythm.panel, minHeight: 0, ...style }}>
      {(title || actions) && <SectionHeader title={title} subtitle={subtitle} actions={actions} />}
      {children}
    </div>
  );
}

export function ContentGrid({ children, min = 220, gap = 12, style }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap, ...style }}>
      {children}
    </div>
  );
}

export function DashboardCard({ title, subtitle, value, icon, action, tone, style }) {
  return (
    <GlassContainer tone={tone} style={{ minHeight: tone === 'quiet' ? 108 : 136, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ color: tone === 'gold' ? '#17120a' : APG2_PROFILE.text, fontSize: tone === 'quiet' ? 14.5 : 16, lineHeight: tone === 'quiet' ? '19px' : '21px', fontWeight: 870 }}>{title}</div>
          {subtitle && <div style={{ color: tone === 'gold' ? 'rgba(23,18,10,0.62)' : APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>{subtitle}</div>}
        </div>
        {icon && <div style={{ width: 42, height: 42, borderRadius: 17, display: 'grid', placeItems: 'center', background: tone === 'gold' ? 'rgba(23,18,10,0.08)' : APG2_PROFILE.goldSoft, fontSize: 20 }}>{icon}</div>}
      </div>
      {(value || action) && <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
        {value && <div style={{ color: tone === 'gold' ? '#17120a' : APG2_PROFILE.gold, fontSize: 28, lineHeight: '30px', fontWeight: 930 }}>{value}</div>}
        {action}
      </div>}
    </GlassContainer>
  );
}

export function MetricCard({ label, value, delta, tone, style }) {
  return (
    <GlassContainer tone={tone} style={{ borderRadius: tone === 'gold' ? 26 : 24, padding: tone === 'quiet' ? 11 : 13, background: tone === 'quiet' ? APG2_PROFILE.quietSurface : undefined, ...style }}>
      <div style={{ color: tone === 'gold' ? 'rgba(23,18,10,0.62)' : APG2_PROFILE.textSoft, fontSize: 11, fontWeight: 820, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ color: tone === 'gold' ? '#17120a' : APG2_PROFILE.text, fontSize: tone === 'quiet' ? 21 : 24, lineHeight: tone === 'quiet' ? '24px' : '27px', fontWeight: 930, marginTop: 4 }}>{value}</div>
      {delta && <div style={{ color: tone === 'gold' ? 'rgba(23,18,10,0.68)' : APG2_PROFILE.gold, fontSize: 12, fontWeight: 780, marginTop: 5 }}>{delta}</div>}
    </GlassContainer>
  );
}

export function QuickActions({ actions = [], style }) {
  return (
    <GlassCard style={{ borderRadius: 28, padding: 8, display: 'flex', gap: 7, overflowX: 'auto', ...style }}>
      {safeArray(actions).map(action => (
        <GlassButton key={action.id || action.label} tone={action.tone} onClick={action.onClick} style={{ minHeight: 40, whiteSpace: 'nowrap', color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text }}>
          {action.label}
        </GlassButton>
      ))}
    </GlassCard>
  );
}

export function InfoPanel({ icon, title, text, action, tone, style }) {
  const customIcon = React.isValidElement(icon);
  return (
    <GlassContainer tone={tone} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', ...style }}>
      {icon && (customIcon ? icon : <div style={{ width: 42, height: 42, flex: '0 0 auto', borderRadius: 17, display: 'grid', placeItems: 'center', background: tone === 'gold' ? 'rgba(23,18,10,0.08)' : APG2_PROFILE.goldSoft, fontSize: 21 }}>{icon}</div>)}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: tone === 'gold' ? '#17120a' : APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 870 }}>{title}</div>
        {text && <div style={{ color: tone === 'gold' ? 'rgba(23,18,10,0.62)' : APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 4 }}>{text}</div>}
        {action && <div style={{ marginTop: 10 }}>{action}</div>}
      </div>
    </GlassContainer>
  );
}

export function SectionHeader({ title, subtitle, actions, style }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 14, ...style }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 21, lineHeight: '26px', fontWeight: 920, letterSpacing: -0.15 }}>{title}</div>
        {subtitle && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginTop: 4 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}

export function ActionCard({ icon, title, text, onClick, disabled, tone, style }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{
      ...APG2_PROFILE.glass,
      borderRadius: tone === 'quiet' ? 24 : 30,
      padding: tone === 'quiet' ? 12 : 15,
      minHeight: tone === 'quiet' ? 98 : 116,
      textAlign: 'left',
      color: tone === 'gold' ? '#17120a' : APG2_PROFILE.text,
      background: tone === 'gold' ? APG2_PROFILE.goldGradient : tone === 'quiet' ? APG2_PROFILE.quietSurface : APG2_PROFILE.glass.background,
      fontFamily: 'inherit',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.54 : 1,
      transition: motionTransition(['transform', 'box-shadow', 'opacity'], 'base'),
      ...style,
    }}>
      {icon && <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>}
      <div style={{ fontSize: 16, lineHeight: '21px', fontWeight: 880 }}>{title}</div>
      {text && <div style={{ color: tone === 'gold' ? 'rgba(23,18,10,0.64)' : APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 5 }}>{text}</div>}
    </button>
  );
}

export function WorkspaceContextPanel({ open, title, subtitle, children, onClose, docked = false, style }) {
  if (!open) return null;
  return (
    <div style={{
      position: docked ? 'sticky' : 'fixed',
      top: docked ? 18 : 0,
      right: docked ? 0 : 0,
      bottom: docked ? 'auto' : 0,
      width: docked ? '100%' : 'min(420px, 100vw)',
      zIndex: docked ? 1 : WORKSPACE_COMPONENT_Z.contextPanel,
      padding: docked ? 0 : '12px',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      animation: `pageSlideForwardIn ${MOTION.duration.panel}ms ${MOTION.ease.standard} both`,
      ...style,
    }}>
      <WorkspacePanel title={title} subtitle={subtitle} actions={onClose ? <GlassButton onClick={onClose} style={{ width: 38, minHeight: 38, padding: 0 }}>×</GlassButton> : null}>
        {children}
      </WorkspacePanel>
    </div>
  );
}

export function WorkspaceFloatingPanels({ children, style }) {
  return (
    <div style={{
      position: 'fixed',
      right: 14,
      bottom: 'calc(86px + max(env(safe-area-inset-bottom, 0px), var(--apg-vv-bottom, 0px)))',
      zIndex: WORKSPACE_COMPONENT_Z.floating,
      display: 'grid',
      gap: 10,
      pointerEvents: 'none',
      color: T.textPri,
      ...style,
    }}>
      {children}
    </div>
  );
}
