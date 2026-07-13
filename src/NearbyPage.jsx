import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { HorizontalScroll } from '@vkontakte/vkui';
import vkBridge, { isVK } from './vk.js';
import { T, GLASS } from './design.js';
import { haversine, formatDistance } from './utils/geo.js';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassListItem, GlassPanel, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';

const RADII = [
  { label: '500 м', km: 0.5 },
  { label: '1 км',  km: 1   },
  { label: '3 км',  km: 3   },
  { label: '5 км',  km: 5   },
  { label: 'Весь город', km: 999 },
];

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

function PartnerLogo({ partner, size = 48 }) {
  const [failed, setFailed] = useState(false);
  const name = partner.name ?? '?';
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (!partner.logoUrl || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg,hsl(${hue},50%,52%),hsl(${hue},42%,44%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 800, color: '#fff', border: `2px solid ${T.border}` }}>
        {name[0].toUpperCase()}
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', padding: 2, flexShrink: 0, background: `linear-gradient(135deg,${T.gold},${T.goldL})` }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
        <img src={partner.logoUrl} alt="" loading="lazy" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

function NearbyCard({ partner, distance, onOpen, index }) {
  const cat = CATEGORIES.find(c => c.id === partner.category);
  return (
    <button
      onClick={() => onOpen(partner)}
      style={{ width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 20, border: `1px solid ${T.border}`, background: T.chipBg, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, animation: `fadeInUp 0.3s ease ${index * 0.04}s both` }}
    >
      <PartnerLogo partner={partner} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.textPri, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.name}</div>
        {cat && <div style={{ fontSize: 11, color: T.textSec, marginBottom: 4 }}>{cat.emoji} {cat.label}</div>}
        {partner.avgRating > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#FFD700', letterSpacing: 0.5 }}>{'★'.repeat(Math.round(partner.avgRating))}{'☆'.repeat(5 - Math.round(partner.avgRating))}</span>
            <span style={{ fontSize: 11, color: T.textSec }}>{partner.avgRating.toFixed(1)}</span>
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.gold }}>📍 {formatDistance(distance)}</div>
        {partner.offer && <div style={{ fontSize: 10, color: T.green, marginTop: 4, maxWidth: 90, lineHeight: '13px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>🎁 {partner.offer}</div>}
      </div>
    </button>
  );
}

export function NearbyPage({ variant = 'v2', partners = [], onBack, onOpenPartner, onOpenMap }) {
  const [geoState, setGeoState]   = useState('idle'); // idle | loading | ok | denied | error
  const [userPos, setUserPos]     = useState(null);   // { lat, lon }
  const [radiusKm, setRadiusKm]   = useState(3);
  const [category, setCategory]   = useState('all');

  const requestGeo = useCallback(async () => {
    setGeoState('loading');
    try {
      if (isVK()) {
        const res = await vkBridge.send('VKWebAppGetGeodata');
        if (res.available) {
          setUserPos({ lat: res.lat, lon: res.long });
          setGeoState('ok');
        } else {
          setGeoState('denied');
        }
        return;
      }
      if (!navigator.geolocation) { setGeoState('error'); return; }
      navigator.geolocation.getCurrentPosition(
        pos => { setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGeoState('ok'); },
        err => setGeoState(err.code === 1 ? 'denied' : 'error'),
        { timeout: 10000, maximumAge: 60000 },
      );
    } catch {
      setGeoState('denied');
    }
  }, []);

  useEffect(() => { requestGeo(); }, [requestGeo]);

  const withCoords = useMemo(() => partners.filter(p => p.latitude && p.longitude), [partners]);

  const nearby = useMemo(() => {
    if (!userPos) return [];
    return withCoords
      .map(p => ({ ...p, _dist: haversine(userPos.lat, userPos.lon, p.latitude, p.longitude) }))
      .filter(p => p._dist <= radiusKm && (category === 'all' || p.category === category))
      .sort((a, b) => a._dist - b._dist);
  }, [withCoords, userPos, radiusKm, category]);

  if (variant === 'v2') {
    return (
      <GlassPanel>
        <ScreenHeader
          title="Рядом"
          subtitle={geoState === 'ok' ? `${nearby.length} партнеров в радиусе` : 'Поиск рядом с вами'}
          kicker="Геолокация"
          onBack={onBack}
          action={onOpenMap ? <GlassButton onClick={onOpenMap} tone="gold" style={{ minHeight: 42, borderRadius: 18, padding: '9px 12px', color: '#17120a' }}>Карта</GlassButton> : null}
        />
        {geoState === 'ok' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <StatPill label="найдено" value={nearby.length} tone="gold" />
              <StatPill label="с координатами" value={withCoords.length} />
            </div>
            <div style={{ overflowX: 'auto', display: 'flex', gap: 8, margin: '0 -16px 10px', padding: '0 16px', WebkitOverflowScrolling: 'touch' }}>
              {RADII.map(r => (
                <GlassButton key={r.km} onClick={() => setRadiusKm(r.km)} tone={radiusKm === r.km ? 'gold' : 'glass'} style={{ minHeight: 38, borderRadius: 18, padding: '8px 12px', whiteSpace: 'nowrap', color: radiusKm === r.km ? '#17120a' : APG2_PROFILE.text }}>{r.label}</GlassButton>
              ))}
            </div>
            <div style={{ overflowX: 'auto', display: 'flex', gap: 8, margin: '0 -16px 16px', padding: '0 16px', WebkitOverflowScrolling: 'touch' }}>
              {CATEGORIES.map(c => (
                <GlassButton key={c.id} onClick={() => setCategory(c.id)} tone={category === c.id ? 'gold' : 'glass'} style={{ minHeight: 38, borderRadius: 18, padding: '8px 12px', whiteSpace: 'nowrap', color: category === c.id ? '#17120a' : APG2_PROFILE.text }}>{c.emoji} {c.label}</GlassButton>
              ))}
            </div>
          </>
        )}
        {geoState === 'loading' && <EmptyStateV2 icon="📡" title="Определяем местоположение" text="Разрешите доступ к геолокации, чтобы показать ближайших партнеров." />}
        {(geoState === 'denied' || geoState === 'error') && (
          <EmptyStateV2 icon={geoState === 'denied' ? '📍' : '⚠️'} title={geoState === 'denied' ? 'Геолокация закрыта' : 'Не удалось определить место'} text={geoState === 'denied' ? 'Разрешите доступ в настройках браузера или телефона.' : 'Проверьте соединение и попробуйте снова.'} action={<GlassButton onClick={requestGeo} tone="gold" style={{ color: '#17120a' }}>Попробовать снова</GlassButton>} />
        )}
        {geoState === 'ok' && withCoords.length === 0 && <EmptyStateV2 icon="🗺️" title="Координаты скоро появятся" text="Партнеры без координат не попадают в подборку рядом." />}
        {geoState === 'ok' && withCoords.length > 0 && nearby.length === 0 && (
          <EmptyStateV2 icon="🔍" title="Рядом ничего нет" text="Попробуйте увеличить радиус или выбрать другую категорию." action={<GlassButton onClick={() => { setRadiusKm(999); setCategory('all'); }} tone="gold" style={{ color: '#17120a' }}>Показать весь город</GlassButton>} />
        )}
        {geoState === 'ok' && nearby.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nearby.map((p, i) => {
              const cat = CATEGORIES.find(c => c.id === p.category);
              return (
                <GlassListItem
                  key={p.id}
                  icon={<PartnerLogo partner={p} size={42} />}
                  title={p.name}
                  subtitle={`${cat ? `${cat.emoji} ${cat.label} · ` : ''}${p.offer || p.address || 'Партнер АПГ'}`}
                  meta={<GlassBadge tone="gold">{formatDistance(p._dist)}</GlassBadge>}
                  onClick={() => onOpenPartner(p)}
                  style={{ animation: `fadeInUp 0.32s ease ${i * 0.035}s both` }}
                />
              );
            })}
            {withCoords.length < partners.length && <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12, textAlign: 'center', paddingTop: 4 }}>{partners.length - withCoords.length} партнеров пока без координат</div>}
          </div>
        )}
      </GlassPanel>
    );
  }

  return (
    <>
      {/* Хедер */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)', borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{ background: T.chipBg, border: `1px solid ${T.border}`, borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0 }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri }}>📍 Рядом со мной</div>
            {geoState === 'ok' && <div style={{ fontSize: 11, color: T.textSec }}>{nearby.length} партнёров в радиусе</div>}
          </div>
        </div>

        {geoState === 'ok' && (
          <>
            {/* Радиус */}
            <div style={{ paddingBottom: 8 }}>
              <HorizontalScroll>
                <div style={{ display: 'flex', gap: 6, padding: '0 2px' }}>
                  {RADII.map(r => (
                    <button key={r.km} onClick={() => setRadiusKm(r.km)} style={{ padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, background: radiusKm === r.km ? T.gold : T.chipBg, color: radiusKm === r.km ? '#0F0F1A' : T.textSec, transition: 'all 0.15s' }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </HorizontalScroll>
            </div>

            {/* Категории */}
            <div style={{ paddingBottom: 10 }}>
              <HorizontalScroll>
                <div style={{ display: 'flex', gap: 6, padding: '0 2px' }}>
                  {CATEGORIES.map(c => (
                    <button key={c.id} onClick={() => setCategory(c.id)} style={{ padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, background: category === c.id ? T.gold : T.chipBg, color: category === c.id ? '#0F0F1A' : T.textSec, transition: 'all 0.15s' }}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </HorizontalScroll>
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '12px 16px 90px', minHeight: '100%' }}>

        {/* Загрузка геолокации */}
        {geoState === 'loading' && (
          <div style={{ ...GLASS, borderRadius: 24, padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <div style={{ fontSize: 52, animation: 'float 2s ease-in-out infinite' }}>📡</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>Определяем местоположение...</div>
            <div style={{ fontSize: 13, color: T.textSec }}>Разреши доступ к геолокации в появившемся запросе</div>
          </div>
        )}

        {/* Отказ / ошибка */}
        {(geoState === 'denied' || geoState === 'error') && (
          <div style={{ ...GLASS, borderRadius: 24, padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <div style={{ fontSize: 52 }}>{geoState === 'denied' ? '🚫' : '⚠️'}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri, marginBottom: 8 }}>
                {geoState === 'denied' ? 'Доступ к геолокации закрыт' : 'Не удалось определить местоположение'}
              </div>
              <div style={{ fontSize: 13, color: T.textSec, lineHeight: '19px' }}>
                {geoState === 'denied'
                  ? 'Чтобы показать партнёров рядом с тобой, нужно разрешить доступ к геолокации в настройках браузера'
                  : 'Проверь подключение и попробуй снова'}
              </div>
            </div>
            <button onClick={requestGeo} style={{ padding: '12px 28px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg,${T.gold},${T.goldL})`, color: '#0F0F1A', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              Попробовать снова
            </button>
          </div>
        )}

        {/* Нет партнёров с координатами */}
        {geoState === 'ok' && withCoords.length === 0 && (
          <div style={{ ...GLASS, borderRadius: 24, padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <div style={{ fontSize: 48 }}>🗺️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>Адреса ещё не добавлены</div>
            <div style={{ fontSize: 13, color: T.textSec }}>Администратор скоро добавит координаты партнёров</div>
          </div>
        )}

        {/* Пусто в радиусе */}
        {geoState === 'ok' && withCoords.length > 0 && nearby.length === 0 && (
          <div style={{ ...GLASS, borderRadius: 24, padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <div style={{ fontSize: 48, animation: 'float 3s ease-in-out infinite' }}>🔍</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>Ничего не найдено</div>
            <div style={{ fontSize: 13, color: T.textSec }}>Попробуй увеличить радиус или сменить категорию</div>
            <button onClick={() => { setRadiusKm(999); setCategory('all'); }} style={{ padding: '10px 22px', borderRadius: 12, background: 'rgba(201,168,76,0.15)', color: T.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `1px solid rgba(201,168,76,0.3)` }}>
              Показать всех
            </button>
          </div>
        )}

        {/* Список */}
        {geoState === 'ok' && nearby.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {nearby.map((p, i) => (
              <NearbyCard key={p.id} partner={p} distance={p._dist} onOpen={onOpenPartner} index={i} />
            ))}
            {withCoords.length < partners.length && (
              <div style={{ textAlign: 'center', fontSize: 11, color: T.textSec, paddingTop: 4 }}>
                {partners.length - withCoords.length} партнёров пока без координат — не учитываются
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
