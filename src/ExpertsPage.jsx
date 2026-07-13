import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HorizontalScroll } from '@vkontakte/vkui';
import { EXPERT_CATEGORIES } from './constants.js';
import { db } from './firebase';
import {
  collection, getDocs, query, where,
} from 'firebase/firestore';
import { userAction } from './userApi.js';
import { APG_EVENT_TYPES, trackAppEvent } from './intelligence/index.js';

function getISOWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
import { T, GLASS, GLASS_STRONG } from './design.js';
import { RichText } from './components/RichText.jsx';
import { VideoSection } from './components/VideoSection.jsx';
import vkBridge, { openUrl, isVK } from './vk.js';
import { logError } from './errorLogger.js';
import { openNormalizedUrl } from './utils/externalUrls.js';
import { shareLink } from './utils/shareLink.js';
import { APG2_PROFILE as APG2, GlassBadge, GlassButton, GlassCard, GlassPanel, GlassSection, ProfileGallery, ProfileHero, ProfileReviewCard, getProfileImage } from './components/Apg2ProfileGlass.jsx';
import { motionTransition } from './motion.js';
import { getExpertCategory, normalizeExpertRecord } from '../server-shared/expert-directory.js';

function sanitizeForVK(text) {
  if (!text) return '';
  return text
    .replace(/https?:\/\/\S+/gi, '[ссылка скрыта]')
    .replace(/\b(t\.me|telegram|tg|instagram|inst|whatsapp|youtube|youtu\.be|tiktok|rutube|max\.ru|yclients|dikidi)\S*/gi, '[скрыто]')
    .replace(/@\S+/g, '[скрыто]');
}

const FORMAT_LABELS = {
  online:  { label: 'Онлайн',  emoji: '💻', bg: 'rgba(74,144,217,0.15)',  border: 'rgba(74,144,217,0.35)',  text: '#6AABEC' },
  offline: { label: 'Офлайн', emoji: '📍', bg: 'rgba(75,179,75,0.15)',   border: 'rgba(75,179,75,0.35)',   text: '#4BB34B' },
  group:   { label: 'Группа', emoji: '👥', bg: 'rgba(201,168,76,0.15)',  border: 'rgba(201,168,76,0.35)', text: '#C9A84C' },
};

function ExpertAvatar({ expert, size = 64 }) {
  const [failed, setFailed] = useState(false);
  const name = expert.name ?? '?';
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (!expert.photo || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg,hsl(${hue},48%,50%),hsl(${hue},40%,42%))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.36), fontWeight: 800, color: '#fff',
        border: `2px solid ${T.border}`,
      }}>
        {name[0].toUpperCase()}
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', padding: 2.5, flexShrink: 0, background: `linear-gradient(135deg,${T.gold},${T.goldL})` }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
        <img src={expert.photo} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

function StarDisplay({ value = 0, size = 13 }) {
  const filled = Math.round(value);
  return (
    <span style={{ fontSize: size, color: '#FFD700', lineHeight: 1, letterSpacing: 0.5 }}>
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  );
}

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
            fontSize: 28, lineHeight: 1,
            color: s <= display ? '#FFD700' : T.border,
            transition: 'color 0.1s, transform 0.1s',
            transform: s <= display ? 'scale(1.15)' : 'scale(1)',
          }}>★</button>
      ))}
    </div>
  );
}

function FormatChip({ format }) {
  const info = FORMAT_LABELS[format];
  if (!info) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: info.bg, border: `1px solid ${info.border}`,
      borderRadius: 12, padding: '3px 9px',
      fontSize: 11, fontWeight: 700, color: info.text, whiteSpace: 'nowrap',
    }}>
      {info.emoji} {info.label}
    </div>
  );
}

