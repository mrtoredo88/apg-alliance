import React from 'react';
import { openUrl } from '../vk.js';
import { formatRelativeTime } from '../utils/time.js';
import { APG2_PROFILE as APG2, GlassButton } from './Apg2ProfileGlass.jsx';
import { MediaPreview } from './DesktopUI.jsx';

export const FEED_ACTIVITY_TYPES = {
  NEWS: 'NEWS',
  EVENT: 'EVENT',
  PROMOTION: 'PROMOTION',
  PHOTO: 'PHOTO',
  VIDEO: 'VIDEO',
  REVIEW: 'REVIEW',
  ACHIEVEMENT: 'ACHIEVEMENT',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
};

const FEED_TYPE_ALIASES = {
  publication: FEED_ACTIVITY_TYPES.NEWS,
  news: FEED_ACTIVITY_TYPES.NEWS,
  event: FEED_ACTIVITY_TYPES.EVENT,
  offer: FEED_ACTIVITY_TYPES.PROMOTION,
  promotion: FEED_ACTIVITY_TYPES.PROMOTION,
  promo: FEED_ACTIVITY_TYPES.PROMOTION,
  photo: FEED_ACTIVITY_TYPES.PHOTO,
  photos: FEED_ACTIVITY_TYPES.PHOTO,
  video: FEED_ACTIVITY_TYPES.VIDEO,
  review: FEED_ACTIVITY_TYPES.REVIEW,
  achievement: FEED_ACTIVITY_TYPES.ACHIEVEMENT,
  announcement: FEED_ACTIVITY_TYPES.ANNOUNCEMENT,
  vk: FEED_ACTIVITY_TYPES.NEWS,
};

const FEED_TYPE_META = {
  [FEED_ACTIVITY_TYPES.NEWS]: { icon: '📰', label: 'Новость', tone: 'rgba(91,143,219,0.16)', accent: '#5b8fdb' },
  [FEED_ACTIVITY_TYPES.EVENT]: { icon: '📅', label: 'Мероприятие', tone: 'rgba(201,168,76,0.16)', accent: APG2.gold },
  [FEED_ACTIVITY_TYPES.PROMOTION]: { icon: '🎁', label: 'Акция', tone: 'rgba(232,197,109,0.20)', accent: '#e8c56d' },
  [FEED_ACTIVITY_TYPES.PHOTO]: { icon: '📸', label: 'Фото', tone: 'rgba(75,179,75,0.15)', accent: '#4bb34b' },
  [FEED_ACTIVITY_TYPES.VIDEO]: { icon: '🎥', label: 'Видео', tone: 'rgba(217,93,84,0.16)', accent: '#d95d54' },
  [FEED_ACTIVITY_TYPES.REVIEW]: { icon: '⭐', label: 'Отзыв', tone: 'rgba(255,215,0,0.15)', accent: '#ffd76a' },
  [FEED_ACTIVITY_TYPES.ACHIEVEMENT]: { icon: '🏆', label: 'Достижение', tone: 'rgba(201,168,76,0.16)', accent: APG2.gold },
  [FEED_ACTIVITY_TYPES.ANNOUNCEMENT]: { icon: '✦', label: 'Объявление', tone: 'rgba(var(--apg2-glass-a,255,255,255),0.10)', accent: APG2.gold },
};

function getFeedTypeMeta(type) {
  const key = String(type || '').trim();
  if (!key) return null;
  const normalized = FEED_ACTIVITY_TYPES[key.toUpperCase()] || FEED_TYPE_ALIASES[key.toLowerCase()] || '';
  return normalized ? FEED_TYPE_META[normalized] : null;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function feedDateValue(item = {}) {
  const value = item.feedTimestamp || item.publishDate || item.publishedAt || item.createdAt || item.created || item.date || item.updatedAt || item.ts;
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && typeof value.seconds === 'number') return value.seconds * 1000 + Math.floor((Number(value.nanoseconds) || 0) / 1000000);
  return Number(value) || new Date(value || 0).getTime() || 0;
}

