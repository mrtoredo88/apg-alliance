import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { openUrl } from '../vk.js';
import {
  buildProfileTimeline,
  buildProfileNowPriority,
  groupProfileTimelineItems,
} from '../profileTimeline.js';
import { normalizeExternalUrl } from '../utils/externalUrls.js';
import { APG2_PROFILE as APG2, GlassButton } from './Apg2ProfileGlass.jsx';
import { DesktopEmptyState } from './DesktopUI.jsx';
import { getCommunityFeedSource } from './CommunityFeedSection.jsx';
import { UniversalFeed } from './FeedFramework.jsx';

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

function LivingMetricCard({ icon, title, text, onOpen, tone = APG2.gold, compact = false }) {
  return (
    <div style={{
      borderRadius: compact ? 16 : 18,
      border: `1px solid ${tone}44`,
      background: 'rgba(var(--apg2-glass-a,255,255,255),0.05)',
      padding: compact ? 10 : 12,
      display: 'grid',
      gap: compact ? 4 : 6,
      minWidth: 0,
    }}>
      <div style={{ color: APG2.gold, fontSize: compact ? 11 : 12, fontWeight: 860, textTransform: 'uppercase', letterSpacing: 0.2 }}>{title}</div>
      <div style={{ color: APG2.text, fontSize: compact ? 13 : 14, fontWeight: 820, lineHeight: '20px', minHeight: compact ? 36 : 42, display: 'flex', alignItems: compact ? 'flex-start' : 'center' }}>{icon} {text}</div>
      {onOpen && <button type="button" onClick={onOpen} style={{ border: 0, background: 'transparent', color: APG2.gold, fontSize: 12, fontWeight: 820, padding: 0, justifySelf: 'start', cursor: 'pointer' }}>Открыть</button>}
    </div>
  );
}

function formatNowCardAction(item = {}) {
  if (!item) return '-';
  return [item.value, item.details].filter(Boolean).join(' • ');
}

function NowPriorityGrid({
  items = [],
  desktop = false,
  role = 'partner',
  onOpenNews,
  onOpenEvent,
  onOpenTab,
  onOpenBooking,
}) {
  const hasItems = items.length > 0;
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div style={{ color: APG2.textSoft, fontSize: 11, fontWeight: 860, textTransform: 'uppercase', letterSpacing: 0 }}>Что сейчас важно</div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: desktop ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
        {hasItems ? items.slice(0, 6).map(item => (
          <LivingMetricCard
            key={item.id}
            icon={
              item.type === 'offer' ? '🎁' :
              item.type === 'event' ? '🎉' :
              item.type === 'booking' ? '🗓' :
              item.type === 'publication' ? '📰' :
              item.type === 'video' ? '▶' :
              item.type === 'review' ? '⭐' :
              item.type === 'photo' ? '📸' : '💬'
            }
            title={item.title}
            text={formatNowCardAction(item)}
            onOpen={() => openTimelineItem(item, { onOpenNews, onOpenEvent, onOpenTab, onOpenBooking })}
          />
        )) : (
          <LivingMetricCard icon="•" title="Нет актуальных событий" text={`${role === 'expert' ? 'У эксперта' : 'У партнёра'} пока нет свежих активностей`} />
        )}
      </div>
    </section>
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
  onOpenBooking,
  isOwner = false,
  onCreatePublication,
  mode = 'full',
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

  const nowPriorityItems = useMemo(() => buildProfileNowPriority({
    profile,
    role,
    news,
    events,
    reviews,
    vkPosts: vkState.posts,
    nowValue: Date.now(),
  }), [profile, role, news, events, reviews, vkState.posts]);
  const timelineItems = useMemo(() => buildProfileTimeline({ profile, role, news, events, reviews, vkPosts: vkState.posts }), [profile, role, news, events, reviews, vkState.posts]);
  const filteredItems = timelineItems;
  const visibleItems = filteredItems.slice(0, visibleCount);
  const groups = useMemo(() => groupProfileTimelineItems(visibleItems), [visibleItems]);
  useEffect(() => {
    setVisibleCount(desktop ? 8 : 6);
  }, [desktop, profile?.id]);
  const toggleExpanded = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const showTimelineList = timelineItems.length > 0;
  const showImportantOnly = mode === 'important';
  const showNowPriority = mode === 'full' || mode === 'important';

    return (
      <div style={{ display: 'grid', gap: desktop ? 14 : 12 }}>
        {showNowPriority && (
          <NowPriorityGrid
            items={nowPriorityItems}
            desktop={desktop}
            role={role}
            onOpenNews={onOpenNews}
            onOpenEvent={onOpenEvent}
            onOpenTab={onOpenTab}
            onOpenBooking={onOpenBooking}
          />
        )}

        {showImportantOnly ? null : (
        <>
        {vkState.loading && !showTimelineList && (
          <div style={{ display: 'grid', gap: 10 }}>
            {[0, 1, 2].map(index => <div key={index} style={{ height: desktop ? 112 : 96, borderRadius: desktop ? 20 : 24, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)' }} />)}
          </div>
        )}

        {!vkState.loading && !showTimelineList && (
          <div style={{ display: 'grid', gap: 10 }}>
            <DesktopEmptyState
              icon="✦"
              title="Лента пока собирается"
              text={isOwner ? 'Создайте первую публикацию, добавьте фото или привяжите VK-сообщество, чтобы профиль выглядел живым.' : 'Здесь появятся публикации, акции, мероприятия, фото, видео, отзывы и записи VK-сообщества.'}
            />
            {isOwner && onCreatePublication && (
              <GlassButton onClick={onCreatePublication} style={{ justifySelf: 'center', minHeight: 38, borderRadius: 16, padding: '8px 14px' }}>Создать первую публикацию</GlassButton>
            )}
          </div>
        )}

        {showTimelineList && (
          <UniversalFeed
            groups={groups}
            desktop={desktop}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onOpen={item => openTimelineItem(item, { onOpenNews, onOpenEvent, onOpenTab, onOpenBooking })}
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
        </>
        )}
      </div>
    );
}

export default ProfileTimelineSection;
