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

export function DesktopSectionShell({ children, topOverview, header, toolbar, kpi, info, actionBar, maxWidth = 1360, style, contentStyle }) {
  return (
    <div style={{ minHeight: '100svh', width: '100%', boxSizing: 'border-box', padding: 'calc(18px + var(--safe-top, 0px)) 24px 34px', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, ...style }}>
      <div style={{ width: '100%', maxWidth, margin: '0 auto', display: 'grid', gap: 16 }}>
        {topOverview}
        {header}
        {toolbar}
        {kpi}
        {info}
        <main style={{ minWidth: 0, display: 'grid', gap: 16, ...contentStyle }}>{children}</main>
        {actionBar}
      </div>
    </div>
  );
}

export function DesktopDetailShell({ children, aside, stickyActions, onBack, title, maxWidth = 1440, style, contentStyle }) {
  return (
    <div style={{ minHeight: '100svh', width: '100%', boxSizing: 'border-box', padding: 'calc(16px + var(--safe-top, 0px)) 24px 34px', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, ...style }}>
      <div style={{ width: '100%', maxWidth, margin: '0 auto', display: 'grid', gap: 14 }}>
        <GlassCard style={{ borderRadius: 26, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', alignItems: 'center', gap: 10 }}>
          <GlassButton onClick={onBack} style={{ width: 42, minHeight: 42, borderRadius: 16, padding: 0, fontSize: 18 }}>‹</GlassButton>
          <div style={{ minWidth: 0, color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '17px', fontWeight: 760, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {stickyActions}
        </GlassCard>
        <div style={{ display: 'grid', gridTemplateColumns: aside ? 'minmax(0, 1fr) minmax(270px, 330px)' : 'minmax(0, 1fr)', gap: 14, alignItems: 'start', ...contentStyle }}>
          <main style={{ display: 'grid', gap: 14, minWidth: 0 }}>{children}</main>
          {aside && <aside style={{ display: 'grid', gap: 12, position: 'sticky', top: 'calc(16px + var(--safe-top, 0px))', minWidth: 0 }}>{aside}</aside>}
        </div>
      </div>
    </div>
  );
}

export function DesktopHero({ image, avatar, kicker, title, subtitle, status, badges = [], description, actions, meta, style }) {
  const safeBadges = asArray(badges);
  return (
    <GlassCard style={{ borderRadius: 34, padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(320px, 0.96fr) minmax(360px, 1.04fr)', minHeight: 310, ...style }}>
      <div style={{ minHeight: 310, position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 24% 20%, rgba(201,168,76,0.20), transparent 42%), rgba(var(--apg2-glass-a,255,255,255),0.06)' }}>
        {image ? <img src={image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', minHeight: 310, objectFit: 'cover', display: 'block' }} /> : null}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,12,14,0.02), rgba(12,12,14,0.42) 68%, rgba(12,12,14,0.72))' }} />
        {avatar && <div style={{ position: 'absolute', left: 22, bottom: 22, width: 94, height: 94, borderRadius: 28, padding: 8, display: 'grid', placeItems: 'center', background: 'rgba(var(--apg2-glass-a,255,255,255),0.78)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.48)', boxShadow: '0 20px 46px rgba(0,0,0,0.24)' }}>{avatar}</div>}
      </div>
      <div style={{ padding: 22, display: 'grid', alignContent: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {status && <div style={{ justifySelf: 'start', borderRadius: 999, padding: '5px 10px', color: APG2_PROFILE.gold, background: 'rgba(201,168,76,0.13)', border: '1px solid rgba(201,168,76,0.28)', fontSize: 11, lineHeight: '14px', fontWeight: 820 }}>{status}</div>}
          {kicker && <div style={{ color: APG2_PROFILE.gold, fontSize: 11, lineHeight: '14px', fontWeight: 840, letterSpacing: 0.8, textTransform: 'uppercase' }}>{kicker}</div>}
          <div style={{ color: APG2_PROFILE.text, fontSize: 34, lineHeight: '38px', fontWeight: 930, letterSpacing: 0 }}>{title}</div>
          {subtitle && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 15, lineHeight: '21px', fontWeight: 760 }}>{subtitle}</div>}
          {safeBadges.length > 0 && <DesktopCardBadges items={safeBadges} />}
          {description && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px', maxWidth: 620 }}>{description}</div>}
        </div>
        {meta}
        {actions}
      </div>
    </GlassCard>
  );
}

export function DesktopHeroInfo({ children, style }) {
  return <div style={{ display: 'grid', gap: 10, minWidth: 0, ...style }}>{children}</div>;
}

export function DesktopHeroActions({ actions = [], style }) {
  const safeActions = asArray(actions);
  if (!safeActions.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', ...style }}>
      {safeActions.map(action => (
        <GlassButton key={action.id || action.label} disabled={action.disabled} onClick={action.onClick} tone={action.tone || 'glass'} style={{ minHeight: 38, borderRadius: 15, padding: '8px 12px', fontSize: 12.2, color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, ...action.style }}>
          {action.icon && <span>{action.icon}</span>}<span>{action.label}</span>
        </GlassButton>
      ))}
    </div>
  );
}

export function DesktopInfoGrid({ items = [], columns, style }) {
  const safeItems = asArray(items).filter(item => item?.value || item?.label);
  if (!safeItems.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns || `repeat(${Math.min(safeItems.length, 5)}, minmax(0, 1fr))`, gap: 10, ...style }}>
      {safeItems.map(item => (
        <DesktopMetricCard key={item.id || item.label} label={item.label} value={item.value} icon={item.icon} tone={item.tone} onClick={item.onClick} style={{ minHeight: 82, ...item.style }} />
      ))}
    </div>
  );
}

export function DesktopMeta({ items = [], style }) {
  const safeItems = asArray(items).filter(item => item?.value);
  if (!safeItems.length) return null;
  return (
    <div style={{ display: 'grid', gap: 8, ...style }}>
      {safeItems.map(item => (
        <button key={item.id || item.label} type="button" disabled={!item.onClick} onClick={item.onClick} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: 9, alignItems: 'start', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 15, padding: '10px 11px', color: APG2_PROFILE.text, textAlign: 'left', fontFamily: 'inherit', cursor: item.onClick ? 'pointer' : 'default' }}>
          <span style={{ width: 28, height: 28, borderRadius: 11, display: 'grid', placeItems: 'center', color: APG2_PROFILE.gold, background: APG2_PROFILE.goldSoft, fontSize: 14 }}>{item.icon || '•'}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', color: APG2_PROFILE.textMuted, fontSize: 10, lineHeight: '12px', fontWeight: 760, marginBottom: 3 }}>{item.label}</span>
            <span style={{ display: 'block', color: item.onClick ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '17px', fontWeight: 760, wordBreak: 'break-word' }}>{item.value}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function DesktopGallery({ items = [], onOpen, style }) {
  const safeItems = asArray(items);
  if (!safeItems.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: safeItems.length === 1 ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8, ...style }}>
      {safeItems.slice(0, 6).map((url, index) => (
        <button key={`${url}_${index}`} type="button" onClick={() => onOpen?.(index)} style={{ padding: 0, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 17, overflow: 'hidden', cursor: onOpen ? 'pointer' : 'default', aspectRatio: index === 0 && safeItems.length > 2 ? '1.5' : '1' }}>
          <img src={url} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </button>
      ))}
    </div>
  );
}

export function DesktopSection({ title, subtitle, action, children, style }) {
  if (!children) return null;
  return (
    <GlassCard style={{ borderRadius: 28, padding: 18, display: 'grid', gap: 13, ...style }}>
      {(title || subtitle || action) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            {title && <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '20px', fontWeight: 890 }}>{title}</div>}
            {subtitle && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '16px', marginTop: 3 }}>{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </GlassCard>
  );
}

export function DesktopRelated({ items = [], onOpen, style }) {
  const safeItems = asArray(items);
  if (!safeItems.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9, ...style }}>
      {safeItems.slice(0, 6).map(item => (
        <button key={item.id || item.title || item.name} type="button" onClick={() => onOpen?.(item)} style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 18, padding: 11, color: APG2_PROFILE.text, textAlign: 'left', fontFamily: 'inherit', cursor: onOpen ? 'pointer' : 'default', minHeight: 92 }}>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '13px', fontWeight: 760, marginBottom: 10 }}>{item.kicker || item.categoryLabel || item.type || 'АПГ'}</div>
          <div style={{ color: APG2_PROFILE.text, fontSize: 13, lineHeight: '17px', fontWeight: 850, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title || item.name}</div>
          {item.subtitle && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '13px', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle}</div>}
        </button>
      ))}
    </div>
  );
}

