import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { openUrl } from '../vk.js';
import { buildProfileTimeline } from '../profileTimeline.js';
import { formatRelativeTime } from '../utils/time.js';
import { normalizeExternalUrl } from '../utils/externalUrls.js';
import { APG2_PROFILE as APG2, GlassButton } from './Apg2ProfileGlass.jsx';
import { DesktopEmptyState } from './DesktopUI.jsx';
import { getCommunityFeedSource } from './CommunityFeedSection.jsx';

const TYPE_META = {
  publication: { icon: '📰', tone: 'rgba(91,143,219,0.16)' },
  event: { icon: '🎉', tone: 'rgba(201,168,76,0.16)' },
  offer: { icon: '🎁', tone: 'rgba(232,197,109,0.20)' },
  video: { icon: '▶', tone: 'rgba(217,93,84,0.16)' },
  photo: { icon: '▣', tone: 'rgba(75,179,75,0.15)' },
  review: { icon: '⭐', tone: 'rgba(255,215,0,0.15)' },
  vk: { icon: 'VK', tone: 'rgba(74,118,168,0.16)' },
};

function ActionButton({ item, onOpenNews, onOpenEvent, onOpenTab }) {
  const common = { minHeight: 32, borderRadius: 14, padding: '6px 10px', fontSize: 12 };
  if (item.action === 'openNews' && onOpenNews) return <GlassButton onClick={() => onOpenNews(item.entity)} style={common}>Открыть</GlassButton>;
  if (item.action === 'openEvent' && onOpenEvent) return <GlassButton onClick={() => onOpenEvent(item.entity)} style={common}>Открыть</GlassButton>;
  if (item.action === 'openExternal' && item.url) return <GlassButton onClick={() => openUrl(item.url)} style={common}>Открыть</GlassButton>;
  if (item.action === 'openVideo') return <GlassButton onClick={() => onOpenTab?.('video')} style={common}>Видео</GlassButton>;
  if (item.action === 'openPhotos') return <GlassButton onClick={() => onOpenTab?.('photos')} style={common}>Фото</GlassButton>;
  if (item.action === 'openReviews') return <GlassButton onClick={() => onOpenTab?.('reviews')} style={common}>Отзывы</GlassButton>;
  if (item.action === 'openOffer') return <GlassButton onClick={() => onOpenTab?.('offer')} style={common}>Акция</GlassButton>;
  return null;
}

function TimelineItem({ item, desktop, onOpenNews, onOpenEvent, onOpenTab }) {
  const meta = TYPE_META[item.type] || TYPE_META.publication;
  const image = item.image || '';
  return (
    <article style={{
      display: 'grid',
      gridTemplateColumns: image ? (desktop ? '128px minmax(0,1fr)' : '86px minmax(0,1fr)') : 'minmax(0,1fr)',
      gap: desktop ? 14 : 10,
      padding: desktop ? 14 : 12,
      borderRadius: desktop ? 20 : 24,
      border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)',
      background: 'rgba(var(--apg2-glass-a,255,255,255),0.065)',
      boxShadow: desktop ? '0 14px 36px var(--apg2-elev-shadow, rgba(0,0,0,0.10))' : 'none',
      minWidth: 0,
    }}>
      {image && (
        <div style={{ height: desktop ? 96 : 78, borderRadius: desktop ? 16 : 18, overflow: 'hidden', background: meta.tone, display: 'grid', placeItems: 'center', color: APG2.gold, fontWeight: 900 }}>
          <img src={image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={event => { event.currentTarget.style.display = 'none'; }} />
          <span style={{ display: 'none' }}>{meta.icon}</span>
        </div>
      )}
      <div style={{ minWidth: 0, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            minWidth: 30,
            height: 26,
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: meta.icon === 'VK' ? '0 7px' : '0',
            background: meta.tone,
            color: APG2.gold,
            fontSize: meta.icon === 'VK' ? 10 : 13,
            fontWeight: 900,
          }}>{meta.icon}</span>
          <span style={{ color: APG2.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>{item.label}</span>
          <span style={{ color: APG2.textMuted, fontSize: 11, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{formatRelativeTime(item.date || item.ts)}</span>
        </div>
        <div style={{ color: APG2.text, fontSize: desktop ? 17 : 15, lineHeight: desktop ? '22px' : '20px', fontWeight: 880, overflowWrap: 'anywhere' }}>{item.title}</div>
        {item.text && (
          <div style={{
            color: APG2.textSoft,
            fontSize: desktop ? 13.5 : 12.8,
            lineHeight: desktop ? '20px' : '18px',
            display: '-webkit-box',
            WebkitLineClamp: desktop ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>{item.text}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', minWidth: 0 }}>
          <div style={{ color: APG2.textMuted, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.author || 'АПГ'}</div>
          <ActionButton item={item} onOpenNews={onOpenNews} onOpenEvent={onOpenEvent} onOpenTab={onOpenTab} />
        </div>
      </div>
    </article>
  );
}

export function ProfileTimelineSection({
  profile,
  role = 'partner',
  news = [],
  events = [],
  reviews = [],
  desktop = false,
  onOpenNews,
  onOpenEvent,
  onOpenTab,
}) {
  const communityUrl = getCommunityFeedSource(profile, role);
  const [vkState, setVkState] = useState({ loading: Boolean(communityUrl), posts: [], error: '' });

  useEffect(() => {
    if (!communityUrl) {
      setVkState({ loading: false, posts: [], error: '' });
      return undefined;
    }
    const normalized = normalizeExternalUrl(communityUrl, { platform: 'vk' });
    if (!normalized) {
      setVkState({ loading: false, posts: [], error: '' });
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    setVkState(prev => ({ ...prev, loading: true, error: '' }));
    fetch(`${API_BASE_URL}/api/community-feed?community=${encodeURIComponent(normalized)}&count=4`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('VK недоступен')))
      .then(data => {
        if (cancelled) return;
        setVkState({ loading: false, posts: Array.isArray(data.posts) ? data.posts : [], error: data.unavailable ? (data.reason || '') : '' });
      })
      .catch(error => {
        if (cancelled) return;
        setVkState({ loading: false, posts: [], error: error.name === 'AbortError' ? 'VK не ответил вовремя.' : '' });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [communityUrl]);

  const items = useMemo(() => buildProfileTimeline({ profile, role, news, events, reviews, vkPosts: vkState.posts }), [profile, role, news, events, reviews, vkState.posts]);

  if (!items.length && vkState.loading) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {[0, 1, 2].map(index => <div key={index} style={{ height: desktop ? 120 : 96, borderRadius: desktop ? 20 : 24, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)' }} />)}
      </div>
    );
  }

  if (!items.length) {
    return (
      <DesktopEmptyState
        icon="✦"
        title="Лента пока собирается"
        text="Здесь появятся публикации, акции, мероприятия, фото, видео, отзывы и записи VK-сообщества."
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: desktop ? 12 : 10 }}>
      {items.map(item => <TimelineItem key={item.id} item={item} desktop={desktop} onOpenNews={onOpenNews} onOpenEvent={onOpenEvent} onOpenTab={onOpenTab} />)}
      {vkState.error && (
        <div style={{ color: APG2.textMuted, fontSize: 12, lineHeight: '18px' }}>
          VK-источник временно недоступен, остальные события ленты показаны.
        </div>
      )}
    </div>
  );
}

export default ProfileTimelineSection;
