import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { openUrl } from '../vk.js';
import {
  TIMELINE_FILTERS,
  buildProfileTimeline,
  filterProfileTimelineItems,
  groupProfileTimelineItems,
} from '../profileTimeline.js';
import { formatRelativeTime } from '../utils/time.js';
import { normalizeExternalUrl } from '../utils/externalUrls.js';
import { APG2_PROFILE as APG2, GlassButton } from './Apg2ProfileGlass.jsx';
import { DesktopEmptyState } from './DesktopUI.jsx';
import { getCommunityFeedSource } from './CommunityFeedSection.jsx';

const TYPE_META = {
  publication: { icon: '📰', tone: 'rgba(91,143,219,0.16)', accent: '#5b8fdb' },
  event: { icon: '🎉', tone: 'rgba(201,168,76,0.16)', accent: APG2.gold },
  offer: { icon: '🎁', tone: 'rgba(232,197,109,0.20)', accent: '#e8c56d' },
  video: { icon: '▶', tone: 'rgba(217,93,84,0.16)', accent: '#d95d54' },
  photo: { icon: '▣', tone: 'rgba(75,179,75,0.15)', accent: '#4bb34b' },
  review: { icon: '⭐', tone: 'rgba(255,215,0,0.15)', accent: '#ffd76a' },
  vk: { icon: 'VK', tone: 'rgba(74,118,168,0.16)', accent: '#4a76a8' },
};

