import React, { useMemo, useState } from 'react';
import guides from './assistant/guides.json';
import faq from './assistant/faq.json';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel } from './components/Apg2ProfileGlass.jsx';
import { isVK } from './vk.js';

function normalize(value) {
  return String(value || '').toLowerCase().replace(/ё/g, 'е').trim();
}

function scoreItem(query, fields) {
  const q = normalize(query);
  if (!q) return 1;
  const source = normalize(fields.join(' '));
  const words = q.split(/\s+/).filter(Boolean);
  return words.reduce((sum, word) => sum + (source.includes(word) ? 2 : 0), 0) + (source.includes(q) ? 4 : 0);
}

function VisualToken({ visual, emoji }) {
  return (
    <span style={{ width: 42, height: 42, borderRadius: 18, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontSize: 20, color: APG2_PROFILE.gold, background: APG2_PROFILE.goldSoft, border: '1px solid rgba(215,184,106,0.22)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}>
      {emoji || ({ account: '👤', telegram: '✈️', city: '🏙', reward: '🔑', visit: '☕', qr: '◎', camera: '📷', success: '✓', calendar: '📅', ticket: '🎟', check: '✓', place: '⌖', card: '▣', news: '📰', media: '◉', expert: '🎓', profile: '👤', message: '💬', gift: '🎁', support: '♡' }[visual] ?? '✦')}
    </span>
  );
}

function GuideCard({ guide, active, onClick }) {
  return (
    <GlassCard onClick={onClick} style={{ borderRadius: 24, padding: 13, display: 'flex', gap: 12, alignItems: 'center', border: active ? '1px solid rgba(215,184,106,0.38)' : APG2_PROFILE.glass.border }}>
      <VisualToken emoji={guide.emoji} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: APG2_PROFILE.text, fontSize: 14.5, lineHeight: '19px', fontWeight: 860, overflowWrap: 'anywhere' }}>{guide.title}</div>
        <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '17px', marginTop: 3 }}>{guide.description}</div>
      </div>
    </GlassCard>
  );
}

export function ReferencePage({ onBack, onOpenLoki, onOpenPanel }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(guides[0]?.id ?? '');
  const selectedGuide = guides.find(item => item.id === selectedId) ?? guides[0];
  const isVkShell = isVK();

  const filteredGuides = useMemo(() => {
    const q = normalize(query);
    return guides
      .map(guide => ({
        guide,
        score: scoreItem(q, [guide.title, guide.description, ...(guide.keywords || []), ...guide.steps.map(step => `${step.title} ${step.text}`)]),
      }))
      .filter(item => !q || item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.guide);
  }, [query]);

  const filteredFaq = useMemo(() => {
    const q = normalize(query);
    return faq
      .map(item => ({ item, score: scoreItem(q, [item.question, item.answer, ...(item.keywords || [])]) }))
      .filter(entry => !q || entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)
      .slice(0, q ? 8 : 4);
  }, [query]);

  const quickActions = [
    { label: 'Партнёры', panel: 'offers' },
    { label: 'Эксперты', panel: 'experts' },
    { label: 'События', panel: 'events' },
    { label: 'Призы', panel: 'rewards' },
  ];

  return (
    <GlassPanel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <GlassButton onClick={onBack} style={{ width: 44, minHeight: 44, borderRadius: 18, padding: 0 }}>‹</GlassButton>
        <div style={{ flex: 1, minWidth: 0 }}>
          <GlassBadge tone="gold" style={{ marginBottom: 7 }}>{isVkShell ? 'VK Mini App' : 'АПГ'}</GlassBadge>
          <div style={{ color: APG2_PROFILE.text, fontSize: 27, lineHeight: '31px', fontWeight: 940 }}>Справочник АПГ</div>
          <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '19px', marginTop: 4 }}>Короткие ответы, инструкции и безопасные шаги внутри одной экосистемы.</div>
        </div>
      </div>

      <GlassCard style={{ borderRadius: 30, padding: 14, marginBottom: 14 }}>
        <GlassInput
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск: ключи, QR, партнёры, розыгрыш..."
          aria-label="Поиск по справочнику"
          style={{ marginBottom: 10 }}
        />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 2 }}>
          {quickActions.map(action => (
            <GlassButton key={action.panel} onClick={() => onOpenPanel?.(action.panel)} style={{ minHeight: 38, flex: '0 0 auto', borderRadius: 999, padding: '8px 12px' }}>{action.label}</GlassButton>
          ))}
          <GlassButton onClick={onOpenLoki} tone="gold" style={{ minHeight: 38, flex: '0 0 auto', borderRadius: 999, padding: '8px 12px', color: '#17120a' }}>Спросить Локи</GlassButton>
        </div>
      </GlassCard>

      <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
        {filteredGuides.length ? filteredGuides.map(guide => (
          <GuideCard key={guide.id} guide={guide} active={guide.id === selectedGuide?.id} onClick={() => setSelectedId(guide.id)} />
        )) : (
          <GlassCard style={{ borderRadius: 26, padding: 18, textAlign: 'center' }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 840 }}>Ничего не найдено</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13, lineHeight: '19px', marginTop: 5 }}>Попробуйте спросить Локи обычными словами.</div>
          </GlassCard>
        )}
      </div>

      {selectedGuide && (
        <GlassCard style={{ borderRadius: 34, padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
            <VisualToken emoji={selectedGuide.emoji} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: APG2_PROFILE.text, fontSize: 21, lineHeight: '25px', fontWeight: 920 }}>{selectedGuide.title}</div>
              <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '19px', marginTop: 3 }}>{selectedGuide.description}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {selectedGuide.steps.map((step, index) => (
              <div key={`${selectedGuide.id}-${step.title}`} style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: 12, alignItems: 'start' }}>
                <VisualToken visual={step.visual} />
                <div style={{ minWidth: 0, paddingBottom: index === selectedGuide.steps.length - 1 ? 0 : 10, borderBottom: index === selectedGuide.steps.length - 1 ? 'none' : '1px solid rgba(var(--apg2-glass-a,255,255,255),0.10)' }}>
                  <div style={{ color: APG2_PROFILE.gold, fontSize: 11, lineHeight: '15px', fontWeight: 840, textTransform: 'uppercase', letterSpacing: 0.8 }}>Шаг {index + 1}</div>
                  <div style={{ color: APG2_PROFILE.text, fontSize: 15.5, lineHeight: '20px', fontWeight: 860, marginTop: 2 }}>{step.title}</div>
                  <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13.5, lineHeight: '20px', marginTop: 4, overflowWrap: 'anywhere' }}>{step.text}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div style={{ color: APG2_PROFILE.gold, fontSize: 12, lineHeight: '16px', fontWeight: 840, letterSpacing: 1, textTransform: 'uppercase', margin: '2px 0 10px' }}>Частые вопросы</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {filteredFaq.map(item => (
          <GlassCard key={item.id} style={{ borderRadius: 24, padding: 14 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 14.5, lineHeight: '19px', fontWeight: 860, marginBottom: 6 }}>{item.question}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>{item.answer}</div>
          </GlassCard>
        ))}
      </div>
    </GlassPanel>
  );
}
