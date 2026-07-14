import React, { useMemo, useRef, useState } from 'react';

import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard } from './components/Apg2ProfileGlass.jsx';
import {
  DesktopActionBar,
  DesktopContentGrid,
  DesktopEmptyState,
  DesktopHeader,
  DesktopKpiStrip,
  DesktopMetricCard,
  DesktopSectionShell,
  DesktopSectionTitle,
  DesktopSidebarCard,
  DesktopSkeleton,
  DesktopToolbar,
  DesktopTopOverview,
} from './components/DesktopUI.jsx';
import { openUrl } from './vk.js';

const categoryLabels = {
  food: 'Еда',
  beauty: 'Красота',
  sport: 'Спорт',
  education: 'Обучение',
  entertainment: 'Развлечения',
  health: 'Здоровье',
  home: 'Дом и ремонт',
  pets: 'Животные',
  fashion: 'Одежда',
  auto: 'Авто',
  services: 'Услуги',
  shopping: 'Магазины',
  other: 'Другое',
};

const viewModes = [
  ['grid', 'Grid'],
  ['list', 'List'],
  ['map', 'Map'],
  ['split', 'Split'],
];

const sortOptions = [
  ['featured', 'Рекомендованные'],
  ['rating', 'По рейтингу'],
  ['new', 'Новые'],
  ['name', 'По названию'],
  ['offers', 'С акциями'],
];