function ReviewCard({ review }) {
  function timeAgo(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const m = Math.floor((Date.now() - d) / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return `${m} мин назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч назад`;
    return `${Math.floor(h / 24)} дн назад`;
  }
  return (
    <div style={{ ...GLASS, borderRadius: 16, padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {review.userPhoto
          ? <img src={review.userPhoto} alt="" loading="lazy" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>👤</div>
        }
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>{review.userName || 'Участник'}</div>
          <div style={{ fontSize: 11, color: T.textSec }}>{timeAgo(review.createdAt)}</div>
        </div>
        <StarDisplay value={review.rating} size={12} />
      </div>
      {review.text && (
        <div style={{ fontSize: 13, color: T.textSec, lineHeight: '19px' }}>{review.text}</div>
      )}
    </div>
  );
}

function pluralReviews(n) {
  const n1 = n % 10, n2 = n % 100;
  if (n2 >= 11 && n2 <= 19) return `${n} отзывов`;
  if (n1 === 1) return `${n} отзыв`;
  if (n1 >= 2 && n1 <= 4) return `${n} отзыва`;
  return `${n} отзывов`;
}

function PhotoLightbox({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const prev = () => setIdx(i => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx(i => (i + 1) % photos.length);
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.93)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)' }}>
      <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'50%', width:38, height:38, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>✕</button>
      {photos.length > 1 && <div style={{ position:'absolute', top:22, left:'50%', transform:'translateX(-50%)', fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:600, zIndex:10 }}>{idx+1}/{photos.length}</div>}
      <img src={photos[idx]} alt="" loading="lazy" onClick={e => e.stopPropagation()} style={{ maxWidth:'94vw', maxHeight:'82vh', objectFit:'contain', borderRadius:16 }} />
      {photos.length > 1 && <>
        <button onClick={e => { e.stopPropagation(); prev(); }} style={{ position:'absolute', left:12, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'50%', width:42, height:42, color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
        <button onClick={e => { e.stopPropagation(); next(); }} style={{ position:'absolute', right:12, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'50%', width:42, height:42, color:'#fff', fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
      </>}
    </div>,
    document.body,
  );
}

function ExpertModal({ expert, user, scannedExperts, onClose, variant = 'v2', onScan, onAskQuestion }) {
  expert = normalizeExpertRecord(expert);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [shareToast, setShareToast] = useState('');
  const [dragY, setDragY] = useState(0);
  const dragStartYRef = useRef(0);
  const dragReadyRef = useRef(false);
  const shareToastRef = useRef(null);

  useEffect(() => {
    trackAppEvent('expert:view', {
      type: APG_EVENT_TYPES.EXPERT_OPENED,
      user,
      entityType: 'expert',
      entityId: expert.id,
      payload: { expertId: expert.id, title: expert.name, category: expert.category || expert.categoryLabel },
    });
    userAction('publicQr:view', { type: 'expert', id: expert.id, metric: 'view' }).catch(() => {});
  }, []);

  const showToast = (msg) => {
    setShareToast(msg);
    clearTimeout(shareToastRef.current);
    shareToastRef.current = setTimeout(() => setShareToast(''), 2500);
  };

  const handleShare = () => {
    const deepLink = shareLink('expert', expert.id);

    const textLines = [
      `${expert.name} — эксперт АПГ Зеленоград! ⭐`,
      expert.specialization && expert.specialization,
      expert.description   && expert.description.slice(0, 120),
      'Присоединяйся к Альянсу Партнёров Города.',
      `👉 ${deepLink}`,
    ].filter(Boolean).join('\n');

    if (isVK()) {
      vkBridge.send('VKWebAppCopyText', { text: textLines })
        .then(() => showToast('📋 Скопировано!'))
        .catch(() => showToast('❌ Ошибка'));
      return;
    }

    const webText = textLines.split('\n').slice(0, -1).join('\n');
    if (navigator.share) {
      navigator.share({ url: deepLink, text: webText })
        .then(() => showToast('✅ Поделились!'))
        .catch(() => {
          navigator.clipboard?.writeText(textLines)
            .then(() => showToast('📋 Скопировано'))
            .catch(() => showToast('❌ Ошибка'));
        });
    } else {
      navigator.clipboard?.writeText(textLines)
        .then(() => showToast('📋 Скопировано'))
        .catch(() => showToast('❌ Ошибка'));
    }
  };
  const openExpertContact = (url, target = 'contact', options = undefined) => {
    trackAppEvent(target === 'booking' ? 'expert:book' : 'expert:contact_open', {
      type: target === 'booking' ? APG_EVENT_TYPES.EXPERT_BOOKED : APG_EVENT_TYPES.EXPERT_CONTACT_OPENED,
      user,
      entityType: 'expert',
      entityId: expert.id,
      payload: { expertId: expert.id, title: expert.name, target },
    });
    if (options) openNormalizedUrl(openUrl, url, options);
    else openNormalizedUrl(openUrl, url);
  };
  const callExpert = () => {
    trackAppEvent('expert:contact_open', {
      type: APG_EVENT_TYPES.EXPERT_CONTACT_OPENED,
      user,
      entityType: 'expert',
      entityId: expert.id,
      payload: { expertId: expert.id, title: expert.name, target: 'phone' },
    });
    openUrl(expert.telHref);
  };
  const openExpertMap = () => {
    trackAppEvent('expert:contact_open', {
      type: APG_EVENT_TYPES.EXPERT_CONTACT_OPENED,
      user,
      entityType: 'expert',
      entityId: expert.id,
      payload: { expertId: expert.id, title: expert.name, target: 'map' },
    });
    openUrl(expert.latitude && expert.longitude ? `https://yandex.ru/maps/?pt=${expert.longitude},${expert.latitude}&z=16&l=map` : `https://yandex.ru/maps/?text=${encodeURIComponent(expert.address)}`);
  };
  const startExpertScan = () => {
    trackAppEvent('expert:qr_scan_start', {
      type: APG_EVENT_TYPES.QR_SCAN_STARTED,
      user,
      entityType: 'expert',
      entityId: expert.id,
      payload: { expertId: expert.id, title: expert.name, source: 'expert_card' },
    });
    onClose();
    onScan?.();
  };
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!expert?.id) return;
    let cancelled = false;
    setReviewsLoading(true);
    getDocs(query(collection(db, 'expertReviews'), where('expertId', '==', expert.id)))
      .then(snap => {
        if (cancelled) return;
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ?? 0);
            const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ?? 0);
            return tb - ta;
          });
        setReviews(list);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setReviewsLoading(false); });
    return () => { cancelled = true; };
  }, [expert?.id]);

  const handleSubmitReview = async () => {
    if (!user || !myRating || submitting) return;
    if (String(user.id).startsWith('guest_')) return;
    setSubmitting(true);
    try {
      const reviewData = {
        expertId: expert.id,
        userId: String(user.id),
        userName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
        userPhoto: user.photo_200 ?? null,
        rating: myRating,
        text: myText.trim(),
      };
      const result = await userAction('review:expert', {
        userId: String(user.id),
        expertId: expert.id,
        rating: myRating,
        text: myText.trim(),
        userName: reviewData.userName,
        userPhoto: reviewData.userPhoto,
      });
      if (mountedRef.current) {
        setReviews(prev => [{ id: result.review?.id || `local_${Date.now()}`, ...reviewData, createdAt: { toDate: () => new Date() } }, ...prev]);
        setSubmitDone(true);
        setMyRating(0);
        setMyText('');
      }
    } catch (e) { logError(e, 'ExpertsPage.submitReview'); }
    finally { if (mountedRef.current) setSubmitting(false); }
  };

  const hasScanned = scannedExperts?.[expert.id];
  const canBook = expert.bookingUrl || expert.vkUrl || expert.phone;
  const category = getExpertCategory(expert.category);

  if (variant === 'v2') {
    const heroImage = getProfileImage(expert);
    const galleryItems = expert.gallery?.length ? expert.gallery : [heroImage].filter(Boolean);
    const status = expert.verified ? 'Проверенный эксперт' : expert.premium ? 'Premium' : 'Эксперт АПГ';
    const heroBadges = [
      ...expert.categories.map(value => getExpertCategory(value)).filter(Boolean).map(value => `${value.emoji} ${value.label}`),
      (expert.avgRating ?? 0) > 0 ? `★ ${expert.avgRating.toFixed(1)} · ${expert.reviewCount ?? reviews.length}` : null,
    ].filter(Boolean);
    const cta = [
      expert.telHref && { label: 'Позвонить', icon: '📞', onClick: callExpert, tone: 'gold' },
      expert.bookingUrl && { label: 'Записаться', icon: '📅', onClick: () => openExpertContact(expert.bookingUrl, 'booking'), tone: 'gold' },
      expert.whatsappUrl && { label: 'WhatsApp', icon: '🟢', onClick: () => openExpertContact(expert.whatsappUrl, 'whatsapp', { platform: 'whatsapp' }) },
      expert.websiteUrl && { label: 'Сайт', icon: '🌐', onClick: () => openExpertContact(expert.websiteUrl, 'website') },
      expert.vkUrl && { label: 'VK', icon: '🔵', onClick: () => openExpertContact(expert.vkUrl, 'vk', { platform: 'vk' }) },
      expert.telegramUrl && { label: 'Telegram', icon: '✈️', onClick: () => openExpertContact(expert.telegramUrl, 'telegram', { platform: 'telegram' }) },
      expert.maxUrl && { label: 'MAX', icon: '💬', onClick: () => openExpertContact(expert.maxUrl, 'max', { platform: 'max' }) },
      onAskQuestion && { label: 'Задать вопрос', icon: '💬', onClick: () => onAskQuestion(expert), tone: 'gold' },
      { label: 'Поделиться', icon: '↗', onClick: handleShare },
    ].filter(Boolean);

    return createPortal(
      <>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 12000, background: APG2.bg, overflowY: 'auto', color: APG2.text }}
          onTouchStart={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}
        >
          {shareToast && (
            <div style={{ position: 'fixed', top: 'calc(var(--safe-top, 0px) + 60px)', left: '50%', transform: 'translateX(-50%)', zIndex: 20000, ...APG2.glass, borderRadius: 18, padding: '11px 18px', fontSize: 13, fontWeight: 760, color: APG2.text, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {shareToast}
            </div>
          )}
          <div style={{ position: 'sticky', top: 0, zIndex: 50, padding: 'calc(8px + var(--safe-top, 0px)) 16px 8px', background: 'linear-gradient(180deg,var(--apg2-header-bg-strong, rgba(17,17,19,0.92)),var(--apg2-header-bg-soft, rgba(17,17,19,0.56)),transparent)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={onClose} style={{ ...APG2.glass, width: 42, height: 42, borderRadius: 18, color: APG2.text, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
              <div style={{ flex: 1, minWidth: 0, color: APG2.textSoft, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expert.name}</div>
              <button onClick={handleShare} style={{ ...APG2.glass, width: 42, height: 42, borderRadius: 18, color: APG2.textSoft, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>↗</button>
            </div>
          </div>
          <main style={{ padding: '0 16px', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', maxWidth: 520, margin: '0 auto' }}>
            <ProfileHero
              image={heroImage}
              title={expert.name}
              subtitle={expert.specialization || 'Эксперт города'}
              status={status}
              avatar={<ExpertAvatar expert={expert} size={66} />}
              badges={heroBadges}
              description={expert.offer || expert.description || 'Проверенный специалист в экосистеме АПГ.'}
            />

            <GlassSection title="Действия">
              {cta.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {cta.map(item => (
                    <GlassButton key={item.label} onClick={item.onClick} tone={item.tone}>
                      <span>{item.icon}</span><span>{item.label}</span>
                    </GlassButton>
                  ))}
                </div>
              ) : (
                <div style={{ ...APG2.glass, borderRadius: 30, padding: 22, color: APG2.textSoft, textAlign: 'center' }}>Контакты скоро появятся.</div>
              )}
            </GlassSection>

            {expert.offer && (
              <GlassSection title="Акция">
                <div style={{ ...APG2.goldGlass, borderRadius: 34, padding: 18, color: APG2.text, display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 54, height: 54, borderRadius: 20, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎁</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.68, marginBottom: 5 }}>Для участников АПГ</div>
                    <div style={{ fontSize: 16, lineHeight: '22px', fontWeight: 800 }}>{expert.offer}</div>
                  </div>
                </div>
              </GlassSection>
            )}

            <GlassSection title="Описание">
              <div style={{ ...APG2.glass, borderRadius: 34, padding: 18 }}>
                {expert.description ? (
                  <RichText color={APG2.textSoft} fontSize={15}>{isVK() ? sanitizeForVK(expert.description) : expert.description}</RichText>
                ) : (
                  <div style={{ color: APG2.textSoft, fontSize: 15, lineHeight: '22px' }}>Описание эксперта пока готовится.</div>
                )}
                {expert.formats?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                    {expert.formats.map(f => <FormatChip key={f} format={f} />)}
                  </div>
                )}
              </div>
            </GlassSection>

            {(expert.services || expert.experience || expert.serviceCost) && (
              <GlassSection title="Профессиональная информация">
                <div style={{ ...APG2.glass, borderRadius: 34, padding: 18, display: 'grid', gap: 14 }}>
                  {expert.services && <div><div style={{ color: APG2.gold, fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Услуги</div><RichText color={APG2.textSoft} fontSize={14}>{expert.services}</RichText></div>}
                  {expert.experience && <div><div style={{ color: APG2.gold, fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Опыт</div><div style={{ color: APG2.textSoft, fontSize: 14, lineHeight: '21px' }}>{expert.experience}</div></div>}
                  {expert.serviceCost && <div><div style={{ color: APG2.gold, fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Стоимость услуг</div><div style={{ color: APG2.text, fontSize: 15, fontWeight: 800 }}>{expert.serviceCost}</div></div>}
                </div>
              </GlassSection>
            )}

            {(expert.address || expert.hours) && (
              <GlassSection title="Где и когда">
                <div style={{ ...APG2.glass, borderRadius: 34, padding: 18, display: 'grid', gap: 10, color: APG2.textSoft, fontSize: 14, lineHeight: '20px' }}>
                  {expert.address && <div>📍 {expert.address}</div>}
                  {expert.hours && <div>🕒 {expert.hours}</div>}
                  {(expert.latitude && expert.longitude || expert.address) && <GlassButton onClick={openExpertMap}>Открыть на карте</GlassButton>}
                </div>
              </GlassSection>
            )}

            <GlassSection title="Фото">
              <ProfileGallery items={galleryItems} onOpen={expert.gallery?.length ? setLightboxIdx : null} />
            </GlassSection>

            {expert.videos?.length > 0 && (
              <GlassSection title="Видео">
                <div style={{ ...APG2.glass, borderRadius: 34, padding: 14, overflow: 'hidden' }}>
                  <VideoSection videos={expert.videos} />
                </div>
              </GlassSection>
            )}

            <GlassSection title="Получить ключ">
              <div style={{ ...APG2.glass, borderRadius: 30, padding: 18, display: 'grid', gap: 16, border: hasScanned ? '1px solid rgba(75,179,75,0.34)' : '1px solid rgba(215,184,106,0.24)' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: APG2.gold, background: hasScanned ? 'rgba(75,179,75,0.14)' : APG2.goldSoft, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 14px 32px rgba(215,184,106,0.14)' }}>{hasScanned ? '✓' : '🎁'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: APG2.text, fontSize: 17, lineHeight: '22px', fontWeight: 840 }}>{hasScanned ? 'Консультация уже отмечена' : 'Получите ключ за консультацию'}</div>
                    <div style={{ color: hasScanned ? '#7fe18b' : APG2.textMuted, fontSize: 13, marginTop: 6, lineHeight: '19px' }}>
                      {hasScanned ? 'Повторный скан не создаёт дубль, но визит остаётся в истории.' : 'После консультации попросите эксперта показать QR-код АПГ. Отсканируйте его через приложение, и ключ поступит на ваш аккаунт.'}
                    </div>
                  </div>
                </div>
                <GlassButton onClick={startExpertScan} tone="gold" style={{ width: '100%', minHeight: 50, borderRadius: 21, fontSize: 15, color: '#17120a', opacity: onScan ? 1 : 0.55 }}>
                  📷 Сканировать QR
                </GlassButton>
              </div>
            </GlassSection>

            <GlassSection title={`Отзывы${reviews.length ? ` · ${reviews.length}` : ''}`}>
              {user && !String(user.id).startsWith('guest_') && !submitDone && (
                <div style={{ ...APG2.glass, borderRadius: 30, padding: 16, marginBottom: 12 }}>
                  <div style={{ color: APG2.text, fontSize: 15, fontWeight: 780, marginBottom: 10 }}>Оставить отзыв</div>
                  <StarPicker value={myRating} onChange={setMyRating} />
                  <textarea value={myText} onChange={e => setMyText(e.target.value)} placeholder="Расскажите о своём опыте..." style={{ width: '100%', marginTop: 12, padding: '12px 13px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: APG2.text, fontSize: 16, resize: 'vertical', minHeight: 78, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
                  <GlassButton onClick={handleSubmitReview} tone="gold" style={{ marginTop: 10, opacity: !myRating || submitting ? 0.55 : 1 }}>{submitting ? '...' : 'Опубликовать'}</GlassButton>
                </div>
              )}
              {reviewsLoading ? (
                <div style={{ ...APG2.glass, borderRadius: 28, padding: 22, color: APG2.textMuted, textAlign: 'center' }}>Загружаем отзывы...</div>
              ) : reviews.length === 0 ? (
                <div style={{ ...APG2.glass, borderRadius: 34, padding: 28, textAlign: 'center' }}>
                  <div style={{ color: APG2.text, fontSize: 18, fontWeight: 780, marginBottom: 6 }}>Отзывов пока нет</div>
                  <div style={{ color: APG2.textMuted, fontSize: 13, lineHeight: '19px' }}>Первый отзыв появится здесь красиво.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x mandatory' }} onTouchStart={e => e.stopPropagation()}>
                  {reviews.map(r => <ProfileReviewCard key={r.id} review={r} textFallback="Гость оценил консультацию без комментария." />)}
                </div>
              )}
            </GlassSection>
          </main>
        </div>
        {lightboxIdx !== null && expert.gallery?.length > 0 && (
          <PhotoLightbox photos={expert.gallery} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
        )}
      </>,
      document.body,
    );
  }

  return createPortal(
    <>
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div
        onTouchStart={(e) => {
          e.stopPropagation();
          dragStartYRef.current = e.touches[0].clientY;
          dragReadyRef.current = e.currentTarget.scrollTop <= 2;
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
          if (!dragReadyRef.current) return;
          const dy = e.touches[0].clientY - dragStartYRef.current;
          if (dy > 0) setDragY(Math.min(dy, 190));
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          const shouldClose = dragY > 92;
          setDragY(0);
          dragReadyRef.current = false;
          if (shouldClose) onClose();
        }}
        onTouchCancel={() => { setDragY(0); dragReadyRef.current = false; }}
        style={{ ...GLASS_STRONG, borderRadius: '28px 28px 0 0', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '20px 20px 52px', transform: `translate3d(0, ${dragY}px, 0)`, transition: dragY ? 'none' : motionTransition(['transform'], 'base') }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, margin: '0 auto 20px' }} />
        {shareToast && (
          <div style={{ position: 'fixed', top: 'calc(var(--safe-top, 0px) + 60px)', left: '50%', transform: 'translateX(-50%)', zIndex: 20000, background: 'rgba(30,30,50,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {shareToast}
          </div>
        )}

        {/* Обложка */}
        {expert.coverPhoto && (
          <div style={{ position:'relative', height:160, borderRadius:16, overflow:'hidden', margin:'-4px -4px 16px' }}>
            <img src={expert.coverPhoto} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e => e.target.parentElement.style.display='none'} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, rgba(15,15,46,0.85))' }} />
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ExpertAvatar expert={expert} size={80} />
            {expert.verified && (
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%', background: T.blue, border: `2px solid ${T.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 800 }}>✓</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.textPri, marginBottom: 3, lineHeight: '22px' }}>{expert.name}</div>
            <div style={{ fontSize: 13, color: T.gold, fontWeight: 600, marginBottom: 8 }}>{expert.specialization}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {expert.verified && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(74,144,217,0.12)', border: '1px solid rgba(74,144,217,0.28)', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#6AABEC' }}>
                  ✓ Верифицирован АПГ
                </div>
              )}
              {(() => { const cat = getExpertCategory(expert.category); return cat ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: T.gold }}>
                  {cat.emoji} {cat.label}
                </div>
              ) : null; })()}
            </div>
          </div>
          <button onClick={handleShare} style={{ background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: T.textSec, flexShrink: 0, pointerEvents: 'auto' }}>📤</button>
          <button onClick={onClose} style={{ background: T.chipBg, border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: T.textSec, flexShrink: 0 }}>✕</button>
        </div>

        {/* Rating */}
        {(expert.avgRating ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <StarDisplay value={expert.avgRating} size={15} />
            <span style={{ fontSize: 13, color: T.textSec }}>{expert.avgRating?.toFixed(1)} · {pluralReviews(expert.reviewCount ?? 0)}</span>
          </div>
        )}

        {/* Formats */}
        {expert.formats?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {expert.formats.map(f => <FormatChip key={f} format={f} />)}
          </div>
        )}

        {/* Description */}
        {expert.description && (
          <div style={{ ...GLASS, borderRadius: 16, padding: '14px', marginBottom: 14 }}>
            <RichText color={T.textSec} fontSize={13}>{isVK() ? sanitizeForVK(expert.description) : expert.description}</RichText>
          </div>
        )}

        {/* Спецпредложение */}
        {expert.offer && (
          <div style={{ marginBottom: 14, borderRadius: 20, background: 'linear-gradient(135deg,rgba(201,168,76,0.13),rgba(232,201,122,0.08))', border: '1px solid rgba(201,168,76,0.3)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 26, flexShrink: 0 }}>🎁</div>
            <div>
              <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>Предложение для участников АПГ</div>
              <div style={{ fontSize: 14, color: T.textPri, fontWeight: 600 }}>{expert.offer}</div>
            </div>
          </div>
        )}

        {/* Штамп-карта */}
        {expert.stampTarget > 0 && (() => {
          const raw     = scannedExperts?.[expert.id];
          const stamps  = Number(raw) || (raw ? 1 : 0);
          const target  = expert.stampTarget;
          const filled  = Math.min(stamps, target);
          const done    = stamps >= target;
          return (
            <div style={{ marginBottom: 14, borderRadius: 20, padding: '16px 18px', background: done ? 'rgba(201,168,76,0.1)' : T.chipBg, border: `1px solid ${done ? 'rgba(201,168,76,0.4)' : T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: done ? T.gold : T.textSec, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>🎟️ Штамп-карта</div>
                <div style={{ fontSize: 12, color: done ? T.gold : T.textSec, fontWeight: 700 }}>{filled} / {target}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {Array.from({ length: target }, (_, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${i < filled ? T.gold : T.border}`, background: i < filled ? `linear-gradient(135deg,${T.gold},${T.goldL})` : 'transparent', flexShrink: 0, transition: 'all 0.3s', boxShadow: i < filled ? '0 0 8px rgba(201,168,76,0.4)' : 'none' }} />
                ))}
              </div>
              <div style={{ fontSize: 13, color: done ? T.gold : T.textSec, fontWeight: done ? 700 : 400 }}>
                {done ? 'Карта заполнена! Попросите награду у эксперта 🎉' : `Ещё ${target - filled} визит${target - filled === 1 ? '' : target - filled < 5 ? 'а' : 'ов'} до награды`}
              </div>
            </div>
          );
        })()}

        {/* Галерея */}
        {(expert.gallery?.length > 0) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>✦ Галерея</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {expert.gallery.map((url, i) => (
                <button key={i} onClick={() => setLightboxIdx(i)} style={{ padding: 0, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'none', aspectRatio: '1' }}>
                  <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => e.target.parentElement.style.display='none'} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Видео */}
        {expert.videos?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <VideoSection videos={expert.videos} />
          </div>
        )}

        {/* Кнопки действий */}
        {(canBook || expert.websiteUrl || expert.telegramUrl || expert.vkUrl || expert.maxUrl || expert.whatsappUrl) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {expert.telHref && (
              <button onClick={callExpert} style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg,${T.green},#3a9a3a)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                📞 Позвонить
              </button>
            )}
            {expert.bookingUrl && (
              <button onClick={() => openExpertContact(expert.bookingUrl, 'booking')} style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg,${T.gold},${T.goldL})`, color: '#0F0F1A', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(201,168,76,0.35)' }}>
                📅 Записаться онлайн
              </button>
            )}
            {expert.whatsappUrl && (
              <button onClick={() => openExpertContact(expert.whatsappUrl, 'whatsapp', { platform: 'whatsapp' })} style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#25D366,#149F4A)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>🟢 WhatsApp</button>
            )}
            {expert.websiteUrl && (
              <button onClick={() => openExpertContact(expert.websiteUrl, 'website')} style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: T.textPri, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                🌐 Сайт
              </button>
            )}
            {expert.vkUrl && (
              <button onClick={() => openExpertContact(expert.vkUrl, 'vk', { platform: 'vk' })} style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg,#4A76A8,#2D5F8A)`, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                🔵 ВКонтакте
              </button>
            )}
            {expert.telegramUrl && (
              <button onClick={() => openExpertContact(expert.telegramUrl, 'telegram', { platform: 'telegram' })} style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#2AABEE,#1D8EC4)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                ✈️ Telegram
              </button>
            )}
            {expert.maxUrl && (
              <button onClick={() => openExpertContact(expert.maxUrl, 'max', { platform: 'max' })} style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7B5EA7,#5B3F87)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                💬 Max
              </button>
            )}
          </div>
        )}

        <div style={{ ...GLASS, borderRadius: 20, padding: '16px', marginBottom: 16, border: hasScanned ? '1px solid rgba(75,179,75,0.3)' : '1px solid rgba(201,168,76,0.18)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 16, background: hasScanned ? 'rgba(75,179,75,0.12)' : T.gold + '18', color: hasScanned ? '#4BB34B' : T.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{hasScanned ? '✓' : '🎁'}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.textPri, marginBottom: 3 }}>{hasScanned ? 'Консультация отмечена' : 'Получите ключ за консультацию'}</div>
              <div style={{ fontSize: 12, color: hasScanned ? '#4BB34B' : T.textSec, lineHeight: '17px' }}>{hasScanned ? 'Повторный скан не создаёт дубль.' : 'Попросите эксперта показать QR-код АПГ и отсканируйте его.'}</div>
            </div>
          </div>
          <button onClick={startExpertScan} style={{ width: '100%', padding: '13px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg,${T.gold},${T.goldL})`, color: '#17120a', fontSize: 14, fontWeight: 850, cursor: 'pointer', opacity: onScan ? 1 : 0.55 }}>
            📷 Сканировать QR
          </button>
        </div>

        {/* Reviews */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, marginBottom: 12 }}>Отзывы</div>

          {user && !String(user.id).startsWith('guest_') && !submitDone && (
            <div style={{ ...GLASS, borderRadius: 16, padding: '14px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textPri, marginBottom: 10 }}>Оставить отзыв</div>
              <div style={{ marginBottom: 10 }}>
                <StarPicker value={myRating} onChange={setMyRating} />
              </div>
              <textarea
                value={myText}
                onChange={e => setMyText(e.target.value)}
                placeholder="Расскажите о своём опыте..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.chipBg, color: T.textPri, fontSize: 16, resize: 'vertical', minHeight: 72, boxSizing: 'border-box', outline: 'none', marginBottom: 10, fontFamily: 'inherit' }}
              />
              <button
                onClick={handleSubmitReview}
                disabled={!myRating || submitting}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: myRating ? `linear-gradient(135deg,${T.gold},${T.goldL})` : T.chipBg, color: myRating ? '#0F0F1A' : T.textSec, fontSize: 13, fontWeight: 700, cursor: myRating ? 'pointer' : 'default' }}
              >
                {submitting ? '...' : 'Опубликовать'}
              </button>
            </div>
          )}

          {submitDone && (
            <div style={{ ...GLASS, borderRadius: 16, padding: '14px', marginBottom: 12, border: '1px solid rgba(75,179,75,0.3)' }}>
              <div style={{ fontSize: 14, color: '#4BB34B', fontWeight: 700, textAlign: 'center' }}>✓ Отзыв опубликован. Спасибо!</div>
            </div>
          )}

          {reviewsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2].map(i => (
                <div key={i} style={{ ...GLASS, borderRadius: 16, padding: '14px', animation: 'shimmer 1.5s ease-in-out infinite' }}>
                  <div style={{ width: '45%', height: 10, background: T.chipBg, borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ width: '75%', height: 12, background: T.chipBg, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div style={{ ...GLASS, borderRadius: 16, padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 13, color: T.textSec }}>Отзывов пока нет. Будьте первым!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
            </div>
          )}
        </div>
      </div>
    </div>
    {lightboxIdx !== null && expert.gallery?.length > 0 && (
      <PhotoLightbox photos={expert.gallery} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
    )}
    </>,
    document.body,
  );
}

function ExpertCard({ expert, index, onClick, isTop }) {
  return (
    <div
      onClick={() => onClick(expert)}
      style={{ ...GLASS, borderRadius: 20, padding: '16px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', animation: 'fadeInUp 0.35s ease both', animationDelay: `${index * 0.05}s`, ...(isTop ? { border: '1.5px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.06)' } : {}) }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <ExpertAvatar expert={expert} size={64} />
        {expert.verified && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: T.blue, border: `2px solid ${T.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 800 }}>✓</div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: '19px' }}>{expert.name}</div>
          {isTop && <div style={{ fontSize: 10, fontWeight: 700, color: T.gold, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>🌟 В топе</div>}
        </div>
        <div style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 6 }}>{expert.specialization}</div>

        {(expert.avgRating ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <StarDisplay value={expert.avgRating} size={12} />
            <span style={{ fontSize: 11, color: T.textSec }}>{expert.avgRating?.toFixed(1)} · {expert.reviewCount ?? 0}</span>
          </div>
        )}

        {expert.formats?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
            {expert.formats.map(f => <FormatChip key={f} format={f} />)}
          </div>
        )}
        {(() => { const cat = getExpertCategory(expert.category); return cat ? (
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{cat.emoji} {cat.label}</div>
        ) : null; })()}
      </div>

      <div style={{ color: T.gold, fontSize: 18, flexShrink: 0, alignSelf: 'center' }}>›</div>
    </div>
  );
}

export function ExpertCardV2({ expert, onClick, isTop }) {
  expert = normalizeExpertRecord(expert);
  const image = getProfileImage(expert);
  const cat = getExpertCategory(expert.category);
  return (
    <GlassCard onClick={() => onClick(expert)} style={{ minHeight: 132, padding: 0, overflow: 'hidden', position: 'relative', borderRadius: 26 }}>
      {image && <img src={image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.38, filter: 'saturate(1.05) contrast(1.02)' }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(125deg,rgba(12,12,14,0.86),rgba(12,12,14,0.42) 58%,rgba(12,12,14,0.86))' }} />
      <div style={{ position: 'relative', zIndex: 1, padding: 14, minHeight: 132, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <ExpertAvatar expert={expert} size={48} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isTop && <GlassBadge tone="gold">В топе</GlassBadge>}
            {cat && <GlassBadge>{cat.emoji} {cat.label}</GlassBadge>}
          </div>
        </div>
        <div>
          <div style={{ color: APG2.text, fontSize: 17, lineHeight: '21px', fontWeight: 830, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{expert.name || 'Эксперт АПГ'}</div>
          <div style={{ marginTop: 4, color: APG2.gold, fontSize: 12, lineHeight: '16px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expert.specialization || 'Консультации и услуги'}</div>
          {(expert.avgRating ?? 0) > 0 && <div style={{ marginTop: 5, color: APG2.textSoft, fontSize: 11 }}>★ {expert.avgRating.toFixed(1)} · {expert.reviewCount ?? 0}</div>}
        </div>
      </div>
    </GlassCard>
  );
}

const FILTERS = [
  { id: 'all',     label: 'Все',     emoji: '✦' },
  { id: 'online',  label: 'Онлайн', emoji: '💻' },
  { id: 'offline', label: 'Офлайн', emoji: '📍' },
  { id: 'group',   label: 'Группа', emoji: '👥' },
];

export function ExpertsPage({ nav, variant = 'v2', experts = [], user, scannedExperts = {}, onBack, isActive, initialExpertId = null, onScan, onExpertOpen, onAskQuestion }) {
  const [filter, setFilter] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [rotation, setRotation] = useState({});
  const directoryExperts = useMemo(() => experts.map(normalizeExpertRecord), [experts]);
  const CATEGORY_FILTERS = useMemo(() => [{ id: 'all', label: 'Все', emoji: '✦' }, ...EXPERT_CATEGORIES], [experts]);
  const openExpert = (expert) => {
    onExpertOpen?.(expert);
    setSelected(expert);
  };

  useEffect(() => {
    if (!initialExpertId || !directoryExperts.length || selected) return;
    const e = directoryExperts.find(e => e.id === initialExpertId);
    if (e) openExpert(e);
  }, [initialExpertId, directoryExperts, selected]);

  useEffect(() => {
    const currentWeek = getISOWeekKey();
    getDocs(collection(db, 'expertRotation')).then(snap => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.weekKey === currentWeek) map[d.id] = data.expertId;
      });
      setRotation(map);
    }).catch(() => {});
  }, []);

  const topExperts = useMemo(() => {
    return Object.entries(rotation)
      .map(([catId, expertId]) => {
        const e = directoryExperts.find(x => x.id === expertId && x.active !== false);
        if (!e) return null;
        const cat = getExpertCategory(catId);
        return { ...e, _topCategory: cat };
      })
      .filter(Boolean);
  }, [rotation, directoryExperts]);

  const topIds = useMemo(() => new Set(Object.values(rotation)), [rotation]);

  const filtered = useMemo(() => {
    const list = directoryExperts.filter(e => {
      if (e.active === false) return false;
      if (filter !== 'all' && !e.formats?.includes(filter)) return false;
      if (activeCategory !== 'all' && !e.categories.includes(activeCategory)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const categoryText = e.categories.map(id => getExpertCategory(id)?.label || id).join(' ');
        return [e.name, e.specialization, e.description, e.services, e.offer, e.experience, categoryText].some(value => String(value || '').toLowerCase().includes(q));
      }
      return true;
    });
    return list.sort((a, b) => {
      const aTop = topIds.has(a.id) ? 0 : 1;
      const bTop = topIds.has(b.id) ? 0 : 1;
      return aTop - bTop;
    });
  }, [directoryExperts, filter, activeCategory, search, topIds]);

  useEffect(() => {
    if (!isActive && selected) setSelected(null);
  }, [isActive, selected]);

  useEffect(() => {
    if (!selected) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  if (variant === 'v2') {
    return (
      <>
        <GlassPanel>
          <div style={{ position: 'sticky', top: 0, zIndex: 40, margin: 'calc(-14px - var(--safe-top, 0px)) -16px 14px', padding: 'calc(14px + var(--safe-top, 0px)) 16px 12px', background: 'linear-gradient(180deg,var(--apg2-header-bg-strong, rgba(17,17,19,0.96)),var(--apg2-header-bg-soft, rgba(17,17,19,0.78)),transparent)', backdropFilter: 'blur(26px) saturate(1.45)', WebkitBackdropFilter: 'blur(26px) saturate(1.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <GlassButton onClick={onBack} style={{ width: 40, height: 40, minHeight: 40, borderRadius: 16, padding: 0, fontSize: 20 }}>‹</GlassButton>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: APG2.text, fontSize: 22, lineHeight: '26px', fontWeight: 840 }}>Эксперты</div>
                <div style={{ color: APG2.textMuted, fontSize: 12, marginTop: 2 }}>Проверенные специалисты города</div>
              </div>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени или специализации..."
              style={{ width: '100%', boxSizing: 'border-box', ...APG2.glass, borderRadius: 20, padding: '11px 13px', color: APG2.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 0 2px', WebkitOverflowScrolling: 'touch' }} onTouchStart={e => e.stopPropagation()}>
              {FILTERS.map(opt => (
                <GlassButton key={opt.id} onClick={() => setFilter(opt.id)} tone={filter === opt.id ? 'gold' : 'glass'} style={{ minHeight: 34, borderRadius: 999, padding: '7px 11px', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {opt.emoji} {opt.label}
                </GlassButton>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 0 2px', WebkitOverflowScrolling: 'touch' }} onTouchStart={e => e.stopPropagation()}>
              {CATEGORY_FILTERS.map(category => (
                <GlassButton key={category.id} onClick={() => setActiveCategory(category.id)} tone={activeCategory === category.id ? 'gold' : 'glass'} style={{ minHeight: 34, borderRadius: 999, padding: '7px 11px', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {category.emoji} {category.label}
                </GlassButton>
              ))}
            </div>
          </div>

          {topExperts.length > 0 && filter === 'all' && activeCategory === 'all' && !search.trim() && (
            <GlassSection title="В топе недели">
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }} onTouchStart={e => e.stopPropagation()}>
                {topExperts.map(e => (
                  <button key={e.id} onClick={() => openExpert(e)} style={{ ...APG2.glass, width: 144, minHeight: 132, flexShrink: 0, borderRadius: 26, padding: 12, color: APG2.text, textAlign: 'left', cursor: 'pointer' }}>
                    <ExpertAvatar expert={e} size={48} />
                    <div style={{ marginTop: 10, fontSize: 14, lineHeight: '18px', fontWeight: 800, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.name}</div>
                    <div style={{ marginTop: 5, color: APG2.gold, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.specialization}</div>
                  </button>
                ))}
              </div>
            </GlassSection>
          )}

          <GlassSection title={filtered.length ? `${filtered.length} специалистов` : 'Ничего не найдено'}>
            {filtered.length === 0 ? (
              <GlassCard style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ color: APG2.text, fontSize: 18, fontWeight: 820, marginBottom: 7 }}>{experts.length === 0 ? 'Эксперты скоро появятся' : 'Нет совпадений'}</div>
                <div style={{ color: APG2.textMuted, fontSize: 14, lineHeight: '20px' }}>{experts.length === 0 ? 'Мы добавляем проверенных специалистов для участников АПГ.' : 'Попробуйте другой фильтр или поисковый запрос.'}</div>
              </GlassCard>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {filtered.map(expert => <ExpertCardV2 key={expert.id} expert={expert} onClick={openExpert} isTop={topIds.has(expert.id)} />)}
              </div>
            )}
          </GlassSection>
        </GlassPanel>

        {selected && (
          <ExpertModal
            expert={selected}
            user={user}
            scannedExperts={scannedExperts}
            onClose={() => setSelected(null)}
            variant={variant}
            onScan={onScan}
            onAskQuestion={onAskQuestion}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow: 'inset 0 -1px 0 var(--c-border, rgba(0,0,0,0.12))', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: `1px solid ${T.headerBorder}`, borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>🧑‍💼 Эксперты</div>
        </div>

        <div style={{ paddingBottom: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени или специализации..."
            style={{ width: '100%', padding: '9px 14px', borderRadius: 14, border: `1px solid ${T.border}`, background: T.chipBg, color: T.textPri, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, paddingBottom: 8, overflowX: 'auto' }} onTouchStart={e => e.stopPropagation()}>
          {FILTERS.map(opt => (
            <button key={opt.id} onClick={() => setFilter(opt.id)} style={{ padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, background: filter === opt.id ? T.gold : T.chipBg, color: filter === opt.id ? '#0F0F1A' : T.textSec, transition: 'all 0.18s' }}>
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>

        <div style={{ paddingBottom: 10 }} onTouchStart={e => e.stopPropagation()}>
          <HorizontalScroll>
            <div style={{ display: 'flex', gap: 8, padding: '0 2px' }}>
              {CATEGORY_FILTERS.map(c => (
                <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{ padding: '5px 12px', borderRadius: 16, border: activeCategory === c.id ? 'none' : `1px solid ${T.chipBorder ?? 'rgba(255,255,255,0.12)'}`, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, background: activeCategory === c.id ? `linear-gradient(135deg,${T.gold},${T.goldL})` : T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', color: activeCategory === c.id ? '#0F0F1A' : T.chipText ?? T.textSec, transition: 'all 0.18s' }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </HorizontalScroll>
        </div>
      </div>

      <div style={{ padding: '12px 16px 90px', minHeight: '100%' }}>
        {topExperts.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.textSec, marginBottom: 10, letterSpacing: 0.3, textTransform: 'uppercase' }}>🌟 В топе на этой неделе</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} onTouchStart={e => e.stopPropagation()}>
              {topExperts.map(e => (
                <div key={e.id} onClick={() => openExpert(e)} style={{ flexShrink: 0, width: 140, background: 'rgba(201,168,76,0.08)', border: '1.5px solid rgba(201,168,76,0.35)', borderRadius: 20, padding: '14px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                  <ExpertAvatar expert={e} size={56} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textPri, lineHeight: '16px', marginBottom: 3 }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: T.gold, fontWeight: 600, marginBottom: 4 }}>{e.specialization}</div>
                    {e._topCategory && <div style={{ fontSize: 11, color: T.textSec }}>{e._topCategory.emoji} {e._topCategory.label}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ ...GLASS, borderRadius: 24, padding: '40px 20px', textAlign: 'center', marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 52 }}>🧑‍💼</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.textPri, marginBottom: 6 }}>
                {experts.length === 0 ? 'Эксперты скоро появятся' : 'Нет совпадений'}
              </div>
              <div style={{ fontSize: 13, color: T.textSec, lineHeight: '19px' }}>
                {experts.length === 0
                  ? 'Мы добавляем проверенных специалистов для участников АПГ'
                  : 'Попробуйте другой фильтр или поисковый запрос'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: T.textSec, marginBottom: 2 }}>
              {filtered.length} {filtered.length === 1 ? 'эксперт' : filtered.length < 5 ? 'эксперта' : 'экспертов'}
            </div>
            {filtered.map((expert, i) => (
              <ExpertCard key={expert.id} expert={expert} index={i} onClick={openExpert} isTop={topIds.has(expert.id)} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ExpertModal
          expert={selected}
          user={user}
          scannedExperts={scannedExperts}
          onClose={() => setSelected(null)}
          variant={variant}
          onScan={onScan}
          onAskQuestion={onAskQuestion}
        />
      )}
    </>
  );
}
