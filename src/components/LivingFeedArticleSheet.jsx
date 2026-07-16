import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { APG2_PROFILE, GlassButton, GlassCard } from './Apg2ProfileGlass.jsx';
import { ArticleContentRenderer } from './ArticleContentRenderer.jsx';
import { CommentsPanel, shareNewsItem } from '../NewsPage.jsx';
import { formatNewsDate, getCanonicalNewsId, getNewsCategoryLabel, getNewsText, getNewsTitle } from '../newsUtils.js';
import { shareLink } from '../utils/shareLink.js';

async function shareLivingArticle(item, onToast) {
  try {
    await shareNewsItem(item, onToast);
  } catch {
    const id = getCanonicalNewsId(item);
    const url = id ? shareLink('news', id) : window.location?.href || '';
    if (navigator.share) await navigator.share({ title: getNewsTitle(item), text: getNewsTitle(item), url });
    else await navigator.clipboard?.writeText(url);
  }
}

export function LivingFeedArticleSheet({ item, onClose, user, desktopMode = false, onToast }) {
  const [showTop, setShowTop] = useState(false);
  const scrollRef = useRef(null);
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  const articleId = getCanonicalNewsId(item);
  const readingMinutes = Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 170));
  const meta = useMemo(() => [
    getNewsCategoryLabel(item),
    formatNewsDate(item),
    `${readingMinutes} мин`,
  ].filter(Boolean), [item, readingMinutes]);

  useEffect(() => {
    if (!item) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  const handleScroll = (event) => setShowTop(event.currentTarget.scrollTop > 520);
  const toTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const share = () => shareLivingArticle(item, onToast).then(() => onToast?.('Ссылка скопирована или отправлена.', 'success')).catch(() => onToast?.('Не удалось поделиться публикацией.', 'error'));

  const body = desktopMode ? (
    <div
      data-apg-pull-disabled="true"
      onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 13500, background: 'rgba(6,6,10,0.58)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', animation: 'fadeIn 180ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both', display: 'grid', placeItems: 'center', padding: '28px', boxSizing: 'border-box' }}
    >
      <section style={{ width: 'min(1040px, 100%)', maxHeight: 'min(900px, calc(100vh - 56px))', display: 'grid', gridTemplateRows: 'auto 1fr auto', borderRadius: 34, overflow: 'hidden', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: 'linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.12), rgba(var(--apg2-glass-a,255,255,255),0.055))', boxShadow: '0 34px 90px rgba(0,0,0,0.34)', color: APG2_PROFILE.text }}>
        <header style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760, marginBottom: 6 }}>{meta.map(value => <span key={value}>{value}</span>)}</div>
            <h2 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 26, lineHeight: '32px', fontWeight: 940, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GlassButton onClick={share} style={{ minHeight: 40, borderRadius: 16 }}>Поделиться</GlassButton>
            <GlassButton onClick={onClose} tone="gold" style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>Закрыть</GlassButton>
          </div>
        </header>
        <div ref={scrollRef} onScroll={handleScroll} data-apg-scroll-root="living-feed-article" style={{ minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }}>
            <main style={{ display: 'grid', gap: 14, minWidth: 0 }}>
              <ArticleContentRenderer item={item} desktop showHero />
              <GlassCard style={{ borderRadius: 28, padding: 16 }}>
                <CommentsPanel item={item} user={user} onToast={onToast} />
              </GlassCard>
            </main>
            <aside style={{ position: 'sticky', top: 0, display: 'grid', gap: 12 }}>
              <GlassCard style={{ borderRadius: 26, padding: 16 }}>
                <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 900, marginBottom: 8 }}>Публикация профиля</div>
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px' }}>Вы остаетесь внутри карточки. После закрытия откроется та же Лента с прежней позицией.</div>
              </GlassCard>
              <GlassCard style={{ borderRadius: 26, padding: 16 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 900, marginBottom: 8 }}>Действия</div>
                <div style={{ display: 'grid', gap: 9 }}>
                  <GlassButton onClick={share} style={{ minHeight: 42, borderRadius: 18 }}>Поделиться</GlassButton>
                  {showTop && <GlassButton onClick={toTop} style={{ minHeight: 42, borderRadius: 18 }}>Наверх</GlassButton>}
                </div>
              </GlassCard>
            </aside>
          </div>
        </div>
        <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 20px', borderTop: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>
          <span>{articleId ? `ID: ${articleId}` : 'Публикация профиля'}</span>
          <span>Living Profile</span>
        </footer>
      </section>
    </div>
  ) : (
    <div data-apg-pull-disabled="true" style={{ position: 'fixed', inset: 0, zIndex: 13500, background: 'rgba(18,17,15,0.72)', color: 'var(--apg-news-article-text)', animation: 'fadeIn 180ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both' }}>
      <div ref={scrollRef} onScroll={handleScroll} data-apg-scroll-root="living-feed-article" style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
        <div style={{ minHeight: '100%', maxWidth: 680, margin: '0 auto', background: 'linear-gradient(180deg, var(--apg-news-article-bg, #f6efe2), var(--apg-news-article-bg-soft, #fffaf0))', boxShadow: '0 0 0 1px rgba(35,32,24,0.05)' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 8, alignItems: 'center', padding: 'calc(var(--safe-top, 0px) + 8px) 12px 8px', background: 'rgba(var(--apg2-glass-a,255,255,255),0.70)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(35,32,24,0.08)' }}>
            <button type="button" onClick={onClose} aria-label="Закрыть публикацию" style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(35,32,24,0.10)', background: 'rgba(255,255,255,0.64)', color: APG2_PROFILE.text, fontSize: 22 }}>×</button>
            <div style={{ minWidth: 0, textAlign: 'center' }}>
              <div style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getNewsCategoryLabel(item)}</div>
              <div style={{ color: APG2_PROFILE.text, fontSize: 13, fontWeight: 820, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            </div>
            <button type="button" onClick={share} aria-label="Поделиться публикацией" style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(35,32,24,0.10)', background: 'rgba(255,255,255,0.64)', color: APG2_PROFILE.text, fontSize: 18 }}>↗</button>
          </div>
          <ArticleContentRenderer item={item} showHero showLoki={false} />
          <div style={{ padding: '18px 14px 0' }}>
            <CommentsPanel item={item} user={user} onToast={onToast} />
          </div>
          <div style={{ height: 'calc(90px + env(safe-area-inset-bottom, 0px))' }} />
        </div>
      </div>
      {showTop && <button type="button" onClick={toTop} aria-label="Наверх" style={{ position: 'fixed', right: 16, bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))', zIndex: 6, width: 48, height: 48, borderRadius: 18, border: '1px solid rgba(247,241,230,0.14)', background: 'rgba(26,24,18,0.78)', color: APG2_PROFILE.text, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 14px 38px rgba(0,0,0,0.28)', fontSize: 20, cursor: 'pointer' }}>↑</button>}
    </div>
  );

  return createPortal(body, document.body);
}

export default LivingFeedArticleSheet;
