import React, { useState, useMemo } from 'react';
import { HorizontalScroll } from '@vkontakte/vkui';
import { openUrl } from './vk.js';
import { getLocationsSearchText, getProfileLocations, hasMultipleLocations } from '../server-shared/locations.js';

import { T, GLASS } from './design.js';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassListItem, GlassPanel, ScreenHeader } from './components/Apg2ProfileGlass.jsx';

const CATEGORIES = [
  { id: 'all',           label: 'Все',          emoji: '✦' },
  { id: 'food',          label: 'Еда',          emoji: '🍕' },
  { id: 'beauty',        label: 'Красота',       emoji: '💄' },
  { id: 'sport',         label: 'Спорт',         emoji: '💪' },
  { id: 'education',     label: 'Обучение',      emoji: '📚' },
  { id: 'entertainment', label: 'Развлечения',   emoji: '🎉' },
  { id: 'health',        label: 'Здоровье',      emoji: '🏥' },
  { id: 'home',          label: 'Дом и ремонт',  emoji: '🏠' },
  { id: 'pets',          label: 'Животные',      emoji: '🐾' },
  { id: 'fashion',       label: 'Одежда',        emoji: '👗' },
  { id: 'auto',          label: 'Авто',          emoji: '🚗' },
  { id: 'services',      label: 'Услуги',        emoji: '💼' },
  { id: 'shopping',      label: 'Магазины',      emoji: '🛍️' },
  { id: 'other',         label: 'Другое',        emoji: '📦' },
];

// Центр Зеленограда
const ZELENOGRAD_CENTER = 'll=37.1960,55.9830&z=13';

function PartnerLogo({ partner, size = 44 }) {
  const [failed, setFailed] = useState(false);
  const name = partner.name ?? '?';
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (!partner.logoUrl || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, hsl(${hue},50%,52%), hsl(${hue},42%,44%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 800, color: '#fff', border: `1.5px solid ${T.border}` }}>
        {name[0].toUpperCase()}
      </div>
    );
  }
  return <img src={partner.logoUrl} alt={name} loading="lazy" onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${T.border}`, display: 'block', flexShrink: 0 }} />;
}

function openRoute(address) {
  const url = `https://yandex.ru/maps/?rtext=~${encodeURIComponent(address + ', Зеленоград')}&rtt=auto`;
  openUrl(url);
}

function mapLocationRows(partners = []) {
  return partners.flatMap(partner => {
    const locations = getProfileLocations(partner || {});
    const rows = locations.length
      ? locations.filter(location => location.address || location.coordinates)
      : [];
    if (!rows.length && partner?.address?.trim()) {
      return [{ ...partner, mapId: `${partner.id || partner.name}-legacy`, partner, location: null, locationCount: 1, address: partner.address }];
    }
    return rows.map((location, index) => ({
      ...partner,
      mapId: `${partner.id || partner.name}-${location.id || index}`,
      partner,
      location,
      locationId: location.id,
      locationTitle: location.title,
      locationCount: locations.length,
      address: location.address || partner.address,
      phone: location.phone || partner.phone,
      coordinates: location.coordinates,
    }));
  });
}

