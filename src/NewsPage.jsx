import React, { useMemo, useState } from 'react';
import { RichText } from './components/RichText.jsx';
import { APG2_PROFILE, GlassButton, GlassCard } from './components/Apg2ProfileGlass.jsx';
import { openUrl } from './vk.js';
import {
  NEWS_CATEGORIES,
  NEWS_SORTS,
  filterNewsItems,
  formatNewsDate,
  getNewsCategory,
  getNewsCategoryLabel,
  getNewsImage,
  getNewsText,
  getNewsTitle,
  getNewsUrl,
  getReadingMinutes,
  getNewsViews,
  hasNewsVideo,
  isFreshNews,
  sortNewsItems,
} from './newsUtils.js';

const REACTIONS = ['👍', '❤️', '🔥', '👏', '😍'];

const inputStyle = {
  width: '100%',
  height: 48,
  borderRadius: 20,
  border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)',
  background: 'rgba(var(--apg2-glass-a,255,255,255),0.07)',
  color: APG2_PROFILE.text,
  outline: 'none',
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 720,
  padding: '0 16px',
  boxSizing: 'border-box',
};

function NewsImage({ item, height = 210, radius = 28, children }) {
  const image = getNewsImage(item);
  return (
    <div style={{ position: 'relative', height, borderRadius: radius, overflow: 'hidden', background: 'radial-gradient(circle at 24% 18%, rgba(215,184,106,0.22), transparent 38%), linear-gradient(145deg, rgba(var(--apg2-glass-a,255,255,255),0.10), rgba(var(--apg2-glass-a,255,255,255),0.03))' }}>
      {image && (
        <img
          src={image}
          alt=""
          loading="lazy"
          onError={e => { e.currentTarget.style.display = 'none'; }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.08) contrast(1.03)', transform: 'translateZ(0)' }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,7,9,0.02), rgba(7,7,9,0.30) 38%, rgba(7,7,9,0.82))' }} />
      {hasNewsVideo(item) && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 58, height: 58, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(8,8,10,0.52)', border: '1px solid rgba(255,255,255,0.28)', color: '#FFF8E9', fontSize: 23, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 46px rgba(0,0,0,0.28)' }}>▶</div>
      )}
      {children}
    </div>
  );
}

function NewsMeta({ item, compact = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: APG2_PROFILE.textMuted, fontSize: compact ? 10.5 : 11.5, lineHeight: '15px', fontWeight: 720 }}>
      <span>{formatNewsDate(item)}</span>
      <span>⏱ {getReadingMinutes(item)} мин</span>
      <span>{getNewsViews(item)} просмотров</span>
      {isFreshNews(item) && <span style={{ color: APG2_PROFILE.gold }}>Новое</span>}
    </div>
  );
}

