import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { APG2_PROFILE as APG2 } from './Apg2ProfileGlass.jsx';
import { MediaPreview } from './DesktopUI.jsx';
import { parseVideoUrl } from '../utils/parseVideoUrl.js';

function mediaUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.url || value.src || value.imageUrl || value.photoUrl || value.coverPhoto || value.thumbnailUrl || '';
}

function normalizePhoto(value, index) {
  const url = mediaUrl(value);
  if (!url) return null;
  return {
    id: value?.id || value?.url || url || index,
    url,
    title: value?.title || value?.name || value?.text || '',
  };
}

function normalizeVideo(value, index) {
  if (!value) return null;
  const rawUrl = typeof value === 'string' ? value : value.url || value.videoUrl || value.embedUrl || '';
  const parsed = typeof rawUrl === 'string' ? parseVideoUrl(rawUrl) : null;
  const video = typeof value === 'string' ? {} : value;
  const url = rawUrl || video.embedUrl || '';
  if (!url && !parsed?.embedUrl) return null;
  const direct = Boolean(video.direct || /\.(mp4|webm|ogg)(\?|#|$)/i.test(url));
  return {
    ...video,
    ...parsed,
    id: video.id || video.videoId || parsed?.videoId || url || index,
    url,
    direct,
    embedUrl: video.embedUrl || parsed?.embedUrl || (!direct ? url : ''),
    thumbnailUrl: video.thumbnailUrl || video.thumbnail || parsed?.thumbnailUrl || '',
    title: video.title || video.name || 'Видео',
  };
}

export function normalizeProfilePhotos(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(normalizePhoto)
    .filter(Boolean);
}

export function normalizeProfileVideos(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeVideo)
    .filter(Boolean);
}

function GridButton({ children, onClick, label, style }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        padding: 0,
        border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)',
        borderRadius: 20,
        overflow: 'hidden',
        background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)',
        cursor: 'pointer',
        textAlign: 'left',
        minWidth: 0,
        boxShadow: '0 14px 34px rgba(0,0,0,0.12)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ProfilePhotoGrid({ items = [], onOpen, desktop = false }) {
  const photos = useMemo(() => normalizeProfilePhotos(items), [items]);
  if (!photos.length) return null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: desktop ? 'repeat(auto-fit, minmax(160px, 1fr))' : 'repeat(2, minmax(0, 1fr))',
      gap: desktop ? 12 : 10,
    }}>
      {photos.map((photo, index) => (
        <GridButton
          key={photo.id}
          label={`Открыть фото ${index + 1}`}
          onClick={() => onOpen?.(index)}
          style={{
            aspectRatio: index === 0 && photos.length > 2 && !desktop ? '1 / 1.25' : '1 / 0.78',
            gridColumn: index === 0 && photos.length > 2 && !desktop ? 'span 2' : undefined,
          }}
        >
          <MediaPreview image={photo.url} title={photo.title || `Фото ${index + 1}`} height="100%" style={{ width: '100%' }}>
            <div style={{ position: 'absolute', left: 10, bottom: 10, borderRadius: 999, padding: '5px 8px', color: '#fff', background: 'rgba(10,10,14,0.56)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 11, fontWeight: 800 }}>
              {index + 1}/{photos.length}
            </div>
          </MediaPreview>
        </GridButton>
      ))}
    </div>
  );
}

export function ProfileVideoGrid({ videos = [], onOpen, desktop = false }) {
  const items = useMemo(() => normalizeProfileVideos(videos), [videos]);
  if (!items.length) return null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: desktop ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr',
      gap: desktop ? 12 : 10,
    }}>
      {items.map((video, index) => (
        <GridButton key={video.id} label={`Открыть видео ${index + 1}`} onClick={() => onOpen?.(index)} style={{ display: 'grid', gap: 0 }}>
          <MediaPreview source={video} videos={[video]} title={video.title} height={desktop ? 150 : 190} />
          <div style={{ padding: '10px 12px 12px', color: APG2.text }}>
            <div style={{ fontSize: 14, fontWeight: 840, lineHeight: '18px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{video.title || 'Видео'}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: APG2.textMuted, fontWeight: 760 }}>Нажмите, чтобы открыть</div>
          </div>
        </GridButton>
      ))}
    </div>
  );
}

