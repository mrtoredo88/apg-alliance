import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RichText } from './components/RichText.jsx';
import { APG2_PROFILE, GlassButton, GlassCard } from './components/Apg2ProfileGlass.jsx';
import {
  DesktopActionBar,
  DesktopContentGrid,
  DesktopEmptyState,
  DesktopHeader,
  DesktopKpiStrip,
  DesktopDetailShell,
  DesktopGallery,
  DesktopHero,
  DesktopHeroActions,
  DesktopInfoGrid,
  DesktopMeta,
  DesktopSectionShell,
  DesktopSectionTitle,
  DesktopSidebarCard,
  DesktopStickyActions,
  DesktopSection,
  DesktopRelated,
  DesktopDetailTabs,
  DesktopSkeleton,
  DesktopTopOverview,
  DesktopToolbar,
} from './components/DesktopUI.jsx';
import { VideoSection } from './components/VideoSection.jsx';
import { ArticleContentRenderer } from './components/ArticleContentRenderer.jsx';
import { openUrl } from './vk.js';
import { API_BASE_URL } from './constants.js';
import { logError } from './errorLogger.js';
import { apgIdentity } from './apg/index.js';
import { shareLink } from './utils/shareLink.js';
import { useLoki } from './loki/LokiProvider.jsx';
import { APG_EVENT_TYPES, trackAppEvent } from './intelligence/index.js';
import { telegramShareUrl } from '../server-shared/telegram.js';
import {
  NEWS_CATEGORIES,
  areNewsCommentsEnabled,
  filterNewsItems,
  formatNewsDate,
  getCanonicalNewsId,
  getNewsDocs,
  getNewsCategory,
  getNewsCategoryLabel,
  getNewsDate,
  getNewsImage,
  getNewsLinks,
  getNewsPhotoItems,
  getNewsPhotos,
  getNewsReactionsTotal,
  getNewsStats,
  getNewsText,
  getNewsTitle,
  getNewsUrl,
  getNewsVideos,
  getNewsLegacyIds,
  getReadingMinutes,
  getNewsViews,
  hasNewsVideo,
  isSameNews,
  isFreshNews,
  sortNewsItems,
} from './newsUtils.js';

const REACTIONS = ['👍', '❤️', '🔥', '👏', '🎉', '🤔'];
const COMMENT_SORTS = [
  { id: 'new', label: 'Новые' },
  { id: 'popular', label: 'Популярные' },
  { id: 'useful', label: 'Полезные' },
];

const newsFilterPresets = [
  { id: 'new', label: 'Новые' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'popular', label: 'Популярные' },
  { id: 'all_time', label: 'Все' },
];

const desktopSortOptions = [
  { id: 'new', label: 'Новые' },
  { id: 'popular', label: 'Популярные' },
  { id: 'discussed', label: 'Обсуждаемые' },
  { id: 'video', label: 'Видео' },
];

const desktopPeriodOptions = [
  { id: 'all_time', label: 'Всё время' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
];

const inputStyle = {
  width: '100%',
  height: 48,
  borderRadius: 20,
  border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.26)',
  background: 'rgba(var(--apg2-glass-a,255,255,255),0.22)',
  color: APG2_PROFILE.text,
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 720,
  padding: '0 16px',
  boxSizing: 'border-box',
};

const horizontalSnapTrack = {
  display: 'flex',
  overflowX: 'auto',
  overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
  scrollSnapType: 'x mandatory',
  scrollBehavior: 'smooth',
  overscrollBehaviorX: 'contain',
  touchAction: 'pan-x',
  scrollbarWidth: 'none',
};

const horizontalSnapItem = {
  scrollSnapAlign: 'start',
  scrollSnapStop: 'always',
};

function getNewsDeepLink(item) {
  const id = getCanonicalNewsId(item);
  return shareLink('news', id);
}

function arrayOfIds(...values) {
  return values.flatMap(value => {
    if (Array.isArray(value)) return value;
    if (value) return [value];
    return [];
  }).filter(Boolean).map(value => String(value));
}

function buildNewsLokiContext(item) {
  const id = getCanonicalNewsId(item);
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  return {
    type: 'news',
    newsId: id,
    title,
    article: {
      id,
      title,
      text,
      summary: String(item?.summary || item?.subtitle || '').trim(),
      category: getNewsCategory(item),
      categoryLabel: getNewsCategoryLabel(item),
      source: String(item?.source || 'apg'),
      sourceName: String(item?.sourceName || ''),
      url: getNewsDeepLink(item),
      date: getNewsDate(item)?.toISOString?.() || null,
      readingMinutes: getReadingMinutes(item),
      partnerId: item?.partnerId || '',
      expertId: item?.expertId || '',
      eventId: item?.eventId || '',
    },
    partnerIds: arrayOfIds(item?.partnerIds, item?.partnerId, item?.relatedPartnerIds, item?.linkedPartnerIds),
    expertIds: arrayOfIds(item?.expertIds, item?.expertId, item?.relatedExpertIds, item?.linkedExpertIds),
    eventIds: arrayOfIds(item?.eventIds, item?.eventId, item?.relatedEventIds, item?.linkedEventIds),
  };
}

function getSmartBadges(item) {
  const badges = [];
  const category = getNewsCategory(item);
  const date = getNewsDate(item);
  const today = date && new Date().toDateString() === date.toDateString();
  if (item?.isUrgent || (item?.priority ?? 0) >= 9) badges.push(['🔥', 'Важно']);
  if (item?.pinned || item?.isPinned) badges.push(['📌', 'Закреплено']);
  if (isFreshNews(item)) badges.push(['🆕', 'Новое']);
  if (category === 'partners') badges.push(['🎁', 'Партнёр АПГ']);
  if (category === 'updates') badges.push(['🤖', 'Обновление АПГ']);
  if (category === 'events' || today) badges.push(['📅', today ? 'Сегодня' : 'Событие']);
  return badges.slice(0, 3);
}

export async function shareNewsItem(item, onToast) {
  const title = getNewsTitle(item);
  const url = getNewsDeepLink(item);
  try {
    if (navigator.share) {
      await navigator.share({ title, text: title, url });
    } else {
      await navigator.clipboard?.writeText(url);
      onToast?.('Ссылка на новость скопирована.', 'success');
    }
  } catch (e) {
    if (e?.name !== 'AbortError') {
      logError(e, 'NewsPage.cardShare');
      onToast?.('Не удалось поделиться новостью.', 'error');
    }
  }
}

