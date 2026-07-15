import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../constants.js';
import { openUrl } from '../vk.js';
import { normalizeVkCommunityUrl } from '../../server-shared/vk-community.js';
import { APG2_PROFILE as APG2, GlassButton } from './Apg2ProfileGlass.jsx';
import { DesktopEmptyState } from './DesktopUI.jsx';
import { formatRelativeTime } from '../utils/time.js';

function trimPostText(text = '') {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > 220 ? `${value.slice(0, 220).trim()}...` : value;
}

function firstImage(post = {}) {
  return post.imageUrl || post.coverPhoto || post.photos?.[0] || post.photoItems?.[0]?.url || post.videos?.[0]?.thumbnailUrl || '';
}

function postStats(post = {}) {
  const stats = post.stats || {};
  return [
    Number(stats.likes) > 0 && `❤ ${stats.likes}`,
    Number(stats.comments) > 0 && `💬 ${stats.comments}`,
    Number(stats.views) > 0 && `👁 ${stats.views}`,
  ].filter(Boolean).join(' · ');
}

function CommunityFeedCard({ post, desktop = false }) {
  const image = firstImage(post);
  return (
    <article style={{
      minHeight: desktop ? 238 : 'auto',
      borderRadius: desktop ? 22 : 20,
      overflow: 'hidden',
      display: 'grid',
      gridTemplateRows: image ? '120px minmax(0, 1fr)' : 'minmax(0, 1fr)',
      background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)',
      border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)',
    }}>
      {image && (
        <img src={image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      <div style={{ padding: desktop ? 13 : 12, display: 'grid', gap: 9, alignContent: 'start' }}>
        <div style={{ color: APG2.textMuted, fontSize: 11, lineHeight: '14px', fontWeight: 760 }}>
          {formatRelativeTime(post.publishedAt || post.createdAt)}
        </div>
        <div style={{
          color: APG2.textSoft,
          fontSize: desktop ? 13 : 13.5,
          lineHeight: desktop ? '18px' : '20px',
          display: '-webkit-box',
          WebkitLineClamp: image ? 4 : 6,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {trimPostText(post.text || post.title) || 'Публикация без текста'}
        </div>
        {postStats(post) && <div style={{ color: APG2.textMuted, fontSize: 11, lineHeight: '14px' }}>{postStats(post)}</div>}
        {post.postUrl || post.vkUrl || post.linkUrl ? (
          <GlassButton onClick={() => openUrl(post.postUrl || post.vkUrl || post.linkUrl)} style={{ justifySelf: 'start', minHeight: 34, borderRadius: 14, padding: '7px 11px', fontSize: 12 }}>
            Открыть публикацию
          </GlassButton>
        ) : null}
      </div>
    </article>
  );
}

export function getCommunityFeedSource(profile = {}, type = 'partner') {
  const raw = type === 'expert'
    ? profile.vkUrl || profile.socialUrl || ''
    : profile.vkGroupUrl || profile.vkUrl || profile.socialUrl || '';
  return normalizeVkCommunityUrl(raw);
}

export function CommunityFeedSection({ communityUrl, desktop = false }) {
  const normalized = useMemo(() => normalizeVkCommunityUrl(communityUrl), [communityUrl]);
  const [state, setState] = useState({ loading: Boolean(normalized), posts: [], error: '', unavailable: false });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!normalized) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    setState(prev => ({ ...prev, loading: true, error: '' }));
    fetch(`${API_BASE_URL}/api/community-feed?community=${encodeURIComponent(normalized)}&count=${desktop ? 3 : 4}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.reason || data.error || `HTTP ${response.status}`);
        return data;
      })
      .then(data => {
        if (cancelled) return;
        setState({
          loading: false,
          posts: Array.isArray(data.posts) ? data.posts : [],
          error: data.unavailable ? (data.reason || 'Лента временно недоступна.') : '',
          unavailable: Boolean(data.unavailable),
        });
      })
      .catch(error => {
        if (cancelled) return;
        setState({ loading: false, posts: [], error: error.name === 'AbortError' ? 'Не удалось загрузить ленту за отведённое время.' : error.message || 'Лента временно недоступна.', unavailable: true });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalized, desktop, reloadKey]);

  if (!normalized) return null;

  const openCommunity = (
    <GlassButton onClick={() => openUrl(normalized)} style={{ minHeight: 34, borderRadius: 14, padding: '7px 11px', fontSize: 12 }}>
      Открыть сообщество
    </GlassButton>
  );

  if (state.loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, minmax(0, 1fr))' : '1fr', gap: 10 }}>
        {[0, 1, 2].slice(0, desktop ? 3 : 2).map(index => (
          <div key={index} style={{ height: desktop ? 238 : 156, borderRadius: 22, background: 'linear-gradient(90deg, rgba(var(--apg2-glass-a,255,255,255),0.06), rgba(var(--apg2-glass-a,255,255,255),0.14), rgba(var(--apg2-glass-a,255,255,255),0.06))', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)' }} />
        ))}
      </div>
    );
  }

  if (!state.posts.length) {
    return desktop ? (
      <DesktopEmptyState
        icon="VK"
        title="В сообществе пока нет доступных публикаций"
        text={state.error || 'Последние публикации появятся здесь автоматически.'}
        action={<div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>{openCommunity}<GlassButton onClick={() => setReloadKey(key => key + 1)} style={{ minHeight: 34, borderRadius: 14, padding: '7px 11px', fontSize: 12 }}>Повторить</GlassButton></div>}
      />
    ) : (
      <div style={{ display: 'grid', gap: 10, color: APG2.textSoft, fontSize: 13.5, lineHeight: '20px' }}>
        <div>В сообществе пока нет доступных публикаций.</div>
        {state.error && <div style={{ color: APG2.textMuted }}>{state.error}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{openCommunity}<GlassButton onClick={() => setReloadKey(key => key + 1)}>Повторить</GlassButton></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, minmax(0, 1fr))' : '1fr', gap: 10 }}>
        {state.posts.slice(0, desktop ? 3 : 4).map(post => <CommunityFeedCard key={post.id || post.postUrl} post={post} desktop={desktop} />)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {openCommunity}
        {state.error && <span style={{ color: APG2.textMuted, fontSize: 12 }}>{state.error}</span>}
      </div>
    </div>
  );
}
