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
import { parseVideoUrl } from '../utils/parseVideoUrl.js';

const asArray = value => Array.isArray(value) ? value.filter(Boolean) : [];
const MEDIA_PREVIEW_LIVE_EVENT = 'apg:media-preview-live';
const DIRECT_VIDEO_RE = /\.(mp4|webm)(\?|#|$)/i;

export const DESKTOP_PUBLIC_SECTIONS = ['news', 'events', 'partners', 'experts', 'offers', 'rewards'];

function toMediaUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return String(value.url || value.src || value.image || value.photo || value.photoUrl || value.imageUrl || value.thumbnailUrl || value.cover || '').trim();
}

function firstMediaUrl(...sources) {
  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source)) {
      const match = source.map(toMediaUrl).find(Boolean);
      if (match) return match;
      continue;
    }
    const url = toMediaUrl(source);
    if (url) return url;
  }
  return '';
}

function normalizeMediaVideo(raw) {
  if (!raw) return null;
  const url = typeof raw === 'string' ? raw.trim() : String(raw.url || raw.videoUrl || raw.src || raw.link || '').trim();
  if (!url) return null;
  const parsed = parseVideoUrl(url);
  const direct = DIRECT_VIDEO_RE.test(url);
  const platform = raw.platform || parsed?.platform || (direct ? 'direct' : 'video');
  const platformLabel = raw.platformLabel || {
    youtube: 'YouTube',
    vk: 'VK Видео',
    rutube: 'Rutube',
    vimeo: 'Vimeo',
    direct: 'Видео',
  }[platform] || 'Видео';
  return {
    url,
    direct,
    platform,
    platformLabel,
    duration: raw.duration || raw.durationLabel || '',
    title: raw.title || '',
    thumbnailUrl: raw.thumbnailUrl || raw.thumbUrl || raw.previewUrl || parsed?.thumbnailUrl || '',
  };
}

function mediaPreviewSupportsLive() {
  if (typeof window === 'undefined') return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  if (!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches) return false;
  return true;
}

function collectMediaVideos(source, videos) {
  return [
    ...asArray(videos),
    ...asArray(source?.videos),
    source?.video,
    source?.videoUrl,
    source?.youtubeUrl,
    source?.vkVideoUrl,
    source?.rutubeUrl,
    source?.mp4Url,
    source?.webmUrl,
  ].map(normalizeMediaVideo).filter(Boolean);
}

