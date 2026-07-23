import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { saveWorkspaceLinkIntent } from './WorkspaceLinks.jsx';

const UI = {
  text: 'var(--apg-workspace-text, #1F1A14)',
  soft: 'var(--apg-workspace-soft, rgba(31,26,20,0.64))',
  muted: 'var(--apg-workspace-muted, rgba(31,26,20,0.46))',
  line: 'var(--apg-workspace-line, rgba(88,67,37,0.12))',
  card: 'var(--apg-workspace-card, rgba(255,255,255,0.78))',
  strong: 'var(--apg-workspace-card-strong, rgba(255,255,255,0.94))',
  gold: '#C89B3C',
};

const card = extra => ({
  border: `1px solid ${UI.line}`,
  borderRadius: 18,
  background: UI.card,
  boxShadow: '0 18px 48px rgba(82,60,30,0.08)',
  ...extra,
});

const button = primary => ({
  minHeight: 38,
  border: `1px solid ${primary ? 'rgba(200,155,60,0.34)' : UI.line}`,
  borderRadius: 14,
  padding: '8px 12px',
  background: primary ? 'linear-gradient(135deg,#F6D891,#D0A14C)' : 'rgba(255,255,255,0.62)',
  color: '#24190B',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 840,
  cursor: 'pointer',
});

