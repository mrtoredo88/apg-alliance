import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RichText } from './components/RichText.jsx';
import { APG2_PROFILE, GlassButton, GlassCard } from './components/Apg2ProfileGlass.jsx';
import { VideoSection } from './components/VideoSection.jsx';
import { openUrl } from './vk.js';
import { API_BASE_URL, APP_URL } from './constants.js';
import { db } from './firebase.js';
import { logError } from './errorLogger.js';
import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  NEWS_CATEGORIES,
  filterNewsItems,
  formatNewsDate,
  getNewsDocs,
  getNewsCategory,
  getNewsCategoryLabel,
  getNewsDate,
  getNewsImage,
  getNewsLinks,
  getNewsPhotoItems,
  getNewsPhotos,
  getNewsReactionsTotal,
  getNewsStats,
  getNewsText,
  getNewsTitle,
  getNewsUrl,
  getNewsVideos,
  getReadingMinutes,
  getNewsViews,
  hasNewsVideo,
  isFreshNews,
  sortNewsItems,
} from './newsUtils.js';

const REACTIONS = ['👍', '❤️', '🔥', '👏', '😍'];
const COMMENT_SORTS = [
  { id: 'new', label: 'Новые' },
  { id: 'popular', label: 'Популярные' },
];

const newsFilterPresets = [
  { id: 'new', label: 'Новые' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'popular', label: 'Популярные' },
  { id: 'all_time', label: 'Все' },
];

const inputStyle = {
  width: '100%',
  height: 48,
  borderRadius: 20,
  border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)',
  background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)',
  color: APG2_PROFILE.text,
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 720,
  padding: '0 16px',
  boxSizing: 'border-box',
};

function getNewsDeepLink(item) {
  const id = encodeURIComponent(String(item?.id || item?.externalId || ''));
  return `${APP_URL}/#/news/${id}`;
}

function getSmartBadges(item) {
  const badges = [];
  const category = getNewsCategory(item);
  const date = getNewsDate(item);
  const today = date && new Date().toDateString() === date.toDateString();
  if (item?.isUrgent || (item?.priority ?? 0) >= 9) badges.push(['🔥', 'Важно']);
  if (item?.pinned || item?.isPinned) badges.push(['📌', 'Закреплено']);
  if (isFreshNews(item)) badges.push(['🆕', 'Новое']);
  if (category === 'partners') badges.push(['🎁', 'Партнёр АПГ']);
  if (category === 'updates') badges.push(['🤖', 'Обновление АПГ']);
  if (category === 'events' || today) badges.push(['📅', today ? 'Сегодня' : 'Событие']);
  return badges.slice(0, 3);
}

async function shareNewsItem(item, onToast) {
  const title = getNewsTitle(item);
  const url = getNewsDeepLink(item);
  try {
    if (navigator.share) {
      await navigator.share({ title, text: title, url });
    } else {
      await navigator.clipboard?.writeText(url);
      onToast?.('Ссылка на новость скопирована.', 'success');
    }
  } catch (e) {
    if (e?.name !== 'AbortError') {
      logError(e, 'NewsPage.cardShare');
      onToast?.('Не удалось поделиться новостью.', 'error');
    }
  }
}

