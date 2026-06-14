import React, { useState, useMemo } from 'react';
import { Panel } from '@vkontakte/vkui';

const T = {
  bg:      '#0F0F1A',
  surface: '#1A1A2E',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.5)',
};

const GLASS = {
  background: 'rgba(255,255,255,0.05)',
  border: `1px solid rgba(255,255,255,0.08)`,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
};

function OfferCard({ partner, onOpenPartner, index }) {
  return (
    <div style={{
      ...GLASS,
      borderRadius: 20, padding: 16, marginBottom: 12,
      animation: 'fadeInUp 0.4s ease both',
      animationDelay: `${index * 0.06}s`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {partner.logoUrl
          ? <img src={partner.logoUrl} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid rgba(201,168,76,0.25)`, flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
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
        background: `linear-gradient(135deg, ${T.gold}14, ${T.goldL}08)`,
        border: `1px solid ${T.gold}30`, borderRadius: 14,
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

export function OffersPage({ partners = [], onBack, onOpenPartner }) {
  const [activeCategory, setActiveCategory] = useState('all');

  const withOffers = useMemo(() => partners.filter(p => p.offer?.trim()), [partners]);

  const categories = useMemo(() => {
    const counts = {};
    withOffers.forEach(p => {
      const cat = p.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const labels = {
      food:     '🍽️ Еда',
      beauty:   '💅 Красота',
      health:   '💊 Здоровье',
      sport:    '🏋️ Спорт',
      retail:   '🛍️ Магазины',
      services: '🔧 Услуги',
      other:    '📦 Прочее',
    };
    return Object.entries(counts).map(([id, count]) => ({
      id,
      label: labels[id] ?? id,
      count,
    }));
  }, [withOffers]);

  const filtered = useMemo(() =>
    activeCategory === 'all'
      ? withOffers
      : withOffers.filter(p => (p.category || 'other') === activeCategory),
    [withOffers, activeCategory]
  );

  return (
    <Panel id="offers">
      {/* Кастомный хедер */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(15,15,26,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, color: T.textPri, flexShrink: 0,
          }}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.textPri, lineHeight: 1.2 }}>
              ✦ Акции и предложения
            </div>
            {withOffers.length > 0 && (
              <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>
                {withOffers.length} {withOffers.length === 1 ? 'предложение' : withOffers.length < 5 ? 'предложения' : 'предложений'}
              </div>
            )}
          </div>
        </div>

        {/* Фильтр по категориям */}
        {categories.length > 1 && (
          <div style={{ display: 'flex', gap: 8, paddingBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setActiveCategory('all')}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: activeCategory === 'all' ? T.gold : 'rgba(255,255,255,0.07)',
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
                  background: activeCategory === cat.id ? T.gold : 'rgba(255,255,255,0.07)',
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

      <div style={{ background: T.bg, minHeight: '100%', padding: '12px 16px 90px' }}>
        {withOffers.length === 0 ? (
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
        )}
      </div>
    </Panel>
  );
}