function createdAt(review) {
  const value = review?.createdAt;
  const date = value?.toDate ? value.toDate() : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function WorkspaceReviewsCenter({ role, profile, reviews: suppliedReviews, actions, onOpenDialogs, compact = false }) {
  const [loadedReviews, setLoadedReviews] = useState([]);
  const [loading, setLoading] = useState(!Array.isArray(suppliedReviews));
  const [filter, setFilter] = useState('all');
  const [queryText, setQueryText] = useState('');
  const reviews = Array.isArray(suppliedReviews) ? suppliedReviews : loadedReviews;

  useEffect(() => {
    if (Array.isArray(suppliedReviews) || !profile?.id || !['partner', 'expert'].includes(role?.id)) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const reviewsQuery = role.id === 'expert'
      ? query(collection(db, 'expertReviews'), where('expertId', '==', profile.id), orderBy('createdAt', 'desc'), limit(100))
      : query(collection(db, 'partners', profile.id, 'reviews'), orderBy('createdAt', 'desc'), limit(100));
    getDocs(reviewsQuery)
      .then(snapshot => alive && setLoadedReviews(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))))
      .catch(() => alive && setLoadedReviews([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [profile?.id, role?.id, suppliedReviews]);

  const stats = useMemo(() => {
    const rated = reviews.filter(item => Number(item.stars ?? item.rating) > 0);
    const average = rated.length ? rated.reduce((sum, item) => sum + Number(item.stars ?? item.rating), 0) / rated.length : 0;
    const unanswered = reviews.filter(item => !item.reply && !item.response && !item.answeredAt).length;
    return { all: reviews.length, average, unanswered, positive: rated.filter(item => Number(item.stars ?? item.rating) >= 4).length };
  }, [reviews]);

  const visible = useMemo(() => reviews.filter(review => {
    const rating = Number(review.stars ?? review.rating ?? 0);
    const unanswered = !review.reply && !review.response && !review.answeredAt;
    if (filter === 'unanswered' && !unanswered) return false;
    if (filter === 'positive' && rating < 4) return false;
    if (filter === 'critical' && (!rating || rating > 3)) return false;
    const needle = queryText.trim().toLowerCase();
    return !needle || [review.userName, review.authorName, review.text, review.comment].some(value => String(value || '').toLowerCase().includes(needle));
  }), [reviews, filter, queryText]);

  const openReviewDialog = review => {
    saveWorkspaceLinkIntent('dialogs', {
      dialogId: review.dialogId || '',
      bookingId: review.bookingId || '',
      query: review.userName || review.authorName || review.text || '',
    });
    (actions?.openDialogs || onOpenDialogs)?.();
  };

  return (
    <div data-workspace-reviews-center style={{ display: 'grid', gap: 14 }}>
      <section style={card({ padding: compact ? 14 : 18, background: UI.strong })}>
        <div style={{ color: UI.gold, fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Репутация</div>
        <h1 style={{ margin: '5px 0 0', color: UI.text, fontSize: compact ? 25 : 30, lineHeight: 1.2 }}>Отзывы клиентов</h1>
        <div style={{ color: UI.soft, fontSize: 14, lineHeight: '20px', marginTop: 5 }}>Реальные оценки и ответы по выбранному рабочему профилю.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 9, marginTop: 14 }}>
          {[['Всего', stats.all], ['Средняя оценка', stats.average ? stats.average.toFixed(1) : '—'], ['Ждут ответа', stats.unanswered], ['Положительные', stats.positive]].map(([label, value]) => (
            <div key={label} style={card({ padding: 11, boxShadow: 'none' })}><div style={{ color: UI.text, fontSize: 22, fontWeight: 930 }}>{value}</div><div style={{ color: UI.muted, fontSize: 11.5 }}>{label}</div></div>
          ))}
        </div>
      </section>
      <section style={card({ padding: compact ? 12 : 16 })}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(150px,220px)', gap: 8 }}>
          <input value={queryText} onChange={event => setQueryText(event.target.value)} placeholder="Найти отзыв или автора" style={{ minHeight: 42, borderRadius: 14, border: `1px solid ${UI.line}`, background: 'rgba(255,255,255,0.62)', padding: '0 12px', font: 'inherit', color: UI.text }} />
          <select value={filter} onChange={event => setFilter(event.target.value)} style={{ ...button(false), width: '100%' }}>
            <option value="all">Все отзывы</option>
            <option value="unanswered">Ждут ответа</option>
            <option value="positive">4–5 звёзд</option>
            <option value="critical">1–3 звезды</option>
          </select>
        </div>
      </section>
      {loading ? <div style={card({ padding: 24, color: UI.soft })}>Загружаем отзывы…</div> : !visible.length ? (
        <div style={card({ padding: 28, textAlign: 'center' })}><div style={{ color: UI.text, fontSize: 18, fontWeight: 900 }}>{reviews.length ? 'По фильтру ничего не найдено' : 'Отзывов пока нет'}</div><div style={{ color: UI.soft, fontSize: 13, marginTop: 5 }}>{reviews.length ? 'Измените фильтр или поисковый запрос.' : 'Первый реальный отзыв появится здесь автоматически.'}</div></div>
      ) : visible.map(review => {
        const rating = Math.max(0, Math.min(5, Number(review.stars ?? review.rating ?? 0)));
        const reply = review.reply || review.response || '';
        return (
          <article key={review.id} style={card({ padding: compact ? 14 : 16 })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div><div style={{ color: UI.text, fontSize: 15, fontWeight: 900 }}>{review.userName || review.authorName || 'Участник АПГ'}</div><div style={{ color: UI.muted, fontSize: 11.5, marginTop: 2 }}>{createdAt(review)}</div></div>
              <div aria-label={`${rating} из 5`} style={{ color: UI.gold, letterSpacing: 1 }}>{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</div>
            </div>
            <div style={{ color: UI.soft, fontSize: 13.5, lineHeight: '20px', marginTop: 10 }}>{review.text || review.comment || 'Отзыв без текста'}</div>
            {reply && <div style={{ marginTop: 10, borderLeft: `3px solid ${UI.gold}`, padding: '8px 10px', color: UI.soft, background: 'rgba(200,155,60,0.07)', borderRadius: 10 }}><strong style={{ color: UI.text }}>Ваш ответ</strong><div style={{ marginTop: 3, fontSize: 13 }}>{reply}</div></div>}
            <button type="button" onClick={() => openReviewDialog(review)} style={{ ...button(!reply), marginTop: 12, width: compact ? '100%' : 'auto' }}>{reply ? 'Открыть диалог' : 'Ответить клиенту'}</button>
          </article>
        );
      })}
    </div>
  );
}

export default WorkspaceReviewsCenter;