function NewsImage({ item, height = 210, radius = 28, mode = 'card', onOpen, children }) {
  const photo = getNewsPhotoItems(item)[0] || { url: getNewsImage(item) };
  const image = photo?.url || '';
  const ratio = photo?.width && photo?.height ? photo.width / photo.height : null;
  const isTall = ratio && ratio < 0.82;
  const isVk = item?.source === 'vk';
  const fit = mode === 'card' && !isTall && !isVk ? 'cover' : 'contain';
  const handleImageError = (e, layer) => {
    e.currentTarget.style.display = 'none';
    logError(new Error(`News image failed: ${image}`), `NewsPage.image.${layer}.${item?.id || item?.externalId || 'unknown'}`);
  };
  return (
    <div
      onClick={onOpen}
      style={{ position: 'relative', height, borderRadius: radius, overflow: 'hidden', background: 'radial-gradient(circle at 24% 18%, rgba(215,184,106,0.22), transparent 38%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.10), rgba(var(--apg2-glass-a,255,255,255),0.03))', cursor: onOpen ? 'zoom-in' : 'inherit' }}
    >
      {image && (
        <>
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={e => handleImageError(e, 'backdrop')}
            style={{ position: 'absolute', inset: -18, width: 'calc(100% + 36px)', height: 'calc(100% + 36px)', objectFit: 'cover', filter: 'blur(22px) saturate(1.12) brightness(0.62)' }}
          />
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={e => handleImageError(e, 'main')}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, filter: 'saturate(1.07) contrast(1.02)' }}
          />
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

function Lightbox({ photos = [], initial = 0, onClose }) {
  const [idx, setIdx] = useState(initial);
  const [zoom, setZoom] = useState(false);
  const startXRef = useRef(0);
  const safePhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const safeIdx = Math.min(idx, Math.max(0, safePhotos.length - 1));
  const go = (dir) => {
    setZoom(false);
    setIdx(current => (current + dir + safePhotos.length) % safePhotos.length);
  };
  if (!safePhotos.length) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 15000, background: 'rgba(3,3,5,0.94)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'grid', gridTemplateRows: 'auto 1fr auto', padding: 'calc(var(--safe-top, 0px) + 12px) 14px calc(18px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{safeIdx + 1} / {safePhotos.length}</span>
        <button type="button" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 22 }}>×</button>
      </div>
      <div
        onDoubleClick={() => setZoom(v => !v)}
        onTouchStart={e => { startXRef.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - startXRef.current;
          if (Math.abs(dx) > 52) go(dx > 0 ? -1 : 1);
        }}
        style={{ minHeight: 0, overflow: zoom ? 'auto' : 'hidden', display: 'grid', placeItems: 'center' }}
      >
        <img src={safePhotos[safeIdx]} alt="" style={{ maxWidth: zoom ? 'none' : '100%', maxHeight: zoom ? 'none' : '100%', width: zoom ? '165%' : 'auto', height: 'auto', objectFit: 'contain', borderRadius: zoom ? 0 : 20, transition: 'width 220ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1))' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        {safePhotos.length > 1 && <button type="button" onClick={() => go(-1)} style={{ width: 54, height: 46, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 24 }}>‹</button>}
        <button type="button" onClick={() => setZoom(v => !v)} style={{ minWidth: 118, height: 46, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontWeight: 820 }}>{zoom ? 'Уместить' : 'Увеличить'}</button>
        {safePhotos.length > 1 && <button type="button" onClick={() => go(1)} style={{ width: 54, height: 46, borderRadius: 18, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 24 }}>›</button>}
      </div>
    </div>
  );
}

function PhotoCarousel({ photos = [], onOpen }) {
  const [idx, setIdx] = useState(0);
  const safePhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const safeIdx = Math.min(idx, Math.max(0, safePhotos.length - 1));

  if (safePhotos.length <= 1) return null;

  const go = (dir) => setIdx(current => (current + dir + safePhotos.length) % safePhotos.length);

  return (
    <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: 12, overflow: 'hidden' }}>
      <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)' }}>
        <button type="button" onClick={() => onOpen?.(safeIdx)} style={{ width: '100%', padding: 0, border: 'none', background: '#08080a', display: 'block', cursor: 'zoom-in' }}>
          <img src={safePhotos[safeIdx]} alt="" loading="lazy" style={{ width: '100%', maxHeight: 430, objectFit: 'contain', display: 'block' }} />
        </button>
        <button type="button" onClick={() => go(-1)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(8,8,10,0.52)', color: '#fff', fontSize: 22 }}>‹</button>
        <button type="button" onClick={() => go(1)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(8,8,10,0.52)', color: '#fff', fontSize: 22 }}>›</button>
        <div style={{ position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)', padding: '6px 10px', borderRadius: 999, background: 'rgba(8,8,10,0.54)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 11, fontWeight: 780 }}>{safeIdx + 1} / {safePhotos.length}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginTop: 10, paddingBottom: 2 }}>
        {safePhotos.map((photo, index) => (
          <button key={`${photo}-${index}`} type="button" onClick={() => setIdx(index)} style={{ flex: '0 0 58px', height: 50, borderRadius: 14, padding: 0, overflow: 'hidden', border: index === safeIdx ? '2px solid rgba(215,184,106,0.72)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.15)', background: 'transparent' }}>
            <img src={photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function NewsMeta({ item, compact = false }) {
  const stats = getNewsStats(item);
  const date = getNewsDate(item);
  const source = item?.sourceName || (item?.source === 'vk' ? 'ВКонтакте' : 'АПГ');
  const reactions = getNewsReactionsTotal(item) || stats.likes;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: APG2_PROFILE.textMuted, fontSize: compact ? 10.5 : 11.5, lineHeight: '15px', fontWeight: 720 }}>
      <span>{formatNewsDate(item)}</span>
      {date && <span>{date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>}
      <span>{source}</span>
      <span>⏱ {getReadingMinutes(item)} мин</span>
      <span>{stats.views} просмотров</span>
      {(reactions > 0 || stats.comments > 0 || stats.reposts > 0) && (
        <span>♥ {reactions} · 💬 {stats.comments} · ↗ {stats.reposts}</span>
      )}
      {isFreshNews(item) && <span style={{ color: APG2_PROFILE.gold }}>Новое</span>}
    </div>
  );
}

function SharePanel({ item, onToast }) {
  const url = getNewsDeepLink(item);
  const title = getNewsTitle(item);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const copy = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url });
      } else {
        await navigator.clipboard?.writeText(url);
        onToast?.('Ссылка скопирована.', 'success');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        logError(e, 'NewsPage.share');
        onToast?.('Не удалось поделиться ссылкой.', 'error');
      }
    }
  };
  const items = [
    ['Telegram', `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`],
    ['VK', `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`],
    ['WhatsApp', `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`],
  ];
  return (
    <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: 16 }}>
      <div style={{ color: APG2_PROFILE.text, fontSize: 17, fontWeight: 900, marginBottom: 12 }}>Поделиться</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
        {items.map(([label, href]) => (
          <GlassButton key={label} onClick={() => openUrl(href)} style={{ minHeight: 42, borderRadius: 18 }}>{label}</GlassButton>
        ))}
        <GlassButton onClick={copy} tone="gold" style={{ minHeight: 42, borderRadius: 18, color: '#17120a' }}>Скопировать</GlassButton>
      </div>
    </GlassCard>
  );
}

async function requestNewsComments(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || 'Не удалось выполнить действие с комментарием.');
  }
  return data;
}

