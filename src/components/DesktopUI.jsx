import React from 'react';
import { APG2_PROFILE, GlassButton, GlassCard } from './Apg2ProfileGlass.jsx';
import {
  ContentGrid,
  GlassContainer,
  MetricCard,
  QuickActions,
  SectionHeader,
  WorkspaceHeader,
  WorkspacePanel,
} from '../workspace/WorkspaceComponents.jsx';
import { motionTransition } from '../motion.js';

const asArray = value => Array.isArray(value) ? value.filter(Boolean) : [];

export const DESKTOP_PUBLIC_SECTIONS = ['news', 'events', 'partners', 'experts', 'offers', 'rewards'];

export function DesktopSectionShell({ children, header, toolbar, kpi, rightRail, actionBar, maxWidth = 1360, railWidth = 336, withRail = Boolean(rightRail), style, contentStyle, railStyle }) {
  return (
    <div style={{ minHeight: '100svh', width: '100%', boxSizing: 'border-box', padding: 'calc(18px + var(--safe-top, 0px)) 24px 34px', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, ...style }}>
      <div style={{ width: '100%', maxWidth, margin: '0 auto', display: 'grid', gap: 16 }}>
        {header}
        {toolbar}
        {kpi}
        <div style={{ display: 'grid', gridTemplateColumns: withRail ? `minmax(0, 1fr) minmax(280px, ${railWidth}px)` : 'minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <main style={{ minWidth: 0, display: 'grid', gap: 16, ...contentStyle }}>{children}</main>
          {withRail && <DesktopRightRail style={railStyle}>{rightRail}</DesktopRightRail>}
        </div>
        {actionBar}
      </div>
    </div>
  );
}

export function DesktopHeader({ title, subtitle, kicker, actions, onBack, style }) {
  return (
    <WorkspaceHeader
      title={title}
      subtitle={subtitle}
      kicker={kicker}
      actions={actions}
      onBack={onBack}
      style={{ padding: '4px 0 2px', ...style }}
    />
  );
}

export function DesktopToolbar({ children, leading, trailing, style }) {
  return (
    <GlassCard style={{ borderRadius: 28, padding: 10, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, ...style }}>
      {leading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>{leading}</div>}
      {children && <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: leading || trailing ? undefined : 1 }}>{children}</div>}
      {trailing && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>{trailing}</div>}
    </GlassCard>
  );
}

export function DesktopKpiStrip({ items = [], columns, style }) {
  const safeItems = asArray(items);
  if (!safeItems.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns || `repeat(${Math.min(safeItems.length, 5)}, minmax(0, 1fr))`, gap: 10, ...style }}>
      {safeItems.map(item => (
        <DesktopMetricCard
          key={item.id || item.label}
          label={item.label}
          value={item.value}
          delta={item.delta}
          tone={item.tone}
          icon={item.icon}
          action={item.action}
          onClick={item.onClick}
          style={item.style}
        />
      ))}
    </div>
  );
}

export function DesktopContentGrid({ children, min = 260, gap = 14, style }) {
  return <ContentGrid min={min} gap={gap} style={style}>{children}</ContentGrid>;
}

export function DesktopRightRail({ children, title, subtitle, actions, style }) {
  return (
    <aside style={{ minWidth: 0, position: 'sticky', top: 'calc(18px + var(--safe-top, 0px))', display: 'grid', gap: 12, ...style }}>
      {(title || actions) ? <DesktopSidebarCard title={title} subtitle={subtitle} actions={actions}>{children}</DesktopSidebarCard> : children}
    </aside>
  );
}

export function DesktopSidebarCard({ title, subtitle, actions, children, tone = 'quiet', style }) {
  return (
    <WorkspacePanel title={title} subtitle={subtitle} actions={actions} style={{ borderRadius: 30, padding: 16, background: tone === 'quiet' ? APG2_PROFILE.quietSurface : undefined, ...style }}>
      {children}
    </WorkspacePanel>
  );
}

export function DesktopMetricCard({ label, value, delta, tone = 'quiet', icon, action, onClick, style }) {
  const body = (
    <MetricCard
      label={label}
      value={value}
      delta={delta}
      tone={tone}
      style={{ minHeight: 92, position: 'relative', paddingRight: icon || action ? 52 : undefined, ...style }}
    />
  );
  const overlay = (icon || action) && (
    <div style={{ position: 'absolute', right: 12, top: 12, display: 'grid', gap: 8, justifyItems: 'end', pointerEvents: action ? 'auto' : 'none' }}>
      {icon && <div style={{ width: 34, height: 34, borderRadius: 14, display: 'grid', placeItems: 'center', background: tone === 'gold' ? 'rgba(23,18,10,0.10)' : APG2_PROFILE.goldSoft, fontSize: 18 }}>{icon}</div>}
      {action}
    </div>
  );
  if (!onClick && !overlay) return body;
  return (
    <button type="button" onClick={onClick} disabled={!onClick} style={{ position: 'relative', border: 0, background: 'transparent', padding: 0, width: '100%', textAlign: 'left', fontFamily: 'inherit', cursor: onClick ? 'pointer' : 'default', color: 'inherit' }}>
      {body}
      {overlay}
    </button>
  );
}

export function DesktopEmptyState({ icon, title, text, action, style }) {
  return (
    <GlassContainer tone="quiet" style={{ minHeight: 240, borderRadius: 32, padding: 28, display: 'grid', placeItems: 'center', textAlign: 'center', ...style }}>
      <div style={{ maxWidth: 420 }}>
        {icon && <div style={{ width: 58, height: 58, borderRadius: 24, margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, fontSize: 28 }}>{icon}</div>}
        <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '27px', fontWeight: 920 }}>{title}</div>
        {text && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px', marginTop: 7 }}>{text}</div>}
        {action && <div style={{ marginTop: 16 }}>{action}</div>}
      </div>
    </GlassContainer>
  );
}

export function DesktopSkeleton({ rows = 3, variant = 'grid', style }) {
  const count = Math.max(1, Number(rows) || 1);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: variant === 'grid' ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr', gap: 12, ...style }}>
      {Array.from({ length: count }).map((_, index) => (
        <GlassCard key={index} style={{ height: variant === 'list' ? 96 : 168, borderRadius: 28, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(var(--apg2-glass-a,255,255,255),0.10), transparent)', animation: 'shimmer 1.45s ease-in-out infinite' }} />
        </GlassCard>
      ))}
    </div>
  );
}

export function DesktopActionBar({ actions = [], children, style }) {
  const safeActions = asArray(actions);
  if (!safeActions.length && !children) return null;
  if (children) {
    return <GlassCard style={{ borderRadius: 28, padding: 8, display: 'flex', alignItems: 'center', gap: 8, ...style }}>{children}</GlassCard>;
  }
  return <QuickActions actions={safeActions} style={{ borderRadius: 28, padding: 8, ...style }} />;
}

export function DesktopSectionTitle({ title, subtitle, actions, style }) {
  return <SectionHeader title={title} subtitle={subtitle} actions={actions} style={{ marginBottom: 0, ...style }} />;
}

export function DesktopFilterButton({ active, children, onClick, tone = 'glass', style }) {
  const activeTone = active ? 'gold' : tone;
  return (
    <GlassButton onClick={onClick} tone={activeTone} style={{ minHeight: 38, borderRadius: 999, padding: '8px 13px', whiteSpace: 'nowrap', color: active ? '#17120a' : APG2_PROFILE.text, transition: motionTransition(['background', 'border-color', 'transform'], 'base'), ...style }}>
      {children}
    </GlassButton>
  );
}
