import React, { useMemo, useState } from 'react';
import { Panel } from '@vkontakte/vkui';
import { getNewsImage, getNewsTitle } from './newsUtils.js';
import { selectActualEvents, selectEventsForPeriod } from './eventSchedule.js';
import { GIFT_SHIMMER_STYLE } from './giftShimmer.js';

const imageOf = (item = {}) => {
  const source = item || {};
  return getNewsImage(source) || source.coverPhoto || source.imageUrl || source.logoUrl || source.photoUrl || source.photo || source.image || '';
};

const firstNameOf = (user = {}) => {
  const raw = user?.first_name || user?.firstName || user?.displayName || user?.name || '';
  const first = String(raw).trim().split(/\s+/)[0];
  return /^(участник|гость)$/i.test(first) ? '' : first;
};

const greetingOf = user => {
  const hour = new Date().getHours();
  const greeting = hour >= 18 ? 'Добрый вечер' : hour >= 12 ? 'Добрый день' : 'Доброе утро';
  const firstName = firstNameOf(user);
  return `${greeting}${firstName ? `, ${firstName}` : ''}!`;
};

const eventTime = event => String(event?.time || event?.startTime || '').match(/\b\d{1,2}:\d{2}\b/)?.[0] || 'Скоро';
const compactOffer = place => place?.offer || place?.discount || place?.promo || 'Предложение для участников АПГ';

