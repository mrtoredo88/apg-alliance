import React from 'react';
import { Panel, PanelHeader, PanelHeaderBack } from '@vkontakte/vkui';

const T = {
  bg:      '#0F0F1A',
  surface: '#1A1A2E',
  border:  'rgba(255,255,255,0.07)',
  gold:    '#C9A84C',
  goldL:   '#E8C97A',
  textPri: '#F0F0F0',
  textSec: 'rgba(240,240,240,0.5)',
};

function OfferCard({ partner, onOpenPartner, index }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 20, padding: 16, marginBottom: 12,
      border: `1px solid ${T.border}`,
      animation: 'fadeInUp 0.4s ease both',
      animationDelay: `${index * 0.07}s`,
    }}>
      {/* Партнёр */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {partner.logoUrl
          ? <img src={partner.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${T.border}`, flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
          : <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.gold + '18', border: `2px solid ${T.gold}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{partner.emoji ?? '🏪'}</div>
        }
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.textPri }}>{partner.name}</div>
          {partner.categoryLabel && <div style={{ fontSize: 11, color: T.gold, marginTop: 2 }}>{partner.categoryLabel}</div>}
        </div>
      </div>

      {/* Акция */}
      <div style={{
        background: `linear-gradient(135deg, ${T.gold}18, ${T.goldL}08)`,
        border: `1px solid ${T.gold}35`, borderRadius: 14,
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
  const withOffers = partners.filter(p => p.offer?.trim());

  return (
    <Panel id="offers">
      <PanelHeader before={<PanelHeaderBack onClick={onBack} />}>
        Акции и предложения
      </PanelHeader>

      <div style={{ background: T.bg, minHeight: '100%', padding: '8px 16px 24px' }}>

        {withOffers.length === 0 ? (
          <div style={{ paddingTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <div style={{ animation: 'float 3s ease-in-out infinite' }}>
              <svg width="90" height="90" viewBox="0 0 90 90" fill="none">
                <rect x="20" y="30" width="50" height="40" rx="10" fill="rgba(201,168,76,0.07)" stroke="rgba(201,168,76,0.22)" strokeWidth="1.5"/>
                <rect x="20" y="30" width="50" height="14" rx="10" fill="rgba(201,168,76,0.12)"/>
                <rect x="20" y="37" width="50" height="7" fill="rgba(201,168,76,0.12)"/>
                <line x1="45" y1="18" x2="45" y2="70" stroke="rgba(201,168,76,0.4)" strokeWidth="1.5" strokeDasharray="3 2"/>
                <circle cx="45" cy="18" r="5" fill="rgba(201,168,76,0.6)"/>
                <circle cx="28" cy="55" r="3" fill="rgba(201,168,76,0.25)"/>
                <circle cx="45" cy="55" r="3" fill="rgba(201,168,76,0.25)"/>
                <circle cx="62" cy="55" r="3" fill="rgba(201,168,76,0.25)"/>
              </svg>
            </div>
            <div>
              <div style={{ color: T.textPri, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Акций пока нет</div>
              <div style={{ color: T.textSec, fontSize: 13, lineHeight: '19px' }}>
                Партнёры АПГ скоро добавят специальные предложения
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: T.textSec, marginBottom: 14, marginTop: 4 }}>
              {withOffers.length} {withOffers.length === 1 ? 'предложение' : withOffers.length < 5 ? 'предложения' : 'предложений'} для участников АПГ
            </div>
            {withOffers.map((p, i) => (
              <OfferCard key={p.id} partner={p} index={i} onOpenPartner={onOpenPartner} />
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
