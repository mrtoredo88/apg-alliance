import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { openUrl } from '../vk.js';
import {
  buildProfileTimeline,
  groupProfileTimelineItems,
} from '../profileTimeline.js';
import { normalizeExternalUrl } from '../utils/externalUrls.js';
import { APG2_PROFILE as APG2, GlassButton } from './Apg2ProfileGlass.jsx';
import { DesktopEmptyState } from './DesktopUI.jsx';
import { getCommunityFeedSource } from './CommunityFeedSection.jsx';
import { UniversalFeed, UniversalFeedCard } from './FeedFramework.jsx';

function timelineTitle(role) {
  return role === 'expert' ? 'Советы эксперта' : 'Новости партнёра';
}

function timelineSubtitle(role, profile = {}, count = 0) {
  const name = profile?.name || profile?.title || '';
  const subject = role === 'expert' ? 'эксперт делится опытом, кейсами и анонсами' : 'партнёр рассказывает о новостях, акциях и событиях';
  return `${name ? `${name}: ` : ''}${subject}${count ? ` · ${count} материалов` : ''}`;
}

function isFreshTimelineItem(item = {}) {
  const ts = Number(item.feedTimestamp || item.ts || 0);
  return ts > 0 && Date.now() - ts <= 14 * 24 * 60 * 60 * 1000;
}

function openTimelineItem(item, {
  onOpenNews,
  onOpenEvent,
  onOpenTab,
  onOpenBooking,
}) {
  if (item.action === 'openNews' && onOpenNews) return onOpenNews(item.entity);
  if (item.action === 'openEvent' && onOpenEvent) return onOpenEvent(item.entity);
  if (item.action === 'openExternal' && item.url) return openUrl(item.url);
  if (item.action === 'openVideo') return onOpenTab?.('video');
  if (item.action === 'openPhotos') return onOpenTab?.('photos');
  if (item.action === 'openReviews') return onOpenTab?.('reviews');
  if (item.action === 'openOffer') return onOpenTab?.('offer');
  if (item.action === 'openBooking') return onOpenBooking?.() || item.onOpen?.();
  return undefined;
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
  onOpenBooking,
  isOwner = false,
  onCreatePublication,
}) {
  const communityUrl = getCommunityFeedSource(profile, role);
  const [vkState, setVkState] = useState({ loading: Boolean(communityUrl), posts: [], error: '' });
  const [visibleCount, setVisibleCount] = useState(desktop ? 8 : 6);
  const [expanded, setExpanded] = useState({});

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

  const timelineItems = useMemo(() => buildProfileTimeline({ profile, role, news, events, reviews, vkPosts: vkState.posts }), [profile, role, news, events, reviews, vkState.posts]);
  const filteredItems = timelineItems;
  const visibleItems = filteredItems.slice(0, visibleCount);
  const featuredItem = visibleItems[0] || null;
  const regularItems = featuredItem ? visibleItems.slice(1) : visibleItems;
  const groups = useMemo(() => groupProfileTimelineItems(regularItems), [regularItems]);
  useEffect(() => {
    setVisibleCount(desktop ? 8 : 6);
  }, [desktop, profile?.id]);
  const toggleExpanded = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const showTimelineList = timelineItems.length > 0;

    return (
      <div style={{ display: 'grid', gap: desktop ? 14 : 12 }}>
        <section style={{ display: 'grid', gap: desktop ? 12 : 10, padding: desktop ? 18 : 15, borderRadius: desktop ? 28 : 26, background: 'radial-gradient(circle at 18% 0%, rgba(215,184,106,0.18), transparent 36%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.12), rgba(var(--apg2-glass-a,255,255,255),0.055))', border: '1px solid rgba(215,184,106,0.18)', boxShadow: '0 14px 34px var(--apg2-elev-shadow, rgba(0,0,0,0.10))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: APG2.gold, fontSize: 11, lineHeight: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.8 }}>Живая лента</span>
                {featuredItem && isFreshTimelineItem(featuredItem) && <span style={{ color: '#17120a', background: APG2.gold, borderRadius: 999, padding: '3px 8px', fontSize: 10.5, lineHeight: '13px', fontWeight: 900 }}>Новое</span>}
                {featuredItem?.label && <span style={{ color: APG2.textSoft, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', borderRadius: 999, padding: '3px 8px', fontSize: 10.5, lineHeight: '13px', fontWeight: 820 }}>{featuredItem.label}</span>}
              </div>
              <div style={{ color: APG2.text, fontSize: desktop ? 24 : 20, lineHeight: desktop ? '30px' : '25px', fontWeight: 940, marginTop: 5 }}>{timelineTitle(role)}</div>
              <div style={{ color: APG2.textSoft, fontSize: desktop ? 13.5 : 12.5, lineHeight: desktop ? '20px' : '18px', marginTop: 4 }}>{timelineSubtitle(role, profile, timelineItems.length)}</div>
            </div>
            {isOwner && onCreatePublication && (
              <GlassButton onClick={onCreatePublication} tone="gold" style={{ minHeight: 38, borderRadius: 16, padding: '8px 12px', color: '#17120a' }}>Создать пост</GlassButton>
            )}
          </div>
          {featuredItem && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: APG2.gold, fontSize: 12, lineHeight: '16px', fontWeight: 880 }}>Свежее в профиле</div>
              <UniversalFeedCard
                item={featuredItem}
                desktop={desktop}
                expanded={expanded[featuredItem.id]}
                onToggleExpanded={toggleExpanded}
                onOpen={item => openTimelineItem(item, { onOpenNews, onOpenEvent, onOpenTab, onOpenBooking })}
                profileReading
              />
            </div>
          )}
        </section>

        {vkState.loading && !showTimelineList && (
          <div style={{ display: 'grid', gap: 10 }}>
            {[0, 1, 2].map(index => <div key={index} style={{ height: desktop ? 112 : 96, borderRadius: desktop ? 20 : 24, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)' }} />)}
          </div>
        )}

        {!vkState.loading && !showTimelineList && (
          <div style={{ display: 'grid', gap: 10 }}>
            <DesktopEmptyState
              icon="✦"
              title="В ленте пока тихо"
              text={isOwner ? 'Добавьте первую публикацию или фото, чтобы профиль начал рассказывать о вас.' : 'Новые публикации, фото и события появятся здесь.'}
            />
            {isOwner && onCreatePublication && (
              <GlassButton onClick={onCreatePublication} style={{ justifySelf: 'center', minHeight: 38, borderRadius: 16, padding: '8px 14px' }}>Создать первую публикацию</GlassButton>
            )}
          </div>
        )}

        {showTimelineList && groups.length > 0 && (
          <UniversalFeed
            groups={groups}
            desktop={desktop}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onOpen={item => openTimelineItem(item, { onOpenNews, onOpenEvent, onOpenTab, onOpenBooking })}
            profileReading
          />
        )}

        {showTimelineList && visibleCount < filteredItems.length && (
          <GlassButton onClick={() => setVisibleCount(count => count + (desktop ? 8 : 6))} style={{ justifySelf: 'center', minHeight: 38, borderRadius: 16, padding: '8px 14px' }}>
            Показать ещё
          </GlassButton>
        )}

        {vkState.error && (
          <div style={{ color: APG2.textMuted, fontSize: 12, lineHeight: '18px' }}>
            VK-источник временно недоступен, остальные события ленты показаны.
          </div>
        )}
      </div>
    );
}

export default ProfileTimelineSection;
