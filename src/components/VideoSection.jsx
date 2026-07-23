import React, { useState } from 'react';
import { isVK, openUrl } from '../vk.js';
import { T } from '../design.js';

const PLATFORM_LABEL = { youtube: 'YouTube', vk: 'VK Видео', rutube: 'Rutube' };

function VideoThumb({ video, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', padding: 0, border: `2px solid ${isActive ? T.gold : T.border}`,
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'none',
        width: 64, height: 48, flexShrink: 0, transition: 'border-color 0.15s',
      }}
    >
      <img
        src={video.thumbnailUrl}
        alt={video.title || ''}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={e => { e.target.style.background = '#1a1a2e'; e.target.style.display = 'none'; }}
      />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
        <span style={{ fontSize: 14, lineHeight: 1 }}>▶</span>
      </div>
    </button>
  );
}

function VideoPlayer({ video }) {
  const [playing, setPlaying] = useState(false);
  const canEmbed = Boolean(video?.embedUrl);

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', background: '#0a0a1a', position: 'relative', aspectRatio: '16/9' }}>
      {playing && canEmbed ? (
        <iframe
          src={video.embedUrl}
          width="100%"
          height="100%"
          style={{ border: 'none', display: 'block', position: 'absolute', inset: 0 }}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title={video.title || PLATFORM_LABEL[video.platform]}
        />
      ) : (
        <button
          onClick={() => canEmbed ? setPlaying(true) : video?.url && openUrl(video.url)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
        >
          <img
            src={video.thumbnailUrl}
            alt={video.title || ''}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.style.background = '#1a1a2e'; e.target.style.display = 'none'; }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              <span style={{ fontSize: 22, marginLeft: 4, color: '#0a0a1a' }}>{canEmbed ? '▶' : '↗'}</span>
            </div>
            {video.title && (
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.8)', textAlign: 'center', maxWidth: '80%', lineHeight: '16px' }}>{canEmbed ? 'Смотреть видео' : 'Открыть видео в VK'}</div>
            )}
          </div>
        </button>
      )}
    </div>
  );
}

export function VideoSection({ videos }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!videos || videos.length === 0) return null;

  const inVK = isVK();
  const visible = inVK ? videos.filter(v => v.platform === 'vk') : videos;
  const hidden  = inVK ? videos.filter(v => v.platform !== 'vk') : [];

  if (visible.length === 0 && hidden.length === 0) return null;

  const safeIdx = Math.min(activeIdx, visible.length - 1);
  const current = visible[safeIdx] ?? null;

  return (
    <div style={{ margin: '12px 16px' }}>
      <div style={{ fontSize: 13, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>✦ Видео</div>

      {current && <VideoPlayer key={safeIdx} video={current} />}
      {current?.url && (
        <button type="button" onClick={() => openUrl(current.url)} style={{ marginTop: 9, border: 'none', background: 'transparent', color: T.gold, fontSize: 12, fontWeight: 750, cursor: 'pointer', padding: '4px 0' }}>
          Не открылось? Смотреть в VK ↗
        </button>
      )}

      {visible.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {visible.map((v, i) => (
            <VideoThumb key={i} video={v} isActive={i === safeIdx} onClick={() => setActiveIdx(i)} />
          ))}
        </div>
      )}

      {hidden.length > 0 && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🌐</span>
          <span style={{ fontSize: 12, color: T.textSec }}>
            {hidden.map(v => PLATFORM_LABEL[v.platform]).join(', ')} — доступно в веб-версии
          </span>
        </div>
      )}
    </div>
  );
}