function text(value) {
  return String(value || '').trim();
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partnerCategory(partner) {
  const id = text(partner?.category || 'other') || 'other';
  return { id, label: text(partner?.categoryLabel) || categoryLabels[id] || id };
}

function partnerCity(partner) {
  return text(partner?.city || partner?.town || partner?.settlement || 'Зеленоград');
}

function partnerDistrict(partner) {
  return text(partner?.district || partner?.area || partner?.microdistrict || '');
}

function partnerFormat(partner) {
  const source = [partner?.format, partner?.workFormat, partner?.locationMode, partner?.servicesFormat, ...(Array.isArray(partner?.workFormats) ? partner.workFormats : [])].join(' ').toLowerCase();
  if (source.includes('online') && (source.includes('offline') || source.includes('очно'))) return 'hybrid';
  if (source.includes('online')) return 'online';
  return 'offline';
}

function partnerRating(partner) {
  const value = Number(partner?.avgRating ?? partner?.rating ?? partner?.stars ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function partnerSearchText(partner) {
  return [
    partner?.name,
    partner?.description,
    partner?.offer,
    partner?.address,
    partner?.phone,
    partner?.website,
    partnerCategory(partner).label,
    partnerCity(partner),
    partnerDistrict(partner),
  ].filter(Boolean).join(' ').toLowerCase();
}

function routeToPartner(partner) {
  const address = text(partner?.address);
  if (!address) return;
  openUrl(`https://yandex.ru/maps/?rtext=~${encodeURIComponent(`${address}, Зеленоград`)}&rtt=auto`);
}

function callPartner(partner) {
  const phone = text(partner?.phone || partner?.contactPhone);
  if (!phone) return;
  openUrl(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

function PartnerLogo({ partner, size = 46 }) {
  const [failed, setFailed] = useState(false);
  const name = text(partner?.name) || 'П';
  if (partner?.logoUrl && !failed) {
    return <img src={partner.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), objectFit: 'cover', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.18)', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), display: 'grid', placeItems: 'center', background: APG2_PROFILE.goldSoft, color: APG2_PROFILE.gold, fontSize: Math.round(size * 0.36), fontWeight: 900, flexShrink: 0 }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function PartnerCatalogCard({ partner, selected, compact = false, onSelect, onOpen, onBook }) {
  const category = partnerCategory(partner);
  const city = partnerCity(partner);
  const rating = partnerRating(partner);
  const canRoute = Boolean(text(partner?.address));
  const canCall = Boolean(text(partner?.phone || partner?.contactPhone));
  const canBook = Boolean(partner?.bookingEnabled || partner?.bookingUrl || partner?.services?.length || partner?.serviceCatalog?.length);
  const cover = partner?.coverPhoto || partner?.imageUrl || partner?.photoUrl || partner?.photo || partner?.image || '';
  return (
    <GlassCard
      onClick={() => onSelect?.(partner)}
      style={{ borderRadius: 26, padding: 0, overflow: 'hidden', minHeight: compact ? 132 : 236, cursor: 'pointer', border: selected ? '1px solid rgba(201,168,76,0.62)' : APG2_PROFILE.glass.border, display: 'grid', gridTemplateRows: compact ? '1fr' : '96px 1fr' }}
    >
      {!compact && (
        <div style={{ position: 'relative', overflow: 'hidden', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)' }}>
          {cover ? <img src={cover} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.72 }} /> : <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 20%, rgba(201,168,76,0.24), transparent 42%), linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))' }} />}
          <div style={{ position: 'absolute', left: 12, bottom: -22 }}><PartnerLogo partner={partner} size={54} /></div>
        </div>
      )}
      <div style={{ padding: compact ? 12 : '30px 13px 13px', display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
          {compact && <PartnerLogo partner={partner} size={44} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {partner?.featured && <GlassBadge tone="gold">Партнёр дня</GlassBadge>}
              {(partner?.verified || partner?.isVerified) && <GlassBadge>Проверен</GlassBadge>}
              {partner?.offer && <GlassBadge tone="gold">Акция</GlassBadge>}
            </div>
            <div style={{ color: APG2_PROFILE.text, fontSize: compact ? 15 : 17, lineHeight: compact ? '19px' : '21px', fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: compact ? 'nowrap' : undefined, display: compact ? 'block' : '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{partner?.name || 'Партнёр АПГ'}</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '17px', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category.label} · {city}</div>
          </div>
          {rating > 0 && <div style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 840, whiteSpace: 'nowrap' }}>★ {rating.toFixed(1)}</div>}
        </div>
        {!compact && <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12.5, lineHeight: '18px', minHeight: 36, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{partner?.description || partner?.offer || partner?.address || 'Организация АПГ'}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${canBook ? 4 : 3}, minmax(0, 1fr))`, gap: 6 }}>
          <GlassButton onClick={event => { event.stopPropagation(); onOpen?.(partner); }} tone="gold" style={{ minHeight: 34, borderRadius: 14, padding: '7px 8px', fontSize: 11, color: '#17120a' }}>Подробнее</GlassButton>
          <GlassButton disabled={!canCall} onClick={event => { event.stopPropagation(); callPartner(partner); }} style={{ minHeight: 34, borderRadius: 14, padding: '7px 8px', fontSize: 11 }}>Позвонить</GlassButton>
          <GlassButton disabled={!canRoute} onClick={event => { event.stopPropagation(); routeToPartner(partner); }} style={{ minHeight: 34, borderRadius: 14, padding: '7px 8px', fontSize: 11 }}>Маршрут</GlassButton>
          {canBook && <GlassButton onClick={event => { event.stopPropagation(); onBook?.(partner); }} style={{ minHeight: 34, borderRadius: 14, padding: '7px 8px', fontSize: 11 }}>Записаться</GlassButton>}
        </div>
      </div>
    </GlassCard>
  );
}

function PartnersMapPreview({ partners, selected, onOpenMap, onSelect }) {
  const items = partners.filter(item => item?.address).slice(0, 6);
  return (
    <DesktopSidebarCard title="Карта партнёров" subtitle={`${items.length} адресов в выборке`}>
      <div style={{ height: 220, borderRadius: 24, overflow: 'hidden', position: 'relative', background: 'radial-gradient(circle at 24% 26%, rgba(201,168,76,0.22), transparent 22%), radial-gradient(circle at 76% 72%, rgba(255,255,255,0.12), transparent 28%), linear-gradient(145deg, rgba(35,36,40,0.92), rgba(19,20,23,0.94))', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.24, backgroundImage: 'linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        {items.map((item, index) => (
          <button key={item.id || item.name} type="button" onClick={() => onSelect?.(item)} title={item.name} style={{ position: 'absolute', left: `${16 + ((index * 29) % 70)}%`, top: `${20 + ((index * 17) % 58)}%`, width: selected?.id === item.id ? 20 : 14, height: selected?.id === item.id ? 20 : 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.72)', background: selected?.id === item.id ? APG2_PROFILE.gold : 'rgba(255,255,255,0.72)', boxShadow: selected?.id === item.id ? '0 0 0 8px rgba(201,168,76,0.16), 0 0 30px rgba(201,168,76,0.32)' : '0 0 0 6px rgba(255,255,255,0.08)', cursor: 'pointer' }} />
        ))}
        <div style={{ position: 'absolute', left: 14, bottom: 14, right: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <span style={{ color: APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 760 }}>Зеленоград · партнёры АПГ</span>
          <GlassButton onClick={onOpenMap} tone="gold" style={{ minHeight: 32, borderRadius: 14, color: '#17120a' }}>Открыть карту</GlassButton>
        </div>
      </div>
    </DesktopSidebarCard>
  );
}

export function PartnersPage({ partners = [], events = [], news = [], favorites = [], onBack, onOpenPartner, onAskQuestion, onBook, onOpenMap, desktopOverview = null, desktopMode = false }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [city, setCity] = useState('all');
  const [district, setDistrict] = useState('all');
  const [format, setFormat] = useState('all');
  const [rating, setRating] = useState('all');
  const [sort, setSort] = useState('featured');
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState(null);
  const searchRef = useRef(null);
  const favoriteSet = useMemo(() => new Set((favorites || []).map(String)), [favorites]);
  const visiblePartners = useMemo(() => (Array.isArray(partners) ? partners : []).filter(Boolean), [partners]);
  const categories = useMemo(() => {
    const counts = new Map();
    visiblePartners.forEach(partner => {
      const cat = partnerCategory(partner);
      const prev = counts.get(cat.id) || { ...cat, count: 0 };
      counts.set(cat.id, { ...prev, count: prev.count + 1 });
    });
    return [{ id: 'all', label: 'Все категории', count: visiblePartners.length }, ...Array.from(counts.values()).sort((a, b) => b.count - a.count)];
  }, [visiblePartners]);
  const cities = useMemo(() => {
    const counts = new Map();
    visiblePartners.forEach(partner => counts.set(partnerCity(partner), (counts.get(partnerCity(partner)) || 0) + 1));
    return [{ id: 'all', label: 'Весь город', count: visiblePartners.length }, ...Array.from(counts.entries()).map(([id, count]) => ({ id, label: id, count })).sort((a, b) => b.count - a.count)];
  }, [visiblePartners]);
  const districts = useMemo(() => {
    const counts = new Map();
    visiblePartners.forEach(partner => {
      const value = partnerDistrict(partner);
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [{ id: 'all', label: 'Все районы', count: visiblePartners.length }, ...Array.from(counts.entries()).map(([id, count]) => ({ id, label: id, count })).sort((a, b) => b.count - a.count)];
  }, [visiblePartners]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return visiblePartners.filter(partner => {
      if (q && !partnerSearchText(partner).includes(q)) return false;
      if (category !== 'all' && partnerCategory(partner).id !== category) return false;
      if (city !== 'all' && partnerCity(partner) !== city) return false;
      if (district !== 'all' && partnerDistrict(partner) !== district) return false;
      if (format !== 'all' && partnerFormat(partner) !== format) return false;
      if (rating !== 'all' && partnerRating(partner) < Number(rating)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === 'rating') return partnerRating(b) - partnerRating(a) || text(a.name).localeCompare(text(b.name), 'ru');
      if (sort === 'new') return (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0);
      if (sort === 'name') return text(a.name).localeCompare(text(b.name), 'ru');
      if (sort === 'offers') return (b.offer ? 1 : 0) - (a.offer ? 1 : 0) || text(a.name).localeCompare(text(b.name), 'ru');
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.verified || b.isVerified ? 1 : 0) - (a.verified || a.isVerified ? 1 : 0) || (now - (toDate(b.createdAt)?.getTime() || 0)) - (now - (toDate(a.createdAt)?.getTime() || 0));
    });
  }, [category, city, district, format, query, rating, sort, visiblePartners]);
  const selectedPartner = selected && filtered.some(item => item.id === selected.id) ? selected : filtered[0] || null;
  const recentLimit = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newCount = visiblePartners.filter(partner => (toDate(partner.createdAt)?.getTime() || 0) >= recentLimit).length;
  const verifiedCount = visiblePartners.filter(partner => partner?.verified || partner?.isVerified).length;
  const nearbyCount = visiblePartners.filter(partner => partner?.latitude || partner?.longitude || partner?.address).length;
  const favoriteCount = visiblePartners.filter(partner => favoriteSet.has(String(partner.id))).length;
  const kpiItems = [
    visiblePartners.length > 0 && { id: 'total', label: 'Всего партнёров', value: visiblePartners.length, tone: 'gold', icon: '🏢' },
    categories.length > 1 && { id: 'categories', label: 'Категорий', value: categories.length - 1, icon: '⌘' },
    newCount > 0 && { id: 'new', label: 'Новые', value: newCount, icon: '↗' },
    verifiedCount > 0 && { id: 'verified', label: 'Проверенные', value: verifiedCount, icon: '✓' },
    nearbyCount > 0 && { id: 'nearby', label: 'С адресом', value: nearbyCount, icon: '📍', onClick: onOpenMap },
    favoriteCount > 0 && { id: 'favorites', label: 'Избранные', value: favoriteCount, icon: '★' },
  ].filter(Boolean);
  const relatedEvents = useMemo(() => selectedPartner ? events.filter(event => String(event?.partnerId || event?.partner?.id || event?.partnerName || event?.partner || '') === String(selectedPartner.id) || text(event?.partnerName || event?.partner).toLowerCase() === text(selectedPartner.name).toLowerCase()).slice(0, 3) : [], [events, selectedPartner]);
  const relatedNews = useMemo(() => selectedPartner ? news.filter(item => String(item?.partnerId || item?.partner?.id || '') === String(selectedPartner.id) || text(item?.partnerName || item?.partner).toLowerCase() === text(selectedPartner.name).toLowerCase()).slice(0, 3) : [], [news, selectedPartner]);
  const selectStyle = { height: 42, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, outline: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 760, padding: '0 12px', minWidth: 128 };
  const searchStyle = { height: 42, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 720, padding: '0 14px', minWidth: 220, width: '100%', boxSizing: 'border-box' };

  if (!desktopMode) {
    return (
      <DesktopEmptyState
        icon="🏢"
        title="Каталог партнёров доступен на desktop"
        text="Мобильная навигация АПГ остаётся без изменений."
        action={<GlassButton onClick={onBack} tone="gold" style={{ color: '#17120a' }}>Назад</GlassButton>}
      />
    );
  }

  return (
    <DesktopSectionShell
      maxWidth={1460}
      topOverview={desktopOverview ? <DesktopTopOverview {...desktopOverview} activeSection="partners" /> : null}
      header={
        <DesktopHeader
          title="Партнёры"
          subtitle={`Каталог организаций АПГ · ${filtered.length} из ${visiblePartners.length}`}
          kicker="Бизнес-витрина"
          onBack={onBack}
          actions={
            <>
              <GlassButton onClick={() => searchRef.current?.focus()} style={{ minHeight: 40, borderRadius: 16 }}>Поиск</GlassButton>
              <GlassButton onClick={onOpenMap} style={{ minHeight: 40, borderRadius: 16 }}>Карта</GlassButton>
              <GlassButton onClick={() => { setCategory('all'); setCity('all'); setDistrict('all'); setFormat('all'); setRating('all'); setSort('featured'); setQuery(''); }} tone="gold" style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>Фильтры</GlassButton>
            </>
          }
        />
      }
      toolbar={
        <DesktopToolbar
          leading={<input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по названию, категории, адресу" aria-label="Поиск партнёров" style={searchStyle} />}
          trailing={
            <>
              <select aria-label="Категория партнёра" value={category} onChange={event => setCategory(event.target.value)} style={selectStyle}>{categories.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              <select aria-label="Город партнёра" value={city} onChange={event => setCity(event.target.value)} style={selectStyle}>{cities.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              <select aria-label="Район партнёра" value={district} onChange={event => setDistrict(event.target.value)} style={selectStyle}>{districts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              <select aria-label="Формат партнёра" value={format} onChange={event => setFormat(event.target.value)} style={selectStyle}><option value="all">Все форматы</option><option value="offline">Офлайн</option><option value="online">Онлайн</option><option value="hybrid">Гибрид</option></select>
              <select aria-label="Рейтинг партнёра" value={rating} onChange={event => setRating(event.target.value)} style={selectStyle}><option value="all">Любой рейтинг</option><option value="4.5">4.5+</option><option value="4">4.0+</option><option value="3">3.0+</option></select>
              <select aria-label="Сортировка партнёров" value={sort} onChange={event => setSort(event.target.value)} style={selectStyle}>{sortOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            </>
          }
        />
      }
      kpi={<DesktopKpiStrip items={kpiItems} />}
      info={
        <DesktopContentGrid min={300} gap={12}>
          <DesktopSidebarCard title="Quick Preview" subtitle={selectedPartner?.name || 'Выберите партнёра'}>
            {selectedPartner ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><PartnerLogo partner={selectedPartner} size={52} /><div style={{ minWidth: 0 }}><div style={{ color: APG2_PROFILE.text, fontSize: 17, fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPartner.name}</div><div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, marginTop: 3 }}>{partnerCategory(selectedPartner).label} · {partnerCity(selectedPartner)}</div></div></div>
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{selectedPartner.description || selectedPartner.offer || selectedPartner.address || 'Карточка партнёра АПГ'}</div>
                {selectedPartner.offer && <GlassBadge tone="gold">Акция: {selectedPartner.offer}</GlassBadge>}
                {relatedEvents[0] && <GlassBadge>Ближайшее событие: {relatedEvents[0].title}</GlassBadge>}
                {relatedNews[0] && <GlassBadge>Новость: {relatedNews[0].title || relatedNews[0].text}</GlassBadge>}
                <GlassButton onClick={() => onOpenPartner?.(selectedPartner)} tone="gold" style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>Подробнее</GlassButton>
              </div>
            ) : <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13 }}>Выберите карточку, чтобы увидеть краткий обзор.</div>}
          </DesktopSidebarCard>
          {(view === 'map' || view === 'split') && <PartnersMapPreview partners={filtered} selected={selectedPartner} onOpenMap={onOpenMap} onSelect={setSelected} />}
          <DesktopSidebarCard title="Связано" subtitle="Существующие данные">
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <DesktopMetricCard label="Новости" value={relatedNews.length} style={{ minHeight: 74 }} />
                <DesktopMetricCard label="События" value={relatedEvents.length} style={{ minHeight: 74 }} />
              </div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>
                Акции: {filtered.filter(item => item.offer).length}. Карта и контакты открываются из карточек без новых данных.
              </div>
            </div>
          </DesktopSidebarCard>
        </DesktopContentGrid>
      }
      actionBar={<DesktopActionBar actions={viewModes.map(([id, label]) => ({ id, label, tone: view === id ? 'gold' : undefined, onClick: () => setView(id) }))} />}
    >
      <DesktopSectionTitle title={view === 'map' ? 'Партнёры на карте' : `${filtered.length} организаций`} subtitle={query.trim() ? `По запросу: ${query.trim()}` : 'Каталог партнёров, организаций и городских сервисов'} />
      {visiblePartners.length === 0 ? (
        <DesktopSkeleton rows={8} variant="grid" />
      ) : filtered.length === 0 ? (
        <DesktopEmptyState icon="🏢" title="Партнёры не найдены" text="Попробуйте изменить категорию, город, район, рейтинг или поисковый запрос." action={<GlassButton tone="gold" onClick={() => { setQuery(''); setCategory('all'); setCity('all'); setDistrict('all'); setFormat('all'); setRating('all'); }} style={{ color: '#17120a' }}>Показать всех</GlassButton>} />
      ) : view === 'map' ? (
        <PartnersMapPreview partners={filtered} selected={selectedPartner} onOpenMap={onOpenMap} onSelect={setSelected} />
      ) : (
        <DesktopContentGrid min={view === 'list' ? 520 : view === 'split' ? 360 : 270} gap={14}>
          {filtered.map(partner => (
            <PartnerCatalogCard key={partner.id || partner.name} partner={partner} selected={selectedPartner?.id === partner.id} compact={view === 'list' || view === 'split'} onSelect={setSelected} onOpen={onOpenPartner} onBook={onBook} />
          ))}
        </DesktopContentGrid>
      )}
    </DesktopSectionShell>
  );
}

export default PartnersPage;