function getCommentsCount(item = {}) {
  const value = item.entity?.stats?.comments ?? item.entity?.commentsCount ?? item.entity?.commentCount ?? item.entity?.comments;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getActionLabel(item = {}) {
  if (item.action === 'openVideo') return 'Видео';
  if (item.action === 'openPhotos') return 'Фото';
  if (item.action === 'openReviews') return 'Отзывы';
  if (item.action === 'openOffer') return 'Акция';
  return 'Открыть';
}

function openTimelineItem(item, { onOpenNews, onOpenEvent, onOpenTab }) {
  if (item.action === 'openNews' && onOpenNews) return onOpenNews(item.entity);
  if (item.action === 'openEvent' && onOpenEvent) return onOpenEvent(item.entity);
  if (item.action === 'openExternal' && item.url) return openUrl(item.url);
  if (item.action === 'openVideo') return onOpenTab?.('video');
  if (item.action === 'openPhotos') return onOpenTab?.('photos');
  if (item.action === 'openReviews') return onOpenTab?.('reviews');
  if (item.action === 'openOffer') return onOpenTab?.('offer');
  return undefined;
}

async function shareTimelineItem(item) {
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

export function ProfileTimelineCard({
  item,
  desktop,
  expanded,
  onToggleExpanded,
  onOpenNews,
  onOpenEvent,
  onOpenTab,
}) {
  const meta = TYPE_META[item.type] || TYPE_META.publication;
  const image = item.image || '';
  const text = String(item.text || '').trim();
  const canExpand = text.length > (desktop ? 220 : 150);
  const commentsCount = getCommentsCount(item);
  const actionLabel = getActionLabel(item);
  const open = () => openTimelineItem(item, { onOpenNews, onOpenEvent, onOpenTab });
  const commonButton = { minHeight: 32, borderRadius: 14, padding: '6px 10px', fontSize: 12 };
  return (
    <article style={{
      display: 'grid',
      gridTemplateColumns: image ? (desktop ? '128px minmax(0,1fr)' : '86px minmax(0,1fr)') : 'minmax(0,1fr)',
      gap: desktop ? 14 : 10,
      padding: desktop ? 14 : 12,
      borderRadius: desktop ? 20 : 24,
      border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.11)',
      background: 'rgba(var(--apg2-glass-a,255,255,255),0.065)',
      boxShadow: item.pinned ? `0 16px 42px ${APG2.gold}1F` : (desktop ? '0 14px 36px var(--apg2-elev-shadow, rgba(0,0,0,0.10))' : 'none'),
      minWidth: 0,
      position: 'relative',
    }}>
      {image && (
        <button type="button" onClick={open} style={{ height: desktop ? 96 : 78, borderRadius: desktop ? 16 : 18, overflow: 'hidden', background: meta.tone, display: 'grid', placeItems: 'center', color: APG2.gold, fontWeight: 900, padding: 0, border: 0, cursor: 'pointer', minWidth: 0 }}>
          <img src={image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={event => { event.currentTarget.style.display = 'none'; }} />
          <span style={{ display: 'none' }}>{meta.icon}</span>
        </button>
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
            color: meta.accent,
            fontSize: meta.icon === 'VK' ? 10 : 13,
            fontWeight: 900,
          }}>{meta.icon}</span>
          <span style={{ color: APG2.gold, fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>{item.label}</span>
          {item.pinned && <span style={{ color: APG2.text, fontSize: 10.5, fontWeight: 820, border: `1px solid ${APG2.gold}55`, background: `${APG2.gold}1A`, borderRadius: 999, padding: '3px 7px', whiteSpace: 'nowrap' }}>Закреплено</span>}
          <span style={{ color: APG2.textMuted, fontSize: 11, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{formatRelativeTime(item.date || item.ts)}</span>
        </div>
        <button type="button" onClick={open} style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', color: APG2.text, fontSize: desktop ? 17 : 15, lineHeight: desktop ? '22px' : '20px', fontWeight: 880, overflowWrap: 'anywhere', cursor: 'pointer', fontFamily: 'inherit' }}>{item.title}</button>
        {text && (
          <div style={{
            color: APG2.textSoft,
            fontSize: desktop ? 13.5 : 12.8,
            lineHeight: desktop ? '20px' : '18px',
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : (desktop ? 3 : 2),
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}>{text}</div>
        )}
        {canExpand && (
          <button type="button" onClick={() => onToggleExpanded(item.id)} style={{ border: 0, background: 'transparent', padding: 0, margin: 0, justifySelf: 'start', color: APG2.gold, fontSize: 12, fontWeight: 820, cursor: 'pointer', fontFamily: 'inherit' }}>
            {expanded ? 'Свернуть' : 'Показать полностью'}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', minWidth: 0, flexWrap: desktop ? 'nowrap' : 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, color: APG2.textMuted, fontSize: 11.5 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.author || 'АПГ'}</span>
            {commentsCount > 0 && <span style={{ whiteSpace: 'nowrap' }}>💬 {commentsCount}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <GlassButton onClick={() => shareTimelineItem(item)} style={{ ...commonButton, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)' }}>Поделиться</GlassButton>
            <GlassButton onClick={open} style={commonButton}>{actionLabel}</GlassButton>
          </div>
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
  isOwner = false,
  onCreatePublication,
}) {
  const communityUrl = getCommunityFeedSource(profile, role);
  const [vkState, setVkState] = useState({ loading: Boolean(communityUrl), posts: [], error: '' });
  const [activeFilter, setActiveFilter] = useState('all');
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

	  const items = useMemo(() => buildProfileTimeline({ profile, role, news, events, reviews, vkPosts: vkState.posts }), [profile, role, news, events, reviews, vkState.posts]);
  const filters = useMemo(() => {
    const counts = items.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), { all: items.length });
    return TIMELINE_FILTERS
      .map(filter => ({ ...filter, count: counts[filter.id] || 0 }))
      .filter(filter => filter.id === 'all' || filter.count > 0);
  }, [items]);
  const filteredItems = useMemo(() => filterProfileTimelineItems(items, activeFilter), [items, activeFilter]);
  const visibleItems = filteredItems.slice(0, visibleCount);
  const groups = useMemo(() => groupProfileTimelineItems(visibleItems), [visibleItems]);
  useEffect(() => {
    if (!filters.some(filter => filter.id === activeFilter)) setActiveFilter('all');
  }, [activeFilter, filters]);
  useEffect(() => {
    setVisibleCount(desktop ? 8 : 6);
  }, [activeFilter, desktop, profile?.id]);
  const toggleExpanded = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

	  if (!items.length && vkState.loading) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {[0, 1, 2].map(index => <div key={index} style={{ height: desktop ? 120 : 96, borderRadius: desktop ? 20 : 24, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)' }} />)}
      </div>
    );
  }

	  if (!items.length) {
	    return (
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
	    );
	  }

	  return (
	    <div style={{ display: 'grid', gap: desktop ? 14 : 12 }}>
	      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
	        {filters.map(filter => {
	          const active = filter.id === activeFilter;
	          return (
	            <button
	              key={filter.id}
	              type="button"
	              onClick={() => setActiveFilter(filter.id)}
	              style={{
	                border: `1px solid ${active ? `${APG2.gold}66` : 'rgba(var(--apg2-glass-a,255,255,255),0.13)'}`,
	                background: active ? `${APG2.gold}1F` : 'rgba(var(--apg2-glass-a,255,255,255),0.055)',
	                color: active ? APG2.text : APG2.textSoft,
	                minHeight: 32,
	                borderRadius: 999,
	                padding: '6px 10px',
	                display: 'inline-flex',
	                alignItems: 'center',
	                gap: 7,
	                fontSize: 12,
	                fontWeight: active ? 840 : 720,
	                cursor: 'pointer',
	                fontFamily: 'inherit',
	              }}
	            >
	              <span>{filter.label}</span>
	              <span style={{ color: active ? APG2.gold : APG2.textMuted, fontSize: 11 }}>{filter.count}</span>
	            </button>
	          );
	        })}
	      </div>
	      {groups.map(group => (
	        <section key={group.id} style={{ display: 'grid', gap: 10 }}>
	          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
	            <div style={{ color: group.id === 'pinned' ? APG2.gold : APG2.textMuted, fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0 }}>{group.label}</div>
	            <div style={{ height: 1, flex: 1, background: 'rgba(var(--apg2-glass-a,255,255,255),0.11)' }} />
	          </div>
	          {group.items.map(item => (
	            <ProfileTimelineCard
	              key={item.id}
	              item={item}
	              desktop={desktop}
	              expanded={Boolean(expanded[item.id])}
	              onToggleExpanded={toggleExpanded}
	              onOpenNews={onOpenNews}
	              onOpenEvent={onOpenEvent}
	              onOpenTab={onOpenTab}
	            />
	          ))}
	        </section>
	      ))}
	      {visibleCount < filteredItems.length && (
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
