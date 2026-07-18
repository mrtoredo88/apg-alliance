import React, { useEffect, useMemo, useRef, useState } from 'react';

import { APG2_PROFILE, GlassBadge, GlassButton } from './components/Apg2ProfileGlass.jsx';
import {
  DesktopActionBar,
  DesktopCatalogEntityCard,
  DesktopCatalogGrid,
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
import { getLocationsSearchText, getMainLocation, getProfileLocations, hasMultipleLocations } from '../server-shared/locations.js';

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

function partnerPrimaryServices(partner) {
  const catalog = Array.isArray(partner?.serviceCatalog) ? partner.serviceCatalog : [];
  const fromCatalog = catalog.map(item => text(item?.title || item?.name || item?.service)).filter(Boolean);
  const fromArray = Array.isArray(partner?.services) ? partner.services.map(item => text(item?.title || item?.name || item)).filter(Boolean) : [];
  const fromText = typeof partner?.services === 'string' ? partner.services.split(/[\n,;]+/).map(text).filter(Boolean) : [];
  return [...new Set([...fromCatalog, ...fromArray, ...fromText])].slice(0, 3);
}

function partnerRating(partner) {
  const value = Number(partner?.avgRating ?? partner?.rating ?? partner?.stars ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function partnerSearchText(partner) {
  const mainLocation = getMainLocation(partner || {});
  return [
    partner?.name,
    partner?.description,
    partner?.offer,
    mainLocation?.address || partner?.address,
    mainLocation?.phone || partner?.phone,
    getLocationsSearchText(partner || {}),
    partner?.website,
    partnerCategory(partner).label,
    partnerCity(partner),
    partnerDistrict(partner),
  ].filter(Boolean).join(' ').toLowerCase();
}

function firstCatalogMediaUrl(...sources) {
  for (const source of sources) {
    if (!source) continue;
    if (Array.isArray(source)) {
      const match = source.map(item => typeof item === 'string' ? item.trim() : text(item?.url || item?.src || item?.image || item?.photo || item?.photoUrl || item?.imageUrl)).find(Boolean);
      if (match) return match;
      continue;
    }
    const url = typeof source === 'string' ? source.trim() : text(source?.url || source?.src || source?.image || source?.photo || source?.photoUrl || source?.imageUrl);
    if (url) return url;
  }
  return '';
}

function partnerCatalogCover(partner, gallery = []) {
  return firstCatalogMediaUrl(
    partner?.cover,
    partner?.coverPhoto,
    partner?.heroImage,
    partner?.coverImage,
    partner?.mainPhoto,
    partner?.photo,
    gallery,
    partner?.images,
    partner?.logo,
    partner?.logoUrl,
    partner?.videoPreview,
    partner?.videoPreviewUrl,
    partner?.videoThumbnailUrl,
  );
}

function routeToPartner(partner) {
  const address = text(getMainLocation(partner || {})?.address || partner?.address);
  if (!address) return;
  openUrl(`https://yandex.ru/maps/?rtext=~${encodeURIComponent(`${address}, Зеленоград`)}&rtt=auto`);
}

function callPartner(partner) {
  const phone = text(getMainLocation(partner || {})?.phone || partner?.phone || partner?.contactPhone);
  if (!phone) return;
  openUrl(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

function useViewportWidth(defaultWidth = 1440) {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? defaultWidth : window.innerWidth));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}

function getCatalogColumns(width) {
  if (width >= 1600) return 4;
  if (width >= 1300) return 3;
  if (width >= 1000) return 2;
  return 1;
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

function PartnerCatalogCard({ partner, selected, compact = false, onSelect, onOpen, onBook, onAskQuestion }) {
  const category = partnerCategory(partner);
  const city = partnerCity(partner);
  const rating = partnerRating(partner);
  const mainLocation = getMainLocation(partner || {});
  const locations = getProfileLocations(partner || {});
  const multipleLocations = hasMultipleLocations(partner || {});
  const address = text(mainLocation?.address || partner?.address);
  const phone = text(mainLocation?.phone || partner?.phone || partner?.contactPhone);
  const canRoute = Boolean(address);
  const canCall = Boolean(phone);
  const canBook = Boolean(partner?.bookingEnabled || partner?.bookingUrl || partner?.services?.length || partner?.serviceCatalog?.length);
  const gallery = [
    ...(Array.isArray(partner?.gallery) ? partner.gallery : []),
    ...(Array.isArray(partner?.photos) ? partner.photos : []),
    ...(Array.isArray(partner?.images) ? partner.images : []),
  ];
  const cover = partnerCatalogCover(partner, gallery);
  const services = partnerPrimaryServices(partner);
  const isNew = (toDate(partner?.createdAt)?.getTime() || 0) >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  const badges = [
    partner?.featured && { id: 'featured', label: 'Партнёр дня', tone: 'gold' },
    (partner?.verified || partner?.isVerified) && { id: 'verified', label: 'Проверен' },
    isNew && { id: 'new', label: 'Новый' },
    partner?.offer && { id: 'offer', label: 'Акция', tone: 'gold' },
    multipleLocations && { id: 'locations', label: `${locations.length} филиала` },
    canBook && { id: 'booking', label: 'Запись доступна' },
  ].filter(Boolean);
  const meta = [
    rating > 0 && { id: 'rating', label: 'Рейтинг', value: `★ ${rating.toFixed(1)}`, tone: 'gold' },
    address && { id: 'address', label: 'Адрес', value: address },
    multipleLocations && { id: 'locations', label: 'Филиалы', value: `${locations.length}` },
    city && { id: 'city', label: 'Город', value: city },
  ].filter(Boolean);
  const tags = [
    { id: 'category', label: category.label },
    ...services.map(service => ({ id: `service-${service}`, label: service })),
    partnerFormat(partner) !== 'offline' && { id: 'format', label: partnerFormat(partner) === 'online' ? 'Онлайн' : 'Гибрид' },
  ].filter(Boolean);
  const secondaryAction = canBook
    ? { id: 'book', label: 'Записаться', onClick: () => onBook?.(partner) }
    : canCall
      ? { id: 'call', label: 'Позвонить', onClick: () => callPartner(partner) }
      : canRoute
        ? { id: 'route', label: 'Маршрут', onClick: () => routeToPartner(partner) }
        : null;
  const actions = [
    { id: 'open', label: 'Подробнее', tone: 'gold', onClick: () => onOpen?.(partner) },
    secondaryAction,
    onAskQuestion && { id: 'message', label: 'Написать', onClick: () => onAskQuestion?.(partner) },
  ].filter(Boolean);
  return (
    <DesktopCatalogEntityCard
      selected={selected}
      onClick={() => onSelect?.(partner)}
      onMouseEnter={() => onSelect?.(partner)}
      onFocus={() => onSelect?.(partner)}
      cover={cover}
      media={partner}
      gallery={gallery}
      videos={partner?.videos}
      avatar={<PartnerLogo partner={partner} size={48} />}
      badges={badges}
      title={partner?.name || 'Партнёр АПГ'}
      subtitle={`${category.label} · ${city}`}
      rating={rating > 0 ? rating.toFixed(1) : ''}
      description={partner?.description || partner?.offer || partner?.address || 'Организация АПГ'}
      meta={meta}
      tags={tags}
      contact={address || phone}
      actions={actions}
      offer={partner?.offer ? `Акция: ${partner.offer}` : services.length ? `Услуги: ${services.join(', ')}` : ''}
      style={compact ? { height: 360 } : undefined}
    />
  );
}

function PartnersMapPreview({ partners, selected, onOpenMap, onSelect }) {
  const items = partners.filter(item => getMainLocation(item || {})?.address || item?.address).slice(0, 6);
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
  const viewportWidth = useViewportWidth();
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
  const selectedLocation = selectedPartner ? getMainLocation(selectedPartner) : null;
  const selectedAddress = text(selectedLocation?.address || selectedPartner?.address);
  const selectedPhone = text(selectedLocation?.phone || selectedPartner?.phone || selectedPartner?.contactPhone);
  const recentLimit = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newCount = visiblePartners.filter(partner => (toDate(partner.createdAt)?.getTime() || 0) >= recentLimit).length;
  const verifiedCount = visiblePartners.filter(partner => partner?.verified || partner?.isVerified).length;
  const nearbyCount = visiblePartners.filter(partner => partner?.latitude || partner?.longitude || getMainLocation(partner)?.address || partner?.address).length;
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
  const compactKpiItems = kpiItems.map(item => ({ ...item, style: { minHeight: 70, padding: '10px 44px 10px 12px', ...(item.style || {}) } }));
  const selectStyle = { height: 36, borderRadius: 15, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.18)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.28)', color: APG2_PROFILE.text, outline: 'none', fontFamily: 'inherit', fontSize: 12.2, fontWeight: 760, padding: '0 10px', minWidth: 118 };
  const searchStyle = { height: 36, borderRadius: 15, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.18)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.28)', color: APG2_PROFILE.text, outline: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 720, padding: '0 12px', minWidth: 220, width: '100%', boxSizing: 'border-box', '--apg-input-placeholder': APG2_PROFILE.textMuted };
  const gridColumns = getCatalogColumns(viewportWidth);
  const showCatalogRail = viewportWidth >= 1180 && view === 'split';
  const effectiveGridColumns = showCatalogRail ? Math.min(gridColumns, 2) : gridColumns;
  const catalogGridStyle = view === 'list'
    ? { gridTemplateColumns: 'minmax(0, 1fr)' }
    : view === 'split'
      ? { gridTemplateColumns: `repeat(${Math.min(effectiveGridColumns, 2)}, minmax(0, 1fr))` }
      : { gridTemplateColumns: `repeat(${effectiveGridColumns}, minmax(0, 1fr))` };

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
      maxWidth={1580}
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
          style={{ padding: 7, borderRadius: 22 }}
          leading={<input type="search" ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Поиск по названию, категории, адресу" aria-label="Поиск партнёров" style={searchStyle} />}
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
      kpi={<DesktopKpiStrip items={compactKpiItems} style={{ gap: 8 }} />}
      actionBar={<DesktopActionBar actions={viewModes.map(([id, label]) => ({ id, label, tone: view === id ? 'gold' : undefined, onClick: () => setView(id) }))} />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: showCatalogRail ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
          <DesktopSectionTitle title={view === 'map' ? 'Партнёры на карте' : `${filtered.length} организаций`} subtitle={query.trim() ? `По запросу: ${query.trim()}` : 'Каталог партнёров, организаций и городских сервисов'} />
          {visiblePartners.length === 0 ? (
            <DesktopSkeleton rows={8} variant="grid" />
          ) : filtered.length === 0 ? (
            <DesktopEmptyState icon="🏢" title="Партнёры не найдены" text="Попробуйте изменить категорию, город, район, рейтинг или поисковый запрос." action={<GlassButton tone="gold" onClick={() => { setQuery(''); setCategory('all'); setCity('all'); setDistrict('all'); setFormat('all'); setRating('all'); }} style={{ color: '#17120a' }}>Показать всех</GlassButton>} />
          ) : view === 'map' ? (
            <PartnersMapPreview partners={filtered} selected={selectedPartner} onOpenMap={onOpenMap} onSelect={setSelected} />
          ) : (
            <DesktopCatalogGrid columns={view === 'list' ? 1 : view === 'split' ? Math.min(effectiveGridColumns, 2) : effectiveGridColumns} gap={12} style={catalogGridStyle}>
              {filtered.map(partner => (
                <PartnerCatalogCard key={partner.id || partner.name} partner={partner} selected={selectedPartner?.id === partner.id} compact={view === 'list' || view === 'split'} onSelect={setSelected} onOpen={onOpenPartner} onBook={onBook} onAskQuestion={onAskQuestion} />
              ))}
            </DesktopCatalogGrid>
          )}
        </div>
        {showCatalogRail && (
          <aside style={{ display: 'grid', gap: 12, minWidth: 0, position: 'sticky', top: 'calc(14px + var(--safe-top, 0px))' }}>
            <DesktopSidebarCard title="Quick Preview" subtitle={selectedPartner?.name || 'Выберите партнёра'}>
              {selectedPartner ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><PartnerLogo partner={selectedPartner} size={52} /><div style={{ minWidth: 0 }}><div style={{ color: APG2_PROFILE.text, fontSize: 17, fontWeight: 880, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedPartner.name}</div><div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, marginTop: 3 }}>{partnerCategory(selectedPartner).label} · {partnerCity(selectedPartner)}</div></div></div>
                  <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{selectedPartner.description || selectedPartner.offer || selectedAddress || 'Карточка партнёра АПГ'}</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {selectedAddress && <GlassBadge>Адрес: {selectedAddress}</GlassBadge>}
                    {selectedPhone && <GlassBadge>Телефон указан</GlassBadge>}
                    {partnerPrimaryServices(selectedPartner).slice(0, 2).map(service => <GlassBadge key={service}>{service}</GlassBadge>)}
                  </div>
                  {selectedPartner.offer && <div style={{ color: '#17120a', background: APG2_PROFILE.goldSoft, border: '1px solid rgba(201,168,76,0.34)', borderRadius: 16, padding: '9px 10px', fontSize: 12, lineHeight: '16px', fontWeight: 820, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>Акция: {selectedPartner.offer}</div>}
                  {relatedEvents[0] && <GlassBadge>Ближайшее событие: {relatedEvents[0].title}</GlassBadge>}
                  {relatedNews[0] && <GlassBadge>Новость: {relatedNews[0].title || relatedNews[0].text}</GlassBadge>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <GlassButton onClick={() => onOpenPartner?.(selectedPartner)} tone="gold" style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>Подробнее</GlassButton>
                    <GlassButton disabled={!selectedAddress} onClick={() => routeToPartner(selectedPartner)} style={{ minHeight: 40, borderRadius: 16 }}>Маршрут</GlassButton>
                  </div>
                </div>
              ) : <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13 }}>Выберите карточку, чтобы увидеть краткий обзор.</div>}
            </DesktopSidebarCard>
            {view === 'split' && <PartnersMapPreview partners={filtered} selected={selectedPartner} onOpenMap={onOpenMap} onSelect={setSelected} />}
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
          </aside>
        )}
      </div>
    </DesktopSectionShell>
  );
}

export default PartnersPage;
