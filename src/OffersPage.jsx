import React, { useState, useMemo, useRef, useEffect } from 'react';

import { T, GLASS, GLASS_GOLD } from './design.js';
import { APG2_PROFILE, EmptyStateV2, GlassBadge, GlassButton, GlassCard, GlassListItem, GlassPanel, ScreenHeader, StatPill } from './components/Apg2ProfileGlass.jsx';
import {
  DesktopContentGrid,
  DesktopEmptyState,
  DesktopHeader,
  DesktopKpiStrip,
  DesktopSectionShell,
  DesktopSectionTitle,
  DesktopSidebarCard,
  DesktopToolbar,
  DesktopTopOverview,
} from './components/DesktopUI.jsx';

function OfferCard({ partner, onOpenPartner, onAskQuestion, index }) {
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

      <div style={{ display: 'grid', gridTemplateColumns: onAskQuestion ? '1fr 1fr' : '1fr', gap: 8 }}>
      <button onClick={() => onOpenPartner(partner)} style={{
        width: '100%', padding: '12px 0', borderRadius: 14, border: 'none',
        background: `linear-gradient(135deg, ${T.gold}, ${T.goldL})`,
        color: '#0F0F1A', fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>
        Подробнее
      </button>
      {onAskQuestion && (
        <button onClick={() => onAskQuestion(partner)} style={{
          width: '100%', padding: '12px 0', borderRadius: 14, border: `1px solid ${T.gold}55`,
          background: 'rgba(201,168,76,0.12)', color: T.gold, fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}>
          Задать вопрос
        </button>
      )}
      </div>
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

function OfferCardV2({ partner, onOpenPartner, onAskQuestion, index }) {
  const featuredTone = partner.featured;
  return (
    <GlassCard onClick={() => onOpenPartner(partner)} style={{ borderRadius: 28, padding: 0, overflow: 'hidden', animation: `fadeInUp 0.34s ease ${index * 0.04}s both`, border: featuredTone ? '1px solid rgba(215,184,106,0.28)' : APG2_PROFILE.glass.border }}>
      <div style={{ minHeight: 126, padding: 14, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: featuredTone ? 'radial-gradient(circle at 82% 12%,rgba(255,247,214,0.15),transparent 34%), radial-gradient(circle at 8% 90%,rgba(215,184,106,0.10),transparent 34%)' : 'radial-gradient(circle at 82% 12%,rgba(255,247,214,0.13),transparent 34%), radial-gradient(circle at 8% 90%,rgba(73,61,118,0.14),transparent 34%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {partner.logoUrl
            ? <img src={partner.logoUrl} alt="" loading="lazy" style={{ width: 54, height: 54, borderRadius: 20, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
            : <div style={{ width: 54, height: 54, borderRadius: 20, background: APG2_PROFILE.goldSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{partner.emoji ?? '🏪'}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
              {partner.featured && <GlassBadge tone="gold">Партнер дня</GlassBadge>}
              {partner.categoryLabel && <GlassBadge>{partner.categoryLabel}</GlassBadge>}
            </div>
            <div style={{ color: APG2_PROFILE.text, fontSize: 17, lineHeight: '21px', fontWeight: 830, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{partner.name}</div>
          </div>
        </div>
        <div style={{ position: 'relative', marginTop: 10, color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '18px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {partner.offer}
        </div>
        {onAskQuestion && (
          <GlassButton
            onClick={(event) => { event.stopPropagation(); onAskQuestion(partner); }}
            style={{ position: 'relative', marginTop: 12, minHeight: 38, borderRadius: 18 }}
          >
            💬 Задать вопрос
          </GlassButton>
        )}
      </div>
    </GlassCard>
  );
}

export function OffersPage({ variant = 'v2', partners = [], onBack, onOpenPartner, onAskQuestion, desktopOverview = null, desktopMode = false }) {
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

  if (variant === 'v2' && desktopMode) {
    const selectStyle = { height: 42, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, outline: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 760, padding: '0 12px', minWidth: 150 };
    const searchStyle = { height: 42, borderRadius: 18, border: '1px solid rgba(var(--apg2-glass-a,255,255,255),0.16)', background: 'rgba(var(--apg2-glass-a,255,255,255),0.08)', color: APG2_PROFILE.text, outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 720, padding: '0 14px', minWidth: 260, width: '100%', boxSizing: 'border-box' };
    const activeList = isSearching ? searchResults : filtered;
    const featuredOffer = withOffers[0] || null;
    const kpiItems = [
      withOffers.length > 0 && { id: 'offers', label: 'Акций', value: withOffers.length, tone: 'gold', icon: '🎁' },
      partners.length > 0 && { id: 'partners', label: 'Партнёров', value: partners.length, icon: '🏢' },
      categories.length > 0 && { id: 'categories', label: 'Категорий', value: categories.length, icon: '⌘' },
      search.trim() && { id: 'search', label: 'Найдено', value: searchResults.length, icon: '⌕' },
    ].filter(Boolean);

    return (
      <DesktopSectionShell
        maxWidth={1460}
        topOverview={desktopOverview ? <DesktopTopOverview {...desktopOverview} activeSection="offers" /> : null}
        header={
          <DesktopHeader
            title="Акции"
            subtitle={`${withOffers.length} предложений · ${partners.length} партнёров`}
            kicker="Выгода АПГ"
            onBack={onBack}
            actions={
              <>
                <GlassButton onClick={() => inputRef.current?.focus()} style={{ minHeight: 40, borderRadius: 16 }}>Поиск</GlassButton>
                <GlassButton onClick={() => { setSearch(''); setActiveCategory('all'); }} tone="gold" style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>Сбросить</GlassButton>
              </>
            }
          />
        }
        toolbar={
          <DesktopToolbar
            leading={<input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти партнёра или акцию" aria-label="Поиск акций" style={searchStyle} />}
            trailing={
              <select aria-label="Категория акции" value={activeCategory} onChange={event => setActiveCategory(event.target.value)} style={selectStyle}>
                <option value="all">Все · {withOffers.length}</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.label} · {cat.count}</option>)}
              </select>
            }
          />
        }
        kpi={<DesktopKpiStrip items={kpiItems} />}
        info={
          <DesktopSidebarCard title="Акция дня" subtitle={featuredOffer?.name || 'Предложения АПГ'}>
            {featuredOffer ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ color: APG2_PROFILE.text, fontSize: 18, lineHeight: '22px', fontWeight: 880 }}>{featuredOffer.offer}</div>
                <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>{featuredOffer.name}</div>
                {featuredOffer.categoryLabel && <GlassBadge>{featuredOffer.categoryLabel}</GlassBadge>}
                <GlassButton tone="gold" onClick={() => onOpenPartner?.(featuredOffer)} style={{ minHeight: 40, borderRadius: 16, color: '#17120a' }}>Открыть партнёра</GlassButton>
              </div>
            ) : <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13 }}>Партнёры АПГ скоро добавят специальные предложения.</div>}
          </DesktopSidebarCard>
        }
      >
        <DesktopSectionTitle title={isSearching ? `Найдено ${searchResults.length}` : `${filtered.length} предложений`} subtitle={isSearching ? `По запросу: ${search.trim()}` : 'Актуальные предложения партнёров'} />
        {withOffers.length === 0 ? (
          <DesktopEmptyState icon="🎁" title="Акции скоро появятся" text="Партнёры АПГ готовят специальные предложения." />
        ) : activeList.length === 0 ? (
          <DesktopEmptyState icon="🔍" title="Ничего не найдено" text="Попробуйте другой запрос или сбросьте фильтры." action={<GlassButton onClick={() => { setSearch(''); setActiveCategory('all'); }} tone="gold" style={{ color: '#17120a' }}>Сбросить</GlassButton>} />
        ) : (
          <DesktopContentGrid min={260} gap={14}>
            {activeList.map((p, i) => <OfferCardV2 key={p.id} partner={p} index={i} onOpenPartner={onOpenPartner} onAskQuestion={onAskQuestion} />)}
          </DesktopContentGrid>
        )}
      </DesktopSectionShell>
    );
  }

  if (variant === 'v2') {
    return (
      <GlassPanel>
        <ScreenHeader title="Акции" subtitle={`${withOffers.length} предложений · ${partners.length} партнеров`} kicker="Выгода АПГ" onBack={onBack} />
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <StatPill label="акций" value={withOffers.length} tone="gold" />
          <StatPill label="партнеров" value={partners.length} />
        </div>
        <GlassCard style={{ borderRadius: 28, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ color: APG2_PROFILE.textMuted }}>🔍</span>
          <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти партнера или акцию" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: APG2_PROFILE.text, fontSize: 14 }} />
          {isSearching && <button onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: APG2_PROFILE.textSoft, fontSize: 16 }}>✕</button>}
        </GlassCard>
        {!isSearching && categories.length > 1 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px 14px', padding: '0 16px', WebkitOverflowScrolling: 'touch' }}>
            <GlassButton onClick={() => setActiveCategory('all')} tone={activeCategory === 'all' ? 'gold' : 'glass'} style={{ minHeight: 38, borderRadius: 18, padding: '8px 12px', color: activeCategory === 'all' ? '#17120a' : APG2_PROFILE.text }}>Все · {withOffers.length}</GlassButton>
            {categories.map(cat => <GlassButton key={cat.id} onClick={() => setActiveCategory(cat.id)} tone={activeCategory === cat.id ? 'gold' : 'glass'} style={{ minHeight: 38, borderRadius: 18, padding: '8px 12px', whiteSpace: 'nowrap', color: activeCategory === cat.id ? '#17120a' : APG2_PROFILE.text }}>{cat.label} · {cat.count}</GlassButton>)}
          </div>
        )}
        {isSearching ? (
          searchResults.length === 0 ? <EmptyStateV2 icon="🔍" title="Ничего не найдено" text="Попробуйте другой запрос или сбросьте поиск." action={<GlassButton onClick={() => setSearch('')} tone="gold" style={{ color: '#17120a' }}>Сбросить</GlassButton>} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {searchResults.map((p, i) => <GlassListItem key={p.id} icon={p.logoUrl ? <img src={p.logoUrl} alt="" style={{ width: 42, height: 42, borderRadius: 16, objectFit: 'cover' }} /> : (p.emoji ?? '🏪')} title={p.name} subtitle={p.offer || p.categoryLabel || 'Партнер АПГ'} meta="›" onClick={() => onOpenPartner(p)} style={{ animation: `fadeInUp 0.32s ease ${i * 0.035}s both` }} />)}
            </div>
          )
        ) : withOffers.length === 0 ? (
          <EmptyStateV2 icon="🎁" title="Акции скоро появятся" text="Партнеры АПГ готовят специальные предложения." />
        ) : filtered.length === 0 ? (
          <EmptyStateV2 icon="🔍" title="В категории пока пусто" text="Можно вернуться ко всем предложениям." action={<GlassButton onClick={() => setActiveCategory('all')} tone="gold" style={{ color: '#17120a' }}>Показать все</GlassButton>} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{filtered.map((p, i) => <OfferCardV2 key={p.id} partner={p} index={i} onOpenPartner={onOpenPartner} onAskQuestion={onAskQuestion} />)}</div>
        )}
      </GlassPanel>
    );
  }

  return (
    <>
      {/* Кастомный хедер */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: T.headerBg, backdropFilter: 'blur(36px) saturate(2)', WebkitBackdropFilter: 'blur(36px) saturate(2)',
        borderBottom: '1px solid var(--c-header-border, rgba(255,255,255,0.1))',
        boxShadow: 'inset 0 -1px 0 var(--c-border, rgba(0,0,0,0.12))',
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
              <OfferCard key={p.id} partner={p} index={i} onOpenPartner={onOpenPartner} onAskQuestion={onAskQuestion} />
            ))
          )
        )}
      </div>
    </>
  );
}
