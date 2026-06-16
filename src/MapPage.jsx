import React, { useState, useMemo } from 'react';
import { Panel, HorizontalScroll } from '@vkontakte/vkui';
import vkBridge from './vk.js';

import { T, GLASS } from './design.js';

const CATEGORIES = [
  { id: 'all',     label: 'Все',         emoji: '✦' },
  { id: 'food',    label: 'Еда',         emoji: '🍽' },
  { id: 'beauty',  label: 'Красота',     emoji: '💄' },
  { id: 'health',  label: 'Здоровье',    emoji: '💊' },
  { id: 'sport',   label: 'Спорт',       emoji: '💪' },
  { id: 'edu',     label: 'Обучение',    emoji: '📚' },
  { id: 'fun',     label: 'Развлечения', emoji: '🎉' },
  { id: 'shop',    label: 'Магазины',    emoji: '🛍️' },
  { id: 'auto',    label: 'Авто',        emoji: '🚗' },
  { id: 'home',    label: 'Дом',         emoji: '🏠' },
  { id: 'kids',    label: 'Дети',        emoji: '👶' },
  { id: 'service', label: 'Сервис',      emoji: '🔧' },
];

// Центр Зеленограда
const ZELENOGRAD_CENTER = 'll=37.1960,55.9830&z=13';

function PartnerLogo({ partner, size = 44 }) {
  const [failed, setFailed] = useState(false);
  const name = partner.name ?? '?';
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (!partner.logoUrl || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, hsl(${hue},45%,20%), hsl(${hue},35%,30%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 800, color: 'rgba(255,255,255,0.9)', border: '1.5px solid rgba(255,255,255,0.1)' }}>
        {name[0].toUpperCase()}
      </div>
    );
  }
  return <img src={partner.logoUrl} alt={name} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.1)', display: 'block', flexShrink: 0 }} />;
}

function openRoute(address) {
  const url = `https://yandex.ru/maps/?rtext=~${encodeURIComponent(address + ', Зеленоград')}&rtt=auto`;
  vkBridge.send('VKWebAppOpenLink', { link: url }).catch(() => window.open(url, '_blank'));
}

export function MapPage({ partners = [], onBack, onOpenPartner }) {
  const [selected, setSelected]       = useState(null);
  const [activeCategory, setCategory] = useState('all');
  const [search, setSearch]           = useState('');
  const [mapLoaded, setMapLoaded]     = useState(false);

  const partnersWithAddress = useMemo(() =>
    partners.filter(p => p.address?.trim()),
    [partners]
  );

  const filtered = useMemo(() =>
    partnersWithAddress
      .filter(p => activeCategory === 'all' || p.category === activeCategory)
      .filter(p => !search.trim() ||
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.address?.toLowerCase().includes(search.toLowerCase())
      ),
    [partnersWithAddress, activeCategory, search]
  );

  const mapQuery = selected?.address
    ? `text=${encodeURIComponent(selected.address + ', Зеленоград')}&z=16`
    : ZELENOGRAD_CENTER;

  const mapSrc = `https://yandex.ru/maps/?${mapQuery}&l=map`;

  const handleSelect = (p) => {
    setSelected(prev => prev?.id === p.id ? null : p);
    setMapLoaded(false);
  };

  return (
    <Panel id="map">
      {/* Хедер */}
      <div style={{ position: 'sticky', top: 0, zIndex: 60, background: 'rgba(8,8,20,0.72)', backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>🗺️ Карта партнёров</div>
            <div style={{ fontSize: 11, color: T.textSec }}>{partnersWithAddress.length} адресов</div>
          </div>
        </div>
      </div>

      {/* Карта — sticky под хедером */}
      <div style={{ position: 'sticky', top: 52, zIndex: 50, height: 264, background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(28px) saturate(1.8)', WebkitBackdropFilter: 'blur(28px) saturate(1.8)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Shimmer пока карта грузится */}
        {!mapLoaded && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(26,26,46,0.95), rgba(15,26,46,0.95))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 2 }}>
            <div style={{ fontSize: 40, animation: 'float 2s ease-in-out infinite' }}>🗺️</div>
            <div style={{ fontSize: 13, color: T.textSec }}>Загрузка карты...</div>
          </div>
        )}
        <iframe
          src={mapSrc}
          title="Яндекс.Карты"
          onLoad={() => setMapLoaded(true)}
          style={{ width: '100%', height: '100%', border: 'none', display: 'block', opacity: mapLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
          allow="geolocation"
        />

        {/* Оверлей выбранного партнёра */}
        {selected && (
          <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, zIndex: 10, ...GLASS, borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <PartnerLogo partner={selected} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>📍 {selected.address}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => openRoute(selected.address)} style={{ padding: '7px 10px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #FF6600, #FF8C00)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                🗺️
              </button>
              <button onClick={() => { onOpenPartner(selected); }} style={{ padding: '7px 10px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`, color: '#0F0F1A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Открыть
              </button>
              <button onClick={() => setSelected(null)} style={{ padding: '7px 9px', borderRadius: 10, border: `1px solid ${T.border}`, background: 'rgba(255,255,255,0.07)', color: T.textSec, fontSize: 11, cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Список ниже карты */}
      <div style={{ background: T.bg, minHeight: 'calc(100% - 316px)', paddingBottom: 80 }}>

        {/* Поиск */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 16, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.12)' }}>
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
                <button key={cat.id} onClick={() => setCategory(cat.id)} style={{ padding: '6px 12px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, background: activeCategory === cat.id ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})` : 'rgba(255,255,255,0.07)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', color: activeCategory === cat.id ? '#0F0F1A' : 'rgba(240,240,240,0.82)', border: activeCategory === cat.id ? 'none' : '1px solid rgba(255,255,255,0.13)' }}>
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
                const isSelected = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    style={{ width: '100%', textAlign: 'left', padding: '14px', borderRadius: 18, border: `1px solid ${isSelected ? 'rgba(201,168,76,0.45)' : 'rgba(255,255,255,0.08)'}`, background: isSelected ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.05)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, animation: `fadeInUp 0.35s ease ${i * 0.04}s both`, transition: 'border-color 0.2s, background 0.2s' }}
                  >
                    <PartnerLogo partner={p} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? T.gold : T.textPri, marginBottom: 3 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {p.address}</div>
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
    </Panel>
  );
}
