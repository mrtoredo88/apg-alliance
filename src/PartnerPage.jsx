import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Panel, HorizontalScroll } from '@vkontakte/vkui';
import vkBridge, { openUrl } from './vk.js';
import { db } from './firebase';
import { collection, getDocs, query, orderBy, doc, setDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';

import { T, GLASS, GLASS_STRONG, GLASS_GOLD } from './design.js';

// ─── Лайтбокс ─────────────────────────────────────────────────────────────────

function PhotoLightbox({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const prev = () => setIdx(i => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx(i => (i + 1) % photos.length);
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.93)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)' }}>
      <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'50%', width:38, height:38, color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>✕</button>
      {photos.length > 1 && <div style={{ position:'absolute', top:22, left:'50%', transform:'translateX(-50%)', fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:600, zIndex:10 }}>{idx+1}/{photos.length}</div>}
      <img src={photos[idx]} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth:'94vw', maxHeight:'82vh', objectFit:'contain', borderRadius:16 }} />
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
          style={{ background:'none', border:'none', cursor:'pointer', padding:2, fontSize:size, lineHeight:1, color: s <= display ? '#FFD700' : 'rgba(255,255,255,0.15)', transition:'color 0.1s, transform 0.1s', transform: s <= display ? 'scale(1.15)' : 'scale(1)' }}>★</button>
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
    return <div style={{ width:size, height:size, borderRadius:'50%', background:`linear-gradient(135deg,hsl(${hue},45%,22%),hsl(${hue},35%,34%))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*0.38), fontWeight:800, color:'rgba(255,255,255,0.92)', border:'3px solid rgba(255,255,255,0.15)' }}>{name[0].toUpperCase()}</div>;
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
    <button onClick={() => onOpen(partner)} style={{ width:140, flexShrink:0, background:'rgba(255,255,255,0.05)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderRadius:20, padding:'14px 12px', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      {partner.logoUrl && !failed
        ? <img src={partner.logoUrl} alt="" onError={() => setFailed(true)} style={{ width:48, height:48, borderRadius:'50%', objectFit:'cover', border:'1.5px solid rgba(255,255,255,0.1)' }} />
        : <div style={{ width:48, height:48, borderRadius:'50%', background:`linear-gradient(135deg,hsl(${hue},45%,20%),hsl(${hue},35%,30%))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, color:'rgba(255,255,255,0.9)' }}>{name[0].toUpperCase()}</div>
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
  function timeAgo(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const m = Math.floor((Date.now() - d) / 60000);
    if (m < 1) return 'только что';
    if (m < 60) return `${m} мин назад`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ч назад`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days} дн назад`;
    return d.toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
  }

  return (
    <div style={{ padding:'14px 16px', borderBottom:`1px solid ${T.border}`, animation:'fadeInUp 0.3s ease both' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
        {review.userPhoto
          ? <img src={review.userPhoto} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', border:`1px solid ${isOwn ? T.gold+'44' : T.border}`, flexShrink:0 }} onError={e => e.target.style.display='none'} />
          : <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>👤</div>
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
            <span style={{ fontSize:10, color:T.textSec }}>{timeAgo(review.createdAt)}</span>
          </div>
        </div>
      </div>
      {review.text && (
        <div style={{ fontSize:13, color:T.textSec, lineHeight:'18px', paddingLeft:42 }}>{review.text}</div>
      )}
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export function PartnerPage({ partner, isFavorite, onBack, onToggleFavorite, onOpenPartner, partners = [], user, scannedPartnerIds = {}, visitCounts = {}, onPartnerUpdate }) {
  const [lightboxIdx, setLightboxIdx]     = useState(null);
  const [reviews, setReviews]             = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showForm, setShowForm]           = useState(false);
  const [formStars, setFormStars]         = useState(0);
  const [formText, setFormText]           = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitDone, setSubmitDone]       = useState(false);
  const [phoneCopied, setPhoneCopied]     = useState(false);

  const userId = user?.id ? String(user.id) : null;
  const canReview = userId && userId !== 'guest' && partner && scannedPartnerIds[partner.id];
  const myReview = userId ? reviews.find(r => r.id === userId) : null;

  // Считаем просмотр карточки (один раз при открытии каждого партнёра)
  useEffect(() => {
    if (!partner?.id) return;
    updateDoc(doc(db, 'partners', partner.id), { viewCount: increment(1) }).catch(() => {});
  }, [partner?.id]);

  useEffect(() => {
    if (!partner) return;
    setReviews([]);
    setReviewsLoading(true);
    setShowForm(false);
    setFormStars(0);
    setFormText('');
    setSubmitDone(false);

    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'partners', partner.id, 'reviews'),
          orderBy('createdAt', 'desc'),
        ));
        setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
      setReviewsLoading(false);
    })();
  }, [partner?.id]);

  const submitReview = useCallback(async () => {
    if (!partner || !userId || formStars === 0 || submitting) return;
    setSubmitting(true);
    try {
      const reviewRef = doc(db, 'partners', partner.id, 'reviews', userId);
      const reviewData = {
        userId,
        userName: user?.first_name ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Участник АПГ',
        userPhoto: user?.photo_200 ?? null,
        stars: formStars,
        text: formText.trim(),
        createdAt: serverTimestamp(),
      };
      await setDoc(reviewRef, reviewData);
      // Также пишем в глобальную коллекцию для фида отзывов на главной
      setDoc(doc(db, 'reviews', `${partner.id}_${userId}`), {
        ...reviewData, partnerId: partner.id, partnerName: partner.name,
      }).catch(() => {});

      // Обновляем список отзывов
      const snap = await getDocs(query(
        collection(db, 'partners', partner.id, 'reviews'),
        orderBy('createdAt', 'desc'),
      ));
      const allReviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReviews(allReviews);

      // Считаем новый средний рейтинг
      const avg = allReviews.reduce((s, r) => s + (r.stars ?? 0), 0) / allReviews.length;
      const newAvg = Math.round(avg * 10) / 10;
      const newCount = allReviews.length;
      await updateDoc(doc(db, 'partners', partner.id), { avgRating: newAvg, reviewCount: newCount });
      onPartnerUpdate?.(partner.id, { avgRating: newAvg, reviewCount: newCount });

      setSubmitDone(true);
      setShowForm(false);

      // Предлагаем поделиться в ВК
      const stars = '⭐'.repeat(formStars);
      const msg = `Побывал у партнёра АПГ «${partner.name}» — ${stars}\n${formText.trim() ? formText.trim() + '\n' : ''}\n#АПГ_Зеленоград`;
      vkBridge.send('VKWebAppShowWallPostBox', { message: msg }).catch(() => {});
    } catch (e) { console.error(e); }
    setSubmitting(false);
  }, [partner, userId, formStars, formText, submitting, user, onPartnerUpdate]);

  if (!partner) return null;

  const photos = partner.photos ?? [];
  const similar = partners.filter(p => p.id !== partner.id && p.category === partner.category).slice(0, 6);
  const avgRating = partner.avgRating ?? 0;
  const reviewCount = partner.reviewCount ?? reviews.length;

  const openVkGroup = () => {
    if (!partner.vkGroupUrl) return;
    const url = partner.vkGroupUrl.startsWith('http') ? partner.vkGroupUrl : `https://vk.com/${partner.vkGroupUrl}`;
    openUrl(url);
  };
  const handlePhone = () => {
    if (!partner.phone) return;
    // Копируем номер в буфер — VK WebView блокирует tel: схему
    vkBridge.send('VKWebAppCopyText', { text: partner.phone }).catch(() => {
      navigator.clipboard?.writeText(partner.phone).catch(() => {});
    });
    setPhoneCopied(true);
    setTimeout(() => setPhoneCopied(false), 3000);
    // Попытка открыть диалер (может сработать в браузере)
    openUrl(`tel:${partner.phone.replace(/\s/g, '')}`);
  };
  const handleMap   = () => partner.address && openUrl(`https://yandex.ru/maps/?text=${encodeURIComponent(partner.address + ', Зеленоград')}`);
  const handleShare  = () => vkBridge.send('VKWebAppShare', { link:`https://vk.com/app54601851`, text:`${partner.name} — партнёр АПГ! ${partner.offer ? partner.offer+' · ' : ''}Зеленоград` }).catch(() => {});

  const infoRows = [
    partner.hours   && { icon:'🕐', label:'Часы работы', value:partner.hours },
    partner.address && { icon:'📍', label:'Адрес',       value:partner.address, onClick:handleMap },
    partner.phone   && { icon:'📞', label:'Телефон',     value:partner.phone,   onClick:handlePhone },
  ].filter(Boolean);

  const ratingLabel = avg => avg >= 4.7 ? 'Отлично' : avg >= 4.0 ? 'Хорошо' : avg >= 3.0 ? 'Неплохо' : avg >= 2.0 ? 'Так себе' : 'Плохо';

  return (
    <Panel id="partner">
      {/* position:fixed — работает независимо от overflow контейнера Panel и VK UI анимаций */}
      <div style={{ position:'fixed', top:'var(--safe-top, 0px)', left:0, right:0, zIndex:50, background:T.headerBg, backdropFilter:'blur(36px) saturate(2)', WebkitBackdropFilter:'blur(36px) saturate(2)', borderBottom:'1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow:'0 1px 12px rgba(0,0,0,0.4)', padding:'0 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, height:52 }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid var(--c-header-border, rgba(255,255,255,0.1))', borderRadius:12, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, color:T.textPri, flexShrink:0 }}>‹</button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:T.textPri, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{partner.name}</div>
            {avgRating > 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                <span style={{ fontSize:11, color:'#FFD700', letterSpacing:1 }}>{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5-Math.round(avgRating))}</span>
                <span style={{ fontSize:11, color:T.gold, fontWeight:700 }}>{avgRating.toFixed(1)}</span>
                <span style={{ fontSize:10, color:T.textSec }}>({reviewCount})</span>
              </div>
            )}
          </div>
          <button onClick={handleShare} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid var(--c-header-border, rgba(255,255,255,0.1))', borderRadius:12, width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:16, flexShrink:0 }}>📤</button>
          <button onClick={() => onToggleFavorite(partner.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:isFavorite ? T.red : T.textSec, padding:4, flexShrink:0 }}>
            {isFavorite ? '♥' : '♡'}
          </button>
        </div>
      </div>

      <div style={{ background: T.bg }}>
        {/* Отступ для фиксированного хедера */}
        <div style={{ height:52 }} />

        {/* Шапка партнёра */}
        <div style={{ margin:'8px 16px', borderRadius:24, background:'linear-gradient(135deg,#0F0F2E,#1A1A4E)', position:'relative', overflow:'hidden', border:`1px solid rgba(201,168,76,0.2)` }}>
          {photos.length > 0 && (
            <div style={{ height:160, overflow:'hidden', borderRadius:'24px 24px 0 0' }}>
              <img src={photos[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e => e.target.parentElement.style.display='none'} />
              <div style={{ position:'absolute', top:0, left:0, right:0, height:160, background:'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(15,15,46,0.7))' }} />
            </div>
          )}
          <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(rgba(201,168,76,0.04) 1px,transparent 1px)', backgroundSize:'20px 20px', pointerEvents:'none' }}/>
          <div style={{ position:'relative', padding:'20px 20px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <PartnerLogo partner={partner} />
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:22, fontWeight:800, color:T.textPri, marginBottom:4 }}>{partner.name}</div>
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
            {partner.description && <div style={{ fontSize:14, color:T.textSec, textAlign:'center', lineHeight:'20px', maxWidth:280 }}>{partner.description}</div>}
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
            <div style={{ margin:'12px 16px', borderRadius:24, padding:'16px', background: completed ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.05)', border:`1px solid ${completed ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.1)'}`, backdropFilter:'blur(20px)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontSize:11, color: completed ? T.gold : T.textSec, fontWeight:700, letterSpacing:1, textTransform:'uppercase' }}>
                  🎟️ Штамп-карта
                </div>
                <div style={{ fontSize:12, color: completed ? T.gold : T.textSec, fontWeight:700 }}>
                  {filled} / {target}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                {Array.from({ length: target }, (_, i) => (
                  <div key={i} style={{
                    width:34, height:34, borderRadius:10, border:`2px solid ${i < filled ? T.gold : 'rgba(255,255,255,0.15)'}`,
                    background: i < filled ? `linear-gradient(135deg,${T.gold},${T.goldL})` : 'rgba(255,255,255,0.04)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0,
                    transition:'all 0.3s',
                    boxShadow: i < filled ? `0 0 8px rgba(201,168,76,0.45)` : 'none',
                  }}>
                    {i < filled ? '✦' : ''}
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color: completed ? T.gold : T.textSec, lineHeight:'17px', fontWeight: completed ? 700 : 400 }}>
                {completed
                  ? '🏆 Карта заполнена! Покажи администратору для получения награды'
                  : `Посети ещё ${target - filled} раз${target - filled === 1 ? '' : 'а'} — и получи особый бонус`}
              </div>
            </div>
          );
        })()}

        {/* Фото */}
        {photos.length > 0 && (
          <div style={{ margin:'12px 16px' }}>
            <div style={{ fontSize:13, color:T.gold, fontWeight:700, letterSpacing:1, textTransform:'uppercase', marginBottom:10 }}>✦ Фотографии</div>
            <HorizontalScroll>
              <div style={{ display:'flex', gap:8, paddingRight:4 }}>
                {photos.map((url, i) => (
                  <button key={i} onClick={() => setLightboxIdx(i)} style={{ padding:0, border:`1px solid ${T.border}`, borderRadius:16, overflow:'hidden', cursor:'pointer', flexShrink:0, background:'none' }}>
                    <img src={url} alt="" style={{ width:160, height:110, objectFit:'cover', display:'block' }} onError={e => e.target.parentElement.style.display='none'} />
                  </button>
                ))}
              </div>
            </HorizontalScroll>
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
                  style={{ width:'100%', background:'rgba(255,255,255,0.06)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'10px 12px', color:T.textPri, fontSize:13, resize:'none', minHeight:80, outline:'none', boxSizing:'border-box', fontFamily:'inherit', lineHeight:'18px' }}
                />
                <div style={{ fontSize:10, color:T.textSec, textAlign:'right', marginTop:2 }}>{formText.length}/400</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setShowForm(false)} style={{ flex:1, padding:'12px 0', borderRadius:14, background:'rgba(255,255,255,0.08)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.12)', color:T.textPri, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Отмена
                </button>
                <button
                  onClick={submitReview}
                  disabled={formStars === 0 || submitting}
                  style={{ flex:2, padding:'12px 0', borderRadius:14, border:'none', background: formStars === 0 ? 'rgba(255,255,255,0.07)' : `linear-gradient(135deg,${T.gold},${T.goldL})`, color: formStars === 0 ? T.textSec : '#0F0F1A', fontSize:13, fontWeight:800, cursor: formStars === 0 || submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Отправка...' : '⭐ Опубликовать'}
                </button>
              </div>
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
            <div style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${T.border}`, borderRadius:14, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
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
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{row.icon}</div>
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
          {partner.vkGroupUrl && (
            <button onClick={openVkGroup} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:`linear-gradient(135deg,#4A76A8,#2D5F8A)`, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
              🔵 Сообщество ВКонтакте
            </button>
          )}
          {partner.phone && (
            <div>
              <button onClick={handlePhone} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background: phoneCopied ? `linear-gradient(135deg,#2d7a2d,#1e5e1e)` : `linear-gradient(135deg,${T.green},#3a9a3a)`, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', transition:'background 0.3s' }}>
                {phoneCopied ? '✓ Номер скопирован' : '📞 Позвонить'}
              </button>
              {phoneCopied && (
                <div style={{ marginTop:8, padding:'10px 14px', background:'rgba(75,179,75,0.12)', border:'1px solid rgba(75,179,75,0.3)', borderRadius:12, display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:20 }}>📋</span>
                  <div>
                    <div style={{ fontSize:11, color:T.green, fontWeight:700, marginBottom:2 }}>Номер в буфере обмена</div>
                    <div style={{ fontSize:16, color:T.textPri, fontWeight:700, letterSpacing:1 }}>{partner.phone}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {partner.address && <button onClick={handleMap}    style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:'linear-gradient(135deg,#FF6600,#FF8C00)', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>🗺️ Проложить маршрут</button>}
          {partner.socialUrl && partner.socialUrl !== partner.vkGroupUrl && (
            <button onClick={() => openUrl(partner.socialUrl)} style={{ width:'100%', padding:'15px 0', borderRadius:16, border:'none', background:`linear-gradient(135deg,${T.blue},#2D6FBC)`, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>📱 Перейти в соцсеть</button>
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
        <PhotoLightbox photos={photos} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </Panel>
  );
}