function ViewerFrame({ children, onClose, onPrev, onNext, count, index, title }) {
  const touchStartX = useRef(null);
  const hasMany = count > 1;

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === 'ArrowLeft' && hasMany) onPrev?.();
      if (event.key === 'ArrowRight' && hasMany) onNext?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMany, onClose, onNext, onPrev]);

  const handleTouchStart = event => {
    touchStartX.current = event.touches?.[0]?.clientX ?? null;
  };
  const handleTouchEnd = event => {
    if (touchStartX.current === null) return;
    const dx = (event.changedTouches?.[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 42 || !hasMany) return;
    if (dx > 0) onPrev?.();
    else onNext?.();
  };

  return createPortal(
    <div
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 24000,
        background: 'rgba(4,4,8,0.92)',
        display: 'grid',
        placeItems: 'center',
        padding: 'calc(48px + env(safe-area-inset-top, 0px)) 18px calc(34px + env(safe-area-inset-bottom, 0px))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <button type="button" onClick={onClose} aria-label="Закрыть" style={{ position: 'absolute', top: 'calc(14px + env(safe-area-inset-top, 0px))', right: 16, width: 42, height: 42, borderRadius: 21, border: '1px solid rgba(255,255,255,0.16)', color: '#fff', background: 'rgba(255,255,255,0.10)', cursor: 'pointer', fontSize: 18 }}>×</button>
      <div style={{ position: 'absolute', top: 'calc(22px + env(safe-area-inset-top, 0px))', left: 18, right: 72, color: 'rgba(255,255,255,0.76)', fontSize: 12, lineHeight: '16px', fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title || 'Медиа'}{count > 1 ? ` · ${index + 1}/${count}` : ''}
      </div>
      <div onClick={event => event.stopPropagation()} style={{ width: 'min(1040px, 94vw)', maxHeight: '82vh', display: 'grid', placeItems: 'center' }}>
        {children}
      </div>
      {hasMany && (
        <>
          <button type="button" onClick={event => { event.stopPropagation(); onPrev?.(); }} aria-label="Предыдущее" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 46, height: 46, borderRadius: 23, border: '1px solid rgba(255,255,255,0.16)', color: '#fff', background: 'rgba(255,255,255,0.10)', cursor: 'pointer', fontSize: 28 }}>‹</button>
          <button type="button" onClick={event => { event.stopPropagation(); onNext?.(); }} aria-label="Следующее" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 46, height: 46, borderRadius: 23, border: '1px solid rgba(255,255,255,0.16)', color: '#fff', background: 'rgba(255,255,255,0.10)', cursor: 'pointer', fontSize: 28 }}>›</button>
        </>
      )}
    </div>,
    document.body,
  );
}

export function ProfilePhotoViewer({ items = [], startIndex, onClose }) {
  const photos = useMemo(() => normalizeProfilePhotos(items), [items]);
  const [index, setIndex] = useState(Math.max(0, Number(startIndex) || 0));
  useEffect(() => setIndex(Math.max(0, Number(startIndex) || 0)), [startIndex]);
  if (startIndex === null || startIndex === undefined || !photos.length) return null;
  const safeIndex = Math.min(index, photos.length - 1);
  const photo = photos[safeIndex];
  return (
    <ViewerFrame
      title={photo.title || 'Фото'}
      count={photos.length}
      index={safeIndex}
      onClose={onClose}
      onPrev={() => setIndex(value => (value - 1 + photos.length) % photos.length)}
      onNext={() => setIndex(value => (value + 1) % photos.length)}
    >
      <img src={photo.url} alt={photo.title || ''} loading="eager" style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 18, boxShadow: '0 26px 70px rgba(0,0,0,0.38)' }} />
    </ViewerFrame>
  );
}

export function ProfileVideoViewer({ videos = [], startIndex, onClose }) {
  const items = useMemo(() => normalizeProfileVideos(videos), [videos]);
  const [index, setIndex] = useState(Math.max(0, Number(startIndex) || 0));
  useEffect(() => setIndex(Math.max(0, Number(startIndex) || 0)), [startIndex]);
  if (startIndex === null || startIndex === undefined || !items.length) return null;
  const safeIndex = Math.min(index, items.length - 1);
  const video = items[safeIndex];
  return (
    <ViewerFrame
      title={video.title || 'Видео'}
      count={items.length}
      index={safeIndex}
      onClose={onClose}
      onPrev={() => setIndex(value => (value - 1 + items.length) % items.length)}
      onNext={() => setIndex(value => (value + 1) % items.length)}
    >
      <div style={{ width: '100%', aspectRatio: '16 / 9', maxHeight: '82vh', borderRadius: 18, overflow: 'hidden', background: '#05050a', boxShadow: '0 26px 70px rgba(0,0,0,0.38)' }}>
        {video.embedUrl && !video.direct ? (
          <iframe
            src={video.embedUrl}
            width="100%"
            height="100%"
            style={{ border: 'none', display: 'block' }}
            allow="encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            title={video.title || 'Видео'}
          />
        ) : (
          <video src={video.url || video.embedUrl} controls preload="metadata" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
        )}
      </div>
    </ViewerFrame>
  );
}