function mapPointsParam(rows = []) {
  const points = rows
    .map(row => {
      const latitude = Number(row?.coordinates?.latitude ?? row?.latitude);
      const longitude = Number(row?.coordinates?.longitude ?? row?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
      return `${longitude},${latitude},pm2rdm${row.location?.isMain ? '1' : '2'}`;
    })
    .filter(Boolean);
  return points.length ? `pt=${points.join('~')}` : '';
}

export function MapPage({ variant = 'v2', partners = [], onBack, onOpenPartner }) {
  const [selected, setSelected]       = useState(null);
  const [activeCategory, setCategory] = useState('all');
  const [search, setSearch]           = useState('');
  const [mapLoaded, setMapLoaded]     = useState(false);

  const partnersWithAddress = useMemo(() => mapLocationRows(partners), [partners]);

  const filtered = useMemo(() =>
    partnersWithAddress
      .filter(p => activeCategory === 'all' || p.category === activeCategory)
      .filter(p => !search.trim() ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.address?.toLowerCase().includes(search.toLowerCase()) ||
        p.locationTitle?.toLowerCase().includes(search.toLowerCase()) ||
        getLocationsSearchText(p.partner || p).includes(search.toLowerCase())
      ),
    [partnersWithAddress, activeCategory, search]
  );

  const selectedCoordinates = selected?.coordinates;
  const hasSelectedCoordinates = Number.isFinite(Number(selectedCoordinates?.latitude)) && Number.isFinite(Number(selectedCoordinates?.longitude));
  const allPoints = mapPointsParam(filtered);
  const mapQuery = hasSelectedCoordinates
    ? `ll=${selectedCoordinates.longitude},${selectedCoordinates.latitude}&z=16&${mapPointsParam([selected])}`
    : selected?.address
      ? `text=${encodeURIComponent(selected.address + ', Зеленоград')}&z=16`
      : allPoints
        ? `${ZELENOGRAD_CENTER}&${allPoints}`
        : ZELENOGRAD_CENTER;

  const mapSrc = `https://yandex.ru/maps/?${mapQuery}&l=map`;

  const handleSelect = (p) => {
    setSelected(prev => prev?.mapId === p.mapId ? null : p);
    setMapLoaded(false);
  };

  if (variant === 'v2') {
    return (
      <GlassPanel style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 'calc(10px + var(--safe-top, 0px))' }}>
        <div style={{ padding: '0 16px' }}>
          <ScreenHeader title="Карта" subtitle={`${partnersWithAddress.length} адресов партнеров`} kicker="Город АПГ" onBack={onBack} style={{ marginLeft: -16, marginRight: -16 }} />
        </div>
        <div style={{ margin: '0 16px 14px', borderRadius: 34, overflow: 'hidden', minHeight: 320, position: 'relative', ...APG2_PROFILE.glass }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 22% 26%,rgba(215,184,106,0.18),transparent 22%), radial-gradient(circle at 78% 72%,rgba(73,61,118,0.22),transparent 28%), linear-gradient(145deg,rgba(35,36,40,0.92),rgba(19,20,23,0.94))', zIndex: 0 }} />
          <div style={{ position: 'absolute', inset: 0, opacity: 0.24, backgroundImage: 'linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)', backgroundSize: '44px 44px', zIndex: 1, pointerEvents: 'none' }} />
          {[
            ['18%', '30%'], ['68%', '24%'], ['42%', '58%'], ['76%', '70%'], ['26%', '78%'],
          ].map(([left, top], i) => (
            <div key={`${left}_${top}`} style={{ position: 'absolute', left, top, width: i === 0 ? 18 : 12, height: i === 0 ? 18 : 12, borderRadius: '50%', background: i === 0 ? APG2_PROFILE.gold : 'rgba(255,255,255,0.72)', boxShadow: i === 0 ? '0 0 0 8px rgba(215,184,106,0.16), 0 0 30px rgba(215,184,106,0.32)' : '0 0 0 6px rgba(255,255,255,0.08)', zIndex: 1, pointerEvents: 'none' }} />
          ))}
          <div style={{ position: 'absolute', left: 18, bottom: 18, zIndex: 1, color: APG2_PROFILE.textSoft, fontSize: 13, fontWeight: 760, pointerEvents: 'none' }}>Зеленоград · партнеры АПГ</div>
          {!mapLoaded && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: APG2_PROFILE.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ fontSize: 42 }}>🗺️</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13 }}>Загрузка карты...</div>
            </div>
          )}
          <iframe key={selected?.mapId ?? 'default-v2'} src={mapSrc} title="Яндекс.Карты" onLoad={() => setMapLoaded(true)} style={{ position: 'relative', zIndex: 1, width: '100%', height: 320, border: 'none', display: 'block', opacity: mapLoaded ? 0.42 : 0, filter: 'saturate(0.72) contrast(0.98)', mixBlendMode: 'screen', transition: 'opacity 0.3s' }} allow="geolocation" />
          {selected && (
            <GlassCard style={{ position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 28, padding: 13, display: 'flex', gap: 12, alignItems: 'center' }}>
              <PartnerLogo partner={selected.partner || selected} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 15, fontWeight: 830, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[selected.locationTitle, selected.address].filter(Boolean).join(' · ')}</div>
                {hasMultipleLocations(selected.partner || selected) && <div style={{ color: APG2_PROFILE.gold, fontSize: 11, marginTop: 3 }}>{selected.locationCount} филиала</div>}
              </div>
              <GlassButton onClick={() => openRoute(selected.address)} tone="gold" style={{ minHeight: 42, borderRadius: 17, padding: '9px 11px', color: '#17120a' }}>Маршрут</GlassButton>
            </GlassCard>
          )}
        </div>
        <div style={{ padding: '0 16px' }}>
          <GlassCard style={{ borderRadius: 26, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ color: APG2_PROFILE.textMuted }}>🔍</span>
            <input type="search" placeholder="Найти партнера или адрес" value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'transparent', border: 0, outline: 0, color: APG2_PROFILE.text, fontSize: 14, flex: 1, minWidth: 0 }} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 0, color: APG2_PROFILE.textSoft, fontSize: 16 }}>✕</button>}
          </GlassCard>
        </div>
        <div style={{ overflowX: 'auto', padding: '0 16px 12px', display: 'flex', gap: 8, WebkitOverflowScrolling: 'touch' }}>
          {CATEGORIES.map(cat => (
            <GlassButton key={cat.id} onClick={() => setCategory(cat.id)} tone={activeCategory === cat.id ? 'gold' : 'glass'} style={{ minHeight: 38, borderRadius: 18, padding: '8px 12px', whiteSpace: 'nowrap', color: activeCategory === cat.id ? '#17120a' : APG2_PROFILE.text }}>{cat.emoji} {cat.label}</GlassButton>
          ))}
        </div>
        <div style={{ padding: '0 16px' }}>
          {filtered.length === 0 ? (
            <EmptyStateV2 icon={search.trim() ? '🔍' : '📍'} title={search.trim() ? 'Ничего не найдено' : 'Адресов пока нет'} text={search.trim() ? `По запросу «${search.trim()}» партнеры не найдены.` : 'Как только у партнеров появятся адреса, они будут здесь.'} action={(search.trim() || activeCategory !== 'all') ? <GlassButton onClick={() => { setSearch(''); setCategory('all'); }} tone="gold" style={{ color: '#17120a' }}>Сбросить фильтр</GlassButton> : null} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((p, i) => (
                <GlassListItem key={p.mapId || p.id} icon={<PartnerLogo partner={p.partner || p} size={42} />} title={p.name} subtitle={[p.locationTitle, p.address].filter(Boolean).join(' · ')} meta={selected?.mapId === p.mapId ? <GlassBadge tone="gold">на карте</GlassBadge> : hasMultipleLocations(p.partner || p) ? `${p.locationCount} филиала` : '›'} onClick={() => handleSelect(p)} style={{ animation: `fadeInUp 0.32s ease ${i * 0.035}s both` }} />
              ))}
            </div>
          )}
        </div>
      </GlassPanel>
    );
  }

  return (
    <>
      {/* Хедер */}
      <div style={{ position: 'sticky', top: 0, zIndex: 60, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: `1px solid ${T.headerBorder}`, borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>🗺️ Карта партнёров</div>
            <div style={{ fontSize: 11, color: T.textSec }}>{partnersWithAddress.length} адресов</div>
          </div>
        </div>
      </div>

      {/* Карта — sticky под хедером */}
      <div style={{ position: 'sticky', top: 52, zIndex: 50, height: 264, background: T.chipBg, backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))' }}>
        {/* Shimmer пока карта грузится */}
        {!mapLoaded && (
          <div style={{ position: 'absolute', inset: 0, background: T.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 2 }}>
            <div style={{ fontSize: 40, animation: 'float 2s ease-in-out infinite' }}>🗺️</div>
            <div style={{ fontSize: 13, color: T.textSec }}>Загрузка карты...</div>
          </div>
        )}
          <iframe
          key={selected?.mapId ?? 'default'}
          src={mapSrc}
          title="Яндекс.Карты"
          onLoad={() => setMapLoaded(true)}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', opacity: mapLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
          allow="geolocation"
        />

        {/* Оверлей выбранного партнёра */}
        {selected && (
          <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, zIndex: 10, ...GLASS, borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <PartnerLogo partner={selected.partner || selected} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>📍 {[selected.locationTitle, selected.address].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => openRoute(selected.address)} style={{ padding: '7px 10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #FF6600, #FF8C00)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                🗺️
              </button>
              <button onClick={() => { onOpenPartner(selected.partner || selected); }} style={{ padding: '7px 10px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Открыть
              </button>
              <button onClick={() => setSelected(null)} style={{ padding: '7px 9px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.chipBg, color: T.textSec, fontSize: 11, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Список ниже карты */}
      <div style={{ background: 'transparent', minHeight: 'calc(100% - 316px)', paddingBottom: 80 }}>

        {/* Поиск */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 16, padding: '10px 14px', border: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 15, opacity: 0.6, flexShrink: 0 }}>🔍</span>
            <input
              type="search"
              placeholder="Найти партнёра или адрес..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: T.textPri, fontSize: 14, flex: 1, minWidth: 0 }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSec, fontSize: 16, padding: 0, flexShrink: 0 }}>✕</button>}
          </div>
        </div>

        {/* Категории */}
        <div style={{ paddingBottom: 8 }}>
          <HorizontalScroll>
            <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCategory(cat.id)} style={{ padding: '6px 12px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, background: activeCategory === cat.id ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})` : T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', color: activeCategory === cat.id ? '#0F0F1A' : T.chipText, border: activeCategory === cat.id ? 'none' : `1px solid ${T.chipBorder}` }}>
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </HorizontalScroll>
        </div>

        {/* Партнёры */}
        <div style={{ padding: '4px 16px 0' }}>
          {filtered.length === 0 ? (
            <div style={{ ...GLASS, borderRadius: 24, padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 8 }}>
              <div style={{ fontSize: 48, animation: 'float 3s ease-in-out infinite' }}>{search.trim() ? '🔍' : '📍'}</div>
              <div>
                <div style={{ color: T.textPri, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>
                  {search.trim() ? 'Ничего не найдено' : partnersWithAddress.length === 0 ? 'Адреса пока не добавлены' : 'Нет партнёров в категории'}
                </div>
                <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>
                  {search.trim()
                    ? `По запросу «${search.trim()}» партнёры не найдены`
                    : 'Администратор скоро добавит адреса партнёров'}
                </div>
              </div>
              {(search.trim() || activeCategory !== 'all') && (
                <button onClick={() => { setSearch(''); setCategory('all'); }} style={{ padding: '9px 22px', borderRadius: 12, background: 'rgba(201,168,76,0.15)', color: T.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1px solid rgba(201,168,76,0.3)` }}>
                  Сбросить фильтр
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((p, i) => {
                const isSelected = selected?.mapId === p.mapId;
                return (
                  <button
                    key={p.mapId || p.id}
                    onClick={() => handleSelect(p)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px', borderRadius: 18, border: `1px solid ${isSelected ? 'rgba(201,168,76,0.45)' : T.border}`, background: isSelected ? 'rgba(201,168,76,0.08)' : T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, animation: `fadeInUp 0.35s ease ${i * 0.04}s both`, transition: 'border-color 0.2s, background 0.2s' }}
                  >
                    <PartnerLogo partner={p} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? T.gold : T.textPri, marginBottom: 3 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {[p.locationTitle, p.address].filter(Boolean).join(' · ')}</div>
                      {hasMultipleLocations(p.partner || p) && <div style={{ fontSize: 11, color: T.gold, marginTop: 3 }}>{p.locationCount} филиала</div>}
                      {p.offer && <div style={{ fontSize: 11, color: T.green, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎁 {p.offer}</div>}
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                      {isSelected && (
                        <div style={{ fontSize: 9, fontWeight: 700, color: T.gold, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          на карте
                        </div>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); openRoute(p.address); }}
                        style={{ padding: '6px 10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #FF6600, #FF8C00)', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                      >
                        🗺️ Маршрут
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Партнёры без адреса */}
        {partners.length > partnersWithAddress.length && (
          <div style={{ padding: '12px 16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: T.textSec }}>
              {partners.length - partnersWithAddress.length} партнёров пока без адреса — скоро добавим
            </div>
          </div>
        )}
      </div>
    </>
  );
}
