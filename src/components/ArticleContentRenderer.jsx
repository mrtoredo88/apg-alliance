import React, { useState } from 'react';
import { RichText } from './RichText.jsx';
import { VideoSection } from './VideoSection.jsx';
import { APG2_PROFILE, GlassButton, GlassCard } from './Apg2ProfileGlass.jsx';
import { DesktopGallery, DesktopSection } from './DesktopUI.jsx';
import { openUrl } from '../vk.js';
import { logError } from '../errorLogger.js';
import {
  formatNewsDate,
  getNewsCategoryLabel,
  getNewsDate,
  getNewsDocs,
  getNewsImage,
  getNewsLinks,
  getNewsPhotoItems,
  getNewsPhotos,
  getNewsText,
  getNewsTitle,
  getNewsVideos,
  hasNewsVideo,
  isFreshNews,
  getReadingMinutes,
} from '../newsUtils.js';

function getArticleBadges(item) {
  const badges = [];
  if (item?.isUrgent || (item?.priority ?? 0) >= 9) badges.push(['🔥', 'Важно']);
  if (item?.pinned || item?.isPinned) badges.push(['📌', 'Закреплено']);
  if (isFreshNews(item)) badges.push(['🆕', 'Новое']);
  return badges;
}

export function ArticleHeroMedia({ item, height = 300, radius = 0, mode = 'article', onOpen, children }) {
  const photo = getNewsPhotoItems(item)[0] || { url: getNewsImage(item) };
  const image = photo?.url || '';
  const ratio = photo?.width && photo?.height ? photo.width / photo.height : null;
  const isTall = ratio && ratio < 0.82;
  const isVk = item?.source === 'vk';
  const fit = mode === 'card' && !isTall && !isVk ? 'cover' : 'contain';
  const handleImageError = (e, layer) => {
    e.currentTarget.style.display = 'none';
    logError(new Error(`Article image failed: ${image}`), `ArticleContentRenderer.image.${layer}.${item?.id || item?.externalId || 'unknown'}`);
  };
  return (
    <div
      onClick={onOpen}
      style={{ position: 'relative', height, borderRadius: radius, overflow: 'hidden', background: 'radial-gradient(circle at 24% 18%, rgba(215,184,106,0.22), transparent 38%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.30), rgba(var(--apg2-glass-a,255,255,255),0.14))', cursor: onOpen ? 'zoom-in' : 'inherit' }}
    >
      {image && (
        <>
          <img src={image} alt="" loading="lazy" decoding="async" onError={e => handleImageError(e, 'backdrop')} style={{ position: 'absolute', inset: -18, width: 'calc(100% + 36px)', height: 'calc(100% + 36px)', objectFit: 'cover', filter: 'blur(22px) saturate(1.12) brightness(0.62)' }} />
          <img src={image} alt="" loading="lazy" decoding="async" onError={e => handleImageError(e, 'main')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, filter: 'saturate(1.07) contrast(1.02)' }} />
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

function ArticleLightbox({ photos = [], initial = 0, onClose }) {
  const [idx, setIdx] = useState(initial);
  const safePhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const safeIdx = Math.min(idx, Math.max(0, safePhotos.length - 1));
  const go = (dir) => setIdx(current => (current + dir + safePhotos.length) % safePhotos.length);
  if (!safePhotos.length) return null;
  return (
    <div data-apg-pull-disabled="true" style={{ position: 'fixed', inset: 0, zIndex: 15000, background: 'rgba(3,3,5,0.94)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'grid', gridTemplateRows: 'auto 1fr auto', padding: 'calc(var(--safe-top, 0px) + 12px) 14px calc(18px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{safeIdx + 1} / {safePhotos.length}</span>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 22 }}>×</button>
      </div>
      <div style={{ minHeight: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', touchAction: 'pan-y' }}>
        <img src={safePhotos[safeIdx]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: 20 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {safePhotos.length > 1 && <button type="button" onClick={() => go(-1)} style={{ width: 54, height: 46, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 24 }}>‹</button>}
        {safePhotos.length > 1 && <button type="button" onClick={() => go(1)} style={{ width: 54, height: 46, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 24 }}>›</button>}
      </div>
    </div>
  );
}

function ArticlePhotoCarousel({ photos = [], onOpen }) {
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
    </GlassCard>
  );
}

function ArticleContentBlocks({ blocks = [] }) {
  const safeBlocks = Array.isArray(blocks) ? blocks.filter(Boolean) : [];
  if (!safeBlocks.length) return null;
  return (
    <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
      {safeBlocks.map((block, index) => {
        if (block.type === 'divider') return <div key={index} style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(215,184,106,0.46), transparent)', margin: '8px 10%' }} />;
        if (block.type === 'button') return <GlassButton key={index} tone="gold" onClick={() => block.url && openUrl(block.url)} style={{ minHeight: 48, borderRadius: 20, color: '#17120a' }}>{block.text || block.title || 'Открыть'}</GlassButton>;
        const tone = block.type === 'warning'
          ? { border: '1px solid rgba(248,113,113,0.30)', background: 'rgba(248,113,113,0.09)', mark: '!' }
          : block.type === 'tip'
            ? { border: '1px solid rgba(215,184,106,0.30)', background: 'rgba(215,184,106,0.10)', mark: '✓' }
            : block.type === 'faq'
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

function ArticleAttachments({ links = [], docs = [] }) {
  if (!links.length && !docs.length) return null;
  return (
    <GlassCard style={{ borderRadius: 28, padding: 16 }}>
      <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900, marginBottom: 12 }}>Вложения</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {links.map((link, index) => (
          <button key={`${link.url}-${index}`} type="button" onClick={() => openUrl(link.url)} style={{ display: 'grid', gridTemplateColumns: link.imageUrl ? '56px 1fr' : '1fr', gap: 12, alignItems: 'center', border: '1px solid rgba(247,241,230,0.10)', background: 'rgba(247,241,230,0.04)', borderRadius: 18, padding: 10, textAlign: 'left', color: APG2_PROFILE.text, fontFamily: 'inherit' }}>
            {link.imageUrl && <img src={link.imageUrl} alt="" loading="lazy" style={{ width: 56, height: 48, borderRadius: 13, objectFit: 'cover' }} />}
            <span style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 14, lineHeight: '18px', fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title || link.url}</span>{link.description && <span style={{ display: 'block', color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.description}</span>}</span>
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
  );
}

function ArticleSocialLinks({ links = [] }) {
  const safeLinks = Array.isArray(links) ? links.filter(link => link?.url) : [];
  if (!safeLinks.length) return null;
  const iconByType = { vk: 'VK', telegram: 'TG', youtube: '▶', dzen: 'Дз', instagram: 'IG', tiktok: 'TT', ok: 'OK', facebook: 'Fb', x: 'X', threads: '@', site: '⌁', other: '↗' };
  return (
    <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: 16 }}>
      <div style={{ color: APG2_PROFILE.text, fontSize: 17, fontWeight: 900, marginBottom: 12 }}>Социальные сети и ссылки</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 9 }}>
        {safeLinks.map((link, index) => <GlassButton key={`${link.url}-${index}`} onClick={() => openUrl(link.url)} style={{ minHeight: 42, borderRadius: 18 }}>{iconByType[link.type] || '↗'} {link.label || 'Открыть'}</GlassButton>)}
      </div>
    </GlassCard>
  );
}

export function ArticleContentRenderer({ item, desktop = false, showHero = true, showHeader = true, showLoki = false, onOpenLoki }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  const date = getNewsDate(item);
  const photos = getNewsPhotos(item);
  const videos = getNewsVideos(item);
  const url = item?.url || '';
  const links = getNewsLinks(item).filter(link => link.url && link.url !== url);
  const docs = getNewsDocs(item);
  const tags = Array.isArray(item?.tags) ? item.tags.filter(Boolean) : [];
  const badges = getArticleBadges(item);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const sourceLabel = item?.source === 'apg' ? 'АПГ' : item?.source === 'vk' ? 'VK' : item?.source || 'АПГ';

  if (desktop) {
    const secondaryPhotos = photos.slice(1);
    const hasAdditionalMedia = secondaryPhotos.length > 0 || videos.length > 0 || links.length > 0 || docs.length > 0;
    const hasWrittenContent = Boolean(text || (Array.isArray(item?.contentBlocks) && item.contentBlocks.length));
    return (
      <>
        {showHero && hasWrittenContent && (
          <DesktopSection title="Содержание" subtitle={sourceLabel}>
            {text && <RichText color="var(--apg-news-article-text)" fontSize={15} lineHeight="24px">{text}</RichText>}
            <ArticleContentBlocks blocks={item?.contentBlocks} />
          </DesktopSection>
        )}
        {hasAdditionalMedia && <DesktopSection title={videos.length && !secondaryPhotos.length ? 'Видео' : 'Медиа'} subtitle={videos.length ? 'Воспроизводится прямо в АПГ' : 'Фото и вложения'}>
          <div style={{ display: 'grid', gap: 12 }}>
            {secondaryPhotos.length > 0 && <DesktopGallery items={secondaryPhotos} onOpen={index => setLightboxIndex(index + 1)} />}
            {videos.length > 0 && <VideoSection videos={videos} />}
            <ArticleAttachments links={links} docs={docs} />
          </div>
        </DesktopSection>}
        {lightboxIndex !== null && <ArticleLightbox photos={photos} initial={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
      </>
    );
  }

  return (
    <>
      {showHero && (
        <ArticleHeroMedia item={item} height={300} radius={0} mode="article" onOpen={() => photos.length && setLightboxIndex(0)}>
          {(item?.isPinned || item?.pinned) && <div style={{ position: 'absolute', left: 16, top: 16, padding: '7px 12px', borderRadius: 999, background: 'rgba(8,8,10,0.56)', border: '1px solid rgba(215,184,106,0.34)', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 900, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>📌 Закреплено</div>}
        </ArticleHeroMedia>
      )}
      <div style={{ padding: showHero ? '0 18px' : 0 }}>
        {showHeader && (
          <div style={{ paddingTop: showHero ? 18 : 0 }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(215,184,106,0.12)', border: '1px solid rgba(215,184,106,0.22)', color: APG2_PROFILE.gold, fontSize: 11.5, fontWeight: 860 }}>{getNewsCategoryLabel(item)}</span>
              {badges.map(([emoji, label]) => <span key={`${emoji}-${label}`} style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(247,241,230,0.07)', border: '1px solid rgba(247,241,230,0.11)', color: APG2_PROFILE.textSoft, fontSize: 11, fontWeight: 760 }}>{emoji} {label}</span>)}
            </div>
            <h1 style={{ margin: '0 0 12px', color: APG2_PROFILE.text, fontSize: 'clamp(24px, 5.5vw, 38px)', lineHeight: 1.12, fontWeight: 950, letterSpacing: '-0.02em' }}>{title}</h1>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 660, lineHeight: '16px', marginBottom: 14 }}>
              {date && <span>{date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
              {date && <span style={{ opacity: 0.6 }}>·</span>}
              {date && <span>{date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>}
              <span style={{ opacity: 0.6 }}>·</span>
              <span>⏱ {getReadingMinutes(item)} мин</span>
            </div>
          </div>
        )}
        {showLoki && wordCount >= 260 && onOpenLoki && (
          <div style={{ marginTop: 20, borderRadius: 18, padding: '12px 14px', background: 'rgba(215,184,106,0.06)', border: '1px solid rgba(215,184,106,0.15)', display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: 13, background: 'rgba(215,184,106,0.12)', border: '1px solid rgba(215,184,106,0.20)', display: 'grid', placeItems: 'center', fontSize: 17 }}>◌</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 860, lineHeight: '16px' }}>Локи</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 11.5, lineHeight: '17px', fontWeight: 560 }}>Статья на {Math.max(1, Math.ceil(wordCount / 200))} мин. Кратко перескажу и найду связанные материалы</div>
            </div>
            <button type="button" onClick={onOpenLoki} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 12, border: '1px solid rgba(215,184,106,0.28)', background: 'rgba(215,184,106,0.10)', color: APG2_PROFILE.gold, fontSize: 11.5, fontWeight: 820, fontFamily: 'inherit', cursor: 'pointer' }}>Спросить</button>
          </div>
        )}
        <div style={{ margin: '24px 0', height: 1, background: 'rgba(35,32,24,0.12)' }} />
        <RichText color="var(--apg-news-article-text)" fontSize={17} lineHeight="29px">{text || 'Подробный текст новости появится здесь после публикации.'}</RichText>
        <ArticleContentBlocks blocks={item?.contentBlocks} />
      </div>
      <div style={{ padding: '0 14px' }}>
        <ArticlePhotoCarousel photos={photos} onOpen={setLightboxIndex} />
      </div>
      {videos.length > 0 && (
        <div style={{ padding: '16px 14px 0' }}>
          <GlassCard style={{ borderRadius: 28, padding: '6px 0 12px' }}>
            <VideoSection videos={videos} />
          </GlassCard>
        </div>
      )}
      <div style={{ padding: '0 14px' }}>
        <ArticleSocialLinks links={item?.socialLinks} />
      </div>
      {(links.length > 0 || docs.length > 0) && (
        <div style={{ padding: '16px 14px 0' }}>
          <ArticleAttachments links={links} docs={docs} />
        </div>
      )}
      {lightboxIndex !== null && <ArticleLightbox photos={photos} initial={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
    </>
  );
}

export default ArticleContentRenderer;