function Picture({ item, alt = '', fallback = 'АПГ' }) {
  const src = imageOf(item);
  if (src) return <img src={src} alt={alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={event => { event.currentTarget.style.display = 'none'; }} />;
  return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(145deg,#f4e6c8,#3b1747)', color: '#fff', fontWeight: 900 }}>{fallback}</div>;
}

const s = {
  page: {
    minHeight: '100%', boxSizing: 'border-box', color: '#171519', background: '#fbfaf6',
    padding: 'calc(10px + var(--safe-top, 0px)) 14px calc(92px + env(safe-area-inset-bottom, 0px))',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  roundButton: {
    width: 44, height: 44, borderRadius: 22, border: '1px solid rgba(33,25,18,.06)', padding: 0,
    display: 'grid', placeItems: 'center', position: 'relative', color: '#171519', background: '#fff',
    boxShadow: '0 8px 24px rgba(65,48,30,.09)', cursor: 'pointer', flexShrink: 0,
  },
  goldLink: { border: 0, background: 'transparent', padding: '6px 0', color: '#b8861d', fontSize: 12, lineHeight: 1.2, fontWeight: 800, cursor: 'pointer' },
};

function SectionTitle({ icon, children, action, label = 'Смотреть все' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
      <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: 17, lineHeight: '21px', fontWeight: 900 }}>
        {icon && <span aria-hidden="true" style={{ color: '#bf8a20' }}>{icon}</span>}{children}
      </h2>
      {action && <button type="button" onClick={action} style={s.goldLink}>{label}</button>}
    </div>
  );
}

export function HomeMobileRedesign({
  user, partners = [], experts = [], events = [], news = [], favorites = [],
  onOpenRewards, onOpenOnboarding, onOpenNews, onOpenNewsItem, onOpenPartners, onOpenPartner,
  onOpenExperts, onOpenEvents, onOpenNearby, onOpenOffers, onToggleFavorite, isOffline = false,
}) {
  const [eventFilter, setEventFilter] = useState('today');
  const actualEvents = useMemo(() => selectActualEvents(events), [events]);
  const featuredNews = news.find(item => imageOf(item) && !/^clip by\b/i.test(getNewsTitle(item))) || news[0] || null;
  const featuredPlace = partners.find(item => imageOf(item) && compactOffer(item)) || partners[0] || null;
  const hero = featuredPlace || featuredNews;
  const heroIsPlace = hero === featuredPlace && Boolean(featuredPlace);
  const places = partners.slice(0, 6);
  const offers = partners.filter(item => item?.offer || item?.discount || item?.promo).slice(0, 7);
  const eventPreview = useMemo(() => selectEventsForPeriod(actualEvents, eventFilter).slice(0, 6), [actualEvents, eventFilter]);
  const displayedEvents = eventPreview.length ? eventPreview : [
    { id: 'event-placeholder-1', title: 'События скоро', category: 'Афиша', address: 'Следите за обновлениями', placeholder: true },
    { id: 'event-placeholder-2', title: 'Новые встречи', category: 'Афиша', address: 'Зеленоград', placeholder: true },
    { id: 'event-placeholder-3', title: 'Городские события', category: 'Афиша', address: 'Скоро в приложении', placeholder: true },
  ];
  const favoriteIds = useMemo(() => new Set(favorites.map(value => String(value?.id || value))), [favorites]);

  const stats = [
    { icon: '📰', label: 'Новости', action: onOpenNews },
    { icon: '📍', label: 'Места', action: onOpenPartners },
    { icon: '⭐', label: 'Эксперты', action: onOpenExperts },
  ];

  return (
    <Panel id="home" data-home-version="reference-exact-v2">
      <main style={s.page}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <picture style={{ flexShrink: 0 }}>
            <source srcSet="/logo.webp" type="image/webp" />
            <img src="/logo.png" alt="АПГ" style={{ width: 48, height: 48, borderRadius: 15, objectFit: 'cover', boxShadow: '0 7px 18px rgba(43,18,52,.16)' }} />
          </picture>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 18, lineHeight: '22px', fontWeight: 900 }}>{greetingOf(user)}</h1>
            <div style={{ marginTop: 1, color: '#777176', fontSize: 11.5, lineHeight: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Рады видеть вас в Зеленограде 👋</div>
          </div>
          <button type="button" aria-label="Подарки" onClick={onOpenRewards} style={{ ...s.roundButton, overflow: 'hidden', ...GIFT_SHIMMER_STYLE }}>
            <span aria-hidden="true" style={{ position: 'relative', zIndex: 1, fontSize: 22 }}>🎁</span>
          </button>
          <button type="button" aria-label="Открыть помощь и онбординг" onClick={onOpenOnboarding} style={{ ...s.roundButton, color: '#b8871f', fontSize: 24, fontWeight: 950 }}>
            <span aria-hidden="true">?</span>
          </button>
        </header>

        {isOffline && <div style={{ marginBottom: 10, padding: '9px 11px', borderRadius: 12, background: '#fff1cd', color: '#735210', fontSize: 11.5, fontWeight: 700 }}>Нет сети — показываем сохранённые данные.</div>}

        <nav aria-label="Разделы главной" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7, marginBottom: 11 }}>
          {stats.map(item => (
            <button key={item.label} type="button" onClick={item.action} style={{ height: 50, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '5px 7px', borderRadius: 15, border: '1px solid rgba(44,34,24,.05)', background: '#fff', boxShadow: '0 7px 20px rgba(62,47,32,.07)', color: '#171519', cursor: 'pointer' }}>
              <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
              <strong style={{ minWidth: 0, fontSize: 11.5, lineHeight: '14px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</strong>
            </button>
          ))}
        </nav>

        <button type="button" onClick={() => heroIsPlace ? onOpenPartner?.(hero) : hero ? onOpenNewsItem?.(hero) : onOpenOffers?.()} style={{ width: '100%', height: 155, margin: 0, padding: 0, overflow: 'hidden', position: 'relative', borderRadius: 21, border: '1px solid rgba(83,59,37,.08)', background: '#f3eee4', boxShadow: '0 9px 25px rgba(59,43,29,.07)', color: '#171519', textAlign: 'left', cursor: 'pointer' }}>
          <div style={{ position: 'absolute', inset: '0 0 0 42%' }}><Picture item={hero} fallback="АПГ" /></div>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,#f7f2e9 0%,#f7f2e9 39%,rgba(247,242,233,.88) 50%,rgba(247,242,233,.1) 77%)' }} />
          <div style={{ position: 'relative', zIndex: 1, width: '64%', height: '100%', boxSizing: 'border-box', padding: '12px 0 11px 13px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ padding: '5px 8px', borderRadius: 9, background: '#f26e2b', color: '#fff', fontSize: 8.5, lineHeight: 1, fontWeight: 850, whiteSpace: 'nowrap' }}>🔥 Сегодня нельзя пропустить</span>
            <strong style={{ marginTop: 8, maxWidth: '100%', color: '#171519', fontSize: 16, lineHeight: '18px', fontWeight: 900, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{heroIsPlace ? (hero?.name || 'Предложение дня') : (getNewsTitle(hero) || 'Главное сегодня')}</strong>
            <span style={{ marginTop: 5, maxWidth: '88%', color: '#282328', fontSize: 10.5, lineHeight: '13px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{heroIsPlace ? compactOffer(hero) : (hero?.summary || 'Главные события города')}</span>
            <span style={{ marginTop: 'auto', minWidth: 88, padding: '7px 13px', borderRadius: 16, boxSizing: 'border-box', background: 'linear-gradient(135deg,#d9aa42,#c58a16)', color: '#fff', textAlign: 'center', fontSize: 10.5, fontWeight: 900 }}>Получить</span>
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', left: '45%', bottom: 9, display: 'flex', gap: 5 }}><i style={{ width: 7, height: 7, borderRadius: 4, background: '#d29b21' }} /><i style={{ width: 7, height: 7, borderRadius: 4, background: '#ddd8d0' }} /><i style={{ width: 7, height: 7, borderRadius: 4, background: '#ddd8d0' }} /></div>
        </button>

        <section style={{ marginTop: 12 }}>
          <SectionTitle icon="●" action={onOpenNearby || onOpenPartners} label="Открыть">Рядом с вами</SectionTitle>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 1px 7px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
            {places.length ? places.map(place => {
              const id = String(place.id || place.name);
              const favorite = favoriteIds.has(id);
              return (
                <article key={id} onClick={() => onOpenPartner?.(place)} style={{ flex: '0 0 126px', height: 116, overflow: 'hidden', position: 'relative', borderRadius: 15, border: '1px solid rgba(50,39,29,.06)', background: '#fff', boxShadow: '0 7px 18px rgba(62,47,32,.07)', scrollSnapAlign: 'start', cursor: 'pointer' }}>
                  <div style={{ height: 53, background: '#eee9df' }}><Picture item={place} alt={place.name || ''} fallback="Место" /></div>
                  <button type="button" aria-label={favorite ? 'Убрать из избранного' : 'В избранное'} onClick={event => { event.stopPropagation(); onToggleFavorite?.(place); }} style={{ position: 'absolute', top: 6, right: 6, width: 25, height: 25, padding: 0, borderRadius: 13, border: 0, background: 'rgba(255,255,255,.92)', color: favorite ? '#c69123' : '#777', fontSize: 17, cursor: 'pointer' }}>{favorite ? '★' : '♡'}</button>
                  <div style={{ padding: '7px 7px 6px' }}>
                    <strong style={{ display: 'block', fontSize: 11, lineHeight: '13px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name || 'Место АПГ'}</strong>
                    <span style={{ display: 'block', marginTop: 3, color: '#777176', fontSize: 8.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.distance || place.categoryLabel || place.category || 'Зеленоград'}</span>
                    <span style={{ display: 'block', marginTop: 5, padding: '4px 5px', borderRadius: 7, background: '#fff1cf', color: '#604716', fontSize: 7.8, lineHeight: '9px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎁 {compactOffer(place)}</span>
                  </div>
                </article>
              );
            }) : <div style={{ padding: 16, borderRadius: 17, background: '#fff', color: '#777' }}>Места скоро появятся.</div>}
          </div>
        </section>

        <section style={{ marginTop: 11 }}>
          <SectionTitle action={onOpenOffers}>Горящие акции 🔥</SectionTitle>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 1px 7px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
            {(offers.length ? offers : places).map((place, index) => (
              <button key={place.id || place.name || index} type="button" onClick={() => onOpenPartner?.(place)} style={{ flex: '0 0 94px', height: 84, overflow: 'hidden', position: 'relative', border: 0, borderRadius: 13, padding: 0, background: ['#ef7b2e','#612176','#23854f','#d6a33f'][index % 4], color: '#fff', textAlign: 'left', scrollSnapAlign: 'start', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', inset: 0 }}><Picture item={place} fallback="Акция" /></div>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(21,12,19,.08),rgba(21,12,19,.82))' }} />
                <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: 7, display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ marginTop: 'auto', fontSize: 10, lineHeight: '12px', fontWeight: 900, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 2px 8px rgba(0,0,0,.35)' }}>{compactOffer(place)}</strong>
                  <span style={{ alignSelf: 'flex-start', marginTop: 4, padding: '3px 5px', borderRadius: 6, background: '#fff', color: '#332a31', fontSize: 7, fontWeight: 900 }}>{index % 2 ? 'до 23:59' : 'сегодня'}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 }}>
            <h2 style={{ margin: 0, fontSize: 17, lineHeight: '21px', fontWeight: 900 }}>Афиша</h2>
            <div role="tablist" aria-label="Период афиши" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[['today','Сегодня'],['tomorrow','Завтра'],['weekend','На выходных']].map(([id,label]) => <button key={id} type="button" role="tab" aria-selected={eventFilter === id} onClick={() => setEventFilter(id)} style={{ border: 0, borderRadius: 9, padding: '6px 8px', background: eventFilter === id ? 'linear-gradient(135deg,#d7aa45,#c38b1d)' : 'transparent', color: eventFilter === id ? '#fff' : '#b8861d', fontSize: 9, fontWeight: 850, cursor: 'pointer' }}>{label}</button>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 1px 7px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
            {displayedEvents.map(event => (
              <button key={event.id || event.title} type="button" onClick={() => event.placeholder ? onOpenEvents?.() : onOpenEvents?.(event)} style={{ flex: '0 0 120px', height: 106, overflow: 'hidden', position: 'relative', borderRadius: 14, border: '1px solid rgba(50,39,29,.06)', padding: 0, background: '#fff', color: '#171519', boxShadow: '0 7px 18px rgba(62,47,32,.07)', textAlign: 'left', scrollSnapAlign: 'start', cursor: 'pointer' }}>
                <div style={{ height: 52, position: 'relative', background: '#eee9df' }}><Picture item={event} fallback="Афиша" /><span style={{ position: 'absolute', left: 6, bottom: -7, padding: '3px 5px', borderRadius: 6, background: '#ffe414', color: '#241f12', fontSize: 8, fontWeight: 900 }}>{event.placeholder ? 'Скоро' : eventTime(event)}</span></div>
                <span aria-hidden="true" style={{ position: 'absolute', top: 6, right: 6, width: 25, height: 25, display: 'grid', placeItems: 'center', borderRadius: 13, background: 'rgba(255,255,255,.92)', color: '#777', fontSize: 17 }}>♡</span>
                <div style={{ padding: '10px 7px 5px' }}><span style={{ display: 'block', color: '#777176', fontSize: 7.5 }}>{event.category || 'Событие'}</span><strong style={{ display: '-webkit-box', marginTop: 2, fontSize: 9.5, lineHeight: '11px', fontWeight: 900, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.title || 'Событие АПГ'}</strong><span style={{ display: 'block', marginTop: 2, color: '#777176', fontSize: 7.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.address || event.partner || 'Зеленоград'}</span></div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </Panel>
  );
}
