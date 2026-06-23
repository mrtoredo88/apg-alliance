import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { db } from './firebase';
import {
  collection, getDocs, query, where,
  addDoc, updateDoc, doc, increment, serverTimestamp,
} from 'firebase/firestore';
import { T, GLASS, GLASS_STRONG } from './design.js';
import { RichText } from './components/RichText.jsx';
import { openUrl } from './vk.js';

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

function ExpertModal({ expert, user, scannedExperts, onClose }) {
  const [showQR, setShowQR] = useState(false);
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
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'expertReviews'), reviewData);
      const newCount = (expert.reviewCount ?? 0) + 1;
      const newAvg = Math.round((((expert.avgRating ?? 0) * (expert.reviewCount ?? 0)) + myRating) / newCount * 10) / 10;
      updateDoc(doc(db, 'experts', expert.id), { avgRating: newAvg, reviewCount: increment(1) }).catch(() => {});
      if (mountedRef.current) {
        setReviews(prev => [{ id: `local_${Date.now()}`, ...reviewData, createdAt: { toDate: () => new Date() } }, ...prev]);
        setSubmitDone(true);
        setMyRating(0);
        setMyText('');
      }
    } catch (e) { console.error(e); }
    finally { if (mountedRef.current) setSubmitting(false); }
  };

  const handleBook = () => {
    const url = expert.bookingUrl || expert.vkUrl;
    if (url) openUrl(url);
    else if (expert.phone) openUrl(`tel:${expert.phone}`);
  };

  const hasScanned = scannedExperts?.[expert.id];
  const canBook = expert.bookingUrl || expert.vkUrl || expert.phone;
  const qrValue = `expert_${expert.id}`;

  return createPortal(
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        style={{ ...GLASS_STRONG, borderRadius: '28px 28px 0 0', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '20px 20px 52px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: T.border, borderRadius: 2, margin: '0 auto 20px' }} />

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
            {expert.verified && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(74,144,217,0.12)', border: '1px solid rgba(74,144,217,0.28)', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#6AABEC' }}>
                ✓ Верифицирован АПГ
              </div>
            )}
          </div>
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
            <RichText color={T.textSec} fontSize={13}>{expert.description}</RichText>
          </div>
        )}

        {/* Book button */}
        {canBook && (
          <button onClick={handleBook} style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: 'none', background: `linear-gradient(135deg,${T.gold},${T.goldL})`, color: '#0F0F1A', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 12, boxShadow: '0 4px 16px rgba(201,168,76,0.35)' }}>
            📅 Записаться
          </button>
        )}

        {/* Contact links */}
        {(expert.telegramUrl || expert.websiteUrl || expert.maxUrl) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {expert.telegramUrl && (
              <button onClick={() => openUrl(expert.telegramUrl)} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#2AABEE,#1D8EC4)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ✈️ Telegram
              </button>
            )}
            {expert.websiteUrl && (
              <button onClick={() => openUrl(expert.websiteUrl)} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: T.textPri, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                🌐 Сайт
              </button>
            )}
            {expert.maxUrl && (
              <button onClick={() => openUrl(expert.maxUrl)} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#7B5EA7,#5B3F87)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                💬 Max
              </button>
            )}
          </div>
        )}

        {/* QR code section */}
        <div style={{ ...GLASS, borderRadius: 20, padding: '16px', marginBottom: 16, border: hasScanned ? '1px solid rgba(75,179,75,0.3)' : '1px solid rgba(201,168,76,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showQR ? 14 : 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, marginBottom: 2 }}>🔑 QR для посещения</div>
              <div style={{ fontSize: 12, color: hasScanned ? '#4BB34B' : T.textSec }}>
                {hasScanned ? '✓ Посещение отмечено' : `+${expert.keys ?? 1} ключ за консультацию`}
              </div>
            </div>
            <button
              onClick={() => setShowQR(v => !v)}
              style={{ background: showQR ? 'rgba(201,168,76,0.15)' : T.chipBg, border: `1px solid ${showQR ? 'rgba(201,168,76,0.4)' : T.border}`, borderRadius: 12, padding: '7px 12px', color: showQR ? T.gold : T.textSec, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {showQR ? 'Скрыть' : 'Показать QR'}
            </button>
          </div>
          {showQR && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: 12 }}>
                <QRCodeSVG value={qrValue} size={160} />
              </div>
              <div style={{ fontSize: 11, color: T.textSec, textAlign: 'center', lineHeight: '16px' }}>
                Покажи QR-код эксперту — он отсканирует и начислит ключ
              </div>
            </div>
          )}
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
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: `1px solid ${T.border}`, background: T.chipBg, color: T.textPri, fontSize: 13, resize: 'vertical', minHeight: 72, boxSizing: 'border-box', outline: 'none', marginBottom: 10, fontFamily: 'inherit' }}
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
    </div>,
    document.body,
  );
}

function ExpertCard({ expert, index, onClick }) {
  return (
    <div
      onClick={() => onClick(expert)}
      style={{ ...GLASS, borderRadius: 20, padding: '16px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', animation: 'fadeInUp 0.35s ease both', animationDelay: `${index * 0.05}s` }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <ExpertAvatar expert={expert} size={64} />
        {expert.verified && (
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: T.blue, border: `2px solid ${T.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 800 }}>✓</div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, lineHeight: '19px', marginBottom: 3 }}>{expert.name}</div>
        <div style={{ fontSize: 12, color: T.gold, fontWeight: 600, marginBottom: 6 }}>{expert.specialization}</div>

        {(expert.avgRating ?? 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            <StarDisplay value={expert.avgRating} size={12} />
            <span style={{ fontSize: 11, color: T.textSec }}>{expert.avgRating?.toFixed(1)} · {expert.reviewCount ?? 0}</span>
          </div>
        )}

        {expert.formats?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {expert.formats.map(f => <FormatChip key={f} format={f} />)}
          </div>
        )}
      </div>

      <div style={{ color: T.gold, fontSize: 18, flexShrink: 0, alignSelf: 'center' }}>›</div>
    </div>
  );
}

const FILTERS = [
  { id: 'all',     label: 'Все',     emoji: '✦' },
  { id: 'online',  label: 'Онлайн', emoji: '💻' },
  { id: 'offline', label: 'Офлайн', emoji: '📍' },
  { id: 'group',   label: 'Группа', emoji: '👥' },
];

export function ExpertsPage({ nav, experts = [], user, scannedExperts = {}, onBack, isActive }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = experts.filter(e => {
    if (e.active === false) return false;
    if (filter !== 'all' && !e.formats?.includes(filter)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return e.name?.toLowerCase().includes(q) || e.specialization?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q);
    }
    return true;
  });

  useEffect(() => {
    if (!isActive && selected) setSelected(null);
  }, [isActive, selected]);

  useEffect(() => {
    if (selected) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [selected]);

  return (
    <>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
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

        <div style={{ display: 'flex', gap: 8, paddingBottom: 12, overflowX: 'auto' }}>
          {FILTERS.map(opt => (
            <button key={opt.id} onClick={() => setFilter(opt.id)} style={{ padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, background: filter === opt.id ? T.gold : T.chipBg, color: filter === opt.id ? '#0F0F1A' : T.textSec, transition: 'all 0.18s' }}>
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px 90px', minHeight: '100%' }}>
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
              <ExpertCard key={expert.id} expert={expert} index={i} onClick={setSelected} />
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
        />
      )}
    </>
  );
}