function CommentRow({ comment, user, onDelete, onLike, onEdit, onReply, compact = false }) {
  const name = comment.userName || 'Участник АПГ';
  const avatar = comment.userAvatar || '';
  const canDelete = user?.id && (String(user.id) === String(comment.userId) || ['admin', 'owner'].includes(String(user.role || '')));
  const canEdit = user?.id && String(user.id) === String(comment.userId);
  const date = comment.createdAt ? new Date(comment.createdAt) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '34px 1fr' : '42px 1fr', gap: compact ? 9 : 11 }}>
      <div style={{ width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: compact ? 13 : 16, overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.09)', display: 'grid', placeItems: 'center', color: APG2_PROFILE.gold, fontWeight: 900 }}>
        {avatar ? <img src={avatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <div style={{ color: APG2_PROFILE.text, fontSize: compact ? 12.5 : 13.5, fontWeight: 860 }}>{name}</div>
          {date && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, fontWeight: 680 }}>{date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</div>}
        </div>
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: compact ? 13 : 13.5, lineHeight: compact ? '19px' : '20px', marginTop: 4, whiteSpace: 'pre-wrap' }}>{comment.text}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" onClick={() => onLike(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 820 }}>❤️ {Number(comment.likes || 0)}</button>
          <button type="button" onClick={() => onReply(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>Ответить</button>
          {canEdit && <button type="button" onClick={() => onEdit(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>Изменить</button>}
          {canDelete && <button type="button" onClick={() => onDelete(comment)} style={{ border: 'none', padding: 0, background: 'transparent', color: APG2_PROFILE.textMuted, fontSize: 12, fontWeight: 760 }}>Удалить</button>}
        </div>
      </div>
    </div>
  );
}

function CommentsPanel({ item, user, onToast }) {
  const newsId = String(item?.id || '');
  const [comments, setComments] = useState([]);
  const [sort, setSort] = useState('new');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const draftKey = useMemo(() => newsId ? `apg_news_comment_draft_${newsId}` : '', [newsId]);

  const apiUser = useMemo(() => ({
    id: String(user?.id || ''),
    name: user?.name || user?.first_name || user?.email || 'Участник АПГ',
    avatar: user?.avatar || user?.photo_100 || user?.photo || '',
    role: user?.role || '',
  }), [user]);

  const load = async () => {
    if (!newsId) return;
    setLoading(true);
    setError('');
    try {
      const data = await requestNewsComments(`/api/news-comments?newsId=${encodeURIComponent(newsId)}`);
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (e) {
      logError(e, 'NewsPage.comments.load');
      setError('Не удалось загрузить комментарии. Проверьте подключение и попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [newsId]);
  useEffect(() => {
    if (!draftKey) return;
    setText(localStorage.getItem(draftKey) || '');
    setEditing(null);
    setReplyTo(null);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || editing) return;
    const value = text.trim();
    if (value) localStorage.setItem(draftKey, text);
    else localStorage.removeItem(draftKey);
  }, [draftKey, editing, text]);

  const sorted = useMemo(() => [...comments].sort((a, b) => {
    if (sort === 'popular') return (Number(b.likes) || 0) - (Number(a.likes) || 0);
    const at = Number(new Date(a.createdAt || 0));
    const bt = Number(new Date(b.createdAt || 0));
    return bt - at;
  }).filter(comment => !comment.parentId), [comments, sort]);

  const repliesByParent = useMemo(() => comments.reduce((acc, comment) => {
    if (!comment.parentId) return acc;
    const key = String(comment.parentId);
    acc[key] = [...(acc[key] || []), comment].sort((a, b) => Number(new Date(a.createdAt || 0)) - Number(new Date(b.createdAt || 0)));
    return acc;
  }, {}), [comments]);

  const submit = async () => {
    const value = text.trim();
    if (!value || !newsId) return;
    if (!user || String(user.id).startsWith('guest_')) {
      onToast?.('Авторизуйтесь, чтобы оставить комментарий.', 'info');
      return;
    }
    setSending(true);
    setError('');
    try {
      if (editing) {
        const data = await requestNewsComments('/api/news-comments', {
          method: 'POST',
          body: JSON.stringify({ action: 'update', commentId: editing.id, text: value, user: apiUser }),
        });
        setComments(prev => prev.map(comment => comment.id === editing.id ? data.comment : comment));
        setEditing(null);
        onToast?.('Комментарий обновлён.', 'success');
      } else {
        const data = await requestNewsComments('/api/news-comments', {
          method: 'POST',
          body: JSON.stringify({ action: 'create', newsId, parentId: replyTo?.id || null, text: value, user: apiUser }),
        });
        setComments(prev => [data.comment, ...prev]);
        onToast?.(replyTo ? 'Ответ опубликован.' : 'Комментарий опубликован.', 'success');
      }
      setText('');
      setReplyTo(null);
      if (draftKey) localStorage.removeItem(draftKey);
    } catch (e) {
      logError(e, 'NewsPage.comments.submit');
      setError(e?.message || 'Комментарий не размещён. Попробуйте ещё раз.');
      onToast?.('Комментарий не размещён.', 'error');
    } finally {
      setSending(false);
    }
  };

  const like = async (comment) => {
    try {
      setComments(prev => prev.map(v => v.id === comment.id ? { ...v, likes: Number(v.likes || 0) + 1 } : v));
      const data = await requestNewsComments('/api/news-comments', {
        method: 'POST',
        body: JSON.stringify({ action: 'like', commentId: comment.id, user: apiUser }),
      });
      setComments(prev => prev.map(v => v.id === comment.id ? { ...v, likes: Number(data.likes ?? v.likes ?? 0) } : v));
    } catch (e) {
      logError(e, 'NewsPage.comments.like');
      onToast?.(e?.message || 'Не удалось поставить реакцию.', 'error');
      await load();
    }
  };

  const remove = async (comment) => {
    try {
      await requestNewsComments('/api/news-comments', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete', commentId: comment.id, user: apiUser }),
      });
      setComments(prev => prev.filter(v => v.id !== comment.id));
      onToast?.('Комментарий удалён.', 'success');
    } catch (e) {
      logError(e, 'NewsPage.comments.delete');
      onToast?.(e?.message || 'Не удалось удалить комментарий.', 'error');
    }
  };

  const startEdit = (comment) => {
    setEditing(comment);
    setReplyTo(null);
    setText(comment.text || '');
  };

  const startReply = (comment) => {
    setEditing(null);
    setReplyTo(comment);
    setText('');
  };

  const cancelComposerMode = () => {
    setEditing(null);
    setReplyTo(null);
    setText('');
  };

  return (
    <GlassCard style={{ marginTop: 18, borderRadius: 30, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 920 }}>Комментарии</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {COMMENT_SORTS.map(item => (
            <button key={item.id} type="button" onClick={() => setSort(item.id)} style={{ minHeight: 30, borderRadius: 999, padding: '0 10px', border: sort === item.id ? '1px solid rgba(215,184,106,0.44)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: sort === item.id ? 'rgba(215,184,106,0.16)' : 'transparent', color: sort === item.id ? APG2_PROFILE.gold : APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 780 }}>{item.label}</button>
          ))}
        </div>
      </div>
      {user && !String(user.id || '').startsWith('guest_') ? (
        <div style={{ display: 'grid', gap: 9, marginBottom: 14 }}>
          {(replyTo || editing) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', border: '1px solid rgba(215,184,106,0.18)', background: 'rgba(215,184,106,0.08)', borderRadius: 18, padding: '9px 11px' }}>
              <span>{editing ? 'Редактирование комментария' : `Ответ для ${replyTo?.userName || 'участника'}`}</span>
              <button type="button" onClick={cancelComposerMode} style={{ border: 'none', background: 'transparent', color: APG2_PROFILE.gold, fontWeight: 840 }}>Отмена</button>
            </div>
          )}
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder={editing ? 'Обновите комментарий' : replyTo ? 'Напишите ответ' : 'Напишите комментарий'} maxLength={900} style={{ ...inputStyle, minHeight: 82, height: 82, resize: 'vertical', paddingTop: 13, lineHeight: '20px' }} />
          <GlassButton onClick={submit} disabled={sending || !text.trim()} tone="gold" style={{ minHeight: 42, borderRadius: 18, color: '#17120a', opacity: sending || !text.trim() ? 0.58 : 1 }}>{sending ? 'Отправляем...' : editing ? 'Сохранить' : 'Отправить'}</GlassButton>
        </div>
      ) : (
        <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', marginBottom: 14 }}>Авторизуйтесь, чтобы оставить комментарий.</div>
      )}
      {error && (
        <div style={{ display: 'grid', gap: 8, color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', border: '1px solid rgba(255,119,92,0.24)', background: 'rgba(255,119,92,0.08)', borderRadius: 20, padding: 12, marginBottom: 14 }}>
          <span>{error}</span>
          <button type="button" onClick={load} style={{ justifySelf: 'start', border: 'none', background: 'transparent', color: APG2_PROFILE.gold, fontSize: 12.5, fontWeight: 850, padding: 0 }}>Повторить загрузку</button>
        </div>
      )}
      {loading ? (
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13 }}>Загружаем обсуждение...</div>
      ) : sorted.length ? (
        <div style={{ display: 'grid', gap: 15 }}>
          {sorted.map(comment => (
            <div key={comment.id} style={{ display: 'grid', gap: 11 }}>
              <CommentRow comment={comment} user={user} onDelete={remove} onLike={like} onEdit={startEdit} onReply={startReply} />
              {!!repliesByParent[comment.id]?.length && (
                <div style={{ display: 'grid', gap: 10, marginLeft: 28, paddingLeft: 12, borderLeft: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)' }}>
                  {repliesByParent[comment.id].map(reply => (
                    <CommentRow key={reply.id} comment={reply} user={user} onDelete={remove} onLike={like} onEdit={startEdit} onReply={startReply} compact />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13 }}>Пока нет комментариев. Можно быть первым.</div>
      )}
    </GlassCard>
  );
}

function NewsSkeleton() {
  const shimmer = {
    background: 'linear-gradient(90deg, rgba(var(--apg2-glass-a,255,255,255),0.06), rgba(215,184,106,0.13), rgba(var(--apg2-glass-a,255,255,255),0.06))',
    backgroundSize: '220% 100%',
    animation: 'shimmer 1.6s ease-in-out infinite',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14, alignItems: 'start' }}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} style={{ ...APG2_PROFILE.glass, borderRadius: 30, overflow: 'hidden', minHeight: index === 0 ? 360 : 310 }}>
          <div style={{ height: index === 0 ? 220 : 174, ...shimmer }} />
          <div style={{ display: 'grid', gap: 12, padding: 16 }}>
            <div style={{ width: '46%', height: 12, borderRadius: 999, ...shimmer }} />
            <div style={{ width: '92%', height: 20, borderRadius: 999, ...shimmer }} />
            <div style={{ width: '72%', height: 20, borderRadius: 999, ...shimmer }} />
            <div style={{ width: '100%', height: 12, borderRadius: 999, ...shimmer }} />
            <div style={{ width: '58%', height: 12, borderRadius: 999, ...shimmer }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsCard({ item, index, onOpen, onShare, saved, later }) {
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  const isLarge = index % 5 === 0;
  const badges = getSmartBadges(item);
  return (
    <div
      style={{
        ...APG2_PROFILE.glass,
        width: '100%',
        border: (item.isUrgent || (item.priority ?? 0) >= 9) ? '1px solid rgba(255,119,92,0.42)' : APG2_PROFILE.glass.border,
        borderRadius: 30,
        padding: 0,
        overflow: 'hidden',
        textAlign: 'left',
        color: APG2_PROFILE.text,
        fontFamily: 'inherit',
        animation: 'fadeInUp 420ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
        animationDelay: `${Math.min(index, 8) * 0.035}s`,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={`Открыть новость: ${title}`}
        style={{ width: '100%', border: 'none', background: 'transparent', padding: 0, textAlign: 'left', color: APG2_PROFILE.text, fontFamily: 'inherit', cursor: 'pointer' }}
      >
        <NewsImage item={item} height={isLarge ? 240 : 174} radius={30}>
          <div style={{ position: 'absolute', left: 14, right: 14, top: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ padding: '7px 11px', borderRadius: 999, background: 'rgba(8,8,10,0.45)', color: APG2_PROFILE.gold, border: '1px solid rgba(215,184,106,0.28)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', fontSize: 11, fontWeight: 860 }}>{getNewsCategoryLabel(item)}</span>
              {badges.map(([emoji, label]) => (
                <span key={`${emoji}-${label}`} style={{ padding: '7px 9px', borderRadius: 999, background: 'rgba(8,8,10,0.42)', border: '1px solid rgba(255,255,255,0.16)', color: '#FFF8E9', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', fontSize: 10.5, fontWeight: 850 }}>{emoji} {label}</span>
              ))}
            </span>
            <span style={{ display: 'flex', gap: 6 }}>
              {saved && <span style={{ padding: '7px 9px', borderRadius: 999, background: 'rgba(215,184,106,0.22)', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 900 }}>Сохранено</span>}
              {later && <span style={{ padding: '7px 9px', borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.14)', color: APG2_PROFILE.text, fontSize: 11, fontWeight: 850 }}>Позже</span>}
            </span>
          </div>
        </NewsImage>
        <span style={{ display: 'grid', gap: 10, padding: '16px 16px 10px' }}>
          <span style={{ color: APG2_PROFILE.text, fontSize: isLarge ? 21 : 17, lineHeight: isLarge ? '26px' : '22px', fontWeight: 920, letterSpacing: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</span>
          <span style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px', fontWeight: 620, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text || 'Короткая новость АПГ. Подробнее внутри материала.'}</span>
          <NewsMeta item={item} compact />
        </span>
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '0 16px 16px' }}>
        <span style={{ color: APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '16px', fontWeight: 700 }}>{getNewsPhotos(item).length > 1 ? `${getNewsPhotos(item).length} фото` : 'Материал АПГ'}</span>
        <button type="button" onClick={() => onShare(item)} aria-label={`Поделиться новостью: ${title}`} style={{ minHeight: 34, borderRadius: 999, padding: '0 12px', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 820, fontFamily: 'inherit', cursor: 'pointer' }}>Поделиться</button>
      </div>
    </div>
  );
}

function ArticleView({ item, related, onClose, onReact, onSave, onReadLater, saved, later, reaction, user, onToast }) {
  const [progress, setProgress] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const scrollRef = useRef(null);
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  const url = getNewsUrl(item);
  const photos = getNewsPhotos(item);
  const videos = getNewsVideos(item);
  const links = getNewsLinks(item).filter(link => link.url && link.url !== url);
  const docs = getNewsDocs(item);
  const stats = getNewsStats(item);
  const tags = Array.isArray(item?.tags) ? item.tags.filter(Boolean) : [];
  const articleId = item?.id ? String(item.id) : '';
  const scrollKey = articleId ? `apg_news_scroll_${articleId}` : '';

  useEffect(() => {
    const id = articleId;
    if (!id) return;
    const viewer = String(user?.id || localStorage.getItem('apg_guest_id') || 'local');
    const key = `apg_news_viewed_${id}_${viewer}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, String(Date.now()));
    setDoc(doc(db, 'news', id), {
      views: increment(1),
      stats: { views: increment(1) },
      lastViewedAt: serverTimestamp(),
    }, { merge: true }).catch(e => logError(e, 'NewsPage.trackView'));
  }, [articleId, user?.id]);

  useEffect(() => {
    if (!scrollKey) return;
    const savedTop = Number(localStorage.getItem(scrollKey) || 0);
    if (!savedTop) return;
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = savedTop;
    });
  }, [scrollKey]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    setProgress(Math.min(1, Math.max(0, el.scrollTop / max)));
    if (scrollKey) localStorage.setItem(scrollKey, String(el.scrollTop));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 13000, background: APG2_PROFILE.bg, color: APG2_PROFILE.text }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 3, width: `${progress * 100}%`, background: 'linear-gradient(90deg, #9F7932, #F4D98C, #FFF0B8)', boxShadow: '0 0 18px rgba(244,217,140,0.44)', zIndex: 2, transition: 'width 80ms linear' }} />
      <div ref={scrollRef} onScroll={handleScroll} style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: 'calc(var(--safe-top, 0px) + 12px) 16px calc(110px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <button type="button" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 22 }}>←</button>
            <span style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 880 }}>{getNewsCategoryLabel(item)}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => {})} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 17 }}>↗</button>
          </div>

          <NewsImage item={item} height={310} radius={34} mode="article" onOpen={() => photos.length && setLightboxIndex(0)}>
            {(item.isPinned || item.pinned) && (
              <div style={{ position: 'absolute', left: 16, top: 16, padding: '8px 12px', borderRadius: 999, background: 'rgba(8,8,10,0.56)', border: '1px solid rgba(215,184,106,0.34)', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 900, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>📌 Закреплено</div>
            )}
          </NewsImage>
          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            <NewsMeta item={item} />
            <h1 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 32, lineHeight: '37px', fontWeight: 940, letterSpacing: 0 }}>{title}</h1>
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tags.slice(0, 8).map(tag => (
                  <span key={tag} style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(215,184,106,0.12)', color: APG2_PROFILE.gold, border: '1px solid rgba(215,184,106,0.20)', fontSize: 11, fontWeight: 820 }}>#{tag}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <GlassButton onClick={() => onSave?.(item)} tone={saved ? 'gold' : undefined} style={{ minHeight: 40, borderRadius: 17, color: saved ? '#17120a' : APG2_PROFILE.text }}>{saved ? 'Сохранено' : 'Сохранить'}</GlassButton>
              <GlassButton onClick={() => onReadLater?.(item)} tone={later ? 'gold' : undefined} style={{ minHeight: 40, borderRadius: 17, color: later ? '#17120a' : APG2_PROFILE.text }}>{later ? 'В списке позже' : 'Прочитать позже'}</GlassButton>
              {url && item.source !== 'vk' && <GlassButton onClick={() => openUrl(url)} style={{ minHeight: 40, borderRadius: 17 }}>Открыть источник</GlassButton>}
            </div>
          </div>

          <GlassCard style={{ marginTop: 18, borderRadius: 30, padding: 18 }}>
            <RichText color={APG2_PROFILE.textSoft} fontSize={15} lineHeight="24px">
              {text || 'Подробный текст новости появится здесь после публикации.'}
            </RichText>
          </GlassCard>

          <PhotoCarousel photos={photos} onOpen={setLightboxIndex} />

          {videos.length > 0 && (
            <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: '6px 0 12px' }}>
              <VideoSection videos={videos} />
            </GlassCard>
          )}

          {(links.length > 0 || docs.length > 0) && (
            <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: 16 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 17, fontWeight: 900, marginBottom: 12 }}>Вложения</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {links.map((link, index) => (
                  <button key={`${link.url}-${index}`} type="button" onClick={() => openUrl(link.url)} style={{ display: 'grid', gridTemplateColumns: link.imageUrl ? '58px 1fr' : '1fr', gap: 12, alignItems: 'center', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 20, padding: 10, textAlign: 'left', color: APG2_PROFILE.text, fontFamily: 'inherit' }}>
                    {link.imageUrl && <img src={link.imageUrl} alt="" loading="lazy" style={{ width: 58, height: 50, borderRadius: 14, objectFit: 'cover' }} />}
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, lineHeight: '18px', fontWeight: 840, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title || link.url}</span>
                      {link.description && <span style={{ display: 'block', color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.description}</span>}
                    </span>
                  </button>
                ))}
                {docs.map((doc, index) => (
                  <button key={`${doc.url}-${index}`} type="button" onClick={() => openUrl(doc.url)} style={{ border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', borderRadius: 20, padding: 12, textAlign: 'left', color: APG2_PROFILE.text, fontFamily: 'inherit' }}>
                    <span style={{ display: 'block', fontSize: 14, lineHeight: '18px', fontWeight: 840 }}>📎 {doc.title}</span>
                    {doc.ext && <span style={{ display: 'block', color: APG2_PROFILE.textMuted, fontSize: 12, marginTop: 4 }}>{doc.ext.toUpperCase()}</span>}
                  </button>
                ))}
              </div>
            </GlassCard>
          )}

          {item.source === 'vk' && (
            <GlassCard style={{ marginTop: 16, borderRadius: 30, padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  ['Просмотры', stats.views],
                  ['Лайки', stats.likes],
                  ['Комментарии', stats.comments],
                  ['Репосты', stats.reposts],
                ].map(([label, value]) => (
                  <div key={label} style={{ textAlign: 'center', borderRadius: 18, padding: '10px 6px', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)' }}>
                    <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900 }}>{value}</div>
                    <div style={{ color: APG2_PROFILE.textMuted, fontSize: 10.5, marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
              {url && <GlassButton onClick={() => openUrl(url)} tone="gold" style={{ width: '100%', minHeight: 48, borderRadius: 20, color: '#17120a' }}>Открыть оригинал в ВКонтакте</GlassButton>}
            </GlassCard>
          )}

          <SharePanel item={item} onToast={onToast} />

          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900 }}>Реакция</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {REACTIONS.map(value => (
                <button key={value} type="button" onClick={() => onReact?.(item, value)} style={{ width: 48, height: 44, borderRadius: 18, border: reaction === value ? '1px solid rgba(215,184,106,0.52)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: reaction === value ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)', fontSize: 20 }}>
                  {value}
                </button>
              ))}
            </div>
          </div>

          <CommentsPanel item={item} user={user} onToast={onToast} />

          {!!related.length && (
            <div style={{ marginTop: 28 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 21, lineHeight: '26px', fontWeight: 920, marginBottom: 12 }}>Локи рекомендует прочитать ещё</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {related.slice(0, 3).map(next => (
                  <button key={next.id || getNewsTitle(next)} type="button" onClick={() => onClose(next)} style={{ ...APG2_PROFILE.glass, borderRadius: 24, padding: 12, display: 'grid', gridTemplateColumns: '76px 1fr', gap: 12, textAlign: 'left', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', color: APG2_PROFILE.text }}>
                    <NewsImage item={next} height={76} radius={18} />
                    <span style={{ minWidth: 0, display: 'grid', gap: 5 }}>
                      <span style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 840 }}>{getNewsCategoryLabel(next)}</span>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', fontWeight: 820, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsTitle(next)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {lightboxIndex !== null && <Lightbox photos={photos} initial={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
    </div>
  );
}

export function NewsPage({
  news = [],
  user = null,
  savedNews = [],
  readLaterNews = [],
  newsReactions = {},
  loading = false,
  onBack,
  onReact,
  onSave,
  onReadLater,
  onRefresh,
  onToast,
}) {
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('new');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(9);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);
  const [newItemsCount, setNewItemsCount] = useState(0);
  const pageRef = useRef(null);
  const searchRef = useRef(null);
  const knownIdsRef = useRef(new Set());

  const actualSort = sort === 'all_time' ? 'new' : sort;
  const prepared = useMemo(() => sortNewsItems(filterNewsItems(news, category, query), actualSort), [actualSort, category, news, query]);
  const hero = prepared[0] ?? news[0] ?? null;
  const visible = prepared.slice(0, visibleCount);
  const popular = useMemo(() => sortNewsItems(news, 'popular').slice(0, 5), [news]);
  const related = useMemo(() => selected
    ? sortNewsItems(news.filter(item => item !== selected && getNewsCategory(item) === getNewsCategory(selected)), 'popular')
    : [], [news, selected]);

  const refresh = async () => {
    const before = new Set(news.map(item => String(item?.id || item?.externalId || '')));
    setRefreshing(true);
    try {
      await onRefresh?.();
      const fresh = news.filter(item => !before.has(String(item?.id || item?.externalId || ''))).length;
      if (fresh > 0) setNewItemsCount(fresh);
    } finally { setRefreshing(false); }
  };

  const savedSet = new Set(savedNews || []);
  const laterSet = new Set(readLaterNews || []);
  const selectedId = selected?.id ? String(selected.id) : '';
  const hasNews = Array.isArray(news) && news.length > 0;
  const showSkeleton = loading && !hasNews;
  const resultLabel = query.trim()
    ? `${prepared.length} найдено`
    : category === 'all' && sort === 'new'
      ? `${news.length} материалов`
      : `${prepared.length} материалов`;

  useEffect(() => {
    const current = new Set(news.map(item => String(item?.id || item?.externalId || '')).filter(Boolean));
    if (!knownIdsRef.current.size) {
      knownIdsRef.current = current;
      return;
    }
    const added = [...current].filter(id => !knownIdsRef.current.has(id)).length;
    if (added > 0) setNewItemsCount(added);
    knownIdsRef.current = current;
  }, [news]);

  const handlePageScroll = (e) => setShowTopButton(e.currentTarget.scrollTop > 560);
  const scrollToTop = () => {
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setNewItemsCount(0);
  };
  const focusSearch = () => {
    searchRef.current?.focus();
    pageRef.current?.scrollTo({ top: 210, behavior: 'smooth' });
  };
  const handleShare = (item) => shareNewsItem(item, onToast);

  return (
    <div ref={pageRef} onScroll={handlePageScroll} style={{ height: '100svh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, padding: 'calc(var(--safe-top, 0px) + 12px) 16px calc(108px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button type="button" onClick={onBack} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 22 }}>←</button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '16px', fontWeight: 880 }}>Информационный центр</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '15px', fontWeight: 650 }}>{resultLabel}</div>
          </div>
        </div>

        <section style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 38, lineHeight: '42px', fontWeight: 940, letterSpacing: 0 }}>Новости</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 15, lineHeight: '22px', marginTop: 7 }}>Будь в курсе всего, что происходит в АПГ.</div>
          </div>

          {hero && (
            <button type="button" onClick={() => setSelected(hero)} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', color: APG2_PROFILE.text, cursor: 'pointer' }}>
              <NewsImage item={hero} height={340} radius={36} mode="hero">
                <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, display: 'grid', gap: 10 }}>
                  <span style={{ justifySelf: 'start', padding: '8px 12px', borderRadius: 999, background: 'rgba(8,8,10,0.48)', border: '1px solid rgba(215,184,106,0.30)', color: APG2_PROFILE.gold, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', fontSize: 12, fontWeight: 900 }}>{(hero.priority ?? 0) >= 9 ? '🔥 Важно' : 'Главная новость'}</span>
                  <span style={{ color: '#FFF9EA', fontSize: 27, lineHeight: '32px', fontWeight: 940, textShadow: '0 14px 34px rgba(0,0,0,0.42)' }}>{getNewsTitle(hero)}</span>
                  <NewsMeta item={hero} />
                </div>
              </NewsImage>
            </button>
          )}
        </section>

        {newItemsCount > 0 && (
          <button type="button" onClick={scrollToTop} style={{ width: '100%', minHeight: 42, borderRadius: 999, border: '1px solid rgba(215,184,106,0.34)', background: 'rgba(215,184,106,0.14)', color: APG2_PROFILE.gold, fontSize: 13, fontWeight: 860, fontFamily: 'inherit', marginBottom: 14, cursor: 'pointer' }}>
            Появилось {newItemsCount} {newItemsCount === 1 ? 'новая новость' : newItemsCount < 5 ? 'новые новости' : 'новых новостей'}
          </button>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
          <input ref={searchRef} value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(9); }} placeholder="Поиск по новостям, категориям и тексту" aria-label="Поиск по новостям" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
            {NEWS_CATEGORIES.map(item => (
              <button key={item.id} type="button" onClick={() => { setCategory(item.id); setVisibleCount(9); }} style={{ flex: '0 0 auto', minHeight: 38, borderRadius: 999, padding: '0 13px', border: category === item.id ? '1px solid rgba(215,184,106,0.48)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: category === item.id ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: category === item.id ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 820, fontFamily: 'inherit' }}>{item.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
            {newsFilterPresets.map(item => (
              <button key={item.id} type="button" onClick={() => { setSort(item.id); setVisibleCount(9); }} style={{ flex: '0 0 auto', minHeight: 34, borderRadius: 999, padding: '0 12px', border: sort === item.id ? '1px solid rgba(255,255,255,0.22)' : '1px solid transparent', background: sort === item.id ? 'rgba(var(--apg2-glass-a,255,255,255),0.12)' : 'transparent', color: sort === item.id ? APG2_PROFILE.text : APG2_PROFILE.textMuted, fontSize: 11.5, fontWeight: 760, fontFamily: 'inherit' }}>{item.label}</button>
            ))}
          </div>
        </div>

        {popular.length > 1 && (
          <GlassCard style={{ borderRadius: 30, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 920 }}>Самое читаемое</div>
              <button type="button" onClick={refresh} style={{ border: 'none', background: 'transparent', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 860 }}>{refreshing ? 'Обновляем...' : 'Обновить'}</button>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
              {popular.map(item => (
                <button key={item.id || getNewsTitle(item)} type="button" onClick={() => setSelected(item)} style={{ flex: '0 0 220px', minHeight: 96, borderRadius: 22, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: APG2_PROFILE.text, padding: 12, textAlign: 'left', scrollSnapAlign: 'start' }}>
                  <span style={{ display: 'block', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 820, marginBottom: 6 }}>{getNewsViews(item)} просмотров</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, lineHeight: '18px', fontWeight: 830 }}>{getNewsTitle(item)}</span>
                </button>
              ))}
            </div>
          </GlassCard>
        )}

        {showSkeleton ? (
          <NewsSkeleton />
        ) : visible.length === 0 ? (
          <GlassCard style={{ borderRadius: 34, padding: 24, textAlign: 'center', color: APG2_PROFILE.textSoft }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 20, lineHeight: '25px', fontWeight: 900, marginBottom: 7 }}>Материалы не найдены</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 14, lineHeight: '21px' }}>{hasNews ? 'Попробуйте изменить категорию, период или поисковый запрос.' : 'Новости скоро появятся. Если интернет нестабилен, попробуйте обновить ленту.'}</div>
            <GlassButton onClick={refresh} tone="gold" style={{ marginTop: 16, color: '#17120a' }}>{refreshing ? 'Обновляем...' : 'Обновить'}</GlassButton>
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14, alignItems: 'start' }}>
            {visible.map((item, index) => (
              <NewsCard
                key={item.id || `${getNewsTitle(item)}-${index}`}
                item={item}
                index={index}
                onOpen={setSelected}
                onShare={handleShare}
                saved={savedSet.has(String(item.id))}
                later={laterSet.has(String(item.id))}
              />
            ))}
          </div>
        )}

        {visibleCount < prepared.length && (
          <GlassButton onClick={() => setVisibleCount(v => v + 9)} tone="gold" style={{ width: '100%', marginTop: 18, color: '#17120a' }}>
            Показать ещё
          </GlassButton>
        )}
      </div>

      <div style={{ position: 'fixed', right: 16, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', zIndex: 40, display: 'grid', gap: 10, pointerEvents: selected ? 'none' : 'auto' }}>
        <button type="button" onClick={focusSearch} aria-label="Найти новость" style={{ width: 48, height: 48, borderRadius: 19, border: '1px solid rgba(215,184,106,0.28)', background: 'rgba(18,17,15,0.72)', color: APG2_PROFILE.gold, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 44px rgba(0,0,0,0.28)', fontSize: 18, cursor: 'pointer' }}>⌕</button>
        {showTopButton && (
          <button type="button" onClick={scrollToTop} aria-label="Вернуться наверх" style={{ width: 48, height: 48, borderRadius: 19, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(18,17,15,0.72)', color: APG2_PROFILE.text, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 44px rgba(0,0,0,0.28)', fontSize: 20, cursor: 'pointer' }}>↑</button>
        )}
      </div>

      {selected && (
        <ArticleView
          item={selected}
          related={related}
          onClose={(next) => setSelected(next?.id ? next : null)}
          onReact={onReact}
          onSave={onSave}
          onReadLater={onReadLater}
          onToast={onToast}
          saved={savedSet.has(selectedId)}
          later={laterSet.has(selectedId)}
          reaction={newsReactions?.[selectedId]}
          user={user}
        />
      )}
    </div>
  );
}