function getCount(...values) {
  const value = values.find(item => Number.isFinite(Number(item)));
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getCommentsCount(item = {}) {
  const entity = item.entity || {};
  return getCount(entity.stats?.comments, entity.commentsCount, entity.commentCount, entity.comments, item.commentsCount, item.commentCount);
}

function getLikesCount(item = {}) {
  const entity = item.entity || {};
  return getCount(entity.stats?.likes, entity.likesCount, entity.likeCount, entity.likes, item.likesCount, item.likeCount);
}

function getFeedActionLabel(item = {}) {
  if (item.action === 'openVideo') return 'Видео';
  if (item.action === 'openPhotos') return 'Фото';
  if (item.action === 'openReviews') return 'Отзывы';
  if (item.action === 'openOffer') return 'Акция';
  if (item.action === 'openBooking') return 'Записаться';
  return 'Открыть';
}

function getAuthorLogo(item = {}) {
  const entity = item.entity || {};
  return item.authorLogo || item.logoUrl || entity.authorLogo || entity.logoUrl || entity.avatarUrl || entity.photoUrl || entity.photo || '';
}

function getFeedMedia(item = {}) {
  const entity = item.entity || {};
  const gallery = [
    ...asArray(item.gallery),
    ...asArray(entity.gallery),
    ...asArray(entity.photos),
    ...asArray(entity.images),
  ];
  const videos = [
    ...asArray(item.videos),
    ...asArray(entity.videos),
    entity.video,
    entity.videoUrl,
  ].filter(Boolean);
  return {
    source: entity,
    image: item.image || entity.coverPhoto || entity.imageUrl || entity.photoUrl || entity.photo || '',
    gallery,
    videos,
    hasMedia: Boolean(item.image || gallery.length || videos.length || entity.coverPhoto || entity.imageUrl || entity.photoUrl || entity.photo),
  };
}

async function shareFeedItem(item) {
  const text = [item.title, item.text].filter(Boolean).join('\n');
  const url = item.url || (typeof window !== 'undefined' ? window.location?.href : '') || '';
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: item.title || 'АПГ', text, url });
      return;
    }
    if (typeof navigator !== 'undefined') {
      await navigator.clipboard?.writeText([text, url].filter(Boolean).join('\n'));
    }
  } catch {
  }
}

export function sortFeedItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .slice()
    .sort((a, b) => Number(Boolean(b?.pinned)) - Number(Boolean(a?.pinned)) || feedDateValue(b) - feedDateValue(a));
}