function collectMediaGallery(source, gallery) {
  return [
    ...asArray(gallery),
    ...asArray(source?.gallery),
    ...asArray(source?.photos),
    ...asArray(source?.images),
    ...asArray(source?.media),
  ];
}

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
  React.useEffect(() => {
    if (typeof onBack !== 'function') return undefined;
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  return (
    <div role="dialog" aria-modal="true" aria-label={title || 'Детальная карточка'} style={{ minHeight: '100svh', width: '100%', boxSizing: 'border-box', padding: 'calc(16px + var(--safe-top, 0px)) 24px 34px', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, ...style }}>
      <div style={{ width: '100%', maxWidth, margin: '0 auto', display: 'grid', gap: 14 }}>
        <GlassCard style={{ borderRadius: 26, padding: '10px 12px', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', alignItems: 'center', gap: 10, position: 'sticky', top: 'calc(10px + var(--safe-top, 0px))', zIndex: 20, backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' }}>
          <GlassButton onClick={onBack} aria-label="Закрыть детальную карточку" style={{ width: 42, minHeight: 42, borderRadius: 16, padding: 0, fontSize: 18 }}>‹</GlassButton>
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
    <GlassCard style={{ borderRadius: 34, padding: 0, overflow: 'hidden', minHeight: 276, position: 'relative', isolation: 'isolate', ...style }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 10%, rgba(201,168,76,0.24), transparent 38%), rgba(var(--apg2-glass-a,255,255,255),0.06)' }}>
        {image ? <img src={image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'saturate(1.04) contrast(1.02)' }} /> : null}
      </div>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(90deg, rgba(8,10,14,0.82) 0%, rgba(8,10,14,0.66) 42%, rgba(8,10,14,0.34) 66%, rgba(8,10,14,0.52) 100%), linear-gradient(180deg, rgba(8,10,14,0.12), rgba(8,10,14,0.74))' }} />
      <div style={{ position: 'relative', zIndex: 2, minHeight: 276, padding: 24, display: 'grid', gridTemplateColumns: '138px minmax(0, 1fr) minmax(280px, 0.76fr)', gap: 22, alignItems: 'center' }}>
        {avatar && <div style={{ width: 132, height: 132, borderRadius: 32, padding: 9, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.58)', boxShadow: '0 24px 60px rgba(0,0,0,0.34)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>{avatar}</div>}
        <div style={{ display: 'grid', gap: 9, minWidth: 0, alignContent: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {status && <div style={{ borderRadius: 999, padding: '5px 10px', color: '#17120a', background: 'linear-gradient(135deg,#FFF0B8,#D7B86A)', border: '1px solid rgba(255,232,165,0.62)', fontSize: 11, lineHeight: '14px', fontWeight: 860 }}>{status}</div>}
            {kicker && <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: '14px', fontWeight: 840, letterSpacing: 0.8, textTransform: 'uppercase' }}>{kicker}</div>}
          </div>
          <div style={{ color: '#fff', fontSize: 34, lineHeight: '38px', fontWeight: 940, letterSpacing: 0, textShadow: '0 12px 34px rgba(0,0,0,0.36)', overflowWrap: 'anywhere' }}>{title}</div>
          {subtitle && <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 15, lineHeight: '21px', fontWeight: 760 }}>{subtitle}</div>}
          {safeBadges.length > 0 && <DesktopCardBadges items={safeBadges} style={{ marginTop: 3 }} />}
          {description && <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: '21px', maxWidth: 640, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{description}</div>}
        </div>
        <div style={{ display: 'grid', gap: 12, alignContent: 'center', minWidth: 0 }}>
          {actions}
          {meta}
        </div>
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
  const safeItems = asArray(items)
    .map(item => typeof item === 'string' ? { url: item, alt: '' } : { ...item, url: item?.url || item?.src || item?.image || item?.photo || item?.thumbnailUrl || '' })
    .filter(item => item.url);
  if (!safeItems.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: safeItems.length === 1 ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8, ...style }}>
      {safeItems.slice(0, 6).map((item, index) => (
        <button key={`${item.url}_${index}`} type="button" aria-label={`Открыть фото ${index + 1}`} onClick={() => onOpen?.(index)} style={{ padding: 0, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 17, overflow: 'hidden', cursor: onOpen ? 'pointer' : 'default', aspectRatio: index === 0 && safeItems.length > 2 ? '1.5' : '1' }}>
          <img src={item.url} alt={item.alt || item.title || ''} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
        <GlassButton key={action.id || action.label} aria-label={action.ariaLabel || action.label} disabled={action.disabled} onClick={action.onClick} tone={action.tone || 'glass'} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', fontSize: 11.5, color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, ...action.style }}>
          {action.icon && <span>{action.icon}</span>}<span>{action.label}</span>
        </GlassButton>
      ))}
    </div>
  );
}

