import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HorizontalScroll } from '@vkontakte/vkui';
import vkBridge, { openUrl, isVK } from './vk.js';

function sanitizeForVK(text) {
  if (!text) return '';
  return text
    .replace(/https?:\/\/\S+/gi, '[ссылка скрыта]')
    .replace(/\b(t\.me|telegram|tg|instagram|inst|whatsapp|youtube|youtu\.be|tiktok|rutube|max\.ru|yclients|dikidi)\S*/gi, '[скрыто]')
    .replace(/@\S+/g, '[скрыто]');
}

function formatProfileDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
}
import { db } from './firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

import { T, GLASS, GLASS_STRONG, GLASS_GOLD } from './design.js';
import { logError } from './errorLogger.js';
import { userAction } from './userApi.js';
import { APG_EVENT_TYPES, trackAppEvent } from './intelligence/index.js';
import { openNormalizedUrl } from './utils/externalUrls.js';
import { shareLink } from './utils/shareLink.js';
import { formatRelativeTime, toDate } from './utils/time.js';
import { RichText } from './components/RichText.jsx';
import { VideoSection } from './components/VideoSection.jsx';
import { ProfileTimelineSection } from './components/ProfileTimelineSection.jsx';
import { buildLivingProfileTabs } from './profileTimeline.js';
import { getCanonicalNewsId } from './newsUtils.js';
import { LivingFeedArticleSheet } from './components/LivingFeedArticleSheet.jsx';
import { canOpenBookingFlow } from './booking/BookingFlow.jsx';
import { getMainLocation, getProfileLocations, hasMultipleLocations, locationToProvider } from '../server-shared/locations.js';
import { APG2_PROFILE as APG2, ContactCard, GlassBadge, GlassButton, GlassSection, ProfileGallery, ProfileHero, ProfileReviewCard, getProfileImage } from './components/Apg2ProfileGlass.jsx';
import { ProfilePhotoGrid, ProfilePhotoViewer, ProfileVideoGrid, ProfileVideoViewer } from './components/ProfileMediaViewer.jsx';
import {
  DesktopDetailShell,
  DesktopDetailTabs,
  DesktopGallery,
  DesktopInfoGrid,
  DesktopEmptyState,
  DesktopHero,
  DesktopHeroActions,
  DesktopKpiStrip,
  DesktopMeta,
  DesktopRelated,
  DesktopSection,
  DesktopSidebarCard,
  DesktopStickyActions,
} from './components/DesktopUI.jsx';

// ─── Лайтбокс ─────────────────────────────────────────────────────────────────

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

// ─── Звёзды ────────────────────────────────────────────────────────────────────

function StarPicker({ value, onChange, size = 28 }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div style={{ display:'flex', gap:4 }}>
      {[1,2,3,4,5].map(s => (
        <button key={s} onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          style={{ background:'none', border:'none', cursor:'pointer', padding:2, fontSize:size, lineHeight:1, color: s <= display ? '#FFD700' : T.border, transition:'color 0.1s, transform 0.1s', transform: s <= display ? 'scale(1.15)' : 'scale(1)' }}>★</button>
      ))}
    </div>
  );
}

function StarDisplay({ value = 0, size = 14, color = '#FFD700' }) {
  const filled = Math.round(value);
  return (
    <span style={{ fontSize:size, color, lineHeight:1, letterSpacing:1 }}>
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  );
}

// ─── Логотип партнёра ─────────────────────────────────────────────────────────

function PartnerLogo({ partner, size = 88 }) {
  const [failed, setFailed] = useState(false);
  const name = partner.name ?? '?';
  const hue = [...name].reduce((a,c) => a + c.charCodeAt(0), 0) % 360;
  if (!partner.logoUrl || failed) {
    return <div style={{ width:size, height:size, borderRadius:'50%', background:`linear-gradient(135deg,hsl(${hue},50%,52%),hsl(${hue},42%,44%))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*0.38), fontWeight:800, color:'#fff', border:`3px solid ${T.border}` }}>{name[0].toUpperCase()}</div>;
  }
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', padding:3, background:`linear-gradient(135deg,${T.gold},${T.goldL})` }}>
      <div style={{ width:'100%', height:'100%', borderRadius:'50%', overflow:'hidden' }}>
        <img src={partner.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
      </div>
    </div>
  );
}

// ─── Карточка похожего партнёра ───────────────────────────────────────────────

function SimilarCard({ partner, onOpen }) {
  const [failed, setFailed] = useState(false);
  const name = partner.name ?? '?';
  const hue = [...name].reduce((a,c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <button onClick={() => onOpen(partner)} style={{ width:140, flexShrink:0, background:T.chipBg, backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderRadius:20, padding:'14px 12px', border:`1px solid ${T.border}`, cursor:'pointer', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      {partner.logoUrl && !failed
        ? <img src={partner.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', border:`1.5px solid ${T.border}` }} />
        : <div style={{ width:48, height:48, borderRadius:'50%', background:`linear-gradient(135deg,hsl(${hue},50%,52%),hsl(${hue},42%,44%))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'#fff' }}>{name[0].toUpperCase()}</div>
      }
      <div style={{ fontSize:12, fontWeight:700, color:T.textPri, lineHeight:'15px' }}>{name}</div>
      {partner.avgRating > 0 && (
        <div style={{ fontSize:10, color:'#FFD700' }}>{'★'.repeat(Math.round(partner.avgRating))}{'☆'.repeat(5-Math.round(partner.avgRating))}</div>
      )}
    </button>
  );
}

// ─── Карточка отзыва ──────────────────────────────────────────────────────────

