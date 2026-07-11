import React from 'react';
import { APG2_PROFILE, GlassBadge, GlassCard } from './Apg2ProfileGlass.jsx';
import { getExpertCategory, normalizeExpertRecord } from '../../server-shared/expert-directory.js';

const CATEGORY_LABELS = {
  food: ['Еда', '🍽️'],
  beauty: ['Красота', '💄'],
  sport: ['Спорт', '💪'],
  education: ['Обучение', '📚'],
  entertainment: ['Развлечения', '🎉'],
  health: ['Здоровье', '🏥'],
  home: ['Дом', '🏠'],
  services: ['Услуги', '💼'],
  shopping: ['Шопинг', '🛍️'],
  business: ['Бизнес', '💼'],
  law: ['Право', '⚖️'],
  psychology: ['Психология', '🧠'],
  finance: ['Финансы', '💰'],
  marketing: ['Маркетинг', '📣'],
  society: ['Общество', '🏙️'],
  culture: ['Культура', '🎭'],
  transport: ['Транспорт', '🚇'],
  other: ['Другое', '✨'],
};

const MONTHS_GEN = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function text(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function imageOf(item = {}) {
  return item.coverPhoto || item.imageUrl || item.logoUrl || item.photo || item.thumbnail || item.banner || item.image || '';
}

function titleOf(type, item = {}) {
  if (type === 'expert') return text(item.name, 'Эксперт АПГ');
  if (type === 'partner') return text(item.name, 'Партнёр АПГ');
  if (type === 'event') return text(item.title || item.name, 'Событие АПГ');
  if (type === 'news') return text(item.title || item.name, 'Новость АПГ');
  if (type === 'prize') return text(item.name || item.title, 'Приз АПГ');
  return text(item.title || item.name, 'Карточка АПГ');
}

function descriptionOf(type, item = {}) {
  if (type === 'expert') return text(item.specialization || item.shortDescription || item.description, 'Консультации и экспертная помощь');
  if (type === 'partner') return text(item.offer || item.categoryLabel || item.description || item.address, 'Проверенный участник городской экосистемы');
  if (type === 'event') return text([item.date, item.time, item.partner, item.address || item.location].filter(Boolean).join(' · ') || item.description, 'Подробности мероприятия появятся скоро');
  if (type === 'news') return text(item.summary || item.subtitle || item.text || item.fullText, 'Короткий материал АПГ');
  if (type === 'prize') return text(item.description || item.donorName, 'Награда для участников АПГ');
  return text(item.description || item.summary, 'Предпросмотр карточки');
}

function categoryOf(item = {}, type = '') {
  if (type === 'expert') {
    const category = getExpertCategory(item.category || item.categories?.[0] || item.primaryCategory);
    return category || { id: 'other', label: 'Другое', emoji: '✨' };
  }
  const id = text(item.category || item.primaryCategory || 'other', 'other');
  const pair = CATEGORY_LABELS[id] || [text(item.categoryLabel || id, 'Другое'), '✨'];
  return { id, label: text(item.categoryLabel || pair[0], pair[0]), emoji: pair[1] };
}

function eventDateParts(item = {}) {
  const raw = item.startAt || item.eventDate || item.date || item.deadline;
  if (!raw) return null;
  const date = raw?.toDate ? raw.toDate() : new Date(String(raw).length <= 10 ? `${raw}T12:00:00` : raw);
  if (Number.isNaN(date.getTime())) return null;
  return { day: date.getDate(), month: MONTHS_GEN[date.getMonth()] };
}

export function normalizeEntityPreview(type, item = {}) {
  const normalizedItem = type === 'expert' ? normalizeExpertRecord(item) : item;
  return {
    type,
    item: normalizedItem,
    title: titleOf(type, normalizedItem),
    description: descriptionOf(type, normalizedItem),
    image: imageOf(normalizedItem),
    category: categoryOf(normalizedItem, type),
    date: eventDateParts(normalizedItem),
  };
}

export function EntityPreviewCard({ type = 'partner', item = {}, compact = false, onClick, style }) {
  const preview = normalizeEntityPreview(type, item);
  item = preview.item;
  const isEvent = type === 'event';
  const isNews = type === 'news';
  const isExpert = type === 'expert';
  const isPartner = type === 'partner';
  const isPrize = type === 'prize';
  const badge = isExpert ? 'Эксперт' : isPartner ? 'Партнёр' : isEvent ? 'Событие' : isNews ? 'Новость' : isPrize ? 'Приз' : 'АПГ';
  const emoji = isExpert ? '🧑‍💼' : isPartner ? (item.emoji || '🤝') : isEvent ? (item.emoji || '🎉') : isNews ? '📢' : isPrize ? (item.emoji || '🎁') : '✨';
  return (
    <GlassCard
      onClick={onClick}
      style={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        borderRadius: compact ? 24 : 30,
        padding: 0,
        overflow: 'hidden',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{ minHeight: compact ? 122 : 164, display: 'grid', gridTemplateColumns: isEvent ? '104px minmax(0, 1fr)' : '1fr', position: 'relative' }}>
        {isEvent ? (
          <div style={{ position: 'relative', background: APG2_PROFILE.goldSoft, overflow: 'hidden' }}>
            {preview.image ? <img src={preview.image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: 38 }}>{emoji}</div>}
            <div style={{ position: 'absolute', left: 9, bottom: 9, minWidth: 52, borderRadius: 18, padding: '8px 8px 7px', background: 'linear-gradient(145deg,rgba(255,247,218,0.96),rgba(215,184,106,0.92))', color: '#17120a', textAlign: 'center', border: '1px solid rgba(255,255,255,0.62)', boxShadow: '0 10px 26px rgba(0,0,0,0.30)' }}>
              <div style={{ fontSize: 24, fontWeight: 980, lineHeight: '23px', fontVariantNumeric: 'tabular-nums' }}>{preview.date?.day || '—'}</div>
              <div style={{ marginTop: 1, fontSize: 9, lineHeight: '10px', fontWeight: 940, color: 'rgba(23,18,10,0.78)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{preview.date?.month || 'скоро'}</div>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', minHeight: compact ? 112 : 152, overflow: 'hidden', background: 'radial-gradient(circle at 24% 18%, rgba(215,184,106,0.24), transparent 38%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.22), rgba(var(--apg2-glass-a,255,255,255),0.08))' }}>
            {preview.image && <img src={preview.image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: isNews ? 0.88 : 0.52, filter: 'saturate(1.06) contrast(1.02)' }} onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(7,7,9,0.03),rgba(7,7,9,0.34) 45%,rgba(7,7,9,0.84))' }} />
            {!preview.image && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: APG2_PROFILE.gold, fontSize: 42 }}>{emoji}</div>}
            <div style={{ position: 'absolute', left: 13, top: 13, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              <GlassBadge tone="gold">{badge}</GlassBadge>
              {preview.category.label && <GlassBadge>{preview.category.emoji} {preview.category.label}</GlassBadge>}
            </div>
          </div>
        )}
        <div style={{ padding: compact ? 13 : 16, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10, position: 'relative' }}>
          {isEvent && (
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
              <GlassBadge tone="gold">{badge}</GlassBadge>
              {preview.category.label && <GlassBadge>{preview.category.emoji} {preview.category.label}</GlassBadge>}
            </div>
          )}
          <div>
            <div style={{ color: APG2_PROFILE.text, fontSize: compact ? 16 : 18, lineHeight: compact ? '20px' : '23px', fontWeight: 920, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview.title}</div>
            <div style={{ color: isExpert ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', marginTop: 7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', color: APG2_PROFILE.textMuted, fontSize: 11, fontWeight: 760 }}>
            {isPartner && item.address && <span>📍 {item.address}</span>}
            {isExpert && (item.workFormats || item.formats)?.length > 0 && <span>{(item.workFormats || item.formats).slice(0, 2).join(' · ')}</span>}
            {isExpert && item.offer && <span style={{ color: APG2_PROFILE.gold }}>🎁 Акция</span>}
            {isNews && <span>{item.sourceName || item.source || 'АПГ'}</span>}
            {isPrize && item.donorName && <span>{item.donorName}</span>}
            <span style={{ marginLeft: 'auto', color: APG2_PROFILE.gold, fontSize: 22, lineHeight: 1 }}>›</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