export function UniversalFeedCard({
  item,
  desktop = false,
  expanded = false,
  onToggleExpanded,
  onOpen,
  onShare = shareFeedItem,
}) {
  if (!item) return null;
  const meta = getFeedTypeMeta(item.type);
  const tone = meta?.tone || 'rgba(var(--apg2-glass-a,255,255,255),0.10)';
  const accent = meta?.accent || APG2.gold;
  const media = getFeedMedia(item);
  const text = String(item.text || '').trim();
  const canExpand = text.length > (desktop ? 260 : 160);
  const commentsCount = getCommentsCount(item);
  const likesCount = getLikesCount(item);
  const actionLabel = getFeedActionLabel(item);
  const open = () => {
    if (item.action === 'openExternal' && item.url && !onOpen) return openUrl(item.url);
    return onOpen?.(item);
  };
  const authorLogo = getAuthorLogo(item);
  const authorInitial = String(item.author || item.title || 'А').trim().slice(0, 1).toUpperCase();
  const commonButton = { minHeight: 34, borderRadius: 14, padding: '7px 11px', fontSize: 12 };
  return (
    <article style={{
      display: 'grid',
      gap: desktop ? 15 : 12,
      padding: desktop ? 18 : 14,
      borderRadius: desktop ? 24 : 24,
      border: item.pinned ? `1px solid ${APG2.gold}66` : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)',
      background: item.pinned ? `linear-gradient(145deg, ${APG2.gold}18, rgba(var(--apg2-glass-a,255,255,255),0.08))` : 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.105), rgba(var(--apg2-glass-a,255,255,255),0.052))',
      boxShadow: desktop ? '0 18px 42px var(--apg2-elev-shadow, rgba(0,0,0,0.12))' : '0 12px 28px var(--apg2-elev-shadow, rgba(0,0,0,0.08))',
      minWidth: 0,
      position: 'relative',
      transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
    }}>
      <header style={{ display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', minWidth: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 16, overflow: 'hidden', display: 'grid', placeItems: 'center', color: APG2.gold, background: tone, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)', fontSize: 16, fontWeight: 900 }}>
          {authorLogo ? <img src={authorLogo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={event => { event.currentTarget.style.display = 'none'; }} /> : authorInitial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span style={{ color: APG2.text, fontSize: desktop ? 14 : 13.2, lineHeight: '18px', fontWeight: 860, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.author || 'АПГ'}</span>
            {item.pinned && <span style={{ color: APG2.gold, fontSize: 10.5, fontWeight: 840, border: `1px solid ${APG2.gold}55`, borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap' }}>Закреплено</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 3, minWidth: 0, color: APG2.textMuted, fontSize: 11.2, lineHeight: '14px' }}>
            {meta && <span style={{ color: accent, fontWeight: 820 }}>{meta.icon} {meta.label}</span>}
            {meta && <span>·</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatRelativeTime(item.feedTimestamp || item.date || item.ts)}</span>
          </div>
        </div>
        {meta ? <span style={{ minWidth: 28, height: 28, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: tone, color: accent, fontSize: 14, fontWeight: 900 }}>{meta.icon}</span> : <span />}
      </header>

      <button type="button" onClick={open} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', color: APG2.text, fontSize: desktop ? 20 : 17, lineHeight: desktop ? '25px' : '22px', fontWeight: 910, overflowWrap: 'anywhere', cursor: 'pointer', fontFamily: 'inherit' }}>
        {item.title}
      </button>

      {text && (
        <div style={{
          color: APG2.textSoft,
          fontSize: desktop ? 14.5 : 13,
          lineHeight: desktop ? '22px' : '19px',
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : (desktop ? 4 : 3),
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          overflowWrap: 'anywhere',
        }}>{text}</div>
      )}

      {canExpand && (
        <button type="button" onClick={() => onToggleExpanded?.(item.id)} style={{ border: 0, background: 'transparent', padding: 0, margin: 0, justifySelf: 'start', color: APG2.gold, fontSize: 12, fontWeight: 820, cursor: 'pointer', fontFamily: 'inherit' }}>
          {expanded ? 'Свернуть' : 'Показать полностью'}
        </button>
      )}

      {media.hasMedia && (
        <button type="button" onClick={open} style={{ border: 0, padding: 0, background: 'transparent', borderRadius: desktop ? 20 : 18, overflow: 'hidden', cursor: 'pointer', minWidth: 0, boxShadow: '0 12px 30px rgba(0,0,0,0.12)' }}>
          <MediaPreview
            source={media.source}
            image={media.image}
            gallery={media.gallery}
            videos={media.videos}
            title={item.title}
            height={desktop ? 238 : 178}
          />
        </button>
      )}

      <footer style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', minWidth: 0, flexWrap: desktop ? 'nowrap' : 'wrap', paddingTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, color: APG2.textMuted, fontSize: 11.5 }}>
          <span style={{ whiteSpace: 'nowrap' }}>♡ {likesCount}</span>
          <span style={{ whiteSpace: 'nowrap' }}>💬 {commentsCount}</span>
          {media.gallery.length > 1 && <span style={{ whiteSpace: 'nowrap' }}>▣ {media.gallery.length}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <GlassButton onClick={() => onShare(item)} style={{ ...commonButton, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)' }}>Поделиться</GlassButton>
          <GlassButton onClick={open} style={commonButton}>{actionLabel}</GlassButton>
        </div>
      </footer>
    </article>
  );
}

export function UniversalFeed({
  groups = [],
  desktop = false,
  expanded = {},
  onToggleExpanded,
  onOpen,
  onShare,
}) {
  const safeGroups = asArray(groups);
  if (!safeGroups.length) return null;
  return (
    <div style={{ display: 'grid', gap: desktop ? 16 : 13 }}>
      {safeGroups.map(group => (
        <section key={group.id || group.label} style={{ display: 'grid', gap: 10 }}>
          {group.label && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: group.id === 'pinned' ? APG2.gold : APG2.textMuted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>{group.label}</div>
              <div style={{ height: 1, flex: 1, background: 'rgba(var(--apg2-glass-a,255,255,255),0.11)' }} />
            </div>
          )}
          <div style={{ display: 'grid', gap: desktop ? 12 : 10 }}>
            {sortFeedItems(group.items).map(item => (
              <UniversalFeedCard
                key={item.id}
                item={item}
                desktop={desktop}
                expanded={Boolean(expanded[item.id])}
                onToggleExpanded={onToggleExpanded}
                onOpen={onOpen}
                onShare={onShare}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default UniversalFeed;