export function DesktopDetailTabs({ items = [], activeId, onChange, style }) {
  const safeItems = asArray(items);
  if (!safeItems.length) return null;
  const handleKeyDown = (event, index) => {
    const lastIndex = safeItems.length - 1;
    const nextIndex =
      event.key === 'ArrowRight' ? Math.min(index + 1, lastIndex) :
      event.key === 'ArrowLeft' ? Math.max(index - 1, 0) :
      event.key === 'Home' ? 0 :
      event.key === 'End' ? lastIndex :
      -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    onChange?.(safeItems[nextIndex].id);
  };
  return (
    <GlassCard role="tablist" aria-label="Разделы детальной карточки" style={{ borderRadius: 26, padding: 7, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', position: 'sticky', top: 'calc(70px + var(--safe-top, 0px))', zIndex: 18, ...style }}>
      {safeItems.map((item, index) => (
        <button key={item.id} role="tab" aria-selected={item.id === activeId} tabIndex={item.id === activeId ? 0 : -1} type="button" onClick={() => onChange?.(item.id)} onKeyDown={event => handleKeyDown(event, index)} style={{ minHeight: 38, borderRadius: 999, border: item.id === activeId ? '1px solid rgba(201,168,76,0.62)' : '1px solid transparent', background: item.id === activeId ? 'rgba(201,168,76,0.16)' : 'transparent', color: item.id === activeId ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, padding: '8px 13px', fontSize: 12, lineHeight: '15px', fontWeight: 860, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', position: 'relative', transition: motionTransition(['background', 'border-color', 'color'], 'base') }}>
          {item.label}{Number(item.count) > 0 ? <span style={{ marginLeft: 5, color: item.id === activeId ? APG2_PROFILE.gold : APG2_PROFILE.textMuted }}>{item.count}</span> : null}
          {item.id === activeId && <span style={{ position: 'absolute', left: 14, right: 14, bottom: 3, height: 2, borderRadius: 999, background: APG2_PROFILE.gold }} />}
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
  profileRole = '',
  profileToday = '',
  profileLatestActivity = null,
  profileProgressColor = '',
  quickActions = [],
  isOffline = false,
  style,
}) {
  const [localSearch, setLocalSearch] = React.useState('');
  const safeNav = asArray(navItems);
  const safeStats = asArray(stats);
  const safeHeroActions = asArray(heroActions);
  const safeQuickActions = asArray(quickActions);
  const primaryStats = safeStats.slice(0, 4);
  const actualSearchValue = onSearchChange ? searchValue : localSearch;
  const safeProgress = Math.max(0, Math.min(100, Math.round(Number(progressValue) || 0)));
  const progressColor = profileProgressColor || APG2_PROFILE.gold;
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
        <GlassCard style={{ borderRadius: 30, padding: 12, minHeight: 188, display: 'grid', gridTemplateRows: 'auto auto 1fr auto', gap: 7, overflow: 'hidden', position: 'relative', background: 'radial-gradient(circle at 16% 2%, rgba(201,168,76,0.24), transparent 34%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.16), rgba(var(--apg2-glass-a,255,255,255),0.06))', boxShadow: '0 20px 58px rgba(0,0,0,0.20), inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.16)' }}>
          <div style={{ position: 'absolute', inset: 'auto -42px -54px auto', width: 132, height: 132, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.20), transparent 62%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
            <button type="button" aria-label="Открыть профиль" onClick={onOpenProfile} style={{ width: 58, height: 58, border: '1px solid rgba(201,168,76,0.36)', padding: 0, borderRadius: 22, overflow: 'hidden', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 920, cursor: 'pointer', boxShadow: '0 13px 34px rgba(201,168,76,0.14), inset 0 1px 0 rgba(var(--apg2-glass-a,255,255,255),0.20)' }}>
              {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={event => { event.currentTarget.style.display = 'none'; }} /> : initials}
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: APG2_PROFILE.text, fontWeight: 930, fontSize: 17, lineHeight: '19px', letterSpacing: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.3, lineHeight: '14px', fontWeight: 720, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileRole || userSubtitle}</div>
            </div>
            {profileBadge && <div style={{ borderRadius: 999, padding: '6px 9px', fontSize: 10.2, lineHeight: '12px', fontWeight: 880, color: APG2_PROFILE.gold, border: '1px solid rgba(201,168,76,0.38)', background: 'linear-gradient(145deg, rgba(201,168,76,0.20), rgba(201,168,76,0.08))', maxWidth: 116, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileBadge}</div>}
          </div>
          {profileToday && (
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', alignItems: 'center', gap: 7, minHeight: 26, padding: '0 9px', borderRadius: 14, background: 'rgba(201,168,76,0.11)', border: '1px solid rgba(201,168,76,0.22)', color: APG2_PROFILE.textSoft, fontSize: 10.8, lineHeight: '13px', fontWeight: 760, overflow: 'hidden' }}>
              <span aria-hidden="true" style={{ color: APG2_PROFILE.gold, fontSize: 12 }}>✦</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ color: APG2_PROFILE.text }}>Сегодня для вас:</b> {profileToday}</span>
            </div>
          )}
          {primaryStats.length > 0 && (
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${Math.min(primaryStats.length, 4)}, minmax(0, 1fr))`, gap: 5 }}>
              {primaryStats.map(stat => (
                <div key={stat.label} style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.075)', borderRadius: 13, padding: '6px 5px', textAlign: 'left', overflow: 'hidden', minHeight: 42 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <span aria-hidden="true" style={{ color: stat.accent || APG2_PROFILE.gold, fontSize: 11, lineHeight: '13px' }}>{stat.icon || '•'}</span>
                    <span style={{ color: stat.accent || APG2_PROFILE.text, fontSize: 13.2, lineHeight: '14px', fontWeight: 930 }}>{stat.value}</span>
                  </div>
                  <div style={{ color: APG2_PROFILE.textMuted, fontSize: 8.5, lineHeight: '10px', fontWeight: 760, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 3 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ position: 'relative', display: 'grid', gap: 6, alignSelf: 'center', minHeight: 0, padding: '7px 8px', borderRadius: 16, background: 'rgba(var(--apg2-glass-a,255,255,255),0.055)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 11.6, lineHeight: '14px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{progressTitle || 'Следующая цель'}</div>
                <div style={{ color: APG2_PROFILE.textMuted, fontSize: 9.5, lineHeight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{progressSubtitle || 'Продолжайте собирать прогресс'}</div>
              </div>
              <span style={{ color: APG2_PROFILE.gold, fontSize: 11, lineHeight: '13px', fontWeight: 920 }}>{safeProgress}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.12)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)' }}>
              <div style={{ width: `${safeProgress}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${progressColor}, #E8C97A)`, transition: 'width 0.65s ease', boxShadow: '0 0 22px rgba(201,168,76,0.22)' }} />
            </div>
            {profileLatestActivity && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', color: APG2_PROFILE.textMuted, fontSize: 9.4, lineHeight: '12px', fontWeight: 720, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <span aria-hidden="true" style={{ color: APG2_PROFILE.gold }}>•</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileLatestActivity}</span>
              </div>
            )}
          </div>
          {safeQuickActions.length > 0 && (
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${Math.min(safeQuickActions.length, 3)}, minmax(0, 1fr))`, gap: 5 }}>
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

export function MediaPreview({
  source,
  image = '',
  gallery = [],
  videos = [],
  title = '',
  height = 112,
  children,
  style,
}) {
  const liveId = React.useId();
  const hoverTimer = React.useRef(null);
  const [live, setLive] = React.useState(false);
  const safeVideos = React.useMemo(() => collectMediaVideos(source, videos), [source, videos]);
  const safeGallery = React.useMemo(() => collectMediaGallery(source, gallery), [source, gallery]);
  const video = safeVideos[0] || null;
  const cover = firstMediaUrl(
    video?.thumbnailUrl,
    image,
    source?.coverPhoto,
    source?.cover,
    source?.banner,
    source?.imageUrl,
    source?.photoUrl,
    source?.photo,
    source?.image,
    source?.logoUrl,
    source?.avatarUrl,
    safeGallery,
  );
  const canLivePreview = Boolean(video?.direct && mediaPreviewSupportsLive());

  React.useEffect(() => {
    const handleLivePreview = event => {
      if (event.detail !== liveId) setLive(false);
    };
    window.addEventListener(MEDIA_PREVIEW_LIVE_EVENT, handleLivePreview);
    return () => {
      window.removeEventListener(MEDIA_PREVIEW_LIVE_EVENT, handleLivePreview);
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, [liveId]);

  const startLivePreview = () => {
    if (!canLivePreview) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(MEDIA_PREVIEW_LIVE_EVENT, { detail: liveId }));
      setLive(true);
    }, 350);
  };
  const stopLivePreview = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setLive(false);
  };
  const showVideoBadge = Boolean(video);
  const label = video ? `Видео: ${title || video.title || video.platformLabel}` : title || 'Медиа';
  return (
    <div
      role="img"
      aria-label={label}
      onMouseEnter={startLivePreview}
      onMouseLeave={stopLivePreview}
      style={{ height, position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 18% 18%, rgba(201,168,76,0.22), transparent 42%), rgba(var(--apg2-glass-a,255,255,255),0.08)', ...style }}
    >
      {cover ? (
        <img src={cover} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.88, filter: video ? 'saturate(1.08) contrast(1.04)' : undefined }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: APG2_PROFILE.gold, fontSize: 26, fontWeight: 900, background: 'radial-gradient(circle at 30% 24%, rgba(201,168,76,0.24), transparent 38%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.10), rgba(var(--apg2-glass-a,255,255,255),0.04))' }}>
          АПГ
        </div>
      )}
      {live && video?.direct ? (
        <video
          src={video.url}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : null}
      <div style={{ position: 'absolute', inset: 0, background: video ? 'linear-gradient(180deg, rgba(12,12,14,0.14), rgba(12,12,14,0.58)), radial-gradient(circle at 50% 50%, rgba(0,0,0,0.04), rgba(0,0,0,0.20))' : 'linear-gradient(180deg, rgba(12,12,14,0.04), rgba(12,12,14,0.54))', backdropFilter: video && !cover ? 'blur(10px)' : undefined, WebkitBackdropFilter: video && !cover ? 'blur(10px)' : undefined }} />
      {showVideoBadge ? (
        <>
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 40, height: 40, borderRadius: 20, transform: 'translate(-50%, -50%)', display: 'grid', placeItems: 'center', color: APG2_PROFILE.text, background: 'var(--apg2-control-strong, rgba(var(--apg2-glass-a,255,255,255),0.92))', boxShadow: '0 16px 36px rgba(0,0,0,0.30)', fontSize: 15, lineHeight: '20px', fontWeight: 900 }}>
            ▶
          </div>
          <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 'calc(100% - 20px)', borderRadius: 999, padding: '5px 8px', color: '#fff', background: 'rgba(10,10,14,0.58)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', fontSize: 10.5, lineHeight: '13px', fontWeight: 820 }}>
            <span>Видео</span>
            <span style={{ opacity: 0.74 }}>·</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.duration || video.platformLabel}</span>
          </div>
        </>
      ) : null}
      {children}
    </div>
  );
}

export function DesktopCardPreview({ image, children, height = 70, style }) {
  return (
    <MediaPreview image={image} height={height} style={{ background: 'radial-gradient(circle at 20% 20%, rgba(201,168,76,0.20), transparent 42%), rgba(var(--apg2-glass-a,255,255,255),0.06)', ...style }}>
      {children}
    </MediaPreview>
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
  media,
  gallery = [],
  videos = [],
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
  const safeTags = asArray(tags).filter(item => item?.label || item).slice(0, 5);
  const safeActions = asArray(actions).filter(action => !action?.disabled).slice(0, 3);
  const clamp = lines => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' });
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
          height: 388,
          cursor: onClick ? 'pointer' : 'default',
          border: selected ? '1px solid rgba(201,168,76,0.64)' : APG2_PROFILE.glass.border,
          display: 'grid',
          gridTemplateRows: '112px minmax(0, 1fr)',
          background: active ? 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.13), rgba(var(--apg2-glass-a,255,255,255),0.07))' : undefined,
          transition: motionTransition(['background', 'border-color'], 'base'),
          ...style,
        }}
      >
        <MediaPreview
          source={media}
          image={cover}
          gallery={gallery}
          videos={videos}
          title={title}
          height={112}
        >
          {safeBadges.length > 0 && (
            <div style={{ position: 'absolute', left: 12, top: 12, right: rating ? 68 : 12, display: 'flex', gap: 5, flexWrap: 'wrap', maxHeight: 48, overflow: 'hidden' }}>
              <DesktopCardBadges items={safeBadges} />
            </div>
          )}
          {rating ? (
            <div style={{ position: 'absolute', right: 12, top: 12, minHeight: 26, borderRadius: 999, padding: '5px 9px', display: 'inline-flex', alignItems: 'center', color: APG2_PROFILE.text, background: 'var(--apg2-control-strong, rgba(255,255,255,0.92))', border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.78))', boxShadow: '0 10px 24px var(--apg2-elev-shadow, rgba(0,0,0,0.14))', fontSize: 11.5, lineHeight: '14px', fontWeight: 900 }}>
              ★ {rating}
            </div>
          ) : null}
        </MediaPreview>
        <div style={{ position: 'relative', padding: '15px 14px 13px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {avatar && (
            <div style={{ position: 'absolute', left: 14, top: -30, width: 60, height: 60, borderRadius: 20, padding: 5, display: 'grid', placeItems: 'center', background: 'var(--apg2-control-strong, rgba(255,255,255,0.88))', border: '1px solid var(--apg2-glass-border, rgba(255,255,255,0.56))', boxShadow: '0 16px 34px rgba(0,0,0,0.18)' }}>
              {avatar}
            </div>
          )}
          <div style={{ paddingLeft: avatar ? 72 : 0, minHeight: 48, display: 'grid', alignContent: 'center', minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 16.2, lineHeight: '20px', fontWeight: 900, letterSpacing: 0, ...clamp(2) }}>{title}</div>
            {subtitle && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          </div>
          {description ? <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.2, lineHeight: '17px', minHeight: 34, ...clamp(2) }}>{description}</div> : null}
          {safeMeta.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', maxHeight: 42, overflow: 'hidden', minWidth: 0 }}>
              {safeMeta.map(item => (
                <span key={item.id || item.label} style={{ maxWidth: '100%', minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 8px', color: item.tone === 'gold' ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, background: 'rgba(var(--apg2-glass-a,255,255,255),0.055)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.09)', fontSize: 10.8, lineHeight: '13px', fontWeight: 760 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: item.tone === 'gold' ? APG2_PROFILE.gold : 'rgba(var(--apg2-glass-a,255,255,255),0.34)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</span>
                </span>
              ))}
            </div>
          )}
          {safeTags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', maxHeight: 46, overflow: 'hidden', minWidth: 0 }}>
              {safeTags.map(item => (
                <span key={item.id || item.label || item} style={{ maxWidth: '100%', minWidth: 0, borderRadius: 999, padding: '4px 8px', color: APG2_PROFILE.textMuted, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', fontSize: 10.5, lineHeight: '13px', fontWeight: 720, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label || item}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gap: 5, minWidth: 0, marginTop: 1 }}>
            {contact ? <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '14px', ...clamp(1) }}>{contact}</div> : null}
            {offer ? <div style={{ color: APG2_PROFILE.gold, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.26)', borderRadius: 12, padding: '5px 8px', fontSize: 10.8, lineHeight: '14px', fontWeight: 820, ...clamp(1) }}>{offer}</div> : null}
          </div>
          {safeActions.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${safeActions.length}, minmax(0, 1fr))`, gap: 8, alignItems: 'center', marginTop: 'auto', paddingTop: 4 }}>
              {safeActions.map(action => (
                <GlassButton
                  key={action.id || action.label}
                  onClick={event => {
                    event.stopPropagation();
                    action.onClick?.(event);
                  }}
                  tone={action.tone || 'glass'}
                  style={{ minHeight: 40, borderRadius: 14, padding: '8px 10px', fontSize: 11.6, color: action.tone === 'gold' ? '#17120a' : APG2_PROFILE.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...action.style }}
                >
                  {action.label}
                </GlassButton>
              ))}
            </div>
          )}
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