function ReviewCard({ review, isOwn }) {
  return (
    <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.border}`, animation:'fadeInUp 0.3s ease both' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        {review.userPhoto
          ? <img src={review.userPhoto} alt="" loading="lazy" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:`1px solid ${isOwn ? T.gold+'44' : T.border}`, flexShrink:0 }} onError={e => e.target.style.display='none'} />
          : <div style={{ width:32, height:32, borderRadius:'50%', background:T.chipBg, border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>👤</div>
        }
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:13, fontWeight:700, color: isOwn ? T.gold : T.textPri, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {review.userName || 'Участник АПГ'}
            </span>
            {isOwn && <span style={{ fontSize:10, color:T.gold, background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.25)', borderRadius:6, padding:'1px 6px', flexShrink:0 }}>вы</span>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <span style={{ fontSize:12, color:'#FFD700', letterSpacing:1 }}>{'★'.repeat(review.stars)}{'☆'.repeat(5-review.stars)}</span>
            <span style={{ fontSize:10, color:T.textSec }}>{formatRelativeTime(review.createdAt)}</span>
          </div>
        </div>
      </div>
      {review.text && (
        <div style={{ fontSize:13, color:T.textSec, lineHeight:'18px', paddingLeft:42 }}>{isVK() ? sanitizeForVK(review.text) : review.text}</div>
      )}
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export function PartnerPage({ partner, variant = 'v2', isFavorite, onBack, onToggleFavorite, onOpenPartner, partners = [], news = [], events = [], user, scannedPartnerIds = {}, visitCounts = {}, onPartnerUpdate, onScan, onAskQuestion, onBook, onOpenNews, onOpenEvent, reviewPrompt, reviewPromptBookingId = '', onReviewPromptHandled, desktopMode = false }) {
  const [lightboxIdx, setLightboxIdx]     = useState(null);
  const [reviews, setReviews]             = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [formStars, setFormStars]         = useState(0);
  const [formText, setFormText]           = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitDone, setSubmitDone]       = useState(false);
  const [reviewError, setReviewError]     = useState('');
  const [phoneCopied, setPhoneCopied]     = useState(false);
  const [shareToast, setShareToast]       = useState('');
  const [desktopTab, setDesktopTab]       = useState('about');
  const [selectedProfileNews, setSelectedProfileNews] = useState(null);
  const [videoViewerIdx, setVideoViewerIdx] = useState(null);
  const phoneCopyTimerRef                 = useRef(null);
  const shareToastRef                     = useRef(null);
  const mountedRef                        = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; clearTimeout(phoneCopyTimerRef.current); clearTimeout(shareToastRef.current); }; }, []);

  const userId = user?.id ? String(user.id) : null;
  const canReview = userId && userId !== 'guest' && partner && scannedPartnerIds[partner.id];
  const myReview = userId ? reviews.find(r => r.id === userId) : null;
  const isProfileOwner = Boolean(userId && [
    partner?.ownerId,
    partner?.userId,
    partner?.createdByUserId,
    partner?.submittedByUserId,
    partner?.managerUserId,
  ].map(value => String(value || '')).includes(userId));

  // Считаем просмотр карточки (один раз при открытии каждого партнёра)
  useEffect(() => {
    if (!partner?.id) return;
    userAction('publicQr:view', { type: 'partner', id: partner.id, metric: 'view' }).catch(() => {});
  }, [partner?.id]);

  useEffect(() => {
    if (variant !== 'v2' || !partner?.id) return;
    window.scrollTo(0, 0);
  }, [variant, partner?.id]);

  useEffect(() => {
    setDesktopTab('feed');
    setSelectedProfileNews(null);
  }, [partner?.id]);

  const handleOpenProfileNews = useCallback((item) => {
    if (!item) return;
    setSelectedProfileNews(item);
  }, []);
  const handleCloseProfileArticle = useCallback((next) => {
    if (getCanonicalNewsId(next)) setSelectedProfileNews(next);
    else setSelectedProfileNews(null);
  }, []);
  const selectedProfileArticle = selectedProfileNews && (
    <LivingFeedArticleSheet
      item={selectedProfileNews}
      onClose={handleCloseProfileArticle}
      user={user}
      desktopMode={desktopMode}
    />
  );

  useEffect(() => {
    if (!partner) return;
    let cancelled = false;
    setReviews([]);
    setReviewsLoading(true);
    setShowForm(false);
    setFormStars(0);
    setFormText('');
    setSubmitDone(false);
    setReviewError('');

    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'partners', partner.id, 'reviews'),
          orderBy('createdAt', 'desc'),
        ));
        if (!cancelled) setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { logError(e, 'PartnerPage.fetchReviews'); }
      if (!cancelled) setReviewsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [partner?.id]);

  useEffect(() => {
    if (!reviewPrompt) return;
    if (canReview) {
      setShowForm(true);
      setFormStars(myReview?.stars ?? 0);
      setFormText(myReview?.text ?? '');
    }
    onReviewPromptHandled?.();
  }, [reviewPrompt, canReview, myReview?.stars, myReview?.text, onReviewPromptHandled]);

  const submitReview = useCallback(async () => {
    if (!partner || !userId || formStars === 0 || submitting) return;
    setSubmitting(true);
    try {
      const reviewData = {
        userId,
        userName: user?.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Участник АПГ',
        userPhoto: user?.photo_200 ?? null,
        stars: formStars,
        text: formText.trim(),
      };
      const result = await userAction('review:partner', {
        userId,
        partnerId: partner.id,
        partnerName: partner.name,
        bookingId: reviewPromptBookingId || '',
        ...reviewData,
      });

      // Обновляем список отзывов
      const snap = await getDocs(query(
        collection(db, 'partners', partner.id, 'reviews'),
        orderBy('createdAt', 'desc'),
      ));
      if (!mountedRef.current) return;
      const allReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReviews(allReviews);

      const newAvg = result.avgRating ?? partner.avgRating ?? 0;
      const newCount = result.reviewCount ?? allReviews.length;
      if (!mountedRef.current) return;
      onPartnerUpdate?.(partner.id, { avgRating: newAvg, reviewCount: newCount });

      setReviewError('');
      setSubmitDone(true);
      setShowForm(false);

      // Предлагаем поделиться в ВК
      const stars = '⭐'.repeat(formStars);
      const msg = `Побывал у партнёра АПГ «${partner.name}» — ${stars}\n${formText.trim() ? formText.trim() + '\n' : ''}\n#АПГ_Зеленоград`;
      vkBridge.send('VKWebAppShowWallPostBox', { message: msg }).catch(() => {});
    } catch (e) { logError(e, 'PartnerPage.submitReview'); setReviewError('Ошибка отправки. Проверьте соединение.'); }
    if (mountedRef.current) setSubmitting(false);
  }, [partner, userId, formStars, formText, submitting, user, onPartnerUpdate, reviewPromptBookingId]);

  if (!partner) return null;

  const photos = partner.photos ?? [];
  const gallery = partner.gallery ?? partner.photos ?? [];
  const similar = partners.filter(p => p.id !== partner.id && p.category === partner.category).slice(0, 6);
  const avgRating = partner.avgRating ?? 0;
  const reviewCount = partner.reviewCount ?? reviews.length;
  const locations = getProfileLocations(partner);
  const mainLocation = getMainLocation(partner);
  const multipleLocations = hasMultipleLocations(partner);

  const openVkGroup = () => {
    trackAppEvent('partner:site_open', {
      type: APG_EVENT_TYPES.PARTNER_SITE_OPENED,
      user,
      entityType: 'partner',
      entityId: partner.id,
      payload: { partnerId: partner.id, title: partner.name, target: 'vk' },
    });
    openNormalizedUrl(openUrl, partner.vkGroupUrl || partner.vkUrl || partner.socialUrl, { platform: 'vk' });
  };
  const handlePhone = (location = mainLocation) => {
    const phone = location?.phone || partner.phone;
    if (!phone) return;
    trackAppEvent('partner:call', {
      type: APG_EVENT_TYPES.PARTNER_CALLED,
      user,
      entityType: 'partner',
      entityId: partner.id,
      payload: { partnerId: partner.id, title: partner.name, locationId: location?.id || '' },
    });
    // Копируем номер в буфер — VK WebView блокирует tel: схему
    vkBridge.send('VKWebAppCopyText', { text: phone }).catch(() => {
      navigator.clipboard?.writeText(phone).catch(() => {});
    });
    setPhoneCopied(true);
    clearTimeout(phoneCopyTimerRef.current);
    phoneCopyTimerRef.current = setTimeout(() => setPhoneCopied(false), 3000);
    // Попытка открыть диалер (может сработать в браузере)
    openUrl(`tel:${phone.replace(/\s/g, '')}`);
  };
  const handleMap   = (location = mainLocation) => {
    const address = location?.address || partner.address;
    if (!address) return;
    trackAppEvent('partner:route', {
      type: APG_EVENT_TYPES.PARTNER_ROUTE_BUILT,
      user,
      entityType: 'partner',
      entityId: partner.id,
      payload: { partnerId: partner.id, title: partner.name, address, locationId: location?.id || '' },
    });
    openUrl(`https://yandex.ru/maps/?text=${encodeURIComponent(address + ', Зеленоград')}`);
  };
  const handleBookLocation = (location = mainLocation) => {
    onBook?.(locationToProvider(partner, location));
  };
  const openPartnerUrl = (url, target = 'site', options = undefined) => {
    trackAppEvent('partner:site_open', {
      type: APG_EVENT_TYPES.PARTNER_SITE_OPENED,
      user,
      entityType: 'partner',
      entityId: partner.id,
      payload: { partnerId: partner.id, title: partner.name, target },
    });
    openNormalizedUrl(openUrl, url, options);
  };
  const startPartnerScan = () => {
    trackAppEvent('partner:qr_scan_start', {
      type: APG_EVENT_TYPES.QR_SCAN_STARTED,
      user,
      entityType: 'partner',
      entityId: partner.id,
      payload: { partnerId: partner.id, title: partner.name, source: 'partner_card' },
    });
    onScan?.();
  };
  const showShareToast = (msg) => {
    setShareToast(msg);
    clearTimeout(shareToastRef.current);
    shareToastRef.current = setTimeout(() => setShareToast(''), 2500);
  };

  const handleShare = () => {
    const deepLink = shareLink('partner', partner.id);

    const textLines = [
      `${partner.name} — партнёр АПГ Зеленоград! 🔑`,
      `🎁 ${partner.offer || 'Скоро будут спецпредложения'}`,
      (mainLocation?.address || partner.address) && `📍 ${mainLocation?.address || partner.address}`,
      '',
      'Присоединяйся к программе лояльности АПГ.',
      `👉 ${deepLink}`,
    ].filter(v => v !== false && v !== null && v !== undefined).join('\n');

    if (isVK()) {
      vkBridge.send('VKWebAppCopyText', { text: textLines })
        .then(() => showShareToast('📋 Скопировано!'))
        .catch(() => showShareToast('❌ Ошибка'));
      return;
    }

    const webText = textLines.split('\n').slice(0, -1).join('\n'); // без строки со ссылкой — браузер добавит url сам
    if (navigator.share) {
      navigator.share({ url: deepLink, text: webText })
        .then(() => showShareToast('✅ Поделились!'))
        .catch(() => {
          navigator.clipboard?.writeText(textLines)
            .then(() => showShareToast('📋 Скопировано'))
            .catch(() => showShareToast('❌ Ошибка'));
        });
    } else {
      navigator.clipboard?.writeText(textLines)
        .then(() => showShareToast('📋 Скопировано'))
        .catch(() => showShareToast('❌ Ошибка'));
    }
  };

  const infoRows = [
    (mainLocation?.workingHours || partner.hours) && { icon:'🕐', label:'Часы работы', value:mainLocation?.workingHours || partner.hours },
    (mainLocation?.address || partner.address) && { icon:'📍', label:'Адрес',       value:mainLocation?.address || partner.address, onClick:() => handleMap(mainLocation) },
    (mainLocation?.phone || partner.phone) && { icon:'📞', label:'Телефон',     value:mainLocation?.phone || partner.phone,   onClick:() => handlePhone(mainLocation) },
  ].filter(Boolean);

  const ratingLabel = avg => avg >= 4.7 ? 'Отлично' : avg >= 4.0 ? 'Хорошо' : avg >= 3.0 ? 'Неплохо' : avg >= 2.0 ? 'Так себе' : 'Плохо';
  const canUseApgBooking = canOpenBookingFlow(partner, 'partner') && typeof onBook === 'function';
  const partnerVkUrl = partner.vkGroupUrl || partner.vkUrl || '';
  const partnerTelegramUrl = partner.telegramCommunityUrl || partner.telegramUrl || '';
  const partnerMaxUrl = partner.maxCommunityUrl || partner.maxUrl || '';
  const isDuplicatePartnerSocial = value => [partnerVkUrl, partnerTelegramUrl, partnerMaxUrl, partner.websiteUrl].filter(Boolean).includes(value);

  if (variant === 'v2') {
    const heroImage = getProfileImage(partner);
    const status = partner.partnerOfMonth ? 'Партнер дня' : partner.premium ? 'Premium' : partner.verified ? 'Проверенный' : 'Партнер АПГ';
    const galleryItems = gallery.length ? gallery : [heroImage].filter(Boolean);
    const heroBadges = [
      partner.categoryLabel,
      avgRating > 0 ? `★ ${avgRating.toFixed(1)} · ${reviewCount}` : null,
      multipleLocations ? `${locations.length} локации` : null,
      partner.distance,
    ].filter(Boolean);
    const cta = [
      (mainLocation?.phone || partner.phone) && { label: phoneCopied ? 'Номер скопирован' : 'Позвонить', icon: phoneCopied ? '✓' : '📞', onClick: () => handlePhone(mainLocation), tone: 'gold' },
      (mainLocation?.address || partner.address) && { label: 'Маршрут', icon: '📍', onClick: () => handleMap(mainLocation) },
      canUseApgBooking && { label: 'Записаться', icon: '📅', onClick: () => handleBookLocation(mainLocation), tone: 'gold' },
      !canUseApgBooking && !isVK() && partner.bookingUrl && { label: 'Записаться', icon: '📅', onClick: () => openPartnerUrl(partner.bookingUrl, 'booking'), tone: 'gold' },
      !isVK() && partner.websiteUrl && { label: 'Сайт', icon: '🌐', onClick: () => openPartnerUrl(partner.websiteUrl, 'website') },
      partnerVkUrl && { label: 'VK', icon: '🔵', onClick: openVkGroup },
      partnerTelegramUrl && { label: 'Telegram', icon: '✈️', onClick: () => openPartnerUrl(partnerTelegramUrl, 'telegram', { platform: 'telegram' }) },
      partnerMaxUrl && { label: 'MAX', icon: '💬', onClick: () => openPartnerUrl(partnerMaxUrl, 'max', { platform: 'max' }) },
      onAskQuestion && { label: 'Задать вопрос', icon: '💬', onClick: () => onAskQuestion(partner), tone: 'gold' },
      { label: 'Поделиться', icon: '↗', onClick: handleShare },
    ].filter(Boolean);
    const detailTabs = buildLivingProfileTabs({
      profile: partner,
      galleryItems,
      videos: partner.videos,
      reviews,
      reviewCount,
    });
    const handleProfileTabChange = (id) => {
      setDesktopTab(id);
      if (desktopMode) return;
      requestAnimationFrame(() => {
        document.getElementById(`partner-profile-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    if (desktopMode) {
      const serviceCatalog = Array.isArray(partner.serviceCatalog) ? partner.serviceCatalog.filter(Boolean) : [];
      const servicesText = [partner.services, partner.serviceDescription].filter(Boolean).join('\n\n');
      const hasServices = Boolean(servicesText.trim() || serviceCatalog.length);
      const hasGallery = galleryItems.length > 0;
      const hasVideos = partner.videos?.length > 0;
      const stamps = visitCounts[partner.id] ?? 0;
      const stampTarget = Number(partner.stampTarget) || 0;
      const filledStamps = stampTarget > 0 ? Math.min(Number(stamps) || 0, stampTarget) : 0;
      const offerEndLabel = formatProfileDate(partner.offerUntil || partner.promoUntil || partner.discountUntil || partner.endsAt);
      const activeTab = detailTabs.some(tab => tab.id === desktopTab) ? desktopTab : detailTabs[0]?.id || 'about';
      const kpiItems = [
        avgRating > 0 && { id: 'rating', label: 'Рейтинг', value: avgRating.toFixed(1), icon: '★', tone: 'gold' },
        reviewCount > 0 && { id: 'reviews', label: 'Отзывы', value: reviewCount, icon: '💬' },
        stampTarget > 0 && { id: 'stamps', label: 'Штампы', value: `${filledStamps}/${stampTarget}`, icon: '🎟️' },
        partner.keys && { id: 'keys', label: 'Ключей за визит', value: partner.keys, icon: '🗝️' },
        galleryItems.length > 0 && { id: 'photos', label: 'Фото', value: galleryItems.length, icon: '▣' },
        hasVideos && { id: 'video', label: 'Видео', value: partner.videos.length, icon: '▶' },
      ].filter(Boolean);
      const heroActions = [
        (mainLocation?.phone || partner.phone) && { label: 'Позвонить', icon: '📞', onClick: () => handlePhone(mainLocation), tone: 'gold' },
        canUseApgBooking && { label: 'Записаться', icon: '📅', onClick: () => handleBookLocation(mainLocation), tone: 'gold' },
        !canUseApgBooking && !isVK() && partner.bookingUrl && { label: 'Записаться', icon: '📅', onClick: () => openPartnerUrl(partner.bookingUrl, 'booking'), tone: 'gold' },
        onAskQuestion && { label: 'Написать', icon: '💬', onClick: () => onAskQuestion(partner), tone: 'gold' },
      ].filter(Boolean).map(item => ({ id: item.label, label: item.label, icon: item.icon, tone: item.tone, onClick: item.onClick }));
      const stickyActions = [
        (mainLocation?.phone || partner.phone) && { id: 'call', label: phoneCopied ? 'Скопировано' : 'Позвонить', icon: phoneCopied ? '✓' : '📞', tone: 'gold', onClick: () => handlePhone(mainLocation) },
        onAskQuestion && { id: 'question', label: 'Написать', icon: '💬', onClick: () => onAskQuestion(partner) },
        { id: 'favorite', label: isFavorite ? 'В избранном' : 'В избранное', icon: isFavorite ? '♥' : '♡', onClick: () => onToggleFavorite(partner.id) },
      ].filter(Boolean);
      const contactItems = [
        (mainLocation?.phone || partner.phone) && { id: 'phone', label: 'Телефон', value: mainLocation?.phone || partner.phone, icon: '📞', onClick: () => handlePhone(mainLocation) },
        (mainLocation?.address || partner.address) && { id: 'address', label: 'Адрес', value: mainLocation?.address || partner.address, icon: '📍', onClick: () => handleMap(mainLocation) },
        (mainLocation?.workingHours || partner.hours) && { id: 'hours', label: 'График', value: mainLocation?.workingHours || partner.hours, icon: '🕐' },
      ].filter(Boolean);
      const socialItems = [
        !canUseApgBooking && !isVK() && partner.bookingUrl && { id: 'booking', label: 'Запись', value: partner.bookingUrl, icon: '📅', onClick: () => openPartnerUrl(partner.bookingUrl, 'booking') },
        partner.websiteUrl && !isVK() && { id: 'site', label: 'Сайт', value: partner.websiteUrl, icon: '🌐', onClick: () => openPartnerUrl(partner.websiteUrl, 'website') },
        partnerVkUrl && { id: 'vk', label: 'VK', value: partnerVkUrl, icon: '🔵', onClick: openVkGroup },
        partnerTelegramUrl && { id: 'telegram', label: 'Telegram', value: partnerTelegramUrl, icon: '✈️', onClick: () => openPartnerUrl(partnerTelegramUrl, 'telegram', { platform: 'telegram' }) },
        !isVK() && partner.socialUrl && !isDuplicatePartnerSocial(partner.socialUrl) && { id: 'social', label: /vk\.com|vkontakte\.ru/i.test(partner.socialUrl) ? 'ВКонтакте' : 'Соцсеть', value: partner.socialUrl, icon: /vk\.com|vkontakte\.ru/i.test(partner.socialUrl) ? '🔵' : '🌐', onClick: () => openPartnerUrl(partner.socialUrl, /vk\.com|vkontakte\.ru/i.test(partner.socialUrl) ? 'vk' : 'social', /vk\.com|vkontakte\.ru/i.test(partner.socialUrl) ? { platform: 'vk' } : undefined) },
        partnerMaxUrl && { id: 'max', label: 'MAX', value: partnerMaxUrl, icon: '💬', onClick: () => openPartnerUrl(partnerMaxUrl, 'max', { platform: 'max' }) },
      ].filter(Boolean);
      const relatedItems = similar.map(item => ({ id: item.id, name: item.name, subtitle: item.categoryLabel || item.address, categoryLabel: item.categoryLabel || 'Партнёр' }));

      return (
        <>
          {shareToast && createPortal(
            <div style={{ position:'fixed', top:'calc(var(--safe-top, 0px) + 60px)', left:'50%', transform:'translateX(-50%)', zIndex:20000, ...APG2.glass, borderRadius:18, padding:'11px 18px', fontSize:13, fontWeight:760, color:APG2.text, whiteSpace:'nowrap', pointerEvents:'none' }}>
              {shareToast}
            </div>,
            document.body
          )}
          <DesktopDetailShell
            title={partner.name}
            onBack={onBack}
            stickyActions={<DesktopStickyActions actions={stickyActions} />}
            aside={
              <>
                <DesktopSidebarCard title="Контакты" subtitle="Из анкеты партнёра">
                  <DesktopMeta items={contactItems} />
                </DesktopSidebarCard>
                {partner.offer && (
                  <DesktopSidebarCard title="Активная акция" subtitle="Предложение для участников">
                    <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '19px' }}>{partner.offer}</div>
                  </DesktopSidebarCard>
                )}
                {stampTarget > 0 && (
                  <DesktopSidebarCard title="Штамп-карта" subtitle={`${filledStamps}/${stampTarget} отметок`}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Array.from({ length: stampTarget }).map((_, index) => (
                          <div key={index} style={{ width: 22, height: 22, borderRadius: 9, display: 'grid', placeItems: 'center', background: index < filledStamps ? APG2.gold : 'rgba(var(--apg2-glass-a,255,255,255),0.08)', border: `1px solid ${index < filledStamps ? 'rgba(201,168,76,0.55)' : 'rgba(var(--apg2-glass-a,255,255,255),0.12)'}`, color: index < filledStamps ? '#17120a' : APG2.textMuted, fontSize: 12, fontWeight: 850 }}>{index < filledStamps ? '✓' : ''}</div>
                        ))}
                      </div>
                      <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '19px' }}>
                        {filledStamps >= stampTarget ? 'Карта заполнена. Уточните награду у партнёра.' : `До награды осталось ${stampTarget - filledStamps}.`}
                      </div>
                    </div>
                  </DesktopSidebarCard>
                )}
                <DesktopSidebarCard title="Получить ключ" subtitle="После визита">
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '19px' }}>Попросите QR-код АПГ у партнёра после получения услуги или товара.</div>
                    <GlassButton onClick={startPartnerScan} tone="gold" style={{ minHeight: 42, borderRadius: 16, color: '#17120a', opacity: onScan ? 1 : 0.55 }}>Сканировать QR</GlassButton>
                  </div>
                </DesktopSidebarCard>
                {relatedItems.length > 0 && (
                  <DesktopSidebarCard title="Похожие места" subtitle="Та же категория">
                    <DesktopRelated items={relatedItems} onOpen={onOpenPartner} />
                  </DesktopSidebarCard>
                )}
              </>
            }
          >
            <DesktopHero
              image={heroImage}
              avatar={<PartnerLogo partner={partner} size={74} />}
              status={status}
              title={partner.name}
              subtitle={partner.categoryLabel || mainLocation?.address || partner.address || 'Партнёр АПГ'}
              badges={heroBadges.map(label => ({ id: label, label, tone: String(label).includes('★') ? 'gold' : undefined }))}
              description={partner.offer || partner.description || mainLocation?.address || partner.address || 'Проверенное место в экосистеме АПГ.'}
              meta={<DesktopInfoGrid columns="repeat(auto-fit, minmax(118px, 1fr))" items={kpiItems.map(item => ({ ...item, style: { minHeight: 54, padding: 11 } }))} />}
              actions={<DesktopHeroActions actions={heroActions} style={{ marginBottom: 4 }} />}
            />

            <DesktopDetailTabs items={detailTabs} activeId={activeTab} onChange={handleProfileTabChange} />

            {activeTab === 'feed' && (
              <DesktopSection title="Лента">
                <ProfileTimelineSection
                  profile={partner}
                  role="partner"
                  news={news}
                  events={events}
                  reviews={reviews}
                  desktop
                  isOwner={isProfileOwner}
                  onOpenNews={handleOpenProfileNews}
                  onOpenEvent={onOpenEvent}
                  onOpenTab={setDesktopTab}
                  onOpenBooking={() => handleBookLocation(mainLocation)}
                />
              </DesktopSection>
            )}

            {activeTab === 'about' && (
              <DesktopSection title="О компании">
                <div style={{ display: 'grid', gridTemplateColumns: contactItems.length > 0 ? 'minmax(0, 1.05fr) minmax(280px, 0.95fr)' : '1fr', gap: 14, alignItems: 'start' }}>
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ borderRadius: 22, padding: 16, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)' }}>
                      {partner.description ? (
                        <RichText color={APG2.textSoft} fontSize={14}>{isVK() ? sanitizeForVK(partner.description) : partner.description}</RichText>
                      ) : (
                        <div style={{ color: APG2.textSoft, fontSize: 14, lineHeight: '21px' }}>Описание пока готовится, но карточка уже доступна для посещений и избранного.</div>
                      )}
                    </div>
                    {heroBadges.length > 0 && (
                      <div style={{ borderRadius: 22, padding: 16, background: 'rgba(var(--apg2-glass-a,255,255,255),0.05)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.09)' }}>
                        <div style={{ color: APG2.text, fontSize: 14, lineHeight: '18px', fontWeight: 860, marginBottom: 10 }}>Категории и статусы</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                          {heroBadges.map(label => <GlassBadge key={label} tone={String(label).includes('★') ? 'gold' : 'glass'}>{label}</GlassBadge>)}
                        </div>
                      </div>
                    )}
                  </div>
                  {contactItems.length > 0 && (
                    <div style={{ borderRadius: 22, padding: 14, background: 'rgba(var(--apg2-glass-a,255,255,255),0.05)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.09)' }}>
                      <DesktopMeta items={contactItems} />
                    </div>
                  )}
                  {multipleLocations && (
                    <div style={{ gridColumn: '1 / -1', borderRadius: 22, padding: 14, background: 'rgba(var(--apg2-glass-a,255,255,255),0.05)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.09)' }}>
                      <div style={{ color: APG2.text, fontSize: 14, lineHeight: '18px', fontWeight: 860, marginBottom: 10 }}>Локации</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                        {locations.map(location => (
                          <div key={location.id} style={{ borderRadius: 20, padding: 13, background: 'rgba(var(--apg2-glass-a,255,255,255),0.055)', border: location.isMain ? '1px solid rgba(201,168,76,0.34)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ color: APG2.text, fontSize: 14, lineHeight: '18px', fontWeight: 880 }}>{location.title || 'Локация'}</div>
                                {location.address && <div style={{ color: APG2.textSoft, fontSize: 12.5, lineHeight: '17px', marginTop: 3 }}>{location.address}</div>}
                              </div>
                              {location.isMain && <GlassBadge tone="gold">Главная</GlassBadge>}
                            </div>
                            {(location.workingHours || location.phone) && <div style={{ color: APG2.textMuted, fontSize: 12, lineHeight: '16px' }}>{[location.workingHours, location.phone].filter(Boolean).join(' · ')}</div>}
                            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                              {location.phone && <GlassButton onClick={() => handlePhone(location)} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px' }}>Позвонить</GlassButton>}
                              {location.address && <GlassButton onClick={() => handleMap(location)} style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px' }}>Маршрут</GlassButton>}
                              {canUseApgBooking && <GlassButton onClick={() => handleBookLocation(location)} tone="gold" style={{ minHeight: 34, borderRadius: 14, padding: '7px 10px', color: '#17120a' }}>Записаться</GlassButton>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {socialItems.length > 0 && (
                    <div style={{ borderRadius: 22, padding: 14, background: 'rgba(var(--apg2-glass-a,255,255,255),0.05)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.09)' }}>
                      <div style={{ color: APG2.text, fontSize: 12, lineHeight: '16px', marginBottom: 8, fontWeight: 860, letterSpacing: 0.1 }}>Ссылки</div>
                      <DesktopMeta items={socialItems} />
                    </div>
                  )}
                </div>
              </DesktopSection>
            )}

            {activeTab === 'services' && hasServices && (
              <DesktopSection title="Услуги">
                <div style={{ display: 'grid', gap: 12 }}>
                  {servicesText.trim() && <RichText color={APG2.textSoft} fontSize={14}>{servicesText}</RichText>}
                  {serviceCatalog.length > 0 && (
                    <DesktopRelated items={serviceCatalog.map((item, index) => ({ id: item.id || index, name: item.title || item.name || item.service || 'Услуга', subtitle: item.description || item.price || item.duration || '' }))} />
                  )}
                </div>
              </DesktopSection>
            )}

            {activeTab === 'offer' && (
              <DesktopSection title="Акция">
                {partner.offer ? (
                  <div style={{ position: 'relative', minHeight: 220, borderRadius: 24, overflow: 'hidden', color: '#fff', background: 'rgba(201,168,76,0.18)' }}>
                    {heroImage && <img src={heroImage} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.05) contrast(1.04)' }} />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(9,9,12,0.82), rgba(9,9,12,0.52), rgba(9,9,12,0.20)), linear-gradient(180deg, rgba(9,9,12,0.08), rgba(9,9,12,0.68))' }} />
                    <div style={{ position: 'relative', zIndex: 1, minHeight: 220, padding: 20, display: 'grid', alignContent: 'end', gap: 12, maxWidth: 560 }}>
                      <div style={{ justifySelf: 'start', borderRadius: 999, padding: '6px 10px', color: '#17120a', background: 'linear-gradient(135deg,#FFF0B8,#D7B86A)', fontSize: 11, lineHeight: '14px', fontWeight: 900 }}>Акция</div>
                      <div style={{ fontSize: 24, lineHeight: '29px', fontWeight: 930 }}>{partner.offer}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: '16px', fontWeight: 800 }}>
                        <span style={{ borderRadius: 999, padding: '5px 9px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.16)' }}>Активна</span>
                        {offerEndLabel && <span style={{ borderRadius: 999, padding: '5px 9px', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.16)' }}>До {offerEndLabel}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {canUseApgBooking && <GlassButton onClick={() => handleBookLocation(mainLocation)} tone="gold" style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>Записаться</GlassButton>}
                        {onAskQuestion && <GlassButton onClick={() => onAskQuestion(partner)} style={{ minHeight: 40, borderRadius: 16, color: '#fff', background: 'rgba(255,255,255,0.16)' }}>Написать</GlassButton>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <DesktopEmptyState icon="🎁" title="Акций пока нет" text="Когда партнёр добавит предложение для участников АПГ, оно появится здесь." />
                )}
              </DesktopSection>
            )}

            {activeTab === 'photos' && (
              <DesktopSection title="Фото">
                {hasGallery ? <ProfilePhotoGrid items={galleryItems} desktop onOpen={setLightboxIdx} /> : <DesktopEmptyState icon="▣" title="Фото пока нет" text="Фотографии появятся после обновления карточки." />}
              </DesktopSection>
            )}

            {activeTab === 'video' && (
              <DesktopSection title="Видео">
                {hasVideos ? <ProfileVideoGrid videos={partner.videos} desktop onOpen={setVideoViewerIdx} /> : <DesktopEmptyState icon="▶" title="Видео пока нет" text="Видеоматериалы появятся после добавления в анкету." />}
              </DesktopSection>
            )}

            {activeTab === 'reviews' && (
              <DesktopSection
                title={`Отзывы${reviewCount > 0 ? ` · ${reviewCount}` : ''}`}
                action={canReview && !showForm && !submitDone ? <GlassButton onClick={() => { setShowForm(true); setFormStars(myReview?.stars ?? 0); setFormText(myReview?.text ?? ''); }} style={{ minHeight: 34, borderRadius: 15, padding: '7px 11px', fontSize: 12 }}>Написать</GlassButton> : null}
              >
                {reviewCount > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.36fr) minmax(0, 1fr)', gap: 12, marginBottom: 2 }}>
                    <div style={{ borderRadius: 22, padding: 16, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.26)' }}>
                      <div style={{ color: APG2.gold, fontSize: 32, lineHeight: '36px', fontWeight: 940 }}>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</div>
                      <div style={{ color: '#FFD700', fontSize: 13, letterSpacing: 1, marginTop: 4 }}>{avgRating > 0 ? '★'.repeat(Math.round(avgRating)) : '★★★★★'}</div>
                      <div style={{ color: APG2.textSoft, fontSize: 12, lineHeight: '16px', marginTop: 6 }}>{reviewCount} отзывов</div>
                    </div>
                    <div style={{ borderRadius: 22, padding: 16, background: 'rgba(var(--apg2-glass-a,255,255,255),0.055)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', color: APG2.textSoft, fontSize: 13, lineHeight: '19px' }}>
                      Отзывы помогают другим участникам АПГ понять качество места и выбрать подходящий сценарий визита.
                    </div>
                  </div>
                )}
                {!canReview && !reviewsLoading && (
                  <div style={{ borderRadius: 18, padding: 12, color: APG2.textMuted, background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)', fontSize: 13, lineHeight: '18px', marginBottom: 10 }}>
                    Оставить отзыв можно после посещения и скана QR-кода.
                  </div>
                )}
                {showForm && (
                  <div style={{ borderRadius: 22, padding: 16, marginBottom: 12, background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.13)' }}>
                    <div style={{ color: APG2.text, fontSize: 15, fontWeight: 780, marginBottom: 10 }}>Ваш отзыв</div>
                    <StarPicker value={formStars} onChange={setFormStars} size={30} />
                    <textarea value={formText} onChange={e => setFormText(e.target.value)} placeholder="Расскажите о визите..." maxLength={400} style={{ width:'100%', marginTop: 12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:18, padding:'12px 13px', color:APG2.text, fontSize:15, resize:'none', minHeight:82, outline:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:'22px' }} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <GlassButton onClick={() => setShowForm(false)} style={{ flex: 1 }}>Отмена</GlassButton>
                      <GlassButton onClick={submitReview} tone="gold" style={{ flex: 1, opacity: formStars === 0 || submitting ? 0.5 : 1 }}>{submitting ? '...' : 'Опубликовать'}</GlassButton>
                    </div>
                    {reviewError && <div style={{ marginTop: 9, color: '#ff9aa8', fontSize: 12 }}>{reviewError}</div>}
                  </div>
                )}
                {reviewsLoading ? (
                  <div style={{ color: APG2.textMuted, fontSize: 13 }}>Загружаем отзывы...</div>
                ) : reviews.length === 0 ? (
                  <DesktopEmptyState
                    icon="💬"
                    title="Отзывы пока не добавлены"
                    text="Оценки и отзывы появятся после посещений и закрытых записей."
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                    {reviews.map(r => <ProfileReviewCard key={r.id} review={r} isOwn={r.id === userId} textFallback="Гость оценил место без комментария." />)}
                  </div>
                )}
              </DesktopSection>
            )}
          </DesktopDetailShell>

          <ProfilePhotoViewer items={galleryItems} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
          <ProfileVideoViewer videos={partner.videos} startIndex={videoViewerIdx} onClose={() => setVideoViewerIdx(null)} />
          {selectedProfileArticle}
        </>
      );
    }

    return (
      <>
        {shareToast && createPortal(
          <div style={{ position:'fixed', top:'calc(var(--safe-top, 0px) + 60px)', left:'50%', transform:'translateX(-50%)', zIndex:20000, ...APG2.glass, borderRadius:18, padding:'11px 18px', fontSize:13, fontWeight:760, color:APG2.text, whiteSpace:'nowrap', pointerEvents:'none' }}>
            {shareToast}
          </div>,
          document.body
        )}
        <div style={{ minHeight: '100%', background: APG2.bg, color: APG2.text, paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 50, padding: 'calc(8px + var(--safe-top, 0px)) 16px 8px', background: 'linear-gradient(180deg,var(--apg2-header-bg-strong, rgba(17,17,19,0.92)),var(--apg2-header-bg-soft, rgba(17,17,19,0.56)),transparent)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={onBack} style={{ ...APG2.glass, width: 42, height: 42, borderRadius: 18, color: APG2.text, fontSize: 20, cursor: 'pointer' }}>‹</button>
              <div style={{ flex: 1, minWidth: 0, color: APG2.textSoft, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name}</div>
              <button onClick={() => onToggleFavorite(partner.id)} style={{ ...APG2.glass, width: 42, height: 42, borderRadius: 18, color: isFavorite ? '#ff7d91' : APG2.textSoft, fontSize: 20, cursor: 'pointer' }}>{isFavorite ? '♥' : '♡'}</button>
            </div>
          </div>

          <main style={{ padding: '0 16px 0', maxWidth: 520, margin: '0 auto' }}>
            <ProfileHero
              image={heroImage}
              title={partner.name}
              status={status}
              avatar={<PartnerLogo partner={partner} size={64} />}
              badges={heroBadges}
              description={partner.offer || partner.description || mainLocation?.address || partner.address || 'Проверенное место в экосистеме АПГ.'}
            />

            <GlassSection title="Действия">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {cta.map(item => (
                  <GlassButton key={item.label} onClick={item.onClick} tone={item.tone}>
                    <span>{item.icon}</span><span>{item.label}</span>
                  </GlassButton>
                ))}
                <GlassButton onClick={() => onToggleFavorite(partner.id)} style={{ gridColumn: cta.length % 2 === 0 ? 'auto' : '1 / -1' }}>
                  {isFavorite ? '♥ В избранном' : '♡ В избранное'}
                </GlassButton>
              </div>
            </GlassSection>

            <DesktopDetailTabs
              items={detailTabs}
              activeId={desktopTab}
              onChange={handleProfileTabChange}
              style={{ position: 'sticky', top: 'calc(58px + var(--safe-top, 0px))', zIndex: 42, margin: '0 0 14px' }}
            />

            <div id="partner-profile-feed" style={{ scrollMarginTop: 'calc(116px + var(--safe-top, 0px))' }}>
            <GlassSection title="Лента">
              <ProfileTimelineSection
                profile={partner}
                role="partner"
                news={news}
                events={events}
                reviews={reviews}
                isOwner={isProfileOwner}
                onOpenNews={handleOpenProfileNews}
                onOpenEvent={onOpenEvent}
                onOpenTab={setDesktopTab}
                onOpenBooking={() => onBook?.(partner)}
              />
            </GlassSection>
            </div>

            <GlassSection title="Получить ключ">
              <div style={{ ...APG2.glass, borderRadius: 30, padding: 18, display: 'grid', gap: 16, border: '1px solid rgba(215,184,106,0.24)' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: APG2.gold, background: APG2.goldSoft, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 14px 32px rgba(215,184,106,0.14)' }}>🎁</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: APG2.text, fontSize: 17, lineHeight: '22px', fontWeight: 840 }}>Получите ключ за посещение</div>
                    <div style={{ color: APG2.textMuted, fontSize: 13, marginTop: 6, lineHeight: '19px' }}>
                      После получения товара или услуги попросите сотрудника показать QR-код АПГ. Отсканируйте его через приложение, и ключ автоматически поступит на ваш аккаунт.
                    </div>
                  </div>
                </div>
                <GlassButton onClick={startPartnerScan} tone="gold" style={{ width: '100%', minHeight: 50, borderRadius: 21, fontSize: 15, color: '#17120a', opacity: onScan ? 1 : 0.55 }}>
                  📷 Сканировать QR
                </GlassButton>
              </div>
            </GlassSection>

            <div id="partner-profile-about" style={{ scrollMarginTop: 'calc(116px + var(--safe-top, 0px))' }}>
            <GlassSection title="О компании">
              <div style={{ ...APG2.glass, borderRadius: 34, padding: 18 }}>
                {partner.description ? (
                  <RichText color={APG2.textSoft} fontSize={15}>{isVK() ? sanitizeForVK(partner.description) : partner.description}</RichText>
                ) : (
                  <div style={{ color: APG2.textSoft, fontSize: 15, lineHeight: '22px' }}>Описание пока готовится, но карточка уже доступна для посещений и избранного.</div>
                )}
                {infoRows.length > 0 && (
                  <div style={{ marginTop: 16, display: 'grid', gap: 9 }}>
                    {infoRows.map(row => (
                      <ContactCard key={row.label} icon={row.icon} label={row.label} value={row.value} onClick={row.onClick} />
                    ))}
                  </div>
                )}
              </div>
            </GlassSection>
            </div>

            <div id="partner-profile-offer" style={{ scrollMarginTop: 'calc(116px + var(--safe-top, 0px))' }}>
            <GlassSection title="Акции">
              {partner.offer ? (
                <div style={{ ...APG2.goldGlass, borderRadius: 34, padding: 18, color: APG2.text, display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 54, height: 54, borderRadius: 20, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎁</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.68, marginBottom: 5 }}>Для участников АПГ</div>
                    <div style={{ fontSize: 16, lineHeight: '22px', fontWeight: 800 }}>{partner.offer}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 11, lineHeight: '14px', fontWeight: 820 }}>
                      <span style={{ borderRadius: 999, padding: '4px 7px', background: 'rgba(255,255,255,0.16)' }}>Активна</span>
                      {formatProfileDate(partner.offerUntil || partner.promoUntil || partner.discountUntil || partner.endsAt) && <span style={{ borderRadius: 999, padding: '4px 7px', background: 'rgba(255,255,255,0.16)' }}>До {formatProfileDate(partner.offerUntil || partner.promoUntil || partner.discountUntil || partner.endsAt)}</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ ...APG2.glass, borderRadius: 34, padding: 24, color: APG2.textMuted, textAlign: 'center', fontSize: 14, lineHeight: '20px' }}>Акций пока нет.</div>
              )}
            </GlassSection>
            </div>

            <div id="partner-profile-photos" style={{ scrollMarginTop: 'calc(116px + var(--safe-top, 0px))' }}>
            <GlassSection title="Фото">
              <ProfilePhotoGrid items={galleryItems} onOpen={setLightboxIdx} />
            </GlassSection>
            </div>

            <div id="partner-profile-video" style={{ scrollMarginTop: 'calc(116px + var(--safe-top, 0px))' }}>
            <GlassSection title="Видео">
              {partner.videos?.length > 0 ? (
                <div style={{ ...APG2.glass, borderRadius: 34, padding: 14 }}>
                  <ProfileVideoGrid videos={partner.videos} onOpen={setVideoViewerIdx} />
                </div>
              ) : (
                <div style={{ ...APG2.glass, borderRadius: 34, padding: 24, color: APG2.textMuted, textAlign: 'center', fontSize: 14, lineHeight: '20px' }}>Видео пока нет.</div>
              )}
            </GlassSection>
            </div>

            <div id="partner-profile-reviews" style={{ scrollMarginTop: 'calc(116px + var(--safe-top, 0px))' }}>
            <GlassSection
              title={`Отзывы${reviewCount > 0 ? ` · ${reviewCount}` : ''}`}
              action={canReview && !showForm && !submitDone ? <GlassButton onClick={() => { setShowForm(true); setFormStars(myReview?.stars ?? 0); setFormText(myReview?.text ?? ''); }} style={{ minHeight: 34, borderRadius: 15, padding: '7px 11px', fontSize: 12 }}>Написать</GlassButton> : null}
            >
              {reviewCount > 0 && (
                <div style={{ ...APG2.glass, borderRadius: 28, padding: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 22, display: 'grid', placeItems: 'center', color: APG2.gold, background: APG2.goldSoft, fontSize: 20, fontWeight: 920 }}>{avgRating > 0 ? avgRating.toFixed(1) : '★'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#FFD700', fontSize: 13, letterSpacing: 1 }}>{avgRating > 0 ? '★'.repeat(Math.round(avgRating)) : '★★★★★'}</div>
                    <div style={{ color: APG2.textSoft, fontSize: 13, lineHeight: '18px', marginTop: 3 }}>На основе {reviewCount} отзывов</div>
                  </div>
                </div>
              )}
              {!canReview && !reviewsLoading && (
                <div style={{ ...APG2.glass, borderRadius: 24, padding: 13, color: APG2.textMuted, fontSize: 13, lineHeight: '18px', marginBottom: 10 }}>
                  Оставить отзыв можно после посещения и скана QR-кода.
                </div>
              )}
              {showForm && (
                <div style={{ ...APG2.glass, borderRadius: 30, padding: 16, marginBottom: 12 }}>
                  <div style={{ color: APG2.text, fontSize: 15, fontWeight: 780, marginBottom: 10 }}>Ваш отзыв</div>
                  <StarPicker value={formStars} onChange={setFormStars} size={30} />
                  <textarea value={formText} onChange={e => setFormText(e.target.value)} placeholder="Расскажите о визите..." maxLength={400} style={{ width:'100%', marginTop: 12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)', borderRadius:20, padding:'12px 13px', color:APG2.text, fontSize:16, resize:'none', minHeight:82, outline:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:'22px' }} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <GlassButton onClick={() => setShowForm(false)} style={{ flex: 1 }}>Отмена</GlassButton>
                    <GlassButton onClick={submitReview} tone="gold" style={{ flex: 1, opacity: formStars === 0 || submitting ? 0.5 : 1 }}>{submitting ? '...' : 'Опубликовать'}</GlassButton>
                  </div>
                  {reviewError && <div style={{ marginTop: 9, color: '#ff9aa8', fontSize: 12 }}>{reviewError}</div>}
                </div>
              )}
              {reviewsLoading ? (
                <div style={{ ...APG2.glass, borderRadius: 28, padding: 22, color: APG2.textMuted, textAlign: 'center' }}>Загружаем отзывы...</div>
              ) : reviews.length === 0 ? (
                <div style={{ ...APG2.glass, borderRadius: 34, padding: 28, textAlign: 'center' }}>
                  <div style={{ color: APG2.text, fontSize: 18, fontWeight: 780, marginBottom: 6 }}>Отзывов пока нет</div>
                  <div style={{ color: APG2.textMuted, fontSize: 13, lineHeight: '19px' }}>Карточка выглядит законченно даже до первых отзывов.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x mandatory' }} onTouchStart={e => e.stopPropagation()}>
                  {reviews.map(r => <ProfileReviewCard key={r.id} review={r} isOwn={r.id === userId} textFallback="Гость оценил место без комментария." />)}
                </div>
              )}
            </GlassSection>
            </div>

            {similar.length > 0 && (
              <GlassSection title="Похожие места">
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }} onTouchStart={e => e.stopPropagation()}>
                  {similar.map(p => (
                    <button key={p.id} onClick={() => onOpenPartner(p)} style={{ ...APG2.glass, flex: '0 0 160px', minHeight: 132, borderRadius: 28, padding: 14, color: APG2.text, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ color: APG2.textMuted, fontSize: 11, marginBottom: 18 }}>{p.categoryLabel || 'АПГ'}</div>
                      <div style={{ fontSize: 15, lineHeight: '19px', fontWeight: 800, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name || 'Партнер'}</div>
                    </button>
                  ))}
                </div>
              </GlassSection>
            )}
          </main>
        </div>

          <ProfilePhotoViewer items={galleryItems} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
          <ProfileVideoViewer videos={partner.videos} startIndex={videoViewerIdx} onClose={() => setVideoViewerIdx(null)} />
          {selectedProfileArticle}
        </>
      );
    }

  return (
    <>
      {shareToast && createPortal(
        <div style={{ position:'fixed', top:'calc(var(--safe-top, 0px) + 60px)', left:'50%', transform:'translateX(-50%)', zIndex:20000, background:'rgba(30,30,50,0.95)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'10px 18px', fontSize:13, fontWeight:700, color:'#fff', whiteSpace:'nowrap', pointerEvents:'none' }}>
          {shareToast}
        </div>,
        document.body
      )}
      <div style={{ position:'sticky', top:0, zIndex:50, background:T.headerBg, backdropFilter:'blur(36px) saturate(2)', WebkitBackdropFilter:'blur(36px) saturate(2)', borderBottom:'1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow:'0 1px 12px rgba(0,0,0,0.4)', padding:'0 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, height:52 }}>
          <button onClick={onBack} style={{ background:T.chipBg, border:`1px solid ${T.border}`, borderRadius:12, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, color:T.textPri, flexShrink:0 }}>‹</button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, overflow:'hidden' }}>
              <div style={{ fontSize:15, fontWeight:800, color:T.textPri, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{partner.name}</div>
              {partner.partnerOfMonth && (
                <span style={{ fontSize:9, fontWeight:800, color:T.gold, background:'rgba(201,168,76,0.15)', border:`1px solid rgba(201,168,76,0.35)`, borderRadius:8, padding:'2px 6px', flexShrink:0, whiteSpace:'nowrap' }}>🏆 месяца</span>
              )}
            </div>
            {avgRating > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                <span style={{ fontSize:11, color:'#FFD700', letterSpacing:1 }}>{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5-Math.round(avgRating))}</span>
                <span style={{ fontSize:11, color:T.gold, fontWeight:700 }}>{avgRating.toFixed(1)}</span>
                <span style={{ fontSize:10, color:T.textSec }}>({reviewCount})</span>
              </div>
            )}
          </div>
          <button onClick={handleShare} style={{ background:T.chipBg, border:`1px solid ${T.border}`, borderRadius:12, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, flexShrink:0, pointerEvents:'auto' }}>📤</button>
          <button onClick={() => onToggleFavorite(partner.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:isFavorite ? T.red : T.textSec, padding:4, flexShrink:0 }}>
            {isFavorite ? '♥' : '♡'}
          </button>
        </div>
      </div>

      <div style={{ background: 'transparent' }}>

        {/* Обложка */}
        {partner.coverPhoto && (
          <div style={{ position:'relative', height:200, overflow:'hidden' }}>
            <img src={partner.coverPhoto} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e => e.target.parentElement.style.display='none'} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 40%, rgba(15,15,46,0.95))' }} />
            <div style={{ position:'absolute', bottom:18, left:20, right:20 }}>
              <div style={{ fontSize:22, fontWeight:800, color:'#fff', textShadow:'0 2px 10px rgba(0,0,0,0.7)', lineHeight:'26px' }}>{partner.name}</div>
              {partner.categoryLabel && <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:4 }}>{partner.categoryLabel}</div>}
            </div>
          </div>
        )}

        {/* Шапка партнёра */}
        <div style={{ margin:'8px 16px', borderRadius:24, background:T.surface, position:'relative', overflow:'hidden', border:`1px solid rgba(201,168,76,0.2)` }}>
          {photos.length > 0 && (
            <div style={{ height:160, overflow:'hidden', borderRadius:'24px 24px 0 0' }}>
              <img src={photos[0]} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e => e.target.parentElement.style.display='none'} />
              <div style={{ position:'absolute', top:0, left:0, right:0, height:160, background:'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(15,15,46,0.7))' }} />
            </div>
          )}
          <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(201,168,76,0.04) 1px,transparent 1px)', backgroundSize:'20px 20px', pointerEvents:'none' }}/>
          <div style={{ position:'relative', padding:'20px 20px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <PartnerLogo partner={partner} />
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:T.textPri, marginBottom:4 }}>{partner.name}</div>
              {partner.partnerOfMonth && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.06))', border:`1px solid rgba(201,168,76,0.4)`, borderRadius:20, padding:'5px 14px', marginBottom:8 }}>
                  <span style={{ fontSize:12, color:T.gold, fontWeight:800, letterSpacing:0.3 }}>🏆 Партнёр месяца</span>
                </div>
              )}
              {partner.categoryLabel && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:T.gold+'18', border:`1px solid ${T.gold}40`, borderRadius:20, padding:'4px 12px', marginBottom:8 }}>
                  <span style={{ fontSize:11, color:T.gold, fontWeight:700 }}>✦ {partner.categoryLabel}</span>
                </div>
              )}
              {/* Рейтинг сообщества */}
              {avgRating > 0 ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:4 }}>
                  <span style={{ fontSize:18, color:'#FFD700', letterSpacing:2 }}>{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5-Math.round(avgRating))}</span>
                  <div>
                    <span style={{ fontSize:16, fontWeight:800, color:T.gold }}>{avgRating.toFixed(1)}</span>
                    <span style={{ fontSize:11, color:T.textSec, marginLeft:4 }}>{ratingLabel(avgRating)} · {reviewCount} {reviewCount===1?'отзыв':reviewCount<5?'отзыва':'отзывов'}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize:12, color:T.textSec, marginTop:4 }}>Отзывов пока нет</div>
              )}
            </div>
            {partner.description && <div style={{ maxWidth:280, textAlign:'center' }}><RichText color={T.textSec} fontSize={14}>{isVK() ? sanitizeForVK(partner.description) : partner.description}</RichText></div>}
          </div>
        </div>

        {/* Спецпредложение */}
        {partner.offer && (
          <div style={{ margin:'12px 16px', borderRadius:24, ...GLASS_GOLD, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:28, flexShrink:0 }}>🎁</div>
            <div>
              <div style={{ fontSize:11, color:T.gold, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:4 }}>Предложение для участников АПГ</div>
              <div style={{ fontSize:14, color:T.textPri, fontWeight:600 }}>{partner.offer}</div>
            </div>
          </div>
        )}

        {/* Штамп-карта */}
        {partner.stampTarget > 0 && (() => {
          const stamps    = visitCounts[partner.id] ?? 0;
          const target    = partner.stampTarget;
          const filled    = Math.min(stamps, target);
          const completed = stamps >= target;
          return (
            <div style={{ margin:'12px 16px', borderRadius:24, padding:'16px 18px', background: completed ? 'rgba(201,168,76,0.1)' : T.chipBg, border:`1px solid ${completed ? 'rgba(201,168,76,0.4)' : T.border}`, backdropFilter:'blur(20px)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontSize:11, color: completed ? T.gold : T.textSec, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>
                  🎟️ Штамп-карта
                </div>
                <div style={{ fontSize:12, color: completed ? T.gold : T.textSec, fontWeight:700 }}>
                  {filled} / {target}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {Array.from({ length: target }, (_, i) => (
                  <div key={i} style={{
                    width:32, height:32, borderRadius:'50%',
                    border:`2px solid ${i < filled ? T.gold : T.border}`,
                    background: i < filled ? `linear-gradient(135deg,${T.gold},${T.goldL})` : 'transparent',
                    flexShrink:0,
                    transition:'all 0.3s',
                    boxShadow: i < filled ? `0 0 8px rgba(201,168,76,0.4)` : 'none',
                  }} />
                ))}
              </div>
              <div style={{ fontSize:13, color: completed ? T.gold : T.textSec, fontWeight: completed ? 700 : 400 }}>
                {completed
                  ? 'Награда получена! 🎉'
                  : `Ещё ${target - filled} визит${target - filled === 1 ? '' : target - filled < 5 ? 'а' : 'ов'} до награды`}
              </div>
            </div>
          );
        })()}

        {/* Галерея */}
        {gallery.length > 0 && (
          <div style={{ margin:'12px 16px' }}>
            <div style={{ fontSize:13, color:T.gold, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>✦ Галерея</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
              {gallery.map((url, i) => (
                <button key={i} onClick={() => setLightboxIdx(i)} style={{ padding:0, border:`1px solid ${T.border}`, borderRadius:12, overflow:'hidden', cursor:'pointer', background:'none', aspectRatio:'1' }}>
                  <img src={url} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e => e.target.parentElement.style.display='none'} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Видео */}
        <VideoSection videos={partner.videos} />

        {multipleLocations && (
          <div style={{ margin:'12px 16px' }}>
            <div style={{ fontSize:13, color:T.gold, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>✦ Локации</div>
            <div style={{ display:'grid', gap:10 }}>
              {locations.map(location => (
                <div key={location.id} style={{ ...GLASS, borderRadius:24, padding:'14px 16px', border: location.isMain ? `1px solid ${T.gold}55` : GLASS.border }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start' }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:15, color:T.textPri, fontWeight:800 }}>{location.title || 'Локация'}</div>
                      {location.address && <div style={{ fontSize:13, color:T.textSec, lineHeight:'18px', marginTop:4 }}>{location.address}</div>}
                    </div>
                    {location.isMain && <span style={{ borderRadius:999, padding:'4px 8px', color:T.gold, background:T.gold+'18', border:`1px solid ${T.gold}33`, fontSize:10, fontWeight:800 }}>Главная</span>}
                  </div>
                  {(location.workingHours || location.phone) && <div style={{ fontSize:12, color:T.textSec, lineHeight:'17px', marginTop:8 }}>{[location.workingHours, location.phone].filter(Boolean).join(' · ')}</div>}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:7, marginTop:10 }}>
                    {location.phone && <button onClick={() => handlePhone(location)} style={{ minHeight:38, borderRadius:14, border:`1px solid ${T.border}`, background:T.chipBg, color:T.textPri, fontSize:12, fontWeight:800 }}>Позвонить</button>}
                    {location.address && <button onClick={() => handleMap(location)} style={{ minHeight:38, borderRadius:14, border:`1px solid ${T.border}`, background:T.chipBg, color:T.textPri, fontSize:12, fontWeight:800 }}>Маршрут</button>}
                    {canUseApgBooking && <button onClick={() => handleBookLocation(location)} style={{ minHeight:38, borderRadius:14, border:'none', background:`linear-gradient(135deg,${T.gold},${T.goldL})`, color:'#0F0F1A', fontSize:12, fontWeight:800 }}>Записаться</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Отзывы */}
        <div style={{ margin:'12px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ fontSize:13, color:T.gold, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>
              ✦ Отзывы {reviewCount > 0 && `· ${reviewCount}`}
            </div>
            {canReview && !showForm && !submitDone && (
              <button
                onClick={() => { setShowForm(true); setFormStars(myReview?.stars ?? 0); setFormText(myReview?.text ?? ''); }}
                style={{ fontSize:12, fontWeight:700, color:T.gold, background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.25)', borderRadius:10, padding:'5px 12px', cursor:'pointer' }}
              >
                {myReview ? '✏️ Изменить' : '+ Написать'}
              </button>
            )}
          </div>

          {/* Форма отзыва */}
          {showForm && (
            <div style={{ ...GLASS, borderRadius:24, padding:'16px', border:'1px solid rgba(201,168,76,0.25)', marginBottom:12, animation:'fadeInUp 0.25s ease' }}>
              <div style={{ fontSize:13, color:T.textPri, fontWeight:700, marginBottom:12 }}>
                {myReview ? 'Изменить отзыв' : 'Ваш отзыв'}
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:T.textSec, marginBottom:8 }}>Оценка *</div>
                <StarPicker value={formStars} onChange={setFormStars} size={32} />
                {formStars > 0 && (
                  <div style={{ fontSize:12, color:T.gold, marginTop:6 }}>
                    {formStars===5?'Отлично!':formStars===4?'Хорошо':formStars===3?'Неплохо':formStars===2?'Так себе':'Разочарован'}
                  </div>
                )}
              </div>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:T.textSec, marginBottom:6 }}>Комментарий (необязательно)</div>
                <textarea
                  value={formText}
                  onChange={e => setFormText(e.target.value)}
                  placeholder="Расскажите о своём визите..."
                  maxLength={400}
                  style={{ width:'100%', background:T.chipBg, backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:`1px solid ${T.border}`, borderRadius:16, padding:'10px 12px', color:T.textPri, fontSize:16, resize:'none', minHeight:80, outline:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:'22px' }}
                />
                <div style={{ fontSize:10, color:T.textSec, textAlign:'right', marginTop:2 }}>{formText.length}/400</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowForm(false)} style={{ flex:1, padding:'12px 0', borderRadius:14, background:T.chipBg, backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:`1px solid ${T.border}`, color:T.textPri, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Отмена
                </button>
                <button
                  onClick={submitReview}
                  disabled={formStars === 0 || submitting}
                  style={{ flex:2, padding:'12px 0', borderRadius:14, border:'none', background: formStars === 0 ? T.chipBg : `linear-gradient(135deg,${T.gold},${T.goldL})`, color: formStars === 0 ? T.textSec : '#0F0F1A', fontSize:13, fontWeight:800, cursor: formStars === 0 || submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Отправка...' : '⭐ Опубликовать'}
                </button>
              </div>
              {reviewError && (
                <div style={{ marginTop: 8, fontSize: 12, color: T.red, textAlign: 'center' }}>{reviewError}</div>
              )}
            </div>
          )}

          {/* Баннер после отправки */}
          {submitDone && !showForm && (
            <div style={{ background:'rgba(75,179,75,0.08)', border:'1px solid rgba(75,179,75,0.25)', borderRadius:16, padding:'12px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:10, animation:'fadeInUp 0.3s ease' }}>
              <span style={{ fontSize:20 }}>✓</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:T.green }}>Отзыв опубликован</div>
                <div style={{ fontSize:11, color:T.textSec, marginTop:1 }}>Спасибо! Он виден другим участникам АПГ</div>
              </div>
            </div>
          )}

          {/* Блок "только после скана" */}
          {!canReview && !reviewsLoading && (
            <div style={{ background:T.chipBg, border:`1px solid ${T.border}`, borderRadius:14, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:16, opacity:0.5 }}>◎</span>
              <span style={{ fontSize:12, color:T.textSec }}>Оставить отзыв можно после посещения — отсканируйте QR-код у партнёра</span>
            </div>
          )}

          {/* Список отзывов */}
          {reviewsLoading ? (
            <div style={{ ...GLASS, borderRadius:24, padding:'20px 16px', textAlign:'center' }}>
              <div style={{ fontSize:13, color:T.textSec }}>Загружаем отзывы...</div>
            </div>
          ) : reviews.length === 0 ? (
            <div style={{ ...GLASS, borderRadius:24, padding:'28px 20px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:40, animation:'float 3s ease-in-out infinite' }}>💬</div>
              <div style={{ color:T.textSec, fontSize:13 }}>Отзывов пока нет — будьте первым!</div>
            </div>
          ) : (
            <div style={{ ...GLASS, borderRadius:24, overflow:'hidden' }}>
              {reviews.map(r => (
                <ReviewCard key={r.id} review={r} isOwn={r.id === userId} />
              ))}
            </div>
          )}
        </div>

        {/* Информация */}
        {infoRows.length > 0 && (
          <div style={{ margin:'12px 16px' }}>
            <div style={{ fontSize:13, color:T.gold, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>✦ Информация</div>
            <div style={{ ...GLASS, borderRadius:24, overflow:'hidden' }}>
              {infoRows.map((row,i) => (
                <div key={row.label} onClick={row.onClick} style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, borderBottom:i<infoRows.length-1?`1px solid ${T.border}`:'none', cursor:row.onClick?'pointer':'default' }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:T.chipBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{row.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, color:T.textSec, marginBottom:2 }}>{row.label}</div>
                    <div style={{ fontSize:14, color:row.onClick?T.blue:T.textPri, fontWeight:500 }}>{row.value}</div>
                  </div>
                  {row.onClick && <span style={{ color:T.textSec, fontSize:16 }}>›</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Кнопки действий */}
        <div style={{ margin:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {(mainLocation?.phone || partner.phone) && (
            <div>
              <button onClick={() => handlePhone(mainLocation)} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background: phoneCopied ? `linear-gradient(135deg,#2d7a2d,#1e5e1e)` : `linear-gradient(135deg,${T.green},#3a9a3a)`, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', transition:'background 0.3s' }}>
                {phoneCopied ? '✓ Номер скопирован' : '📞 Позвонить'}
              </button>
              {phoneCopied && (
                <div style={{ marginTop:8, padding:'10px 14px', background:'rgba(75,179,75,0.12)', border:'1px solid rgba(75,179,75,0.3)', borderRadius:12, display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>📋</span>
                  <div>
                    <div style={{ fontSize:11, color:T.green, fontWeight:700, marginBottom:2 }}>Номер в буфере обмена</div>
                    <div style={{ fontSize:16, color:T.textPri, fontWeight:700, letterSpacing:1 }}>{mainLocation?.phone || partner.phone}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {!isVK() && partner.bookingUrl && (
            <button onClick={() => openPartnerUrl(partner.bookingUrl, 'booking')} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:`linear-gradient(135deg,${T.gold},${T.goldL})`, color:'#0F0F1A', fontSize:15, fontWeight:800, cursor:'pointer', boxShadow:`0 4px 16px rgba(201,168,76,0.35)` }}>
              📅 Записаться онлайн
            </button>
          )}
          {(mainLocation?.address || partner.address) && <button onClick={() => handleMap(mainLocation)} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:'linear-gradient(135deg,#FF6600,#FF8C00)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>🗺️ Проложить маршрут</button>}
          {!isVK() && partner.websiteUrl && partner.websiteUrl !== partnerVkUrl && (() => {
            const isVkLink = /vk\.com|vkontakte\.ru/i.test(partner.websiteUrl);
            return isVkLink
              ? <button onClick={() => openPartnerUrl(partner.websiteUrl, 'vk', { platform: 'vk' })} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:`linear-gradient(135deg,#4A76A8,#2D5F8A)`, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>🔵 ВКонтакте</button>
              : <button onClick={() => openPartnerUrl(partner.websiteUrl, 'website')} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.07)', color:T.textPri, fontSize:15, fontWeight:700, cursor:'pointer' }}>🌐 Сайт</button>;
          })()}
          {partnerVkUrl && (
            <button onClick={openVkGroup} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:`linear-gradient(135deg,#4A76A8,#2D5F8A)`, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              🔵 ВКонтакте
            </button>
          )}
          {partnerTelegramUrl && (
            <button onClick={() => openPartnerUrl(partnerTelegramUrl, 'telegram', { platform: 'telegram' })} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:'linear-gradient(135deg,#2AABEE,#1D8EC4)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              ✈️ Telegram
            </button>
          )}
          {!isVK() && partner.socialUrl && !isDuplicatePartnerSocial(partner.socialUrl) && (() => {
            const isVkLink = /vk\.com|vkontakte\.ru/i.test(partner.socialUrl);
            return isVkLink
              ? <button onClick={() => openPartnerUrl(partner.socialUrl, 'vk', { platform: 'vk' })} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:`linear-gradient(135deg,#4A76A8,#2D5F8A)`, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>🔵 ВКонтакте</button>
              : <button onClick={() => openPartnerUrl(partner.socialUrl, 'social')} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.07)', color:T.textPri, fontSize:15, fontWeight:700, cursor:'pointer' }}>🌐 Сайт</button>;
          })()}
          {partnerMaxUrl && (
            <button onClick={() => openPartnerUrl(partnerMaxUrl, 'max', { platform: 'max' })} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:'linear-gradient(135deg,#7B5EA7,#5B3F87)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              💬 Max
            </button>
          )}
          <button onClick={() => onToggleFavorite(partner.id)} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:isFavorite?`1px solid ${T.red}44`:'none', background:isFavorite?T.red+'15':`linear-gradient(135deg,${T.gold},${T.goldL})`, color:isFavorite?T.red:'#0F0F1A', fontSize:15, fontWeight:700, cursor:'pointer' }}>
            {isFavorite ? '♥ Убрать из избранного' : '♡ Добавить в избранное'}
          </button>
        </div>

        {/* Похожие */}
        {similar.length > 0 && (
          <div style={{ margin:'4px 16px 0' }}>
            <div style={{ fontSize:13, color:T.gold, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>✦ Похожие места</div>
            <HorizontalScroll>
              <div style={{ display:'flex', gap:10, paddingRight:4, paddingBottom:4 }}>
                {similar.map(p => <SimilarCard key={p.id} partner={p} onOpen={onOpenPartner} />)}
              </div>
            </HorizontalScroll>
          </div>
        )}

        <div style={{ height:90 }}/>
      </div>

      {lightboxIdx !== null && (
        <PhotoLightbox photos={gallery} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
      {selectedProfileArticle}
    </>
  );
}