export function DesktopStickyActions({ actions = [], style }) {
  const safeActions = asArray(actions);
  if (!safeActions.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, ...style }}>
      {safeActions.map(action => (
        <GlassButton key={action.id || action.label} disabled={action.disabled} onClick={action.onClick} tone={action.tone || 'glass'} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', fontSize: 11.5, color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, ...action.style }}>
          {action.icon && <span>{action.icon}</span>}<span>{action.label}</span>
        </GlassButton>
      ))}
    </div>
  );
}

export function DesktopDetailTabs({ items = [], activeId, onChange, style }) {
  const safeItems = asArray(items);
  if (!safeItems.length) return null;
  return (
    <GlassCard style={{ borderRadius: 26, padding: 7, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', ...style }}>
      {safeItems.map(item => (
        <button key={item.id} type="button" onClick={() => onChange?.(item.id)} style={{ minHeight: 34, borderRadius: 999, border: item.id === activeId ? '1px solid rgba(201,168,76,0.62)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: item.id === activeId ? 'rgba(201,168,76,0.16)' : 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: item.id === activeId ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, padding: '7px 12px', fontSize: 11.5, lineHeight: '15px', fontWeight: 820, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {item.label}{Number(item.count) > 0 ? ` ${item.count}` : ''}
        </button>
      ))}
    </GlassCard>
  );
}

export function DesktopTopOverview({
  activeSection = 'home',
  navItems = [],
  searchValue = '',
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  unreadCount = 0,
  onOpenNotifications,
  onOpenLoki,
  onOpenProfile,
  workspaceAction,
  userName = 'Участник',
  userSubtitle = 'АПГ',
  avatarUrl = '',
  initials = 'У',
  profileBadge = '',
  heroTitle = 'Пульс города сегодня',
  heroSubtitle = 'Главный повод открыть АПГ',
  heroKicker = 'Сегодня в АПГ',
  heroImage = '',
  heroActions = [],
  stats = [],
  progressTitle = '',
  progressSubtitle = '',
  progressValue = 0,
  quickActions = [],
  isOffline = false,
  style,
}) {
  const [localSearch, setLocalSearch] = React.useState('');
  const safeNav = asArray(navItems);
  const safeStats = asArray(stats);
  const safeHeroActions = asArray(heroActions);
  const safeQuickActions = asArray(quickActions);
  const actualSearchValue = onSearchChange ? searchValue : localSearch;
  const safeProgress = Math.max(0, Math.min(100, Math.round(Number(progressValue) || 0)));
  const runSearch = () => {
    if (typeof onSearchSubmit === 'function') onSearchSubmit(actualSearchValue);
  };
  const navButtonStyle = item => ({
    border: '1px solid',
    borderColor: item.id === activeSection ? 'rgba(201,168,76,0.70)' : 'rgba(var(--apg2-glass-a,255,255,255),0.22)',
    background: item.id === activeSection ? 'linear-gradient(145deg, rgba(201,168,76,0.26), rgba(201,168,76,0.08))' : 'rgba(var(--apg2-glass-a,255,255,255),0.08)',
    color: item.id === activeSection ? APG2_PROFILE.gold : APG2_PROFILE.textSoft,
    borderRadius: 999,
    minHeight: 32,
    padding: '0 12px',
    fontSize: 11.7,
    lineHeight: '16px',
    fontWeight: 780,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });
  return (
    <section style={{ display: 'grid', gap: 12, ...style }}>
      {isOffline && (
        <div style={{ padding: '10px 12px', borderRadius: 16, color: APG2_PROFILE.text, background: 'linear-gradient(145deg, rgba(230,70,70,0.18), rgba(var(--apg2-glass-a,255,255,255),0.06))', border: '1px solid rgba(230,70,70,0.34)', fontSize: 13, fontWeight: 720 }}>
          Работа в офлайн-режиме: новые действия недоступны до восстановления сети.
        </div>
      )}
      <header style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <picture>
            <source srcSet="/logo.webp" type="image/webp" />
            <img src="/logo.png" alt="АПГ" style={{ width: 40, height: 40, borderRadius: 16, objectFit: 'cover', boxShadow: '0 12px 30px rgba(0,0,0,0.22), 0 0 0 1px rgba(var(--apg2-glass-a,255,255,255),0.18)' }} />
          </picture>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '19px', fontWeight: 880 }}>АПГ: ЗЕЛЕНОГРАД</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '13px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Альянс партнёров города</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          {safeNav.map(item => (
            <button key={item.id || item.label} type="button" onClick={item.onClick} style={navButtonStyle(item)} aria-current={item.id === activeSection ? 'page' : undefined}>
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ width: 'clamp(178px, 14.2vw, 246px)', height: 38, borderRadius: 999, display: 'grid', gridTemplateColumns: '18px 1fr auto', alignItems: 'center', gap: 7, padding: '0 10px 0 12px', boxSizing: 'border-box', color: APG2_PROFILE.textMuted, background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.20)' }}>
            <span aria-hidden="true" style={{ fontSize: 13, lineHeight: '18px', opacity: 0.82 }}>⌕</span>
            <input
              type="search"
              value={actualSearchValue}
              onChange={event => {
                if (onSearchChange) onSearchChange(event.target.value);
                else setLocalSearch(event.target.value);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  runSearch();
                }
              }}
              placeholder="Поиск по АПГ..."
              aria-label="Поиск по АПГ"
              style={{ minWidth: 0, width: '100%', height: '100%', border: 0, outline: 0, background: 'transparent', color: APG2_PROFILE.text, fontSize: 12, lineHeight: '16px', fontWeight: 720 }}
            />
            {String(actualSearchValue || '').trim() ? (
              <button type="button" aria-label="Очистить поиск" onClick={() => { if (onSearchClear) onSearchClear(); if (!onSearchChange) setLocalSearch(''); }} style={{ width: 20, height: 20, borderRadius: 10, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.20)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.10)', color: APG2_PROFILE.textMuted, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 12, padding: 0 }}>×</button>
            ) : (
              <button type="button" aria-label="Запустить поиск" onClick={runSearch} style={{ width: 20, height: 20, borderRadius: 10, border: '1px solid rgba(201,168,76,0.22)', background: 'rgba(201,168,76,0.10)', color: APG2_PROFILE.gold, cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 11, padding: 0 }}>↵</button>
            )}
          </div>
          <button type="button" onClick={onOpenNotifications} aria-label="Уведомления" style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 16, cursor: 'pointer', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.18)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 18, display: 'grid', placeItems: 'center', position: 'relative' }}>
            🔔
            {unreadCount > 0 && <span style={{ position: 'absolute', top: 7, right: 7, width: 10, height: 10, borderRadius: '50%', background: '#E64646', border: '2px solid #101012' }} />}
          </button>
          {workspaceAction}
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.58fr) minmax(320px, 0.82fr)', gap: 14, alignItems: 'stretch' }}>
        <GlassCard style={{ borderRadius: 34, padding: 0, minHeight: 188, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: -18, pointerEvents: 'none' }}>
            {heroImage ? <img src={heroImage} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.44, filter: 'saturate(1.12) contrast(1.04)' }} /> : <div style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at 28% 18%, rgba(244,217,140,0.28), transparent 42%), linear-gradient(135deg, rgba(24,29,48,0.70), rgba(var(--apg2-glass-a,255,255,255),0.08) 46%, rgba(14,12,18,0.32))' }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(14,15,18,0.03), rgba(14,15,18,0.24) 42%, rgba(12,12,14,0.74))' }} />
          </div>
          <div style={{ position: 'relative', zIndex: 1, minHeight: 188, padding: 16, display: 'grid', alignContent: 'center' }}>
            <div style={{ color: APG2_PROFILE.gold, fontWeight: 820, fontSize: 10.5, letterSpacing: 0.8, marginBottom: 7 }}>{heroKicker.toUpperCase()}</div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 34, lineHeight: '37px', fontWeight: 900, letterSpacing: 0, maxWidth: 760 }}>{heroTitle}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '19px', marginTop: 8, maxWidth: 680 }}>{heroSubtitle}</div>
            {safeHeroActions.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {safeHeroActions.slice(0, 3).map(action => <GlassButton key={action.id || action.label} onClick={(event) => { event.stopPropagation(); action.onClick?.(); }} tone={action.tone || 'glass'} style={{ minHeight: 30, borderRadius: 999, color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text }}>{action.label}</GlassButton>)}
              </div>
            )}
          </div>
        </GlassCard>
        <GlassCard style={{ borderRadius: 30, padding: 12, minHeight: 188, display: 'grid', gridTemplateRows: '42px auto 1fr auto', gap: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 8, alignItems: 'center' }}>
            <button type="button" aria-label="Открыть профиль" onClick={onOpenProfile} style={{ width: 40, height: 40, border: 'none', padding: 0, borderRadius: 16, overflow: 'hidden', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 900, cursor: 'pointer' }}>
              {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={event => { event.currentTarget.style.display = 'none'; }} /> : initials}
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: APG2_PROFILE.text, fontWeight: 880, fontSize: 14.2, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.2, lineHeight: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userSubtitle}</div>
            </div>
            {profileBadge && <div style={{ borderRadius: 999, padding: '5px 8px', fontSize: 9.8, fontWeight: 820, color: APG2_PROFILE.gold, border: '1px solid rgba(201,168,76,0.36)', background: 'rgba(201,168,76,0.12)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileBadge}</div>}
          </div>
          {safeStats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(safeStats.length, 6)}, minmax(0, 1fr))`, gap: 5 }}>
              {safeStats.slice(0, 6).map(stat => (
                <div key={stat.label} style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 12, padding: '5px 4px', textAlign: 'center', overflow: 'hidden' }}>
                  <div style={{ color: stat.accent || APG2_PROFILE.text, fontSize: 12.2, lineHeight: '13px', fontWeight: 900 }}>{stat.value}</div>
                  <div style={{ color: APG2_PROFILE.textMuted, fontSize: 7.5, lineHeight: '9px', fontWeight: 720, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gap: 5, alignSelf: 'center', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 11, lineHeight: '13px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{progressTitle || 'Сегодня для вас'}</div>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 9, lineHeight: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{progressSubtitle || 'Локи подготовил контекст'}</div>
              </div>
              <button type="button" onClick={onOpenLoki} style={{ border: '1px solid rgba(201,168,76,0.30)', background: 'rgba(201,168,76,0.12)', color: APG2_PROFILE.gold, borderRadius: 999, padding: '5px 8px', fontSize: 10.5, fontWeight: 820, cursor: 'pointer' }}>Локи</button>
            </div>
            <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.12)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)' }}>
              <div style={{ width: `${safeProgress}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${APG2_PROFILE.gold}, #E8C97A)`, transition: 'width 0.3s ease' }} />
            </div>
          </div>
          {safeQuickActions.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(safeQuickActions.length, 3)}, minmax(0, 1fr))`, gap: 5 }}>
              {safeQuickActions.slice(0, 3).map(action => <GlassButton key={action.id || action.label} onClick={action.onClick} tone={action.tone || 'glass'} style={{ minHeight: 27, borderRadius: 999, padding: '0 8px', fontSize: 9.8, color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text }}>{action.label}</GlassButton>)}
            </div>
          )}
        </GlassCard>
      </div>
    </section>
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

export function DesktopCatalogGrid({ children, columns, gap = 12, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : 'repeat(auto-fit, minmax(260px, 1fr))',
      gap,
      alignItems: 'stretch',
      ...style,
    }}>
      {children}
    </div>
  );
}

export function DesktopCardHover({ active = false, children, style }) {
  return (
    <div style={{
      transition: motionTransition(['transform', 'box-shadow', 'border-color', 'background'], 'base'),
      transform: active ? 'translateY(-3px)' : 'translateY(0)',
      boxShadow: active ? '0 20px 44px rgba(0,0,0,0.18)' : '0 10px 28px rgba(0,0,0,0.10)',
      ...style,
    }}>
      {children}
    </div>
  );
}

export function DesktopCardPreview({ image, children, height = 70, style }) {
  return (
    <div style={{ height, position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 20% 20%, rgba(201,168,76,0.20), transparent 42%), rgba(var(--apg2-glass-a,255,255,255),0.06)', ...style }}>
      {image ? <img src={image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.78 }} /> : null}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,12,14,0.00), rgba(12,12,14,0.42))' }} />
      {children}
    </div>
  );
}

export function DesktopCardBadges({ items = [], style }) {
  const safeItems = asArray(items);
  if (!safeItems.length) return null;
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', minWidth: 0, ...style }}>
      {safeItems.slice(0, 4).map(item => (
        <span key={item.id || item.label} style={{
          minHeight: 20,
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 999,
          padding: '3px 7px',
          color: item.tone === 'gold' ? APG2_PROFILE.gold : APG2_PROFILE.textSoft,
          background: item.tone === 'gold' ? 'rgba(201,168,76,0.13)' : 'rgba(var(--apg2-glass-a,255,255,255),0.08)',
          border: item.tone === 'gold' ? '1px solid rgba(201,168,76,0.28)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)',
          fontSize: 10,
          lineHeight: '12px',
          fontWeight: 780,
          whiteSpace: 'nowrap',
        }}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function DesktopCardTags({ items = [], style }) {
  const safeItems = asArray(items);
  if (!safeItems.length) return null;
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', minWidth: 0, ...style }}>
      {safeItems.slice(0, 4).map(item => (
        <span key={item.id || item.label || item} style={{
          borderRadius: 999,
          padding: '3px 7px',
          color: APG2_PROFILE.textMuted,
          background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)',
          border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)',
          fontSize: 10,
          lineHeight: '12px',
          fontWeight: 720,
          whiteSpace: 'nowrap',
        }}>
          {item.label || item}
        </span>
      ))}
    </div>
  );
}

export function DesktopCardMeta({ items = [], mode = 'cards', style }) {
  const safeItems = asArray(items).filter(item => item?.value || item?.label);
  if (!safeItems.length) return null;
  if (mode === 'inline') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', minWidth: 0, ...style }}>
        {safeItems.slice(0, 4).map(item => (
          <span key={item.id || item.label} style={{ minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', color: item.tone === 'gold' ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '14px', fontWeight: 760 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: item.tone === 'gold' ? APG2_PROFILE.gold : 'rgba(var(--apg2-glass-a,255,255,255),0.32)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value || item.label}</span>
          </span>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(safeItems.length, 3)}, minmax(0, 1fr))`, gap: 6, ...style }}>
      {safeItems.slice(0, 3).map(item => (
        <div key={item.id || item.label} style={{ minWidth: 0, borderRadius: 12, padding: '6px 7px', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.09)' }}>
          <div style={{ color: item.tone === 'gold' ? APG2_PROFILE.gold : APG2_PROFILE.text, fontSize: 11.5, lineHeight: '13px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
          <div style={{ color: APG2_PROFILE.textMuted, fontSize: 8.8, lineHeight: '10px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function DesktopCardActions({ actions = [], style }) {
  const safeActions = asArray(actions);
  if (!safeActions.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: safeActions.length > 3 ? 'repeat(2, minmax(0, 1fr))' : `repeat(${safeActions.length}, minmax(72px, 1fr))`, gap: 6, ...style }}>
      {safeActions.map(action => (
        <GlassButton
          key={action.id || action.label}
          disabled={action.disabled}
          onClick={event => {
            event.stopPropagation();
            action.onClick?.(event);
          }}
          tone={action.tone || 'glass'}
          style={{ minHeight: 32, borderRadius: 13, padding: '6px 7px', fontSize: 10.5, color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...action.style }}
        >
          {action.label}
        </GlassButton>
      ))}
    </div>
  );
}

export function DesktopCardFooter({ children, style }) {
  if (!children) return null;
  return <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', ...style }}>{children}</div>;
}

export function DesktopCardHeader({ avatar, badges, title, subtitle, side, compact = false, style }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${avatar ? (compact ? '42px' : '48px') : '0'} minmax(0, 1fr) auto`, gap: avatar ? 10 : 0, alignItems: 'start', minWidth: 0, ...style }}>
      {avatar ? <div style={{ minWidth: 0 }}>{avatar}</div> : null}
      <div style={{ minWidth: 0 }}>
        <DesktopCardBadges items={badges} style={{ marginBottom: badges?.length ? 5 : 0 }} />
        <div style={{ color: APG2_PROFILE.text, fontSize: compact ? 14.5 : 15.5, lineHeight: compact ? '18px' : '19px', fontWeight: 880, display: '-webkit-box', WebkitLineClamp: compact ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</div>
        {subtitle && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.2, lineHeight: '15px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>
      {side ? <div style={{ color: APG2_PROFILE.gold, fontSize: 11.5, lineHeight: '14px', fontWeight: 850, whiteSpace: 'nowrap' }}>{side}</div> : null}
    </div>
  );
}

export function DesktopCard({
  selected = false,
  compact = false,
  onClick,
  preview,
  avatar,
  badges = [],
  title,
  subtitle,
  side,
  description,
  meta = [],
  tags = [],
  actions = [],
  footer,
  children,
  layout = 'stacked',
  density = 'regular',
  metaMode = 'cards',
  previewWidth = 112,
  descriptionLines = 2,
  onMouseEnter,
  onFocus,
  style,
}) {
  const [hovered, setHovered] = React.useState(false);
  const active = selected || hovered;
  const catalog = density === 'catalog';
  const horizontal = Boolean(preview && (layout === 'horizontal' || compact));
  const previewRow = catalog ? '78px' : '70px';
  return (
    <DesktopCardHover active={active}>
      <GlassCard
        interactiveAs="div"
        onClick={onClick}
        onMouseEnter={(event) => { setHovered(true); onMouseEnter?.(event); }}
        onMouseLeave={() => setHovered(false)}
        onFocus={(event) => { setHovered(true); onFocus?.(event); }}
        style={{
          borderRadius: 24,
          padding: 0,
          overflow: 'hidden',
          minHeight: horizontal ? 150 : catalog ? 214 : compact ? 132 : 178,
          cursor: onClick ? 'pointer' : 'default',
          border: selected ? '1px solid rgba(201,168,76,0.64)' : APG2_PROFILE.glass.border,
          display: 'grid',
          gridTemplateColumns: horizontal ? `${previewWidth}px minmax(0, 1fr)` : undefined,
          gridTemplateRows: preview && !horizontal ? `${previewRow} minmax(0, 1fr)` : 'minmax(0, 1fr)',
          background: active ? 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.13), rgba(var(--apg2-glass-a,255,255,255),0.06))' : undefined,
          transition: motionTransition(['background', 'border-color'], 'base'),
          ...style,
        }}
      >
        {preview && !horizontal ? preview : null}
        {preview && horizontal ? <div style={{ minHeight: 150, height: '100%' }}>{React.cloneElement(preview, { height: '100%' })}</div> : null}
        <div style={{ padding: catalog ? 11 : compact ? 11 : 12, display: 'grid', gap: catalog ? 7 : compact ? 8 : 9, alignContent: 'start', minWidth: 0 }}>
          <DesktopCardHeader avatar={compact ? avatar : avatar} badges={badges} title={title} subtitle={subtitle} side={side} compact={compact} />
          {description ? (
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: catalog ? 11.5 : 11.8, lineHeight: catalog ? '15px' : '16px', minHeight: compact || horizontal ? 0 : 30, display: '-webkit-box', WebkitLineClamp: descriptionLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description}</div>
          ) : null}
          <DesktopCardMeta items={meta} mode={metaMode} />
          <DesktopCardTags items={tags} />
          {children}
          <DesktopCardActions actions={actions} />
          <DesktopCardFooter>{footer}</DesktopCardFooter>
        </div>
      </GlassCard>
    </DesktopCardHover>
  );
}

export function DesktopCatalogEntityCard({
  selected = false,
  cover = '',
  avatar,
  badges = [],
  title,
  subtitle,
  rating,
  description,
  meta = [],
  tags = [],
  contact,
  offer,
  actions = [],
  onClick,
  onMouseEnter,
  onFocus,
  style,
}) {
  const [hovered, setHovered] = React.useState(false);
  const active = selected || hovered;
  const safeBadges = asArray(badges).slice(0, 3);
  const safeMeta = asArray(meta).filter(item => item?.value).slice(0, 4);
  const safeTags = asArray(tags).filter(item => item?.label || item).slice(0, 4);
  const safeActions = asArray(actions).slice(0, 4);
  const metaSlots = Array.from({ length: 4 }, (_, index) => safeMeta[index] || null);
  const tagSlots = Array.from({ length: 3 }, (_, index) => safeTags[index] || null);
  return (
    <DesktopCardHover active={active}>
      <GlassCard
        interactiveAs="div"
        onClick={onClick}
        onMouseEnter={(event) => { setHovered(true); onMouseEnter?.(event); }}
        onMouseLeave={() => setHovered(false)}
        onFocus={(event) => { setHovered(true); onFocus?.(event); }}
        style={{
          borderRadius: 20,
          padding: 0,
          overflow: 'hidden',
          height: 316,
          cursor: onClick ? 'pointer' : 'default',
          border: selected ? '1px solid rgba(201,168,76,0.64)' : APG2_PROFILE.glass.border,
          display: 'grid',
          gridTemplateRows: '78px minmax(0, 1fr)',
          background: active ? 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.13), rgba(var(--apg2-glass-a,255,255,255),0.07))' : undefined,
          transition: motionTransition(['background', 'border-color'], 'base'),
          ...style,
        }}
      >
        <div style={{ height: 78, position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 18% 18%, rgba(201,168,76,0.22), transparent 42%), rgba(var(--apg2-glass-a,255,255,255),0.08)' }}>
          {cover ? <img src={cover} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.86 }} /> : null}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,12,14,0.02), rgba(12,12,14,0.42))' }} />
          {safeBadges.length > 0 && (
            <div style={{ position: 'absolute', left: 10, top: 10, right: rating ? 56 : 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <DesktopCardBadges items={safeBadges} />
            </div>
          )}
          {rating ? (
            <div style={{ position: 'absolute', right: 10, top: 10, minHeight: 24, borderRadius: 999, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', color: APG2_PROFILE.text, background: 'var(--apg2-control-strong, rgba(255,255,255,0.92))', border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.78))', boxShadow: '0 10px 24px var(--apg2-elev-shadow, rgba(0,0,0,0.14))', fontSize: 11.5, lineHeight: '14px', fontWeight: 900 }}>
              ★ {rating}
            </div>
          ) : null}
        </div>
        <div style={{ position: 'relative', padding: '12px 12px 11px', display: 'grid', gridTemplateRows: '38px 32px 42px 22px 36px 34px', gap: 7, minWidth: 0, minHeight: 0 }}>
          {avatar && (
            <div style={{ position: 'absolute', left: 12, top: -24, width: 54, height: 54, borderRadius: 18, padding: 5, display: 'grid', placeItems: 'center', background: 'rgba(var(--apg2-glass-a,255,255,255),0.88)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.56)', boxShadow: '0 16px 34px rgba(0,0,0,0.18)' }}>
              {avatar}
            </div>
          )}
          <div style={{ paddingLeft: avatar ? 64 : 0, display: 'grid', alignContent: 'center', minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 15.5, lineHeight: '19px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            {subtitle && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.2, lineHeight: '15px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          </div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, lineHeight: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description || ''}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            {metaSlots.map((item, index) => (
              <div key={item?.id || item?.label || `meta-${index}`} style={{ minWidth: 0, borderRadius: 11, padding: '5px 7px', background: item ? 'rgba(var(--apg2-glass-a,255,255,255),0.06)' : 'transparent', border: item ? '1px solid rgba(var(--apg2-glass-a,255,255,255),0.09)' : '1px solid transparent', overflow: 'hidden' }}>
                {item ? (
                  <>
                  <div style={{ color: item.tone === 'gold' ? APG2_PROFILE.gold : APG2_PROFILE.text, fontSize: 11.2, lineHeight: '13px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
                  <div style={{ color: APG2_PROFILE.textMuted, fontSize: 8.8, lineHeight: '10px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
            {tagSlots.map((item, index) => (
              item ? (
                <span key={item.id || item.label || item} style={{ minWidth: 0, maxWidth: index === 0 ? '48%' : '28%', borderRadius: 999, padding: '3px 7px', color: APG2_PROFILE.textMuted, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', fontSize: 10, lineHeight: '12px', fontWeight: 720, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label || item}
                </span>
              ) : <span key={`tag-${index}`} style={{ width: index === 0 ? '48%' : '28%' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, lineHeight: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact || ''}</div>
            <div style={{ color: offer ? '#17120a' : 'transparent', background: offer ? APG2_PROFILE.goldSoft : 'transparent', border: offer ? '1px solid rgba(201,168,76,0.30)' : '1px solid transparent', borderRadius: 11, padding: '4px 7px', fontSize: 10.5, lineHeight: '13px', fontWeight: 830, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{offer || ''}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: safeActions.length > 2 ? '1.12fr 1fr auto' : `repeat(${Math.max(safeActions.length, 1)}, minmax(0, 1fr))`, gap: 7, alignItems: 'center' }}>
            {safeActions.slice(0, 3).map(action => (
                <GlassButton
                  key={action.id || action.label}
                  disabled={action.disabled}
                  onClick={event => {
                    event.stopPropagation();
                    action.onClick?.(event);
                  }}
                  tone={action.tone || 'glass'}
                  style={{ minHeight: 34, borderRadius: 13, padding: action.iconOnly ? '6px 8px' : '7px 9px', fontSize: 11, color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...action.style }}
                >
                  {action.label}
                </GlassButton>
            ))}
          </div>
        </div>
      </GlassCard>
    </DesktopCardHover>
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