async function requestNewsEngagement(action, payload = {}) {
  const response = await fetch(`${API_BASE_URL}/api/news-engagement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
    keepalive: true,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || 'Не удалось сохранить активность новости.');
  }
  return data;
}

function getCommentBadge(comment) {
  const role = String(comment?.authorRole || comment?.userRole || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return ['🛠', 'Администрация АПГ'];
  if (role === 'partner') return ['🤝', 'Партнёр'];
  if (role === 'expert') return ['🎓', 'Эксперт'];
  return null;
}

function sortDiscussionComments(comments, sort) {
  return [...comments].sort((a, b) => {
    const pinDelta = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
    if (pinDelta) return pinDelta;
    const usefulDelta = Number(Boolean(b.isUseful)) - Number(Boolean(a.isUseful));
    if (usefulDelta) return usefulDelta;
    if (sort === 'popular' || sort === 'useful') {
      const likeDelta = (Number(b.likes) || 0) - (Number(a.likes) || 0);
      if (likeDelta) return likeDelta;
    }
    const at = Number(new Date(a.createdAt || 0));
    const bt = Number(new Date(b.createdAt || 0));
    return bt - at;
  });
}

function getNewsArticleScrollRoot() {
  return document.querySelector('[data-apg-scroll-root="news-article"]');
}

function blurActiveComposer(ref) {
  ref.current?.blur?.();
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

function restoreNewsArticleScroll(scrollTop) {
  if (!Number.isFinite(scrollTop)) return;
  const restore = () => {
    const root = getNewsArticleScrollRoot();
    if (root) root.scrollTop = scrollTop;
  };
  requestAnimationFrame(restore);
  window.setTimeout(restore, 80);
}

function NewsImage({ item, height = 210, radius = 28, mode = 'card', onOpen, children }) {
  const photo = getNewsPhotoItems(item)[0] || { url: getNewsImage(item) };
  const image = photo?.url || '';
  const ratio = photo?.width && photo?.height ? photo.width / photo.height : null;
  const isTall = ratio && ratio < 0.82;
  const isVk = item?.source === 'vk';
  const fit = mode === 'card' && !isTall && !isVk ? 'cover' : 'contain';
  const handleImageError = (e, layer) => {
    e.currentTarget.style.display = 'none';
    logError(new Error(`News image failed: ${image}`), `NewsPage.image.${layer}.${item?.id || item?.externalId || 'unknown'}`);
  };
  return (
    <div
      onClick={onOpen}
      style={{ position: 'relative', height, borderRadius: radius, overflow: 'hidden', background: 'radial-gradient(circle at 24% 18%, rgba(215,184,106,0.22), transparent 38%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.30), rgba(var(--apg2-glass-a,255,255,255),0.14))', cursor: onOpen ? 'zoom-in' : 'inherit' }}
    >
      {image && (
        <>
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={e => handleImageError(e, 'backdrop')}
            style={{ position: 'absolute', inset: -18, width: 'calc(100% + 36px)', height: 'calc(100% + 36px)', objectFit: 'cover', filter: 'blur(22px) saturate(1.12) brightness(0.62)' }}
          />
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={e => handleImageError(e, 'main')}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, filter: 'saturate(1.07) contrast(1.02)' }}
          />
        </>
      )}
      {!image && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: APG2_PROFILE.gold, fontSize: 42 }}>📰</div>}
      <div style={{ position: 'absolute', inset: 0, background: mode === 'article' ? 'linear-gradient(180deg, rgba(7,7,9,0.02), rgba(7,7,9,0.12) 52%, rgba(7,7,9,0.38))' : 'linear-gradient(180deg, rgba(7,7,9,0.02), rgba(7,7,9,0.30) 38%, rgba(7,7,9,0.82))' }} />
      {hasNewsVideo(item) && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 58, height: 58, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(8,8,10,0.52)', border: '1px solid rgba(255,255,255,0.28)', color: '#FFF8E9', fontSize: 23, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 46px rgba(0,0,0,0.28)' }}>▶</div>
      )}
      {children}
    </div>
  );
}

function Lightbox({ photos = [], initial = 0, onClose }) {
  const [idx, setIdx] = useState(initial);
  const [zoom, setZoom] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const safePhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const safeIdx = Math.min(idx, Math.max(0, safePhotos.length - 1));
  const go = (dir) => {
    setZoom(false);
    setIdx(current => (current + dir + safePhotos.length) % safePhotos.length);
  };
  if (!safePhotos.length) return null;
  return (
    <div data-apg-pull-disabled="true" style={{ position: 'fixed', inset: 0, zIndex: 15000, background: 'rgba(3,3,5,0.94)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'grid', gridTemplateRows: 'auto 1fr auto', padding: 'calc(var(--safe-top, 0px) + 12px) 14px calc(18px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{safeIdx + 1} / {safePhotos.length}</span>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 22 }}>×</button>
      </div>
      <div
        data-apg-scroll-root="news-lightbox"
        data-apg-gesture-ignore="true"
        onDoubleClick={() => setZoom(v => !v)}
        onTouchStart={e => {
          startXRef.current = e.touches[0].clientX;
          startYRef.current = e.touches[0].clientY;
        }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - startXRef.current;
          const dy = e.changedTouches[0].clientY - startYRef.current;
          if (dy > 86 && Math.abs(dx) < 70) {
            onClose?.();
            return;
          }
          if (Math.abs(dx) > 52) go(dx > 0 ? -1 : 1);
        }}
        style={{ minHeight: 0, overflow: zoom ? 'auto' : 'hidden', display: 'grid', placeItems: 'center', touchAction: zoom ? 'pan-x pan-y' : 'pan-y' }}
      >
        <img src={safePhotos[safeIdx]} alt="" style={{ maxWidth: zoom ? 'none' : '100%', maxHeight: zoom ? 'none' : '100%', width: zoom ? '165%' : 'auto', height: 'auto', objectFit: 'contain', borderRadius: zoom ? 0 : 20, transition: 'width 220ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1))' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {safePhotos.length > 1 && <button type="button" onClick={() => go(-1)} style={{ width: 54, height: 46, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 24 }}>‹</button>}
        <button type="button" onClick={() => setZoom(v => !v)} style={{ minWidth: 118, height: 46, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontWeight: 820 }}>{zoom ? 'Уместить' : 'Увеличить'}</button>
        {safePhotos.length > 1 && <button type="button" onClick={() => go(1)} style={{ width: 54, height: 46, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 24 }}>›</button>}
      </div>
    </div>
  );
}

function PhotoCarousel({ photos = [], onOpen }) {
  const [idx, setIdx] = useState(0);
  const safePhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const safeIdx = Math.min(idx, Math.max(0, safePhotos.length - 1));

  if (safePhotos.length <= 1) return null;

  const go = (dir) => setIdx(current => (current + dir + safePhotos.length) % safePhotos.length);

  return (
    <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: 12, overflow: 'hidden' }}>
      <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.22)' }}>
        <button type="button" onClick={() => onOpen?.(safeIdx)} style={{ width: '100%', padding: 0, border: 'none', background: '#08080a', display: 'block', cursor: 'zoom-in' }}>
          <img src={safePhotos[safeIdx]} alt="" loading="lazy" style={{ width: '100%', maxHeight: 430, objectFit: 'contain', display: 'block' }} />
        </button>
        <button type="button" onClick={() => go(-1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(8,8,10,0.52)', color: '#fff', fontSize: 22 }}>‹</button>
        <button type="button" onClick={() => go(1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(8,8,10,0.52)', color: '#fff', fontSize: 22 }}>›</button>
        <div style={{ position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)', padding: '6px 10px', borderRadius: 999, background: 'rgba(8,8,10,0.54)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 11, fontWeight: 780 }}>{safeIdx + 1} / {safePhotos.length}</div>
      </div>
      <div data-apg-gesture-ignore="true" style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 10, paddingBottom: 2, touchAction: 'pan-x' }}>
        {safePhotos.map((photo, index) => (
          <button key={`${photo}-${index}`} type="button" onClick={() => setIdx(index)} style={{ flex: '0 0 58px', height: 50, borderRadius: 14, padding: 0, overflow: 'hidden', border: index === safeIdx ? '2px solid rgba(215,184,106,0.72)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.15)', background: 'transparent' }}>
            <img src={photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function SocialLinksBlock({ links = [] }) {
  const safeLinks = Array.isArray(links) ? links.filter(link => link?.url) : [];
  if (!safeLinks.length) return null;
  const iconByType = {
    vk: 'VK',
    telegram: 'TG',
    youtube: '▶',
    dzen: 'Дз',
    instagram: 'IG',
    tiktok: 'TT',
    ok: 'OK',
    facebook: 'Fb',
    x: 'X',
    threads: '@',
    site: '⌁',
    other: '↗',
  };
  return (
    <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: 16 }}>
      <div style={{ color: APG2_PROFILE.text, fontSize: 17, fontWeight: 900, marginBottom: 12 }}>Социальные сети и ссылки</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 9 }}>
        {safeLinks.map((link, index) => (
          <GlassButton key={`${link.url}-${index}`} onClick={() => openUrl(link.url)} style={{ minHeight: 42, borderRadius: 18 }}>
            {iconByType[link.type] || '↗'} {link.label || 'Открыть'}
          </GlassButton>
        ))}
      </div>
    </GlassCard>
  );
}

function SourceBadge({ item }) {
  const source = item?.source;
  const sourceName = item?.sourceName || (source === 'vk' ? 'ВКонтакте' : null);
  if (!sourceName || source === 'apg') return null;
  const icon = source === 'vk' ? 'VK' : source === 'telegram' ? 'TG' : '↗';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 10, background: 'rgba(247,241,230,0.05)', border: '1px solid rgba(247,241,230,0.09)' }}>
      <span style={{ fontSize: 10, fontWeight: 860, color: APG2_PROFILE.textMuted }}>{icon}</span>
      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 680 }}>Источник: <span style={{ color: APG2_PROFILE.textSoft, fontWeight: 760 }}>{sourceName}</span></span>
    </div>
  );
}

function LokiArticleBanner({ wordCount, onOpenLoki }) {
  if (wordCount < 260 || !onOpenLoki) return null;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return (
    <div style={{ marginTop: 20, borderRadius: 18, padding: '12px 14px', background: 'rgba(215,184,106,0.06)', border: '1px solid rgba(215,184,106,0.15)', display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 10, alignItems: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: 13, background: 'rgba(215,184,106,0.12)', border: '1px solid rgba(215,184,106,0.20)', display: 'grid', placeItems: 'center', fontSize: 17 }}>◌</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 860, lineHeight: '16px' }}>Локи</div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '17px', fontWeight: 560 }}>Статья на {minutes} мин. Кратко перескажу и найду связанные материалы</div>
      </div>
      <button type="button" onClick={onOpenLoki} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 12, border: '1px solid rgba(215,184,106,0.28)', background: 'rgba(215,184,106,0.10)', color: APG2_PROFILE.gold, fontSize: 11.5, fontWeight: 820, fontFamily: 'inherit', cursor: 'pointer' }}>Спросить</button>
    </div>
  );
}

function ContentBlocks({ blocks = [] }) {
  const safeBlocks = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (!safeBlocks.length) return null;
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      {safeBlocks.map((block, index) => {
        const type = block.type || 'note';
        if (type === 'divider') {
          return <div key={index} style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(215,184,106,0.46), transparent)', margin: '8px 10%' }} />;
        }
        if (type === 'button') {
          return (
            <GlassButton key={index} tone="gold" onClick={() => block.url && openUrl(block.url)} style={{ minHeight: 48, borderRadius: 20, color: '#17120a' }}>
              {block.text || block.title || 'Открыть'}
            </GlassButton>
          );
        }
        const tone = type === 'warning'
          ? { border: '1px solid rgba(248,113,113,0.30)', background: 'rgba(248,113,113,0.09)', mark: '!' }
          : type === 'tip'
            ? { border: '1px solid rgba(215,184,106,0.30)', background: 'rgba(215,184,106,0.10)', mark: '✓' }
            : type === 'faq'
              ? { border: '1px solid rgba(96,165,250,0.30)', background: 'rgba(96,165,250,0.08)', mark: '?' }
              : { border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', mark: '"' };
        return (
          <GlassCard key={index} style={{ borderRadius: 26, padding: 16, border: tone.border, background: tone.background }}>
            <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12, alignItems: 'start' }}>
              <div style={{ width: 34, height: 34, borderRadius: 14, display: 'grid', placeItems: 'center', color: APG2_PROFILE.gold, background: 'rgba(8,8,10,0.22)', fontWeight: 950 }}>{tone.mark}</div>
              <div style={{ minWidth: 0 }}>
                {block.title && <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 900, marginBottom: block.text ? 6 : 0 }}>{block.title}</div>}
                {block.text && <RichText color={APG2_PROFILE.text} fontSize={14.5} lineHeight="23px">{block.text}</RichText>}
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

function NewsMeta({ item, compact = false }) {
  const stats = getNewsStats(item);
  const date = getNewsDate(item);
  const source = item?.sourceName || (item?.source === 'vk' ? 'ВКонтакте' : 'АПГ');
  const reactions = getNewsReactionsTotal(item) || stats.likes;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: APG2_PROFILE.textMuted, fontSize: compact ? 10.5 : 11.5, lineHeight: '15px', fontWeight: 720 }}>
      <span>{formatNewsDate(item)}</span>
      {date && <span>{date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>}
      <span>{source}</span>
      <span>⏱ {getReadingMinutes(item)} мин</span>
      <span>{stats.views} просмотров</span>
      {(reactions > 0 || stats.comments > 0 || stats.reposts > 0) && (
        <span>♥ {reactions} · 💬 {stats.comments} · ↗ {stats.reposts}</span>
      )}
      {isFreshNews(item) && <span style={{ color: APG2_PROFILE.gold }}>Новое</span>}
    </div>
  );
}

function SharePanel({ item, onToast, onShare }) {
  const url = getNewsDeepLink(item);
  const title = getNewsTitle(item);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const copy = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
      } else {
        await navigator.clipboard?.writeText(url);
        onToast?.('Ссылка скопирована.', 'success');
      }
      onShare?.('copy');
    } catch (e) {
      if (e?.name !== 'AbortError') {
        logError(e, 'NewsPage.share');
        onToast?.('Не удалось поделиться ссылкой.', 'error');
      }
    }
  };
  const items = [
    ['Telegram', telegramShareUrl({ url, text: title })],
    ['VK', `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`],
    ['WhatsApp', `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`],
  ];
  return (
    <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: 16 }}>
      <div style={{ color: APG2_PROFILE.text, fontSize: 17, fontWeight: 900, marginBottom: 12 }}>Поделиться</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
        {items.map(([label, href]) => (
          <GlassButton key={label} onClick={() => { onShare?.(label.toLowerCase()); openUrl(href); }} style={{ minHeight: 42, borderRadius: 18 }}>{label}</GlassButton>
        ))}
        <GlassButton onClick={copy} tone="gold" style={{ minHeight: 42, borderRadius: 18, color: '#17120a' }}>Скопировать</GlassButton>
      </div>
    </GlassCard>
  );
}

function ArticleHeader({ item }) {
  const title = getNewsTitle(item);
  const subtitle = String(item?.subtitle || '').trim();
  const summary = String(item?.summary || '').trim();
  const date = getNewsDate(item);
  const badges = getSmartBadges(item);

  return (
    <div style={{ paddingTop: 18 }}>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(215,184,106,0.12)', border: '1px solid rgba(215,184,106,0.22)', color: APG2_PROFILE.gold, fontSize: 11.5, fontWeight: 860 }}>{getNewsCategoryLabel(item)}</span>
        {badges.map(([emoji, label]) => (
          <span key={`${emoji}-${label}`} style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(247,241,230,0.07)', border: '1px solid rgba(247,241,230,0.11)', color: APG2_PROFILE.textSoft, fontSize: 11, fontWeight: 760 }}>{emoji} {label}</span>
        ))}
      </div>
      <h1 style={{ margin: '0 0 12px', color: APG2_PROFILE.text, fontSize: 'clamp(24px, 5.5vw, 38px)', lineHeight: 1.12, fontWeight: 950, letterSpacing: '-0.02em' }}>{title}</h1>
      {subtitle && (
        <div style={{ color: APG2_PROFILE.gold, fontSize: 17, lineHeight: '25px', fontWeight: 800, marginBottom: 10 }}>{subtitle}</div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 660, lineHeight: '16px', marginBottom: summary ? 14 : 0 }}>
        {date && <span>{date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
        {date && <span style={{ opacity: 0.6 }}>·</span>}
        {date && <span>{date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>}
        <span style={{ opacity: 0.6 }}>·</span>
        <span>⏱ {getReadingMinutes(item)} мин</span>
      </div>
      {summary && (
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 16, lineHeight: '26px', fontWeight: 480 }}>{summary}</div>
      )}
    </div>
  );
}

function ArticleActions({ item, saved, later, reaction, subscriptions, onReact, onSave, onReadLater, onSubscribe, onShare, onToast }) {
  const categoryId = getNewsCategory(item);
  const categoryLabel = getNewsCategoryLabel(item);
  const partnerId = item?.partnerId ? String(item.partnerId) : '';
  const expertId = item?.expertId ? String(item.expertId) : '';
  const isCategorySubscribed = Array.isArray(subscriptions?.categories) && subscriptions.categories.map(String).includes(categoryId);
  const isPartnerSubscribed = partnerId && Array.isArray(subscriptions?.partners) && subscriptions.partners.map(String).includes(partnerId);
  const isExpertSubscribed = expertId && Array.isArray(subscriptions?.experts) && subscriptions.experts.map(String).includes(expertId);
  return (
    <GlassCard style={{ marginTop: 18, borderRadius: 30, padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 9 }}>
        <GlassButton onClick={() => onSave?.(item)} tone={saved ? 'gold' : undefined} style={{ minHeight: 44, borderRadius: 18, color: saved ? '#17120a' : APG2_PROFILE.text }}>⭐ {saved ? 'Сохранено' : 'Сохранить'}</GlassButton>
        <GlassButton onClick={() => onReadLater?.(item)} tone={later ? 'gold' : undefined} style={{ minHeight: 44, borderRadius: 18, color: later ? '#17120a' : APG2_PROFILE.text }}>{later ? 'В списке позже' : 'Прочитать позже'}</GlassButton>
        <GlassButton onClick={async () => { await shareNewsItem(item, onToast); onShare?.('native'); }} style={{ minHeight: 44, borderRadius: 18 }}>📤 Поделиться</GlassButton>
        <GlassButton onClick={() => onSubscribe?.({ type: 'category', targetId: categoryId, label: categoryLabel })} tone={isCategorySubscribed ? 'gold' : undefined} style={{ minHeight: 44, borderRadius: 18, color: isCategorySubscribed ? '#17120a' : APG2_PROFILE.text }}>{isCategorySubscribed ? '🔔 Категория' : '🔔 Подписаться'}</GlassButton>
        {partnerId && <GlassButton onClick={() => onSubscribe?.({ type: 'partner', targetId: partnerId, label: item?.partnerName || 'партнёр' })} tone={isPartnerSubscribed ? 'gold' : undefined} style={{ minHeight: 44, borderRadius: 18, color: isPartnerSubscribed ? '#17120a' : APG2_PROFILE.text }}>{isPartnerSubscribed ? '🤝 Партнёр' : '🤝 На партнёра'}</GlassButton>}
        {expertId && <GlassButton onClick={() => onSubscribe?.({ type: 'expert', targetId: expertId, label: item?.expertName || 'эксперт' })} tone={isExpertSubscribed ? 'gold' : undefined} style={{ minHeight: 44, borderRadius: 18, color: isExpertSubscribed ? '#17120a' : APG2_PROFILE.text }}>{isExpertSubscribed ? '🎓 Эксперт' : '🎓 На эксперта'}</GlassButton>}
      </div>
      <div>
        <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900, marginBottom: 10 }}>Реакция</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {REACTIONS.map(value => (
            <button key={value} type="button" onClick={() => onReact?.(item, value)} style={{ width: 48, height: 44, borderRadius: 18, border: reaction === value ? '1px solid rgba(215,184,106,0.52)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: reaction === value ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)', fontSize: 20, cursor: 'pointer' }}>
              {value}
            </button>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

async function requestNewsComments(path, options = {}) {
  const token = apgIdentity.getCurrentIdentity() ? await apgIdentity.getSessionToken().catch(() => '') : '';
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Firebase-Auth': token } : {}), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || 'Не удалось выполнить действие с комментарием.');
  }
  return data;
}

function CommentRow({ comment, user, onDelete, onLike, onEdit, onReply, onPin, onUseful, onBlock, compact = false }) {
  const name = comment.userName || 'Участник АПГ';
  const avatar = comment.userAvatar || '';
  const userRole = String(user?.role || '');
  const canModerate = ['admin', 'owner'].includes(userRole);
  const canDelete = user?.id && (String(user.id) === String(comment.userId) || canModerate);
  const canEdit = user?.id && String(user.id) === String(comment.userId);
  const liked = user?.id && Array.isArray(comment.likedBy) && comment.likedBy.map(String).includes(String(user.id));
  const badge = getCommentBadge(comment);
  const date = comment.createdAt ? new Date(comment.createdAt) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '34px 1fr' : '42px 1fr', gap: compact ? 9 : 11 }}>
      <div style={{ width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: compact ? 13 : 16, overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.09)', display: 'grid', placeItems: 'center', color: APG2_PROFILE.gold, fontWeight: 900 }}>
        {avatar ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <div style={{ minWidth: 0, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: compact ? 12.5 : 13.5, fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            {badge && <span style={{ padding: '3px 7px', borderRadius: 999, background: 'rgba(215,184,106,0.13)', border: '1px solid rgba(215,184,106,0.22)', color: APG2_PROFILE.gold, fontSize: 10, lineHeight: '13px', fontWeight: 850 }}>{badge[0]} {badge[1]}</span>}
          </div>
          {date && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, fontWeight: 680 }}>{date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>}
        </div>
        {(comment.isPinned || comment.isUseful) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {comment.isPinned && <span style={{ padding: '5px 8px', borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', color: APG2_PROFILE.textSoft, fontSize: 10.5, fontWeight: 820 }}>📌 Закреплено</span>}
            {comment.isUseful && <span style={{ padding: '5px 8px', borderRadius: 999, background: 'rgba(215,184,106,0.13)', border: '1px solid rgba(215,184,106,0.22)', color: APG2_PROFILE.gold, fontSize: 10.5, fontWeight: 880 }}>⭐ Полезный ответ</span>}
          </div>
        )}
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: compact ? 13 : 13.5, lineHeight: compact ? '19px' : '20px', marginTop: 4, whiteSpace: 'pre-wrap' }}>{comment.text}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onLike(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: liked ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 820 }}>❤️ {Number(comment.likes || 0)}</button>
          {!compact && <button type="button" onClick={() => onReply(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>Ответить</button>}
          {canEdit && <button type="button" onClick={() => onEdit(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>Изменить</button>}
          {canDelete && <button type="button" onClick={() => onDelete(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>Удалить</button>}
          {canModerate && <button type="button" onClick={() => onUseful(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>{comment.isUseful ? 'Убрать пользу' : 'Полезный'}</button>}
          {canModerate && !compact && <button type="button" onClick={() => onPin(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>{comment.isPinned ? 'Открепить' : 'Закрепить'}</button>}
          {canModerate && <button type="button" onClick={() => onBlock(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: 'rgba(255,119,92,0.88)', fontSize: 12, fontWeight: 760 }}>Блок</button>}
        </div>
      </div>
    </div>
  );
}

export function CommentsPanel({ item, user, onToast }) {
  const newsId = getCanonicalNewsId(item);
  const legacyIds = useMemo(() => getNewsLegacyIds(item).filter(id => id !== newsId), [item, newsId]);
  const legacyKey = legacyIds.join('|');
  const panelRef = useRef(null);
  const composerRef = useRef(null);
  const [comments, setComments] = useState([]);
  const [sort, setSort] = useState('new');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const draftKey = useMemo(() => newsId ? `apg_news_comment_draft_${newsId}` : '', [newsId]);

  const apiUser = useMemo(() => ({
    id: String(user?.id || ''),
    name: user?.name || user?.first_name || user?.email || 'Участник АПГ',
    avatar: user?.avatar || user?.photo_100 || user?.photo || '',
    role: user?.role || user?.userRole || '',
  }), [user]);

  const load = async () => {
    if (!newsId) return;
    setLoading(true);
    setError('');
    try {
      const aliasQuery = legacyIds.length ? `&legacyIds=${encodeURIComponent(legacyIds.join(','))}` : '';
      const data = await requestNewsComments(`/api/news-comments?newsId=${encodeURIComponent(newsId)}${aliasQuery}`);
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (e) {
      logError(e, 'NewsPage.comments.load');
      setError('Не удалось загрузить комментарии. Проверьте подключение и попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [newsId, legacyKey]);
  useEffect(() => {
    if (!draftKey) return;
    setText(localStorage.getItem(draftKey) || '');
    setEditing(null);
    setReplyTo(null);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || editing) return;
    const value = text.trim();
    if (value) localStorage.setItem(draftKey, text);
    else localStorage.removeItem(draftKey);
  }, [draftKey, editing, text]);

  const sorted = useMemo(() => sortDiscussionComments(comments, sort).filter(comment => !comment.parentId), [comments, sort]);
  const discussionHot = comments.length >= 6 || comments.some(comment => Number(comment.likes || 0) >= 5);

  const repliesByParent = useMemo(() => comments.reduce((acc, comment) => {
    if (!comment.parentId) return acc;
    const key = String(comment.parentId);
    acc[key] = [...(acc[key] || []), comment].sort((a, b) => Number(new Date(a.createdAt || 0)) - Number(new Date(b.createdAt || 0)));
    return acc;
  }, {}), [comments]);

  const submit = async () => {
    const value = text.trim();
    if (!value || !newsId) return;
    if (!user || String(user.id).startsWith('guest_')) {
      onToast?.('Авторизуйтесь, чтобы оставить комментарий.', 'info');
      return;
    }
    const articleScrollTop = getNewsArticleScrollRoot()?.scrollTop ?? 0;
    setSending(true);
    setError('');
    try {
      if (editing) {
        const data = await requestNewsComments('/api/news-comments', {
          method: 'POST',
          body: JSON.stringify({ action: 'update', commentId: editing.id, text: value, user: apiUser }),
        });
        setComments(prev => prev.map(comment => comment.id === editing.id ? data.comment : comment));
        trackAppEvent('news:comment_update', {
          type: APG_EVENT_TYPES.NEWS_COMMENTED,
          user,
          entityType: 'news',
          entityId: newsId,
          payload: { newsId, commentId: editing.id, title: getNewsTitle(item) },
        });
        setEditing(null);
        onToast?.('Комментарий обновлён.', 'success');
      } else {
        const data = await requestNewsComments('/api/news-comments', {
          method: 'POST',
          body: JSON.stringify({ action: 'create', newsId, parentId: replyTo?.id || null, text: value, user: apiUser }),
        });
        setComments(prev => [data.comment, ...prev]);
        trackAppEvent(replyTo ? 'news:comment_reply' : 'news:comment_create', {
          type: APG_EVENT_TYPES.NEWS_COMMENTED,
          user,
          entityType: 'news',
          entityId: newsId,
          payload: { newsId, commentId: data.comment?.id || '', parentId: replyTo?.id || null, title: getNewsTitle(item) },
        });
        onToast?.(replyTo ? 'Ответ опубликован.' : 'Комментарий опубликован.', 'success');
      }
      setText('');
      setReplyTo(null);
      blurActiveComposer(composerRef);
      restoreNewsArticleScroll(articleScrollTop);
      if (draftKey) localStorage.removeItem(draftKey);
    } catch (e) {
      logError(e, 'NewsPage.comments.submit');
      setError(e?.message || 'Комментарий не размещён. Попробуйте ещё раз.');
      onToast?.('Комментарий не размещён.', 'error');
    } finally {
      setSending(false);
    }
  };

  const like = async (comment) => {
    if (user?.id && Array.isArray(comment.likedBy) && comment.likedBy.map(String).includes(String(user.id))) {
      onToast?.('Вы уже отметили этот комментарий.', 'info');
      return;
    }
    try {
      setComments(prev => prev.map(v => v.id === comment.id ? { ...v, likes: Number(v.likes || 0) + 1, likedBy: [...(Array.isArray(v.likedBy) ? v.likedBy : []), String(user?.id || '')].filter(Boolean) } : v));
      const data = await requestNewsComments('/api/news-comments', {
        method: 'POST',
        body: JSON.stringify({ action: 'like', commentId: comment.id, user: apiUser }),
      });
      setComments(prev => prev.map(v => v.id === comment.id ? { ...v, likes: Number(data.likes ?? v.likes ?? 0), likedBy: data.likedBy || v.likedBy } : v));
      trackAppEvent('news:comment_like', {
        type: APG_EVENT_TYPES.COMMENT_LIKED,
        user,
        entityType: 'comment',
        entityId: comment.id,
        payload: { newsId, commentId: comment.id, title: getNewsTitle(item) },
      });
    } catch (e) {
      logError(e, 'NewsPage.comments.like');
      onToast?.(e?.message || 'Не удалось поставить реакцию.', 'error');
      await load();
    }
  };

  const remove = async (comment) => {
    try {
      await requestNewsComments('/api/news-comments', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', commentId: comment.id, user: apiUser }),
      });
      setComments(prev => prev.filter(v => v.id !== comment.id));
      onToast?.('Комментарий удалён.', 'success');
    } catch (e) {
      logError(e, 'NewsPage.comments.delete');
      onToast?.(e?.message || 'Не удалось удалить комментарий.', 'error');
    }
  };

  const moderate = async (comment, action, label) => {
    try {
      const data = await requestNewsComments('/api/news-comments', {
        method: 'POST',
        body: JSON.stringify({ action, commentId: comment.id, user: apiUser }),
      });
      if (data.comment) {
        setComments(prev => prev.map(v => v.id === comment.id ? data.comment : v));
      } else {
        await load();
      }
      onToast?.(label, 'success');
    } catch (e) {
      logError(e, `NewsPage.comments.${action}`);
      onToast?.(e?.message || 'Не удалось выполнить действие модерации.', 'error');
    }
  };

  const startEdit = (comment) => {
    setEditing(comment);
    setReplyTo(null);
    setText(comment.text || '');
  };

  const startReply = (comment) => {
    setEditing(null);
    setReplyTo(comment);
    setText('');
  };

  const cancelComposerMode = () => {
    setEditing(null);
    setReplyTo(null);
    setText('');
  };

  return (
    <GlassCard
      ref={panelRef}
      data-apg-pull-disabled="true"
      style={{ marginTop: 18, borderRadius: 30, padding: 16 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 920 }}>Комментарии</div>
          {comments.length > 0 && <span style={{ color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 800 }}>{comments.length}</span>}
          {discussionHot && <span style={{ padding: '6px 9px', borderRadius: 999, background: 'rgba(255,119,92,0.12)', border: '1px solid rgba(255,119,92,0.24)', color: '#ffb19f', fontSize: 10.5, fontWeight: 900 }}>🔥 Сейчас обсуждают</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {COMMENT_SORTS.map(item => (
            <button key={item.id} type="button" onClick={() => setSort(item.id)} style={{ minHeight: 30, borderRadius: 999, padding: '0 10px', border: sort === item.id ? '1px solid rgba(215,184,106,0.44)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: sort === item.id ? 'rgba(215,184,106,0.16)' : 'transparent', color: sort === item.id ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 780 }}>{item.label}</button>
          ))}
        </div>
      </div>
      {user && !String(user.id || '').startsWith('guest_') ? (
        <div style={{ display: 'grid', gap: 9, marginBottom: 14 }}>
          {(replyTo || editing) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', border: '1px solid rgba(215,184,106,0.18)', background: 'rgba(215,184,106,0.08)', borderRadius: 18, padding: '9px 11px' }}>
              <span>{editing ? 'Редактирование комментария' : `Ответ для ${replyTo?.userName || 'участника'}`}</span>
              <button type="button" onClick={cancelComposerMode} style={{ border: 'none', background: 'transparent', color: APG2_PROFILE.gold, fontWeight: 840 }}>Отмена</button>
            </div>
          )}
          <textarea ref={composerRef} value={text} onChange={e => setText(e.target.value)} placeholder={editing ? 'Обновите комментарий' : replyTo ? 'Напишите ответ' : 'Напишите комментарий'} maxLength={900} style={{ ...inputStyle, minHeight: 82, height: 82, resize: 'vertical', paddingTop: 13, lineHeight: '22px' }} />
          <GlassButton onClick={submit} disabled={sending || !text.trim()} tone="gold" style={{ minHeight: 42, borderRadius: 18, color: '#17120a', opacity: sending || !text.trim() ? 0.58 : 1 }}>{sending ? 'Отправляем...' : editing ? 'Сохранить' : 'Отправить'}</GlassButton>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 9, marginBottom: 14 }}>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>Авторизуйтесь, чтобы оставить комментарий.</div>
          <GlassButton disabled tone="gold" style={{ minHeight: 42, borderRadius: 18, color: '#17120a', opacity: 0.48 }}>Отправить</GlassButton>
        </div>
      )}
      {error && (
        <div style={{ display: 'grid', gap: 8, color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', border: '1px solid rgba(255,119,92,0.24)', background: 'rgba(255,119,92,0.08)', borderRadius: 20, padding: 12, marginBottom: 14 }}>
          <span>{error}</span>
          <button type="button" onClick={load} style={{ justifySelf: 'start', border: 'none', background: 'transparent', color: APG2_PROFILE.gold, fontSize: 12.5, fontWeight: 850, padding: 0 }}>Повторить загрузку</button>
        </div>
      )}
      {loading ? (
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13 }}>Загружаем обсуждение...</div>
      ) : sorted.length ? (
        <div style={{ display: 'grid', gap: 15 }}>
          {sorted.map(comment => (
            <div key={comment.id} style={{ display: 'grid', gap: 11 }}>
              <CommentRow comment={comment} user={user} onDelete={remove} onLike={like} onEdit={startEdit} onReply={startReply} onUseful={c => moderate(c, 'toggleUseful', c.isUseful ? 'Комментарий убран из полезных.' : 'Комментарий отмечен как полезный.')} onPin={c => moderate(c, 'togglePin', c.isPinned ? 'Комментарий откреплён.' : 'Комментарий закреплён.')} onBlock={c => moderate(c, 'blockUser', 'Пользователь заблокирован для комментариев.')} />
              {!!repliesByParent[comment.id]?.length && (
                <div style={{ display: 'grid', gap: 10, marginLeft: 28, paddingLeft: 12, borderLeft: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)' }}>
                  {repliesByParent[comment.id].map(reply => (
                    <CommentRow key={reply.id} comment={reply} user={user} onDelete={remove} onLike={like} onEdit={startEdit} onReply={startReply} onUseful={c => moderate(c, 'toggleUseful', c.isUseful ? 'Комментарий убран из полезных.' : 'Комментарий отмечен как полезный.')} onPin={c => moderate(c, 'togglePin', c.isPinned ? 'Комментарий откреплён.' : 'Комментарий закреплён.')} onBlock={c => moderate(c, 'blockUser', 'Пользователь заблокирован для комментариев.')} compact />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13 }}>Комментариев пока нет. Можно быть первым.</div>
      )}
    </GlassCard>
  );
}

function NewsSkeleton() {
  const shimmer = {
    background: 'linear-gradient(90deg, rgba(var(--apg2-glass-a,255,255,255),0.06), rgba(215,184,106,0.13), rgba(var(--apg2-glass-a,255,255,255),0.06))',
    backgroundSize: '220% 100%',
    animation: 'shimmer 1.6s ease-in-out infinite',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14, alignItems: 'start' }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} style={{ ...APG2_PROFILE.glass, borderRadius: 30, overflow: 'hidden', minHeight: index === 0 ? 360 : 310 }}>
          <div style={{ height: index === 0 ? 220 : 174, ...shimmer }} />
          <div style={{ display: 'grid', gap: 12, padding: 16 }}>
            <div style={{ width: '46%', height: 12, borderRadius: 999, ...shimmer }} />
            <div style={{ width: '92%', height: 20, borderRadius: 999, ...shimmer }} />
            <div style={{ width: '72%', height: 20, borderRadius: 999, ...shimmer }} />
            <div style={{ width: '100%', height: 12, borderRadius: 999, ...shimmer }} />
            <div style={{ width: '58%', height: 12, borderRadius: 999, ...shimmer }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewsCard({ item, index = 0, onOpen = () => {}, onShare = () => {}, saved, later, compact = false }) {
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  const isLarge = !compact && index % 5 === 0;
  const badges = getSmartBadges(item);
  return (
    <div
      style={{
        ...APG2_PROFILE.glass,
        width: '100%',
        border: (item.isUrgent || (item.priority ?? 0) >= 9) ? '1px solid rgba(255,119,92,0.42)' : APG2_PROFILE.glass.border,
        borderRadius: compact ? 24 : 30,
        padding: 0,
        overflow: 'hidden',
        textAlign: 'left',
        color: APG2_PROFILE.text,
        fontFamily: 'inherit',
        animation: 'fadeInUp 420ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
        animationDelay: `${Math.min(index, 8) * 0.035}s`,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={`Открыть новость: ${title}`}
        style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', color: APG2_PROFILE.text, fontFamily: 'inherit', cursor: 'pointer' }}
      >
        <NewsImage item={item} height={compact ? 150 : isLarge ? 240 : 174} radius={compact ? 24 : 30}>
          <div style={{ position: 'absolute', left: compact ? 10 : 14, right: compact ? 10 : 14, top: compact ? 10 : 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ padding: '7px 11px', borderRadius: 999, background: 'rgba(8,8,10,0.45)', color: APG2_PROFILE.gold, border: '1px solid rgba(215,184,106,0.28)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', fontSize: 11, fontWeight: 860 }}>{getNewsCategoryLabel(item)}</span>
              {badges.map(([emoji, label]) => (
                <span key={`${emoji}-${label}`} style={{ padding: '7px 9px', borderRadius: 999, background: 'rgba(8,8,10,0.42)', border: '1px solid rgba(255,255,255,0.16)', color: '#FFF8E9', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', fontSize: 10.5, fontWeight: 850 }}>{emoji} {label}</span>
              ))}
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              {saved && <span style={{ padding: '7px 9px', borderRadius: 999, background: 'rgba(215,184,106,0.22)', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 900 }}>Сохранено</span>}
              {later && <span style={{ padding: '7px 9px', borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.14)', color: APG2_PROFILE.text, fontSize: 11, fontWeight: 850 }}>Позже</span>}
            </span>
          </div>
        </NewsImage>
        <span style={{ display: 'grid', gap: compact ? 8 : 10, padding: compact ? '13px 14px 9px' : '16px 16px 10px' }}>
          <span style={{ color: APG2_PROFILE.text, fontSize: compact ? 16 : isLarge ? 21 : 17, lineHeight: compact ? '21px' : isLarge ? '26px' : '22px', fontWeight: 920, letterSpacing: 0, display: '-webkit-box', WebkitLineClamp: compact ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</span>
          <span style={{ color: APG2_PROFILE.textSoft, fontSize: compact ? 12.5 : 13, lineHeight: compact ? '18px' : '20px', fontWeight: 620, display: '-webkit-box', WebkitLineClamp: compact ? 2 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text || 'Короткая новость АПГ. Подробнее внутри материала.'}</span>
          <NewsMeta item={item} compact />
        </span>
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: compact ? '0 14px 14px' : '0 16px 16px' }}>
        <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '16px', fontWeight: 700 }}>{getNewsPhotos(item).length > 1 ? `${getNewsPhotos(item).length} фото` : 'Материал АПГ'}</span>
        <button type="button" onClick={() => onShare(item)} aria-label={`Поделиться новостью: ${title}`} style={{ minHeight: 34, borderRadius: 999, padding: '0 12px', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 820, fontFamily: 'inherit', cursor: 'pointer' }}>Поделиться</button>
      </div>
    </div>
  );
}

export function ArticleView({
  item,
  related,
  previousItem,
  nextItem,
  onClose,
  onNavigate,
  onReact,
  onSave,
  onReadLater,
  onSubscribe,
  saved,
  later,
  reaction,
  subscriptions,
  user,
  onToast,
  onOpenLoki,
  onAskQuestion,
  desktopMode = false,
}) {
  const loki = useLoki();
  const [progress, setProgress] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showArticleTop, setShowArticleTop] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [desktopTab, setDesktopTab] = useState('content');
  const scrollRef = useRef(null);
  const lastScrollRef = useRef(0);
  const readStartRef = useRef(Date.now());
  const maxProgressRef = useRef(0);
  const completedSentRef = useRef(false);
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  const commentsDisabledByFlag = !areNewsCommentsEnabled(item);
  const url = getNewsUrl(item);
  const photos = getNewsPhotos(item);
  const videos = getNewsVideos(item);
  const links = getNewsLinks(item).filter(link => link.url && link.url !== url);
  const docs = getNewsDocs(item);
  const stats = getNewsStats(item);
  const tags = Array.isArray(item?.tags) ? item.tags.filter(Boolean) : [];
  const articleId = getCanonicalNewsId(item);
  const scrollKey = articleId ? `apg_news_scroll_${articleId}` : '';
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const completed = progress > 0.92;
  const engagementUser = useMemo(() => ({
    id: String(user?.id || localStorage.getItem('apg_guest_id') || 'guest'),
    name: user?.name || user?.first_name || user?.email || '',
    role: user?.role || '',
  }), [user]);
  const commentsContainerRef = useRef(null);
  const lokiContext = useMemo(() => buildNewsLokiContext(item), [item]);
  const openLokiForArticle = useCallback(() => {
    if (typeof loki.openContextExperience === 'function') {
      loki.openContextExperience(lokiContext);
      return;
    }
    onOpenLoki?.(lokiContext);
  }, [loki, lokiContext, onOpenLoki]);

  const sendEngagement = (action, extra = {}) => {
    if (!articleId) return;
    requestNewsEngagement(action, { newsId: articleId, user: engagementUser, ...extra })
      .catch(e => logError(e, `NewsPage.engagement.${action}`));
  };

  useEffect(() => {
    const id = articleId;
    if (!id) return;
    readStartRef.current = Date.now();
    maxProgressRef.current = 0;
    completedSentRef.current = false;
    setFeedback(null);
    trackAppEvent('news:open', {
      type: APG_EVENT_TYPES.NEWS_OPENED,
      user,
      entityType: 'news',
      entityId: id,
      payload: { newsId: id, title, category: getNewsCategory(item), source: item?.source || 'apg' },
    });
    sendEngagement('view', { source: item?.source || 'apg' });
    return () => {
      const readTimeMs = Date.now() - readStartRef.current;
      if (readTimeMs > 2200 || maxProgressRef.current > 0.18) {
        requestNewsEngagement('read', {
          newsId: id,
          user: engagementUser,
          progress: maxProgressRef.current,
          readTimeMs,
          completed: maxProgressRef.current > 0.92,
          source: item?.source || 'apg',
        }).catch(e => logError(e, 'NewsPage.engagement.read.cleanup'));
      }
    };
  }, [articleId]);

  useEffect(() => {
    if (!scrollKey) return;
    const savedTop = Number(localStorage.getItem(scrollKey) || 0);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = Number.isFinite(savedTop) ? savedTop : 0;
    });
    setProgress(0);
    setHeaderHidden(false);
    setShowArticleTop(false);
    lastScrollRef.current = Number.isFinite(savedTop) ? savedTop : 0;
  }, [scrollKey]);

  useEffect(() => {
    const nextPhoto = getNewsPhotoItems(nextItem || {})[0]?.url;
    if (!nextPhoto) return;
    const image = new Image();
    image.src = nextPhoto;
  }, [nextItem]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    const nextProgress = Math.min(1, Math.max(0, el.scrollTop / max));
    const currentTop = el.scrollTop;
    maxProgressRef.current = Math.max(maxProgressRef.current, nextProgress);
    setProgress(nextProgress);
    setShowArticleTop(currentTop > 620);
    setHeaderHidden(currentTop > 120 && currentTop > lastScrollRef.current + 4);
    if (currentTop < lastScrollRef.current - 8) setHeaderHidden(false);
    lastScrollRef.current = currentTop;
    if (scrollKey) localStorage.setItem(scrollKey, String(el.scrollTop));
    if (nextProgress > 0.92 && !completedSentRef.current) {
      completedSentRef.current = true;
      sendEngagement('read', {
        progress: nextProgress,
        readTimeMs: Date.now() - readStartRef.current,
        completed: true,
        source: item?.source || 'apg',
      });
    }
  };
  const scrollArticleTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const trackShare = (channel) => sendEngagement('share', { channel });
  const submitFeedback = (helpful) => {
    if (!user || String(user.id || '').startsWith('guest_')) {
      onToast?.('Авторизуйтесь, чтобы оценить новость.', 'info');
      return;
    }
    setFeedback(helpful);
    requestNewsEngagement('feedback', { newsId: articleId, user: engagementUser, helpful })
      .then(() => onToast?.('Спасибо, обратная связь сохранена.', 'success'))
      .catch(e => {
        setFeedback(null);
        logError(e, 'NewsPage.engagement.feedback');
        onToast?.('Не удалось сохранить оценку. Попробуйте ещё раз.', 'error');
      });
  };

  if (desktopMode) {
    const heroImage = photos[0] || getNewsPhotoItems(item)[0]?.url || getNewsImage(item) || '';
    const newsDate = getNewsDate(item);
    const activeTab = desktopTab === 'content' ? 'content' : desktopTab === 'comments' ? 'comments' : desktopTab === 'related' ? 'related' : 'content';
    const heroActions = [
      { id: 'share', icon: '↗', label: 'Поделиться', tone: 'gold', onClick: async () => { await shareNewsItem(item, onToast); trackShare('top'); } },
      saved ? { id: 'saved', icon: '★', label: 'Сохранено', onClick: () => onSave?.(item) } : { id: 'save', icon: '☆', label: 'Сохранить', onClick: () => onSave?.(item) },
      later ? { id: 'later', icon: '⏰', label: 'В отложенных', onClick: () => onReadLater?.(item) } : { id: 'add-later', icon: '🕒', label: 'В отложенные', onClick: () => onReadLater?.(item) },
      onAskQuestion && !commentsDisabledByFlag ? { id: 'message', icon: '💬', label: 'Написать', onClick: () => onAskQuestion(item) } : null,
      { id: 'loki', icon: '🤖', label: 'Loki', onClick: openLokiForArticle },
    ].filter(Boolean);
    const stickyActions = [
      { id: 'close', icon: '✕', label: 'Закрыть', tone: 'gold', onClick: onClose },
      { id: 'question', icon: '💬', label: 'Коммент.', onClick: () => setDesktopTab('comments'), disabled: commentsDisabledByFlag },
      { id: 'prev', icon: '←', label: previousItem ? 'Назад' : 'Назад', onClick: () => previousItem && onNavigate(previousItem), disabled: !previousItem },
      { id: 'next', icon: '→', label: nextItem ? 'Далее' : 'Далее', onClick: () => nextItem && onNavigate(nextItem), disabled: !nextItem },
    ];
    const kpiItems = [
      { id: 'category', label: 'Категория', value: getNewsCategoryLabel(item), icon: '🏷️' },
      newsDate ? { id: 'date', label: 'Дата', value: newsDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }), icon: '📅' } : null,
      { id: 'views', label: 'Просмотры', value: getNewsViews(item), icon: '👁️' },
      { id: 'reactions', label: 'Реакции', value: getNewsReactionsTotal(item), icon: '💬' },
      { id: 'comments', label: 'Комментарии', value: stats.comments || 0, icon: '💬' },
      item.source ? { id: 'source', label: 'Источник', value: item.source, icon: '🔗' } : null,
    ].filter(Boolean);
    const heroMetaItems = [
      { id: 'category', label: 'Категория', value: getNewsCategoryLabel(item), icon: '🏷️' },
      { id: 'author', label: 'Источник', value: item.source || 'apg', icon: '📰', onClick: item.source === 'vk' && url ? () => openUrl(url) : null },
      { id: 'reading', label: 'Чтение', value: `${Math.max(1, Math.ceil((text?.length || 0) / 1200))} мин`, icon: '⏱' },
    ].filter(Boolean);
    const relatedItems = (related || []).slice(0, 6).map(relatedItem => ({
      id: getCanonicalNewsId(relatedItem),
      title: getNewsTitle(relatedItem),
      subtitle: getNewsCategoryLabel(relatedItem),
      categoryLabel: getNewsCategory(relatedItem),
      kicker: 'Связанная новость',
      onOpen: () => onClose(relatedItem),
    }));
    const tabItems = [
      { id: 'content', label: 'Содержание' },
      { id: 'related', label: `Связанные ${related.length}` },
      { id: 'comments', label: `Комментарии${stats?.comments ? ` ${stats.comments}` : ''}` },
    ];
    const sourceLabel = item.source === 'apg' ? 'АПГ' : item.source === 'vk' ? 'VK' : item.source || 'АПГ';

    const articleShell = (
      <DesktopDetailShell
        title={title}
        onBack={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 13000,
          height: '100svh',
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehaviorY: 'contain',
        }}
        stickyActions={<DesktopStickyActions actions={stickyActions} />}
        aside={
          <>
            <DesktopSidebarCard title="Мета" subtitle="Параметры публикации">
              <DesktopMeta items={heroMetaItems} />
            </DesktopSidebarCard>
            {photos.length > 0 && (
              <DesktopSidebarCard title="Мини-галерея" subtitle="Фотографии новости">
                <DesktopGallery items={photos} onOpen={setLightboxIndex} />
              </DesktopSidebarCard>
            )}
            <DesktopSidebarCard title="Связанные" subtitle="Еще материалы">
              {relatedItems.length ? <DesktopRelated items={relatedItems} onOpen={(itemItem) => onClose(itemItem)} /> : (
                <DesktopEmptyState
                  icon="📰"
                  title="Связанных новостей пока нет"
                  text="Новые материалы появятся в ленте публикаций."
                />
              )}
            </DesktopSidebarCard>
            <DesktopSidebarCard title="Теги" subtitle="Темы публикации">
              {tags.length ? <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{tags.slice(0, 10).map(tag => <span key={tag} style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(215,184,106,0.10)', color: APG2_PROFILE.gold, border: '1px solid rgba(215,184,106,0.18)', fontSize: 11, fontWeight: 800 }}>#{tag}</span>)}</div> : <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13 }}>Теги не указаны</div>}
            </DesktopSidebarCard>
          </>
        }
      >
        <DesktopHero
          image={heroImage}
          title={title}
          subtitle={formatNewsDate(item)}
          kicker="Новость"
          status={sourceLabel}
          badges={getSmartBadges(item).map(([emoji, label]) => ({ id: String(label).toLowerCase(), label: `${emoji} ${label}` }))}
          description={text ? text.slice(0, 220) : 'Новость АПГ. Подробнее внутри материала.'}
          meta={<DesktopInfoGrid items={kpiItems} columns="repeat(3, minmax(0, 1fr))" />}
          actions={<DesktopHeroActions actions={heroActions} />}
        />
        <DesktopDetailTabs items={tabItems} activeId={activeTab} onChange={setDesktopTab} />

        {activeTab === 'content' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <ArticleContentRenderer item={item} desktop />
            <DesktopSection title="Рекомендации" subtitle="Что открыть дальше">
              {!!related.length && <DesktopRelated items={relatedItems} onOpen={(relatedItem) => onClose(relatedItem)} />}
            </DesktopSection>
          </div>
        )}

        {activeTab === 'related' && (
          <DesktopSection title="Связанные публикации" subtitle="Новости этой же темы">
            {(relatedItems.length ? (
              <DesktopRelated items={relatedItems} onOpen={(relatedItem) => onClose(relatedItem)} />
            ) : (
              <DesktopEmptyState
                icon="🧩"
                title="Связанных материалов пока нет"
                text="В этой теме пока нет дополнительных публикаций."
              />
            ))}
          </DesktopSection>
        )}

        {activeTab === 'comments' && (
          <DesktopSection title="Комментарии" subtitle="Обсуждение публикации">
            {commentsDisabledByFlag ? (
              <GlassCard style={{ borderRadius: 28, padding: 14, color: APG2_PROFILE.textMuted, fontSize: 13.5, lineHeight: '20px' }}>Комментарии отключены редакцией.</GlassCard>
            ) : (
              <CommentsPanel item={item} user={user} onToast={onToast} />
            )}
          </DesktopSection>
        )}
        <DesktopSection title="Действия с публикацией" subtitle="Оценки и сохранение">
          <ArticleActions item={item} saved={saved} later={later} reaction={reaction} subscriptions={subscriptions} onReact={onReact} onSave={onSave} onReadLater={onReadLater} onSubscribe={onSubscribe} onShare={trackShare} onToast={onToast} />
        </DesktopSection>
        <DesktopActionBar actions={[
          previousItem ? { id: 'prev', label: 'Предыдущая', onClick: () => previousItem && onNavigate(previousItem) } : null,
          nextItem ? { id: 'next', label: 'Следующая', onClick: () => nextItem && onNavigate(nextItem) } : null,
          showArticleTop ? { id: 'toTop', label: 'Наверх', onClick: scrollArticleTop } : null,
        ].filter(Boolean)} />
      </DesktopDetailShell>
    );

    const desktopLightbox = lightboxIndex !== null && (
      <Lightbox
        photos={photos}
        initial={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    );

    return createPortal(
      <>
        {articleShell}
        {desktopLightbox}
      </>,
      document.body
    );
  }

  const DIVIDER = <div style={{ margin: '24px 0', height: 1, background: 'rgba(35,32,24,0.12)' }} />;

  return (
    <div
      className="apg-news-article-shell"
      data-apg-pull-disabled="true"
      style={{ position: 'fixed', inset: 0, zIndex: 13000, background: 'rgba(18,17,15,0.72)', color: 'var(--apg-news-article-text)', animation: 'fadeIn 220ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both' }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, height: 3, width: `${progress * 100}%`, background: 'linear-gradient(90deg, #9F7932, #F4D98C, #FFF0B8)', boxShadow: '0 0 18px rgba(244,217,140,0.44)', zIndex: 2, transition: 'width 80ms linear' }} />

      <div ref={scrollRef} className="apg-news-article-scroll" data-apg-scroll-root="news-article" data-apg-pull-disabled="true" onScroll={handleScroll}>
        <div className="apg-news-article-reader">

          {/* ── nav bar ── */}
          <div className="apg-news-article-nav" style={{ transform: headerHidden ? 'translateY(calc(-100% - 2px))' : 'translateY(0)', opacity: headerHidden ? 0 : 1 }}>
            <button type="button" onClick={onClose} aria-label="Вернуться к ленте" className="apg-news-article-icon-button">←</button>
            <span className="apg-news-article-nav-title">{progress > 0.08 ? title : getNewsCategoryLabel(item)}</span>
            <button type="button" onClick={async () => { await shareNewsItem(item, onToast); trackShare('top'); }} aria-label="Поделиться новостью" className="apg-news-article-icon-button">↗</button>
          </div>

          {/* ── hero image ── */}
          <NewsImage item={item} height={300} radius={0} mode="article" onOpen={() => photos.length && setLightboxIndex(0)}>
            {(item.isPinned || item.pinned) && (
              <div style={{ position: 'absolute', left: 16, top: 16, padding: '7px 12px', borderRadius: 999, background: 'rgba(8,8,10,0.56)', border: '1px solid rgba(215,184,106,0.34)', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 900, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>📌 Закреплено</div>
            )}
          </NewsImage>

          {/* ── article head ── */}
          <div style={{ padding: '0 18px' }}>
            {item.source && item.source !== 'apg' && (
              <div style={{ paddingTop: 16 }}>
                <SourceBadge item={item} />
              </div>
            )}
            <ArticleHeader item={item} />

            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 14 }}>
                {tags.slice(0, 8).map(tag => (
                  <span key={tag} style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(215,184,106,0.10)', color: APG2_PROFILE.gold, border: '1px solid rgba(215,184,106,0.18)', fontSize: 11, fontWeight: 800 }}>#{tag}</span>
                ))}
              </div>
            )}

            <LokiArticleBanner wordCount={wordCount} onOpenLoki={openLokiForArticle} />

            {DIVIDER}

            {/* ── body text ── */}
            <RichText color="var(--apg-news-article-text)" fontSize={17} lineHeight="29px">
              {text || 'Подробный текст новости появится здесь после публикации.'}
            </RichText>
          </div>

          {/* ── content blocks ── */}
          <div style={{ padding: '0 18px' }}>
            <ContentBlocks blocks={item.contentBlocks} />
          </div>

          {/* ── photo carousel ── */}
          <div style={{ padding: '0 14px' }}>
            <PhotoCarousel photos={photos} onOpen={setLightboxIndex} />
          </div>

          {/* ── videos ── */}
          {videos.length > 0 && (
            <div style={{ padding: '16px 14px 0' }}>
              <GlassCard style={{ borderRadius: 28, padding: '6px 0 12px' }}>
                <VideoSection videos={videos} />
              </GlassCard>
            </div>
          )}

          {/* ── social links ── */}
          <div style={{ padding: '0 14px' }}>
            <SocialLinksBlock links={item.socialLinks} />
          </div>

          {/* ── attachments ── */}
          {(links.length > 0 || docs.length > 0) && (
            <div style={{ padding: '16px 14px 0' }}>
              <GlassCard style={{ borderRadius: 28, padding: 16 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900, marginBottom: 12 }}>Вложения</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {links.map((link, index) => (
                    <button key={`${link.url}-${index}`} type="button" onClick={() => openUrl(link.url)} style={{ display: 'grid', gridTemplateColumns: link.imageUrl ? '56px 1fr' : '1fr', gap: 12, alignItems: 'center', border: '1px solid rgba(247,241,230,0.10)', background: 'rgba(247,241,230,0.04)', borderRadius: 18, padding: 10, textAlign: 'left', color: APG2_PROFILE.text, fontFamily: 'inherit' }}>
                      {link.imageUrl && <img src={link.imageUrl} alt="" loading="lazy" style={{ width: 56, height: 48, borderRadius: 13, objectFit: 'cover' }} />}
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, lineHeight: '18px', fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title || link.url}</span>
                        {link.description && <span style={{ display: 'block', color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.description}</span>}
                      </span>
                    </button>
                  ))}
                  {docs.map((doc, index) => (
                    <button key={`${doc.url}-${index}`} type="button" onClick={() => openUrl(doc.url)} style={{ border: '1px solid rgba(247,241,230,0.10)', background: 'rgba(247,241,230,0.04)', borderRadius: 18, padding: 12, textAlign: 'left', color: APG2_PROFILE.text, fontFamily: 'inherit' }}>
                      <span style={{ display: 'block', fontSize: 14, lineHeight: '18px', fontWeight: 820 }}>📎 {doc.title}</span>
                      {doc.ext && <span style={{ display: 'block', color: APG2_PROFILE.textMuted, fontSize: 12, marginTop: 4 }}>{doc.ext.toUpperCase()}</span>}
                    </button>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}

          {/* ── actions ── */}
          <div style={{ padding: '24px 14px 0' }}>
            <ArticleActions item={item} saved={saved} later={later} reaction={reaction} subscriptions={subscriptions} onReact={onReact} onSave={onSave} onReadLater={onReadLater} onSubscribe={onSubscribe} onShare={trackShare} onToast={onToast} />
          </div>

          {onAskQuestion && !commentsDisabledByFlag && (
            <div style={{ padding: '12px 14px 0' }}>
              <GlassCard style={{ borderRadius: 28, padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: APG2_PROFILE.text, fontSize: 15, lineHeight: '20px', fontWeight: 900 }}>Обсудить публикацию</div>
                  <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '18px', marginTop: 3 }}>Откроется диалог с контекстом этой новости.</div>
                </div>
                <GlassButton onClick={() => onAskQuestion(item)} tone="gold" style={{ minHeight: 38, borderRadius: 17, color: '#17120a' }}>Написать</GlassButton>
              </GlassCard>
            </div>
          )}

          {/* ── feedback ── */}
          <div style={{ padding: '12px 14px 0' }}>
            <GlassCard style={{ borderRadius: 28, padding: 16 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 880, marginBottom: 5 }}>Была полезна эта новость?</div>
              <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '18px', marginBottom: 12 }}>Короткий ответ помогает редакции.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
                <GlassButton onClick={() => submitFeedback(true)} tone={feedback === true ? 'gold' : undefined} style={{ minHeight: 42, borderRadius: 18, color: feedback === true ? '#17120a' : APG2_PROFILE.text }}>👍 Да</GlassButton>
                <GlassButton onClick={() => submitFeedback(false)} tone={feedback === false ? 'gold' : undefined} style={{ minHeight: 42, borderRadius: 18, color: feedback === false ? '#17120a' : APG2_PROFILE.text }}>👎 Нет</GlassButton>
              </div>
            </GlassCard>
          </div>

          {/* ── share ── */}
          <div style={{ padding: '0 14px' }}>
            <SharePanel item={item} onToast={onToast} onShare={trackShare} />
          </div>

          {/* ── comments ── */}
          <div ref={commentsContainerRef} style={{ padding: '0 14px' }}>
            {commentsDisabledByFlag ? (
              <GlassCard style={{ marginTop: 18, borderRadius: 28, padding: 14, color: APG2_PROFILE.textMuted, fontSize: 13.5, lineHeight: '20px' }}>
                Комментарии к этой публикации отключены редакцией.
              </GlassCard>
            ) : (
              <CommentsPanel item={item} user={user} onToast={onToast} />
            )}
          </div>

          {/* ── read also ── */}
          {!!related.length && (
            <div style={{ padding: '28px 14px 0' }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 20, lineHeight: '25px', fontWeight: 920, marginBottom: 14 }}>Читайте также</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {related.slice(0, 4).map(next => (
                  <button key={next.id || getNewsTitle(next)} type="button" onClick={() => onClose(next)} style={{ borderRadius: 22, padding: 12, display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12, textAlign: 'left', border: '1px solid rgba(247,241,230,0.09)', background: 'rgba(247,241,230,0.04)', color: APG2_PROFILE.text, fontFamily: 'inherit', cursor: 'pointer' }}>
                    <NewsImage item={next} height={72} radius={16} />
                    <span style={{ minWidth: 0, display: 'grid', gap: 4, alignContent: 'start' }}>
                      <span style={{ color: APG2_PROFILE.gold, fontSize: 10.5, fontWeight: 820 }}>{getNewsCategoryLabel(next)}</span>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 13.5, lineHeight: '18px', fontWeight: 800, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsTitle(next)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── prev / next ── */}
          {(previousItem || nextItem) && (
            <div style={{ padding: '20px 14px 0' }}>
              <GlassCard style={{ borderRadius: 28, padding: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <button type="button" disabled={!previousItem} onClick={() => previousItem && onNavigate(previousItem)} style={{ minHeight: 70, borderRadius: 20, border: '1px solid rgba(247,241,230,0.10)', background: previousItem ? 'rgba(247,241,230,0.05)' : 'rgba(247,241,230,0.02)', color: previousItem ? APG2_PROFILE.text : APG2_PROFILE.textMuted, padding: 12, textAlign: 'left', fontFamily: 'inherit', opacity: previousItem ? 1 : 0.44 }}>
                  <span style={{ display: 'block', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 840, marginBottom: 5 }}>← Предыдущая</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, lineHeight: '17px', fontWeight: 780 }}>{previousItem ? getNewsTitle(previousItem) : 'Нет материала'}</span>
                </button>
                <button type="button" disabled={!nextItem} onClick={() => nextItem && onNavigate(nextItem)} style={{ minHeight: 70, borderRadius: 20, border: '1px solid rgba(247,241,230,0.10)', background: nextItem ? 'rgba(247,241,230,0.05)' : 'rgba(247,241,230,0.02)', color: nextItem ? APG2_PROFILE.text : APG2_PROFILE.textMuted, padding: 12, textAlign: 'right', fontFamily: 'inherit', opacity: nextItem ? 1 : 0.44 }}>
                  <span style={{ display: 'block', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 840, marginBottom: 5 }}>Следующая →</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, lineHeight: '17px', fontWeight: 780 }}>{nextItem ? getNewsTitle(nextItem) : 'Нет материала'}</span>
                </button>
              </GlassCard>
            </div>
          )}

          {/* ── vk original link (bottom, secondary) ── */}
          {item.source === 'vk' && url && (
            <div style={{ padding: '20px 14px 0', textAlign: 'center' }}>
              <button type="button" onClick={() => openUrl(url)} style={{ border: 'none', background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12.5, fontWeight: 680, fontFamily: 'inherit', cursor: 'pointer', padding: '8px 12px', borderRadius: 12 }}>
                Перейти к публикации во ВКонтакте →
              </button>
            </div>
          )}

          {/* ── completed ── */}
          {completed && (
            <div style={{ padding: '16px 14px 0' }}>
              <GlassCard style={{ borderRadius: 26, padding: 14, textAlign: 'center' }}>
                <div style={{ color: APG2_PROFILE.gold, fontSize: 13, fontWeight: 900, marginBottom: 5 }}>Материал дочитан</div>
                <div style={{ fontSize: 13, lineHeight: '19px', color: APG2_PROFILE.text }}>Можно перейти к следующей новости или сохранить эту публикацию.</div>
              </GlassCard>
            </div>
          )}

          <div style={{ height: 'calc(110px + env(safe-area-inset-bottom, 0px))' }} />
        </div>
      </div>

      {showArticleTop && (
        <button type="button" onClick={scrollArticleTop} aria-label="Вернуться к началу новости" style={{ position: 'fixed', right: 16, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', zIndex: 6, width: 48, height: 48, borderRadius: 18, border: '1px solid rgba(247,241,230,0.14)', background: 'rgba(26,24,18,0.78)', color: APG2_PROFILE.text, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 14px 38px rgba(0,0,0,0.28)', fontSize: 20, cursor: 'pointer' }}>↑</button>
      )}
      {lightboxIndex !== null && <Lightbox photos={photos} initial={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
    </div>
  );
}

export function NewsPage({
  news = [],
  user = null,
  savedNews = [],
  readLaterNews = [],
  newsReactions = {},
  newsSubscriptions = {},
  loading = false,
  onBack,
  onReact,
  onSave,
  onReadLater,
  onSubscribe,
  onRefresh,
  onToast,
  onOpenLoki,
  onAskQuestion,
  initialNewsTarget = null,
  desktopOverview = null,
  desktopMode = false,
}) {
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('new');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(9);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);
  const [newItemsCount, setNewItemsCount] = useState(0);
  const pageRef = useRef(null);
  const searchRef = useRef(null);
  const knownIdsRef = useRef(new Set());

  const actualSort = sort === 'all_time' ? 'new' : sort;
  const prepared = useMemo(() => sortNewsItems(filterNewsItems(news, category, query), actualSort), [actualSort, category, news, query]);
  const hero = prepared[0] ?? news[0] ?? null;
  const visible = prepared.slice(0, visibleCount);
  const popular = useMemo(() => sortNewsItems(news, 'popular').slice(0, 5), [news]);
  const related = useMemo(() => selected
    ? sortNewsItems(news.filter(item => item !== selected && getNewsCategory(item) === getNewsCategory(selected)), 'popular')
    : [], [news, selected]);
  const selectedIndex = selected ? prepared.findIndex(item => isSameNews(item, selected)) : -1;
  const previousItem = selectedIndex > 0 ? prepared[selectedIndex - 1] : null;
  const nextItem = selectedIndex >= 0 && selectedIndex < prepared.length - 1 ? prepared[selectedIndex + 1] : null;

  const refresh = async () => {
    const before = new Set(news.map(getCanonicalNewsId).filter(Boolean));
    setRefreshing(true);
    try {
      await onRefresh?.();
      const fresh = news.filter(item => !before.has(getCanonicalNewsId(item))).length;
      if (fresh > 0) setNewItemsCount(fresh);
    } finally { setRefreshing(false); }
  };

  const savedSet = new Set((savedNews || []).map(String));
  const laterSet = new Set((readLaterNews || []).map(String));
  const selectedId = getCanonicalNewsId(selected);
  const hasNews = Array.isArray(news) && news.length > 0;
  const showSkeleton = loading && !hasNews;
  const resultLabel = query.trim()
    ? `${prepared.length} найдено`
    : category === 'all' && sort === 'new'
      ? `${news.length} материалов`
      : `${prepared.length} материалов`;
  useEffect(() => {
    const current = new Set(news.map(getCanonicalNewsId).filter(Boolean));
    if (!knownIdsRef.current.size) {
      knownIdsRef.current = current;
      return;
    }
    const added = [...current].filter(id => !knownIdsRef.current.has(id)).length;
    if (added > 0) setNewItemsCount(added);
    knownIdsRef.current = current;
  }, [news]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 3) return undefined;
    const timer = setTimeout(() => {
      trackAppEvent('news:search', {
        type: APG_EVENT_TYPES.APP_ACTION,
        user,
        entityType: 'news',
        entityId: 'search',
        payload: { query: value, results: prepared.length },
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [prepared.length, query, user]);

  useEffect(() => {
    const targetId = initialNewsTarget?.id ? String(initialNewsTarget.id) : '';
    if (!targetId) return;
    const target = news.find(item => getNewsLegacyIds(item).includes(targetId));
    if (target) setSelected(target);
  }, [initialNewsTarget, news]);

  const handlePageScroll = (e) => setShowTopButton(e.currentTarget.scrollTop > 560);
  const scrollToTop = () => {
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setNewItemsCount(0);
  };
  const focusSearch = () => {
    searchRef.current?.focus();
    pageRef.current?.scrollTo({ top: 210, behavior: 'smooth' });
  };
  const handleShare = (item) => shareNewsItem(item, onToast);
  const openNewsItem = (item, source = 'feed') => {
    const id = getCanonicalNewsId(item);
    trackAppEvent('news:open', {
      type: APG_EVENT_TYPES.NEWS_OPENED,
      user,
      entityType: 'news',
      entityId: id,
      payload: { newsId: id, title: getNewsTitle(item), category: getNewsCategory(item), source },
    });
    setSelected(item);
  };
  const savedItems = useMemo(() => news.filter(item => savedSet.has(getCanonicalNewsId(item))).slice(0, 5), [news, savedNews]);
  const freshItems = useMemo(() => sortNewsItems(news.filter(isFreshNews), 'new').slice(0, 5), [news]);
  const categoryCounts = useMemo(() => NEWS_CATEGORIES
    .map(item => ({
      ...item,
      count: item.id === 'all' ? news.length : news.filter(newsItem => getNewsCategory(newsItem) === item.id || (item.id === 'vk' && newsItem?.source === 'vk')).length,
    }))
    .filter(item => item.count > 0 || item.id === 'all'), [news]);
  const popularCount = news.filter(item => getNewsViews(item) > 0).length;
  const commentsCount = news.reduce((sum, item) => sum + getNewsStats(item).comments, 0);
  const kpiItems = [
    { id: 'total', label: 'Всего публикаций', value: news.length, tone: 'gold', icon: '📰' },
    freshItems.length > 0 && { id: 'fresh', label: 'Новые', value: freshItems.length, icon: '✦' },
    popularCount > 0 && { id: 'popular', label: 'Популярные', value: popularCount, icon: '↑' },
    savedItems.length > 0 && { id: 'saved', label: 'Сохранённые', value: savedItems.length, icon: '★' },
    commentsCount > 0 && { id: 'comments', label: 'Комментариев', value: commentsCount, icon: '💬' },
  ].filter(Boolean);
  const selectedArticleView = selected && (
    <ArticleView
      item={selected}
      related={related}
      previousItem={previousItem}
      nextItem={nextItem}
      onClose={(next) => next?.id ? openNewsItem(next, 'article_close_next') : setSelected(null)}
      onNavigate={(item) => openNewsItem(item, 'article_nav')}
      onReact={onReact}
      onSave={onSave}
      onReadLater={onReadLater}
      onSubscribe={onSubscribe}
      onToast={onToast}
      onOpenLoki={onOpenLoki}
      onAskQuestion={onAskQuestion}
      desktopMode={desktopMode}
      saved={savedSet.has(selectedId)}
      later={laterSet.has(selectedId)}
      reaction={newsReactions?.[selectedId]}
      subscriptions={newsSubscriptions}
      user={user}
    />
  );
  const selectedArticlePortal = selectedArticleView && (
    desktopMode
      ? selectedArticleView
      : createPortal(selectedArticleView, document.body)
  );

  if (desktopMode) {
    const selectStyle = { height: 42, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, outline: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 760, padding: '0 12px', minWidth: 138 };
    const desktopInputStyle = { ...inputStyle, height: 42, borderRadius: 18, fontSize: 14, padding: '0 14px' };
    const infoButtonStyle = { width: '100%', border: 'none', borderRadius: 18, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: APG2_PROFILE.text, padding: 11, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', display: 'grid', gap: 4 };
    const renderNewsList = (items, source, metaOf, actionSource) => (
      <div style={{ display: 'grid', gap: 8 }}>
        {items.slice(0, 4).map(item => (
          <button key={item.id || getNewsTitle(item)} type="button" onClick={() => openNewsItem(item, actionSource)} style={infoButtonStyle}>
            <span style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 820 }}>{metaOf(item)}</span>
            <span style={{ fontSize: 13.5, lineHeight: '18px', fontWeight: 840, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsTitle(item)}</span>
          </button>
        ))}
        {items.length === 0 && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13, lineHeight: '19px' }}>{source}</div>}
      </div>
    );
    return (
      <div ref={pageRef} data-apg-scroll-root="news-feed" onScroll={handlePageScroll} style={{ height: '100svh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', background: APG2_PROFILE.bg }}>
        <DesktopSectionShell
          topOverview={desktopOverview ? <DesktopTopOverview {...desktopOverview} activeSection="news" /> : null}
          header={
            <DesktopHeader
              title="Новости"
              subtitle={`Информационный центр АПГ · ${resultLabel}`}
              kicker="Информационный центр"
              onBack={onBack}
              actions={
                <>
                  <GlassButton onClick={focusSearch} style={{ minHeight: 40, borderRadius: 16 }}>Поиск</GlassButton>
                  <GlassButton onClick={refresh} tone="gold" style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>{refreshing ? 'Обновляем...' : 'Обновить'}</GlassButton>
                  <GlassButton onClick={() => savedItems[0] && openNewsItem(savedItems[0], 'saved_header')} style={{ minHeight: 40, borderRadius: 16 }} disabled={!savedItems.length}>Сохранённые</GlassButton>
                </>
              }
            />
          }
          toolbar={
            <DesktopToolbar
              leading={<input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(12); }} placeholder="Поиск по новостям, категориям и тексту" aria-label="Поиск по новостям" style={desktopInputStyle} />}
              trailing={
                <>
                  <select aria-label="Категория новостей" value={category} onChange={e => { setCategory(e.target.value); setVisibleCount(12); }} style={selectStyle}>
                    {categoryCounts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <select aria-label="Сортировка новостей" value={desktopSortOptions.some(item => item.id === sort) ? sort : 'new'} onChange={e => { setSort(e.target.value); setVisibleCount(12); }} style={selectStyle}>
                    {desktopSortOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <select aria-label="Период новостей" value={desktopPeriodOptions.some(item => item.id === sort) ? sort : 'all_time'} onChange={e => { setSort(e.target.value); setVisibleCount(12); }} style={selectStyle}>
                    {desktopPeriodOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  {(query || category !== 'all' || sort !== 'new') && <GlassButton onClick={() => { setQuery(''); setCategory('all'); setSort('new'); setVisibleCount(12); }} style={{ minHeight: 42, borderRadius: 18 }}>Сбросить</GlassButton>}
                </>
              }
            />
          }
          kpi={<DesktopKpiStrip items={kpiItems} />}
          info={
            <DesktopContentGrid min={260} gap={12}>
              <DesktopSidebarCard title="Популярное" subtitle="Самое читаемое">
                {renderNewsList(popular, 'Популярные материалы появятся позже.', item => `${getNewsViews(item)} просмотров`, 'popular_inline')}
              </DesktopSidebarCard>
              {freshItems.length > 0 && (
                <DesktopSidebarCard title="Новое" subtitle="Свежие публикации">
                  {renderNewsList(freshItems, 'Свежие публикации появятся позже.', formatNewsDate, 'fresh_inline')}
                </DesktopSidebarCard>
              )}
              {savedItems.length > 0 && (
                <DesktopSidebarCard title="Сохранённые" subtitle="Ваши материалы">
                  {renderNewsList(savedItems, 'Сохранённых материалов пока нет.', () => 'Сохранено', 'saved_inline')}
                </DesktopSidebarCard>
              )}
              <DesktopSidebarCard title="Категории" subtitle="Быстрый фильтр">
                <div style={{ display: 'grid', gap: 7 }}>
                  {categoryCounts.slice(0, 9).map(item => (
                    <button key={item.id} type="button" onClick={() => { setCategory(item.id); setVisibleCount(12); scrollToTop(); }} style={{ ...infoButtonStyle, gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', color: category === item.id ? APG2_PROFILE.gold : APG2_PROFILE.text }}>
                      <span style={{ fontSize: 13, fontWeight: 830 }}>{item.label}</span>
                      <span style={{ color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 780 }}>{item.count}</span>
                    </button>
                  ))}
                </div>
              </DesktopSidebarCard>
              <DesktopSidebarCard title="Подсказки" subtitle="Как читать быстрее">
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>
                  Используйте поиск, категории и период в одной строке. Статья, комментарии и Локи открываются через существующий просмотр материала.
                </div>
              </DesktopSidebarCard>
            </DesktopContentGrid>
          }
          actionBar={(newItemsCount > 0 || showTopButton) && (
            <DesktopActionBar
              actions={[
                newItemsCount > 0 && { id: 'fresh', label: `Появилось ${newItemsCount}`, tone: 'gold', onClick: scrollToTop },
                showTopButton && { id: 'top', label: 'Наверх', onClick: scrollToTop },
              ]}
            />
          )}
          contentStyle={{ gap: 14 }}
        >
          <DesktopSectionTitle title={prepared.length ? `${prepared.length} материалов` : 'Материалы'} subtitle={query.trim() ? `По запросу: ${query.trim()}` : 'Городские новости, обновления АПГ и материалы партнёров'} />
          {showSkeleton ? (
            <DesktopSkeleton rows={6} variant="grid" />
          ) : visible.length === 0 ? (
            <DesktopEmptyState
              icon="📰"
              title="Материалы не найдены"
              text={hasNews ? 'Попробуйте изменить категорию, период или поисковый запрос.' : 'Новости скоро появятся. Если интернет нестабилен, попробуйте обновить ленту.'}
              action={<GlassButton onClick={refresh} tone="gold" style={{ color: '#17120a' }}>{refreshing ? 'Обновляем...' : 'Обновить'}</GlassButton>}
            />
          ) : (
            <DesktopContentGrid min={285} gap={14}>
              {visible.map((item, index) => (
                <NewsCard
                  key={item.id || `${getNewsTitle(item)}-${index}`}
                  item={item}
                  index={index}
                  onOpen={(item) => openNewsItem(item, 'desktop_card')}
                  onShare={handleShare}
                  saved={savedSet.has(getCanonicalNewsId(item))}
                  later={laterSet.has(getCanonicalNewsId(item))}
                  compact
                />
              ))}
            </DesktopContentGrid>
          )}
          {visibleCount < prepared.length && (
            <DesktopActionBar actions={[{ id: 'more', label: 'Показать ещё', tone: 'gold', onClick: () => setVisibleCount(v => v + 12) }]} />
          )}
        </DesktopSectionShell>
        {selectedArticlePortal}
      </div>
    );
  }

  return (
    <div ref={pageRef} data-apg-scroll-root="news-feed" onScroll={handlePageScroll} style={{ height: '100svh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', touchAction: 'pan-y', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, padding: 'calc(var(--safe-top, 0px) + 12px) 16px calc(108px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button type="button" onClick={onBack} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 22 }}>←</button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '16px', fontWeight: 880 }}>Информационный центр</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '15px', fontWeight: 650 }}>{resultLabel}</div>
          </div>
        </div>

        <section style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 38, lineHeight: '42px', fontWeight: 940, letterSpacing: 0 }}>Новости</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 15, lineHeight: '22px', marginTop: 7 }}>Будь в курсе всего, что происходит в АПГ.</div>
          </div>

          {hero && (
            <button type="button" onClick={() => openNewsItem(hero, 'hero')} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', color: APG2_PROFILE.text, cursor: 'pointer' }}>
              <NewsImage item={hero} height={340} radius={36} mode="hero">
                <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, display: 'grid', gap: 10 }}>
                  <span style={{ justifySelf: 'start', padding: '8px 12px', borderRadius: 999, background: 'rgba(8,8,10,0.48)', border: '1px solid rgba(215,184,106,0.30)', color: APG2_PROFILE.gold, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', fontSize: 12, fontWeight: 900 }}>{(hero.priority ?? 0) >= 9 ? '🔥 Важно' : 'Главная новость'}</span>
                  <span style={{ color: '#FFF9EA', fontSize: 27, lineHeight: '32px', fontWeight: 940, textShadow: '0 14px 34px rgba(0,0,0,0.42)' }}>{getNewsTitle(hero)}</span>
                  <NewsMeta item={hero} />
                </div>
              </NewsImage>
            </button>
          )}
        </section>

        {newItemsCount > 0 && (
          <button type="button" onClick={scrollToTop} style={{ width: '100%', minHeight: 42, borderRadius: 999, border: '1px solid rgba(215,184,106,0.34)', background: 'rgba(215,184,106,0.14)', color: APG2_PROFILE.gold, fontSize: 13, fontWeight: 860, fontFamily: 'inherit', marginBottom: 14, cursor: 'pointer' }}>
            Появилось {newItemsCount} {newItemsCount === 1 ? 'новая новость' : newItemsCount < 5 ? 'новые новости' : 'новых новостей'}
          </button>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
          <input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(9); }} placeholder="Поиск по новостям, категориям и тексту" aria-label="Поиск по новостям" style={inputStyle} />
          <div data-apg-horizontal-scroll="true" style={{ ...horizontalSnapTrack, gap: 8, paddingBottom: 2, scrollPaddingLeft: 2 }}>
            {NEWS_CATEGORIES.map(item => (
              <button key={item.id} type="button" onClick={() => { setCategory(item.id); setVisibleCount(9); }} style={{ flex: '0 0 auto', minHeight: 38, borderRadius: 999, padding: '0 13px', border: category === item.id ? '1px solid rgba(215,184,106,0.48)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: category === item.id ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: category === item.id ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 820, fontFamily: 'inherit', ...horizontalSnapItem }}>{item.label}</button>
            ))}
          </div>
          <div data-apg-horizontal-scroll="true" style={{ ...horizontalSnapTrack, gap: 8, paddingBottom: 2, scrollPaddingLeft: 2 }}>
            {newsFilterPresets.map(item => (
              <button key={item.id} type="button" onClick={() => { setSort(item.id); setVisibleCount(9); }} style={{ flex: '0 0 auto', minHeight: 34, borderRadius: 999, padding: '0 12px', border: sort === item.id ? '1px solid rgba(255,255,255,0.22)' : '1px solid transparent', background: sort === item.id ? 'rgba(var(--apg2-glass-a,255,255,255),0.12)' : 'transparent', color: sort === item.id ? APG2_PROFILE.text : APG2_PROFILE.textMuted, fontSize: 11.5, fontWeight: 760, fontFamily: 'inherit', ...horizontalSnapItem }}>{item.label}</button>
            ))}
          </div>
        </div>

        {popular.length > 1 && (
          <GlassCard style={{ borderRadius: 30, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 920 }}>Самое читаемое</div>
              <button type="button" onClick={refresh} style={{ border: 'none', background: 'transparent', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 860 }}>{refreshing ? 'Обновляем...' : 'Обновить'}</button>
            </div>
            <div data-apg-horizontal-scroll="true" style={{ ...horizontalSnapTrack, gap: 10, scrollPaddingLeft: 2 }}>
              {popular.map(item => (
                <button key={item.id || getNewsTitle(item)} type="button" onClick={() => openNewsItem(item, 'popular')} style={{ flex: '0 0 220px', minHeight: 96, borderRadius: 22, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: APG2_PROFILE.text, padding: 12, textAlign: 'left', ...horizontalSnapItem }}>
                  <span style={{ display: 'block', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 820, marginBottom: 6 }}>{getNewsViews(item)} просмотров</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, lineHeight: '18px', fontWeight: 830 }}>{getNewsTitle(item)}</span>
                </button>
              ))}
            </div>
          </GlassCard>
        )}

        {showSkeleton ? (
          <NewsSkeleton />
        ) : visible.length === 0 ? (
          <GlassCard style={{ borderRadius: 34, padding: 24, textAlign: 'center', color: APG2_PROFILE.textSoft }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 20, lineHeight: '25px', fontWeight: 900, marginBottom: 7 }}>Материалы не найдены</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px' }}>{hasNews ? 'Попробуйте изменить категорию, период или поисковый запрос.' : 'Новости скоро появятся. Если интернет нестабилен, попробуйте обновить ленту.'}</div>
            <GlassButton onClick={refresh} tone="gold" style={{ marginTop: 16, color: '#17120a' }}>{refreshing ? 'Обновляем...' : 'Обновить'}</GlassButton>
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14, alignItems: 'start' }}>
            {visible.map((item, index) => (
              <NewsCard
                key={item.id || `${getNewsTitle(item)}-${index}`}
                item={item}
                index={index}
                onOpen={(item) => openNewsItem(item, 'card')}
                onShare={handleShare}
                saved={savedSet.has(getCanonicalNewsId(item))}
                later={laterSet.has(getCanonicalNewsId(item))}
              />
            ))}
          </div>
        )}

        {visibleCount < prepared.length && (
          <GlassButton onClick={() => setVisibleCount(v => v + 9)} tone="gold" style={{ width: '100%', marginTop: 18, color: '#17120a' }}>
            Показать ещё
          </GlassButton>
        )}
      </div>

      <div style={{ position: 'fixed', right: 16, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', zIndex: 40, display: 'grid', gap: 10, pointerEvents: selected ? 'none' : 'auto' }}>
        <button type="button" onClick={focusSearch} aria-label="Найти новость" style={{ width: 48, height: 48, borderRadius: 19, border: '1px solid rgba(215,184,106,0.28)', background: 'rgba(18,17,15,0.72)', color: APG2_PROFILE.gold, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 44px rgba(0,0,0,0.28)', fontSize: 18, cursor: 'pointer' }}>⌕</button>
        {showTopButton && (
          <button type="button" onClick={scrollToTop} aria-label="Вернуться наверх" style={{ width: 48, height: 48, borderRadius: 19, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(18,17,15,0.72)', color: APG2_PROFILE.text, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 44px rgba(0,0,0,0.28)', fontSize: 20, cursor: 'pointer' }}>↑</button>
        )}
      </div>

      {selectedArticlePortal}
    </div>
  );
}
