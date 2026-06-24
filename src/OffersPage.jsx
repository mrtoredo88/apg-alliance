import React, { useState, useMemo, useRef, useEffect } from 'react';

import { T, GLASS, GLASS_GOLD } from './design.js';

function OfferCard({ partner, onOpenPartner, index }) {
  return (
    <div style={{
      ...GLASS,
      borderRadius: 24, padding: 16, marginBottom: 12,
      animation: 'fadeInUp 0.4s ease both',
      animationDelay: `${index * 0.06}s`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {partner.logoUrl
          ? <img src={partner.logoUrl} alt="" loading="lazy" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid rgba(201,168,76,0.25)`, flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
          : <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.gold + '18', border: `2px solid ${T.gold}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{partner.emoji ?? '🏪'}</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>{partner.name}</div>
          {partner.categoryLabel && (
            <div style={{ fontSize: 11, color: T.gold, marginTop: 3, fontWeight: 600 }}>
              {partner.categoryLabel}
            </div>
          )}
        </div>
        {partner.featured && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#FFD700', background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>
            ⭐ ПАРТНЁР ДНЯ
          </div>
        )}
      </div>

      <div style={{
        ...GLASS_GOLD,
        borderRadius: 16,
        padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>🎁</span>
        <div>
          <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            Предложение для участников АПГ
          </div>
          <div style={{ fontSize: 14, color: T.textPri, fontWeight: 600, lineHeight: '19px' }}>
            {partner.offer}
          </div>
        </div>
      </div>

      <button onClick={() => onOpenPartner(partner)} style={{
        width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
        color: '#0F0F1A', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>
        Подробнее о партнёре →
      </button>
    </div>
  );
}

function PartnerSearchCard({ partner, onOpenPartner, index, query }) {
  const name = partner.name ?? '';
  // подсвечиваем совпадение в имени
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  const highlighted = idx >= 0
    ? <>{name.slice(0, idx)}<mark style={{ background: T.gold + '40', color: T.gold, borderRadius: 3, padding: '0 1px' }}>{name.slice(idx, idx + query.length)}</mark>{name.slice(idx + query.length)}</>
    : name;

  return (
    <div style={{
      ...GLASS,
      borderRadius: 20, padding: '14px 16px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 12,
      animation: 'fadeInUp 0.3s ease both',
      animationDelay: `${index * 0.04}s`,
    }}>
      {partner.logoUrl
        ? <img src={partner.logoUrl} alt="" loading="lazy" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid rgba(201,168,76,0.2)`, flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
        : <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.gold + '15', border: `1.5px solid ${T.gold}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{partner.emoji ?? '🏪'}</div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.textPri, lineHeight: '18px' }}>{highlighted}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          {partner.categoryLabel && <span style={{ fontSize: 10, color: T.gold, fontWeight: 600 }}>{partner.categoryLabel}</span>}
          {partner.offer && <span style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>· есть акция</span>}
        </div>
      </div>
      <button onClick={() => onOpenPartner(partner)} style={{
        padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: partner.offer
          ? `linear-gradient(135deg, ${T.gold}, ${T.goldL})`
          : T.chipBg,
        color: partner.offer ? '#0F0F1A' : T.textPri,
        fontSize: 12, fontWeight: 700,
      }}>
        Открыть
      </button>
    </div>
  );
}

const CATEGORY_LABELS = {
  food:          '🍕 Еда',
  beauty:        '💄 Красота',
  sport:         '💪 Спорт',
  education:     '📚 Обучение',
  entertainment: '🎉 Развлечения',
  health:        '🏥 Здоровье',
  home:          '🏠 Дом и ремонт',
  pets:          '🐾 Животные',
  fashion:       '👗 Одежда',
  auto:          '🚗 Авто',
  services:      '💼 Услуги',
  other:         '📦 Другое',
};

export function OffersPage({ partners = [], onBack, onOpenPartner }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch]                 = useState('');
  const inputRef                            = useRef(null);

  const withOffers = useMemo(() =>
    partners
      .filter(p => p.offer?.trim())
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)),
    [partners]);

  const categories = useMemo(() => {
    const counts = {};
    withOffers.forEach(p => {
      const cat = p.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([id, count]) => ({
      id, label: CATEGORY_LABELS[id] ?? id, count,
    }));
  }, [withOffers]);

  useEffect(() => {
    if (activeCategory !== 'all' && !categories.find(c => c.id === activeCategory)) {
      setActiveCategory('all');
    }
  }, [categories, activeCategory]);

  const isSearching = search.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = search.trim().toLowerCase();
    return partners.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.offer?.toLowerCase().includes(q) ||
      p.categoryLabel?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  }, [partners, search, isSearching]);

  const filtered = useMemo(() =>
    activeCategory === 'all'
      ? withOffers
      : withOffers.filter(p => (p.category || 'other') === activeCategory),
    [withOffers, activeCategory]
  );

  return (
    <>
      {/* Кастомный хедер */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)',
        borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)',
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{
            background: T.chipBg, border: `1px solid ${T.headerBorder}`,
            borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0,
          }}>‹</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>
              ✦ Акции и партнёры
            </div>
            {!isSearching && withOffers.length > 0 && (
              <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>
                {withOffers.length} {withOffers.length === 1 ? 'предложение' : withOffers.length < 5 ? 'предложения' : 'предложений'} · {partners.length} партнёров
              </div>
            )}
          </div>
        </div>

        {/* Поисковая строка */}
        <div style={{ paddingBottom: 10, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, opacity: 0.5, pointerEvents: 'none' }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Найти партнёра по имени или категории..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 36px 10px 38px',
                background: T.chipBg,
                border: `1px solid ${isSearching ? 'rgba(201,168,76,0.4)' : T.border}`,
                borderRadius: 14,
                color: T.textPri, fontSize: 14, outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
            {isSearching && (
              <button
                onClick={() => { setSearch(''); inputRef.current?.focus(); }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: T.chipBg, border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.textSec, fontSize: 12, padding: 0 }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Фильтр по категориям — скрыт при поиске */}
        {!isSearching && categories.length > 1 && (
          <div style={{ display: 'flex', gap: 8, paddingBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: activeCategory === 'all' ? T.gold : T.chipBg,
                color: activeCategory === 'all' ? '#0F0F1A' : T.textSec,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              Все · {withOffers.length}
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700,
                  background: activeCategory === cat.id ? T.gold : T.chipBg,
                  color: activeCategory === cat.id ? '#0F0F1A' : T.textSec,
                  transition: 'background 0.2s, color 0.2s',
                }}
              >
                {cat.label} · {cat.count}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: 'transparent', minHeight: '100%', padding: '12px 16px 90px' }}>

        {/* ── Режим поиска ── */}
        {isSearching ? (
          searchResults.length === 0 ? (
            <div style={{ paddingTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 52 }}>🔍</div>
              <div>
                <div style={{ color: T.textPri, fontWeight: 700, fontSize: 15, marginBottom: 5 }}>Ничего не найдено</div>
                <div style={{ color: T.textSec, fontSize: 13 }}>Попробуй другой запрос</div>
              </div>
              <button onClick={() => setSearch('')} style={{
                padding: '10px 24px', borderRadius: 12,
                border: '1px solid rgba(201,168,76,0.3)',
                background: 'rgba(201,168,76,0.1)', color: T.gold,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Сбросить поиск
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: T.textSec, marginBottom: 12, fontWeight: 600 }}>
                Найдено: <span style={{ color: T.gold }}>{searchResults.length}</span> из {partners.length} партнёров
              </div>
              {searchResults.map((p, i) => (
                <PartnerSearchCard
                  key={p.id}
                  partner={p}
                  index={i}
                  query={search.trim()}
                  onOpenPartner={onOpenPartner}
                />
              ))}
            </>
          )
        ) : (
          /* ── Обычный режим — акции ── */
          withOffers.length === 0 ? (
            <div style={{ paddingTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 64, animation: 'float 3s ease-in-out infinite' }}>🎁</div>
              <div>
                <div style={{ color: T.textPri, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Акций пока нет</div>
                <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>
                  Партнёры АПГ скоро добавят специальные предложения
                </div>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ paddingTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 52 }}>🔍</div>
              <div style={{ color: T.textSec, fontSize: 14 }}>В этой категории пока нет акций</div>
              <button onClick={() => setActiveCategory('all')} style={{
                padding: '10px 24px', borderRadius: 12, border: '1px solid rgba(201,168,76,0.3)',
                background: 'rgba(201,168,76,0.1)', color: T.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Показать все
              </button>
            </div>
          ) : (
            filtered.map((p, i) => (
              <OfferCard key={p.id} partner={p} index={i} onOpenPartner={onOpenPartner} />
            ))
          )
        )}
      </div>
    </>
  );
}