function NewsCard({ item, index, onOpen, saved, later }) {
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  const isLarge = index % 5 === 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      style={{
        ...APG2_PROFILE.glass,
        width: '100%',
        border: (item.isUrgent || (item.priority ?? 0) >= 9) ? '1px solid rgba(255,119,92,0.42)' : APG2_PROFILE.glass.border,
        borderRadius: 30,
        padding: 0,
        overflow: 'hidden',
        textAlign: 'left',
        cursor: 'pointer',
        color: APG2_PROFILE.text,
        fontFamily: 'inherit',
        animation: 'fadeInUp 420ms var(--motion-ease-standard, cubic-bezier(0.22,1,0.36,1)) both',
        animationDelay: `${Math.min(index, 8) * 0.035}s`,
        transform: 'translateZ(0)',
      }}
    >
      <NewsImage item={item} height={isLarge ? 240 : 174} radius={30}>
        <div style={{ position: 'absolute', left: 14, right: 14, top: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ padding: '7px 11px', borderRadius: 999, background: 'rgba(8,8,10,0.45)', color: APG2_PROFILE.gold, border: '1px solid rgba(215,184,106,0.28)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', fontSize: 11, fontWeight: 860 }}>{getNewsCategoryLabel(item)}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {saved && <span style={{ padding: '7px 9px', borderRadius: 999, background: 'rgba(215,184,106,0.22)', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 900 }}>Сохранено</span>}
            {later && <span style={{ padding: '7px 9px', borderRadius: 999, background: 'rgba(var(--apg2-glass-a,255,255,255),0.14)', color: APG2_PROFILE.text, fontSize: 11, fontWeight: 850 }}>Позже</span>}
          </span>
        </div>
      </NewsImage>
      <span style={{ display: 'grid', gap: 10, padding: 16 }}>
        <span style={{ color: APG2_PROFILE.text, fontSize: isLarge ? 21 : 17, lineHeight: isLarge ? '26px' : '22px', fontWeight: 920, letterSpacing: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</span>
        <span style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '20px', fontWeight: 620, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{text || 'Короткая новость АПГ. Подробнее внутри материала.'}</span>
        <NewsMeta item={item} compact />
      </span>
    </button>
  );
}

function ArticleView({ item, related, onClose, onReact, onSave, onReadLater, saved, later, reaction }) {
  const [progress, setProgress] = useState(0);
  const title = getNewsTitle(item);
  const text = getNewsText(item);
  const url = getNewsUrl(item);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    setProgress(Math.min(1, Math.max(0, el.scrollTop / max)));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 13000, background: APG2_PROFILE.bg, color: APG2_PROFILE.text }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 3, width: `${progress * 100}%`, background: 'linear-gradient(90deg, #9F7932, #F4D98C, #FFF0B8)', boxShadow: '0 0 18px rgba(244,217,140,0.44)', zIndex: 2, transition: 'width 80ms linear' }} />
      <div onScroll={handleScroll} style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: '100%', maxWidth: 760, margin: '0 auto', padding: 'calc(var(--safe-top, 0px) + 12px) 16px calc(110px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <button type="button" onClick={onClose} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 22 }}>←</button>
            <span style={{ color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 880 }}>{getNewsCategoryLabel(item)}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => {})} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 17 }}>↗</button>
          </div>

          <NewsImage item={item} height={310} radius={34} />
          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            <NewsMeta item={item} />
            <h1 style={{ margin: 0, color: APG2_PROFILE.text, fontSize: 32, lineHeight: '37px', fontWeight: 940, letterSpacing: 0 }}>{title}</h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <GlassButton onClick={() => onSave?.(item)} tone={saved ? 'gold' : undefined} style={{ minHeight: 40, borderRadius: 17, color: saved ? '#17120a' : APG2_PROFILE.text }}>{saved ? 'Сохранено' : 'Сохранить'}</GlassButton>
              <GlassButton onClick={() => onReadLater?.(item)} tone={later ? 'gold' : undefined} style={{ minHeight: 40, borderRadius: 17, color: later ? '#17120a' : APG2_PROFILE.text }}>{later ? 'В списке позже' : 'Прочитать позже'}</GlassButton>
              {url && <GlassButton onClick={() => openUrl(url)} style={{ minHeight: 40, borderRadius: 17 }}>Открыть источник</GlassButton>}
            </div>
          </div>

          <GlassCard style={{ marginTop: 18, borderRadius: 30, padding: 18 }}>
            <RichText color={APG2_PROFILE.textSoft} fontSize={15} lineHeight="24px">
              {text || 'Подробный текст новости появится здесь после публикации.'}
            </RichText>
          </GlassCard>

          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 900 }}>Реакция</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {REACTIONS.map(value => (
                <button key={value} type="button" onClick={() => onReact?.(item, value)} style={{ width: 48, height: 44, borderRadius: 18, border: reaction === value ? '1px solid rgba(215,184,106,0.52)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: reaction === value ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)', fontSize: 20 }}>
                  {value}
                </button>
              ))}
            </div>
          </div>

          {!!related.length && (
            <div style={{ marginTop: 28 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 21, lineHeight: '26px', fontWeight: 920, marginBottom: 12 }}>Вам может понравиться</div>
              <div style={{ display: 'grid', gap: 12 }}>
                {related.slice(0, 3).map(next => (
                  <button key={next.id || getNewsTitle(next)} type="button" onClick={() => onClose(next)} style={{ ...APG2_PROFILE.glass, borderRadius: 24, padding: 12, display: 'grid', gridTemplateColumns: '76px 1fr', gap: 12, textAlign: 'left', border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', color: APG2_PROFILE.text }}>
                    <NewsImage item={next} height={76} radius={18} />
                    <span style={{ minWidth: 0, display: 'grid', gap: 5 }}>
                      <span style={{ color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 840 }}>{getNewsCategoryLabel(next)}</span>
                      <span style={{ color: APG2_PROFILE.text, fontSize: 14, lineHeight: '18px', fontWeight: 820, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{getNewsTitle(next)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewsPage({
  news = [],
  user = null,
  savedNews = [],
  readLaterNews = [],
  newsReactions = {},
  onBack,
  onReact,
  onSave,
  onReadLater,
  onRefresh,
}) {
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('new');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(9);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const prepared = useMemo(() => sortNewsItems(filterNewsItems(news, category, query), sort), [category, news, query, sort]);
  const hero = prepared[0] ?? news[0] ?? null;
  const visible = prepared.slice(0, visibleCount);
  const popular = useMemo(() => sortNewsItems(news, 'popular').slice(0, 5), [news]);
  const related = useMemo(() => selected
    ? sortNewsItems(news.filter(item => item !== selected && getNewsCategory(item) === getNewsCategory(selected)), 'popular')
    : [], [news, selected]);

  const refresh = async () => {
    setRefreshing(true);
    try { await onRefresh?.(); } finally { setRefreshing(false); }
  };

  const savedSet = new Set(savedNews || []);
  const laterSet = new Set(readLaterNews || []);
  const selectedId = selected?.id ? String(selected.id) : '';

  return (
    <div style={{ minHeight: '100svh', background: APG2_PROFILE.bg, color: APG2_PROFILE.text, padding: 'calc(var(--safe-top, 0px) + 12px) 16px calc(108px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button type="button" onClick={onBack} style={{ width: 44, height: 44, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, fontSize: 22 }}>←</button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '16px', fontWeight: 880 }}>Информационный центр</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 11, lineHeight: '15px', fontWeight: 650 }}>{news.length} материалов</div>
          </div>
        </div>

        <section style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 38, lineHeight: '42px', fontWeight: 940, letterSpacing: 0 }}>Новости</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 15, lineHeight: '22px', marginTop: 7 }}>Будь в курсе всего, что происходит в АПГ.</div>
          </div>

          {hero && (
            <button type="button" onClick={() => setSelected(hero)} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', color: APG2_PROFILE.text, cursor: 'pointer' }}>
              <NewsImage item={hero} height={340} radius={36}>
                <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, display: 'grid', gap: 10 }}>
                  <span style={{ justifySelf: 'start', padding: '8px 12px', borderRadius: 999, background: 'rgba(8,8,10,0.48)', border: '1px solid rgba(215,184,106,0.30)', color: APG2_PROFILE.gold, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', fontSize: 12, fontWeight: 900 }}>{(hero.priority ?? 0) >= 9 ? '🔥 Важно' : 'Главная новость'}</span>
                  <span style={{ color: '#FFF9EA', fontSize: 27, lineHeight: '32px', fontWeight: 940, textShadow: '0 14px 34px rgba(0,0,0,0.42)' }}>{getNewsTitle(hero)}</span>
                  <NewsMeta item={hero} />
                </div>
              </NewsImage>
            </button>
          )}
        </section>

        <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
          <input value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(9); }} placeholder="Поиск по новостям, категориям и тексту" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
            {NEWS_CATEGORIES.map(item => (
              <button key={item.id} type="button" onClick={() => { setCategory(item.id); setVisibleCount(9); }} style={{ flex: '0 0 auto', minHeight: 38, borderRadius: 999, padding: '0 13px', border: category === item.id ? '1px solid rgba(215,184,106,0.48)' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.14)', background: category === item.id ? 'rgba(215,184,106,0.18)' : 'rgba(var(--apg2-glass-a,255,255,255),0.07)', color: category === item.id ? APG2_PROFILE.gold : APG2_PROFILE.textSoft, fontSize: 12, fontWeight: 820, fontFamily: 'inherit' }}>{item.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
            {NEWS_SORTS.map(item => (
              <button key={item.id} type="button" onClick={() => { setSort(item.id); setVisibleCount(9); }} style={{ flex: '0 0 auto', minHeight: 34, borderRadius: 999, padding: '0 12px', border: sort === item.id ? '1px solid rgba(255,255,255,0.22)' : '1px solid transparent', background: sort === item.id ? 'rgba(var(--apg2-glass-a,255,255,255),0.12)' : 'transparent', color: sort === item.id ? APG2_PROFILE.text : APG2_PROFILE.textMuted, fontSize: 11.5, fontWeight: 760, fontFamily: 'inherit' }}>{item.label}</button>
            ))}
          </div>
        </div>

        {popular.length > 1 && (
          <GlassCard style={{ borderRadius: 30, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 18, fontWeight: 920 }}>Самое читаемое</div>
              <button type="button" onClick={refresh} style={{ border: 'none', background: 'transparent', color: APG2_PROFILE.gold, fontSize: 12, fontWeight: 860 }}>{refreshing ? 'Обновляем...' : 'Обновить'}</button>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
              {popular.map(item => (
                <button key={item.id || getNewsTitle(item)} type="button" onClick={() => setSelected(item)} style={{ flex: '0 0 220px', minHeight: 96, borderRadius: 22, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.12)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.06)', color: APG2_PROFILE.text, padding: 12, textAlign: 'left', scrollSnapAlign: 'start' }}>
                  <span style={{ display: 'block', color: APG2_PROFILE.gold, fontSize: 11, fontWeight: 820, marginBottom: 6 }}>{getNewsViews(item)} просмотров</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 13, lineHeight: '18px', fontWeight: 830 }}>{getNewsTitle(item)}</span>
                </button>
              ))}
            </div>
          </GlassCard>
        )}

        {visible.length === 0 ? (
          <GlassCard style={{ borderRadius: 34, padding: 24, textAlign: 'center', color: APG2_PROFILE.textSoft }}>
            По этому запросу пока нет материалов.
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14, alignItems: 'start' }}>
            {visible.map((item, index) => (
              <NewsCard
                key={item.id || `${getNewsTitle(item)}-${index}`}
                item={item}
                index={index}
                onOpen={setSelected}
                saved={savedSet.has(String(item.id))}
                later={laterSet.has(String(item.id))}
              />
            ))}
          </div>
        )}

        {visibleCount < prepared.length && (
          <GlassButton onClick={() => setVisibleCount(v => v + 9)} tone="gold" style={{ width: '100%', marginTop: 18, color: '#17120a' }}>
            Показать ещё
          </GlassButton>
        )}
      </div>

      {selected && (
        <ArticleView
          item={selected}
          related={related}
          onClose={(next) => setSelected(next?.id ? next : null)}
          onReact={onReact}
          onSave={onSave}
          onReadLater={onReadLater}
          saved={savedSet.has(selectedId)}
          later={laterSet.has(selectedId)}
          reaction={newsReactions?.[selectedId]}
          user={user}
        />
      )}
    </div>
  );
}
